package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
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
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM attendance_sessions WHERE date = ? AND status = 'open'", today).Scan(&stats.OpenSessions); err != nil {
		return nil, err
	}

	err := r.DB.QueryRow(`
		SELECT
			COUNT(CASE WHEN status = 'hadir' THEN 1 END),
			COUNT(CASE WHEN status = 'sakit' THEN 1 END),
			COUNT(CASE WHEN status = 'izin' THEN 1 END),
			COUNT(CASE WHEN status = 'alpha' THEN 1 END)
		FROM attendance_records
		WHERE session_id IN (SELECT id FROM attendance_sessions WHERE date = ?)
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

func (r *AttendanceRepository) GetSessions(date, status string, page, perPage int) ([]models.AttendanceSession, int, error) {
	where := "1=1"
	args := []interface{}{}

	if date != "" {
		where += " AND date = ?"
		args = append(args, date)
	}
	if status != "" {
		where += " AND status = ?"
		args = append(args, status)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM attendance_sessions WHERE "+where, args...).Scan(&total)

	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	listArgs := append(args, perPage, offset)
	query := "SELECT id, date, COALESCE(class_id,''), class_name, COALESCE(academic_year,''), COALESCE(teacher_name, ''), status, COALESCE(notes, ''), created_at FROM attendance_sessions WHERE " + where + " ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?"

	rows, err := r.DB.Query(query, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	sessions := []models.AttendanceSession{}
	for rows.Next() {
		var s models.AttendanceSession
		var crAt sql.NullInt64
		if err := rows.Scan(&s.ID, &s.Date, &s.ClassID, &s.ClassName, &s.AcademicYear, &s.TeacherName, &s.Status, &s.Notes, &crAt); err != nil {
			return nil, 0, err
		}

		cTime := ToTime(crAt)
		s.CreatedAt = &cTime
		_ = r.DB.QueryRow("SELECT COUNT(*) FROM attendance_records WHERE session_id = ?", s.ID).Scan(&s.RecordCount)
		sessions = append(sessions, s)
	}

	return sessions, total, nil
}

func (r *AttendanceRepository) CreateSession(req models.CreateAttendanceSessionRequest) (string, error) {
	className := strings.TrimSpace(req.ClassName)
	if className == "" {
		return "", errors.New("Kelas harus dipilih")
	}

	today := time.Now().Format("2006-01-02")
	var existingID string
	err := r.DB.QueryRow("SELECT id FROM attendance_sessions WHERE date = ? AND class_name = ?", today, className).Scan(&existingID)
	if err == nil {
		return existingID, errors.New("CONFLICT")
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}

	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	teacherName := strings.TrimSpace(req.TeacherName)
	notes := strings.TrimSpace(req.Notes)

	// Resolve class_id and academic_year from student_classes
	classID := strings.TrimSpace(req.ClassID)
	var academicYear string
	if classID == "" && className != "" {
		r.DB.QueryRow("SELECT id, academic_year FROM student_classes WHERE name = ?", className).Scan(&classID, &academicYear)
	} else if classID != "" {
		r.DB.QueryRow("SELECT academic_year FROM student_classes WHERE id = ?", classID).Scan(&academicYear)
	}
	if academicYear == "" {
		// Fallback: get active academic year
		var activeYear string
		if err := r.DB.QueryRow("SELECT name FROM academic_years WHERE is_active = 1 LIMIT 1").Scan(&activeYear); err == nil {
			academicYear = activeYear
		}
	}

	_, err = r.DB.Exec(`
		INSERT INTO attendance_sessions (id, date, class_id, class_name, academic_year, teacher_name, status, notes, opened_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
	`, id, today, classID, className, academicYear, teacherName, notes, now, now, now)

	return id, err
}

func (r *AttendanceRepository) GetSessionByID(id string) (*models.AttendanceSession, error) {
	var s models.AttendanceSession
	var crAt, upAt, opAt, clAt sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT id, date, COALESCE(class_id, ''), class_name, COALESCE(academic_year, ''), COALESCE(teacher_name, ''), status, COALESCE(notes, ''), opened_at, closed_at, created_at, updated_at
		FROM attendance_sessions
		WHERE id = ?
	`, id).Scan(&s.ID, &s.Date, &s.ClassID, &s.ClassName, &s.AcademicYear, &s.TeacherName, &s.Status, &s.Notes, &opAt, &clAt, &crAt, &upAt)
	if err != nil {
		return nil, err
	}

	cTime := ToTime(crAt)
	s.CreatedAt = &cTime
	uTime := ToTime(upAt)
	s.UpdatedAt = &uTime
	if opAt.Valid {
		s.OpenedAt = SafeTime(opAt)
	}
	if clAt.Valid {
		s.ClosedAt = SafeTime(clAt)
	}

	rows, err := r.DB.Query(`
		SELECT ar.id, ar.session_id, ar.student_id, ar.status, ar.check_in_time, COALESCE(ar.recorded_by, ''), ar.record_method, ar.notes,
		       ar.created_at, ar.updated_at, s.full_name, s.nis, s.nisn, s.photo, s.class_name
		FROM attendance_records ar
		JOIN students s ON ar.student_id = s.id
		WHERE ar.session_id = ?
		ORDER BY ar.created_at DESC
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var rec models.AttendanceRecord
		var student models.Student
		var checkInRaw interface{}
		var notes, nis, nisn, photo, className sql.NullString
		var cr, up sql.NullInt64
		if err := rows.Scan(
			&rec.ID, &rec.SessionID, &rec.StudentID, &rec.Status, &checkInRaw, &rec.RecordedBy, &rec.RecordMethod, &notes,
			&cr, &up, &student.FullName, &nis, &nisn, &photo, &className,
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
		if className.Valid {
			student.ClassName = &className.String
		}

		rec.Student = &student
		s.Records = append(s.Records, rec)
	}

	sRows, err := r.DB.Query(`
		SELECT id, full_name, nis, nisn, photo, class_name
		FROM students
		WHERE class_name = ? AND (status = 'active' OR is_active = 1)
		ORDER BY full_name ASC
	`, s.ClassName)
	if err != nil {
		return nil, err
	}
	defer sRows.Close()

	for sRows.Next() {
		var student models.Student
		var nis, nisn, photo, className sql.NullString
		if err := sRows.Scan(&student.ID, &student.FullName, &nis, &nisn, &photo, &className); err != nil {
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
		if className.Valid {
			student.ClassName = &className.String
		}
		s.AllStudents = append(s.AllStudents, student)
	}

	s.RecordCount = len(s.Records)
	return &s, nil
}

func (r *AttendanceRepository) UpdateSessionStatus(id, status string) error {
	status = strings.ToLower(strings.TrimSpace(status))
	if status != "open" && status != "closed" {
		return errors.New("Status sesi tidak valid")
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var className, currentStatus string
	err = tx.QueryRow("SELECT class_name, status FROM attendance_sessions WHERE id = ?", id).Scan(&className, &currentStatus)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("Sesi tidak ditemukan")
		}
		return err
	}

	now := time.Now().UnixMilli()
	if status == "closed" {
		if currentStatus == "closed" {
			return tx.Commit()
		}
		if err := r.markMissingStudentsAlpha(tx, id, className, now); err != nil {
			return err
		}
		_, err = tx.Exec("UPDATE attendance_sessions SET status = ?, closed_at = ?, updated_at = ? WHERE id = ?", status, now, now, id)
	} else {
		_, err = tx.Exec("UPDATE attendance_sessions SET status = ?, closed_at = NULL, updated_at = ? WHERE id = ?", status, now, id)
	}
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *AttendanceRepository) markMissingStudentsAlpha(tx *sql.Tx, sessionID, className string, now int64) error {
	rows, err := tx.Query(`
		SELECT s.id
		FROM students s
		WHERE s.class_name = ? AND (s.status = 'active' OR s.is_active = 1)
		  AND NOT EXISTS (
			SELECT 1 FROM attendance_records ar
			WHERE ar.session_id = ? AND ar.student_id = s.id
		  )
	`, className, sessionID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var studentID string
		if err := rows.Scan(&studentID); err != nil {
			return err
		}
		_, err = tx.Exec(`
			INSERT INTO attendance_records (id, session_id, student_id, status, check_in_time, recorded_by, record_method, created_at, updated_at)
			VALUES (?, ?, ?, 'alpha', NULL, 'system', 'manual', ?, ?)
		`, cuid2.Generate(), sessionID, studentID, now, now)
		if err != nil {
			return err
		}
	}

	return rows.Err()
}

func (r *AttendanceRepository) RecordManual(req models.AttendanceManualRequest) error {
	status := normalizeAttendanceStatus(req.Status)
	if !isValidAttendanceStatus(status) {
		return errors.New("Status presensi tidak valid")
	}
	if strings.TrimSpace(req.SessionID) == "" || strings.TrimSpace(req.StudentID) == "" {
		return errors.New("Sesi dan siswa harus diisi")
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	sessionClass, err := validateOpenSession(tx, req.SessionID)
	if err != nil {
		return err
	}
	if err := validateStudentForSession(tx, req.StudentID, sessionClass); err != nil {
		return err
	}

	now := time.Now().UnixMilli()
	checkInTime := interface{}(now)
	if status == "alpha" {
		checkInTime = nil
	}

	var existingID string
	err = tx.QueryRow("SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?", req.SessionID, req.StudentID).Scan(&existingID)
	if err == nil {
		_, err = tx.Exec(`
			UPDATE attendance_records
			SET status = ?, check_in_time = ?, recorded_by = 'admin', record_method = 'manual', updated_at = ?
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

	_, err = tx.Exec(`
		INSERT INTO attendance_records (id, session_id, student_id, status, check_in_time, recorded_by, record_method, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 'admin', 'manual', ?, ?)
	`, cuid2.Generate(), req.SessionID, req.StudentID, status, checkInTime, now, now)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func validateOpenSession(tx *sql.Tx, sessionID string) (string, error) {
	var className, status string
	err := tx.QueryRow("SELECT class_name, status FROM attendance_sessions WHERE id = ?", sessionID).Scan(&className, &status)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", errors.New("Sesi tidak ditemukan")
		}
		return "", err
	}
	if status != "open" {
		return "", errors.New("Sesi presensi sudah ditutup")
	}
	return className, nil
}

