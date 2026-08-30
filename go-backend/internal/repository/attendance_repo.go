package repository

import (
	"database/sql"
	"errors"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

var (
	ErrHoliday          = errors.New("hari ini libur, presensi tidak tersedia")
	ErrAlreadyRecorded  = errors.New("siswa sudah diabsen hari ini")
	ErrStudentNotFound  = errors.New("siswa tidak ditemukan")
	ErrNoClass          = errors.New("siswa belum memiliki kelas")
	ErrInvalidStatus    = errors.New("status presensi tidak valid")
)

type AttendanceRepository struct {
	DB *sql.DB
}

func NewAttendanceRepository(db *sql.DB) *AttendanceRepository {
	return &AttendanceRepository{DB: db}
}

func normalizeAttendanceStatus(status string) string {
	status = strings.ToLower(strings.TrimSpace(status))
	if status == "" {
		return "hadir"
	}
	return status
}

func isValidAttendanceStatus(status string) bool {
	switch status {
	case "hadir", "sakit", "izin", "alpha":
		return true
	default:
		return false
	}
}

func timeFromDB(value interface{}) *time.Time {
	if value == nil {
		return nil
	}
	switch v := value.(type) {
	case int64:
		return SafeTime(sql.NullInt64{Int64: v, Valid: true})
	case int:
		return SafeTime(sql.NullInt64{Int64: int64(v), Valid: true})
	case float64:
		return SafeTime(sql.NullInt64{Int64: int64(v), Valid: true})
	case []byte:
		return parseTimeString(string(v))
	case string:
		return parseTimeString(v)
	case time.Time:
		return &v
	default:
		return nil
	}
}

func parseTimeString(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	if parsed, err := strconv.ParseInt(value, 10, 64); err == nil {
		return SafeTime(sql.NullInt64{Int64: parsed, Valid: true})
	}
	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return &parsed
		}
	}
	return nil
}

func reportTimeString(t *time.Time) *string {
	if t == nil || t.IsZero() {
		return nil
	}
	value := t.Format("15:04:05")
	return &value
}

func (r *AttendanceRepository) GetStats() (*models.AttendanceStats, error) {
	today := time.Now().Format("2006-01-02")

	var stats models.AttendanceStats
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM students WHERE status = 'active' OR is_active = 1").Scan(&stats.TotalStudents); err != nil {
		return nil, err
	}

	err := r.DB.QueryRow(`
		SELECT
			COUNT(CASE WHEN ar.status = 'hadir' THEN 1 END),
			COUNT(CASE WHEN ar.status = 'sakit' THEN 1 END),
			COUNT(CASE WHEN ar.status = 'izin' THEN 1 END),
			COUNT(CASE WHEN ar.status = 'alpha' THEN 1 END)
		FROM attendance_records ar
		JOIN attendance_sessions s ON ar.session_id = s.id
		WHERE s.date = ?
	`, today).Scan(&stats.Stats.Hadir, &stats.Stats.Sakit, &stats.Stats.Izin, &stats.Stats.Alpha)
	if err != nil {
		return nil, err
	}

	stats.Stats.BelumAbsen = stats.TotalStudents - (stats.Stats.Hadir + stats.Stats.Sakit + stats.Stats.Izin + stats.Stats.Alpha)
	if stats.Stats.BelumAbsen < 0 {
		stats.Stats.BelumAbsen = 0
	}
	if stats.TotalStudents > 0 {
		stats.Stats.PersenKehadiran = math.Round(float64(stats.Stats.Hadir) / float64(stats.TotalStudents) * 100)
	}

	return &stats, nil
}

type DailyClassResult struct {
	Date        string                       `json:"date"`
	ClassName   string                       `json:"className"`
	IsHoliday   bool                         `json:"isHoliday"`
	HolidayReason string                     `json:"holidayReason,omitempty"`
	Students    []models.Student             `json:"students"`
	Records     []models.AttendanceRecord    `json:"records"`
}

func (r *AttendanceRepository) GetDailyClass(date, className string) (*DailyClassResult, error) {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	result := &DailyClassResult{
		Date:      date,
		ClassName: className,
	}

	result.IsHoliday, result.HolidayReason = IsHoliday(date)

	if result.IsHoliday {
		return result, nil
	}

	sRows, err := r.DB.Query(`
		SELECT id, full_name, nis, nisn, photo, class_name
		FROM students
		WHERE class_name = ? AND (status = 'active' OR is_active = 1)
		ORDER BY full_name ASC
	`, className)
	if err != nil {
		return nil, err
	}
	defer sRows.Close()

	for sRows.Next() {
		var student models.Student
		var nis, nisn, photo, clsName sql.NullString
		if err := sRows.Scan(&student.ID, &student.FullName, &nis, &nisn, &photo, &clsName); err != nil {
			return nil, err
		}
		if nis.Valid {
			student.NIS = &nis.String
		}
		if nisn.Valid {
			student.NISN = &nisn.String
		}
		if photo.Valid {
			student.Photo = &photo.String
		}
		if clsName.Valid {
			student.ClassName = &clsName.String
		}
		result.Students = append(result.Students, student)
	}

	// Get records for this date and class via session
	rows, err := r.DB.Query(`
		SELECT ar.id, ar.session_id, ar.student_id, ar.status, ar.check_in_time, COALESCE(ar.recorded_by, ''), ar.record_method, ar.notes,
			   ar.created_at, ar.updated_at, s.full_name, s.nis, s.nisn, s.photo, s.class_name
		FROM attendance_records ar
		JOIN attendance_sessions asess ON ar.session_id = asess.id
		JOIN students s ON ar.student_id = s.id
		WHERE asess.date = ? AND asess.class_name = ?
		ORDER BY ar.created_at DESC
	`, date, className)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var rec models.AttendanceRecord
		var student models.Student
		var checkInRaw interface{}
		var notes, nis, nisn, photo, clsName sql.NullString
		var cr, up sql.NullInt64
		if err := rows.Scan(
			&rec.ID, &rec.SessionID, &rec.StudentID, &rec.Status, &checkInRaw, &rec.RecordedBy, &rec.RecordMethod, &notes,
			&cr, &up, &student.FullName, &nis, &nisn, &photo, &clsName,
		); err != nil {
			return nil, err
		}
		rec.CheckInTime = timeFromDB(checkInRaw)
		if notes.Valid {
			rec.Notes = &notes.String
		}
		rec.CreatedAt = SafeTime(cr)
		rec.UpdatedAt = SafeTime(up)
		student.ID = rec.StudentID
		if nis.Valid {
			student.NIS = &nis.String
		}
		if nisn.Valid {
			student.NISN = &nisn.String
		}
		if photo.Valid {
			student.Photo = &photo.String
		}
		if clsName.Valid {
			student.ClassName = &clsName.String
		}
		rec.Student = &student
		result.Records = append(result.Records, rec)
	}

	if result.Students == nil {
		result.Students = []models.Student{}
	}
	if result.Records == nil {
		result.Records = []models.AttendanceRecord{}
	}

	return result, nil
}

func (r *AttendanceRepository) ensureSession(tx *sql.Tx, date, className string) (string, error) {
	var id string
	err := tx.QueryRow("SELECT id FROM attendance_sessions WHERE date = ? AND class_name = ?", date, className).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}

	// Resolve class_id and academic_year
	var classID, academicYear string
	tx.QueryRow("SELECT id, academic_year FROM student_classes WHERE name = ?", className).Scan(&classID, &academicYear)
	if academicYear == "" {
		var activeYear string
		if err := tx.QueryRow("SELECT name FROM academic_years WHERE is_active = 1 LIMIT 1").Scan(&activeYear); err == nil {
			academicYear = activeYear
		}
	}

	id = cuid2.Generate()
	now := time.Now().UnixMilli()
	_, err = tx.Exec(`
		INSERT INTO attendance_sessions (id, date, class_id, class_name, academic_year, status, opened_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)
	`, id, date, classID, className, academicYear, now, now, now)

	return id, err
}