func validateStudentForSession(tx *sql.Tx, studentID, sessionClass string) error {
	var className string
	err := tx.QueryRow(`
		SELECT COALESCE(class_name, '')
		FROM students
		WHERE id = ? AND (status = 'active' OR is_active = 1)
	`, studentID).Scan(&className)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("Siswa tidak ditemukan")
		}
		return err
	}
	if strings.TrimSpace(className) == "" {
		return errors.New("Siswa belum memiliki kelas")
	}
	if className != sessionClass {
		return fmt.Errorf("Siswa berada di kelas %s, bukan kelas %s", className, sessionClass)
	}
	return nil
}

func (r *AttendanceRepository) RecordQRScan(req models.AttendanceScanRequest) (*models.ScanResult, error) {
	status := normalizeAttendanceStatus(req.Status)
	if !isValidAttendanceStatus(status) {
		return nil, errors.New("Status presensi tidak valid")
	}

	qrCode := strings.TrimSpace(req.QRCode)
	if qrCode == "" {
		return nil, errors.New("QR code kosong")
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
		return nil, errors.New("Siswa tidak ditemukan")
	}
	if strings.TrimSpace(className) == "" {
		return nil, errors.New("Siswa belum memiliki kelas")
	}

	studentPayload := attendanceStudentPayload(studentID, studentName, className, photo)
	sessionID := ""
	if req.SessionID != nil && strings.TrimSpace(*req.SessionID) != "" {
		sessionID = strings.TrimSpace(*req.SessionID)
		sessionClass, err := validateOpenSession(tx, sessionID)
		if err != nil {
			return nil, err
		}
		if sessionClass != className {
			return &models.ScanResult{Student: studentPayload}, fmt.Errorf("Siswa berada di kelas %s, bukan kelas %s", className, sessionClass)
		}
	} else {
		today := time.Now().Format("2006-01-02")
		err = tx.QueryRow("SELECT id FROM attendance_sessions WHERE date = ? AND class_name = ? AND status = 'open'", today, className).Scan(&sessionID)
		if err != nil {
			return &models.ScanResult{Student: studentPayload}, errors.New("Tidak ada sesi aktif untuk kelas ini")
		}
	}

	var existingID string
	err = tx.QueryRow("SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?", sessionID, studentID).Scan(&existingID)
	if err == nil {
		return &models.ScanResult{Student: studentPayload}, errors.New("Siswa sudah diabsen")
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

	return report, nil
}

// GetStudentAttendanceSummary computes hadir/sakit/izin/alpha per academic year for a student
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