func (r *AttendanceRepository) RecordManualV2(req models.AttendanceManualRequestV2) error {
	status := normalizeAttendanceStatus(req.Status)
	if !isValidAttendanceStatus(status) {
		return ErrInvalidStatus
	}
	date := strings.TrimSpace(req.Date)
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	className := strings.TrimSpace(req.ClassName)
	studentID := strings.TrimSpace(req.StudentID)
	if className == "" || studentID == "" {
		return errors.New("kelas dan siswa harus diisi")
	}

	if isHoliday, _ := IsHoliday(date); isHoliday {
		return ErrHoliday
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	sessionID, err := r.ensureSession(tx, date, className)
	if err != nil {
		return err
	}

	var existingID string
	err = tx.QueryRow("SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?", sessionID, studentID).Scan(&existingID)
	if err == nil {
		now := time.Now().UnixMilli()
		checkInTime := interface{}(now)
		if status == "alpha" {
			checkInTime = nil
		}
		_, err = tx.Exec(`
			UPDATE attendance_records
			SET status = ?, check_in_time = ?, updated_at = ?
			WHERE id = ?
		`, status, checkInTime, now, existingID)
		if err != nil {
			return err
		}
		return tx.Commit()
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	now := time.Now().UnixMilli()
	checkInTime := interface{}(now)
	if status == "alpha" {
		checkInTime = nil
	}
	_, err = tx.Exec(`
		INSERT INTO attendance_records (id, session_id, student_id, status, check_in_time, recorded_by, record_method, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 'admin', 'manual', ?, ?)
	`, cuid2.Generate(), sessionID, studentID, status, checkInTime, now, now)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *AttendanceRepository) RecordQRScanV2(req models.AttendanceScanRequest) (*models.ScanResult, error) {
	status := normalizeAttendanceStatus(req.Status)
	if !isValidAttendanceStatus(status) {
		return nil, ErrInvalidStatus
	}

	qrCode := strings.TrimSpace(req.QRCode)
	if qrCode == "" {
		return nil, errors.New("QR code kosong")
	}

	date := time.Now().Format("2006-01-02")
	if isHoliday, _ := IsHoliday(date); isHoliday {
		return nil, ErrHoliday
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var studentID, studentName, className string
	var photo sql.NullString
	err = tx.QueryRow(`
		SELECT id, full_name, COALESCE(class_name, ''), photo
		FROM students
		WHERE (id = ? OR qr_code = ? OR nisn = ? OR nis = ?)
		  AND (status = 'active' OR is_active = 1)
	`, qrCode, qrCode, qrCode, qrCode).Scan(&studentID, &studentName, &className, &photo)
	if err != nil {
		return nil, ErrStudentNotFound
	}
	if strings.TrimSpace(className) == "" {
		return nil, ErrNoClass
	}

	studentPayload := attendanceStudentPayload(studentID, studentName, className, photo)

	sessionID, err := r.ensureSession(tx, date, className)
	if err != nil {
		return nil, err
	}

	var existingID string
	err = tx.QueryRow("SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?", sessionID, studentID).Scan(&existingID)
	if err == nil {
		return &models.ScanResult{Student: studentPayload}, ErrAlreadyRecorded
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	recordedBy := strings.TrimSpace(req.RecordedBy)
	if recordedBy == "" {
		recordedBy = "scanner"
	}
	now := time.Now().UnixMilli()
	_, err = tx.Exec(`
		INSERT INTO attendance_records (id, session_id, student_id, status, check_in_time, recorded_by, record_method, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 'qr_scan', ?, ?)
	`, cuid2.Generate(), sessionID, studentID, status, now, recordedBy, now, now)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &models.ScanResult{Student: studentPayload}, nil
}

func attendanceStudentPayload(id, fullName, className string, photo sql.NullString) map[string]interface{} {
	student := map[string]interface{}{
		"id":        id,
		"fullName":  fullName,
		"className": className,
	}
	if photo.Valid {
		student["photo"] = photo.String
	}
	return student
}

func (r *AttendanceRepository) ExportAttendance(startDate, endDate, className string) ([]models.AttendanceRecord, error) {
	report, err := r.GetAttendanceReport(startDate, endDate, className)
	if err != nil {
		return nil, err
	}

	records := make([]models.AttendanceRecord, 0, len(report.Records))
	for _, row := range report.Records {
		student := models.Student{
			ID:       row.StudentID,
			FullName: row.StudentName,
			NIS:      row.NIS,
			NISN:     row.NISN,
		}
		student.ClassName = &row.ClassName
		rec := models.AttendanceRecord{
			ID:           row.ID,
			StudentID:    row.StudentID,
			Status:       row.Status,
			RecordMethod: row.RecordMethod,
			Student:      &student,
			Notes:        &row.Date,
		}
		records = append(records, rec)
	}
	return records, nil
}

func (r *AttendanceRepository) GetAttendanceReport(startDate, endDate, className string) (*models.AttendanceReportResponse, error) {
	query := `
		SELECT ar.id, asess.date, asess.class_name, ar.student_id, s.full_name, s.nis, s.nisn,
		       ar.status, ar.check_in_time, ar.record_method
		FROM attendance_records ar
		JOIN students s ON ar.student_id = s.id
		JOIN attendance_sessions asess ON ar.session_id = asess.id
		WHERE asess.date BETWEEN ? AND ?
	`
	args := []interface{}{startDate, endDate}

	if className != "" && className != "all" {
		query += " AND asess.class_name = ?"
		args = append(args, className)
	}

	query += " ORDER BY asess.date DESC, asess.class_name ASC, s.full_name ASC"

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	report := &models.AttendanceReportResponse{
		Records: []models.AttendanceReportRecord{},
	}
	for rows.Next() {
		var row models.AttendanceReportRecord
		var nis, nisn sql.NullString
		var checkInRaw interface{}
		if err := rows.Scan(
			&row.ID, &row.Date, &row.ClassName, &row.StudentID, &row.StudentName, &nis, &nisn,
			&row.Status, &checkInRaw, &row.RecordMethod,
		); err != nil {
			return nil, err
		}
		if nis.Valid {
			row.NIS = &nis.String
		}
		if nisn.Valid {
			row.NISN = &nisn.String
		}
		row.CheckInTime = reportTimeString(timeFromDB(checkInRaw))

		switch row.Status {
		case "hadir":
			report.Summary.Hadir++
		case "sakit":
			report.Summary.Sakit++
		case "izin":
			report.Summary.Izin++
		case "alpha":
			report.Summary.Alpha++
		}
		report.Summary.Total++
		report.Records = append(report.Records, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Count effective days (excluding Sundays and national holidays)
	effectiveDays := 0
	start, _ := time.Parse("2006-01-02", startDate)
	end, _ := time.Parse("2006-01-02", endDate)
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		dateStr := d.Format("2006-01-02")
		isHoliday, _ := IsHoliday(dateStr)
		if !isHoliday {
			effectiveDays++
		}
	}
	report.EffectiveDays = effectiveDays

	return report, nil
}

func (r *AttendanceRepository) GetStudentAttendanceSummary(studentID string) ([]models.StudentAttendanceSummary, error) {
	rows, err := r.DB.Query(`
		SELECT COALESCE(s.academic_year, ''), ar.status, COUNT(*)
		FROM attendance_records ar
		JOIN attendance_sessions s ON ar.session_id = s.id
		WHERE ar.student_id = ?
		GROUP BY s.academic_year, ar.status
		ORDER BY s.academic_year DESC
	`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type key struct{ year, status string }
	raw := make(map[key]int)
	var years []string
	yearsSeen := make(map[string]bool)

	for rows.Next() {
		var year, status string
		var count int
		if err := rows.Scan(&year, &status, &count); err != nil {
			return nil, err
		}
		raw[key{year, status}] = count
		if !yearsSeen[year] {
			yearsSeen[year] = true
			years = append(years, year)
		}
	}

	var result []models.StudentAttendanceSummary
	for _, y := range years {
		s := models.StudentAttendanceSummary{AcademicYear: y}
		s.Hadir = raw[key{y, "hadir"}]
		s.Sakit = raw[key{y, "sakit"}]
		s.Izin = raw[key{y, "izin"}]
		s.Alpha = raw[key{y, "alpha"}]
		s.TotalDays = s.Hadir + s.Sakit + s.Izin + s.Alpha
		result = append(result, s)
	}

	if result == nil {
		result = []models.StudentAttendanceSummary{}
	}
	return result, nil
}