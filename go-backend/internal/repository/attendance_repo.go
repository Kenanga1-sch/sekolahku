package repository

import (
	"database/sql"
	"errors"
	"math"
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

func (r *AttendanceRepository) GetStats() (*models.AttendanceStats, error) {
	today := time.Now().Format("2006-01-02")
	
	var stats models.AttendanceStats
	
	// 1. Total Students
	err := r.DB.QueryRow("SELECT COUNT(*) FROM students WHERE status = 'active'").Scan(&stats.TotalStudents)
	if err != nil { return nil, err }
	
	// 2. Open Sessions
	err = r.DB.QueryRow("SELECT COUNT(*) FROM attendance_sessions WHERE date = ? AND status = 'open'", today).Scan(&stats.OpenSessions)
	if err != nil { return nil, err }
	
	// 3. Daily Stats
	err = r.DB.QueryRow(`
		SELECT 
			COUNT(CASE WHEN status = 'hadir' THEN 1 END),
			COUNT(CASE WHEN status = 'sakit' THEN 1 END),
			COUNT(CASE WHEN status = 'izin' THEN 1 END),
			COUNT(CASE WHEN status = 'alpha' THEN 1 END)
		FROM attendance_records 
		WHERE session_id IN (SELECT id FROM attendance_sessions WHERE date = ?)
	`, today).Scan(&stats.Stats.Hadir, &stats.Stats.Sakit, &stats.Stats.Izin, &stats.Stats.Alpha)
	if err != nil { return nil, err }
	
	stats.Stats.BelumAbsen = stats.TotalStudents - (stats.Stats.Hadir + stats.Stats.Sakit + stats.Stats.Izin + stats.Stats.Alpha)
	if stats.Stats.BelumAbsen < 0 { stats.Stats.BelumAbsen = 0 }
	
	if stats.TotalStudents > 0 {
		stats.Stats.PersenKehadiran = math.Round(float64(stats.Stats.Hadir) / float64(stats.TotalStudents) * 100)
	}

	return &stats, nil
}

func (r *AttendanceRepository) GetSessions(date, status string) ([]models.AttendanceSession, error) {
	query := "SELECT id, date, class_name, teacher_name, status, notes, created_at FROM attendance_sessions WHERE 1=1"
	args := []interface{}{}
	
	if date != "" {
		query += " AND date = ?"
		args = append(args, date)
	}
	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}
	
	query += " ORDER BY created_at DESC"
	
	rows, err := r.DB.Query(query, args...)
	if err != nil { return nil, err }
	defer rows.Close()
	
	sessions := []models.AttendanceSession{}
	for rows.Next() {
		var s models.AttendanceSession
		var crAt sql.NullInt64
		err = rows.Scan(&s.ID, &s.Date, &s.ClassName, &s.TeacherName, &s.Status, &s.Notes, &crAt)
		if err != nil { return nil, err }
		
		t := ToTime(crAt)
		s.CreatedAt = &t
		
		// Get count
		r.DB.QueryRow("SELECT COUNT(*) FROM attendance_records WHERE session_id = ?", s.ID).Scan(&s.RecordCount)
		
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func (r *AttendanceRepository) CreateSession(req models.CreateAttendanceSessionRequest) (string, error) {
	today := time.Now().Format("2006-01-02")
	
	// Check for existing session same class same day
	var existId string
	err := r.DB.QueryRow("SELECT id FROM attendance_sessions WHERE date = ? AND class_name = ? AND status = 'open'", today, req.ClassName).Scan(&existId)
	if err == nil {
		return existId, errors.New("CONFLICT") 
	}

	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	
	_, err = r.DB.Exec(`
		INSERT INTO attendance_sessions (id, date, class_name, teacher_name, status, notes, opened_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)
	`, id, today, req.ClassName, req.TeacherName, req.Notes, now, now, now)
	
	return id, err
}

func (r *AttendanceRepository) GetSessionByID(id string) (*models.AttendanceSession, error) {
	var s models.AttendanceSession
	var crAt, upAt, opAt, clAt sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT id, date, class_name, teacher_name, status, notes, opened_at, closed_at, created_at, updated_at 
		FROM attendance_sessions WHERE id = ?
	`, id).Scan(&s.ID, &s.Date, &s.ClassName, &s.TeacherName, &s.Status, &s.Notes, &opAt, &clAt, &crAt, &upAt)
	if err != nil { return nil, err }
	
	t := ToTime(crAt); s.CreatedAt = &t
	u := ToTime(upAt); s.UpdatedAt = &u
	if opAt.Valid { ot := ToTime(opAt); s.OpenedAt = &ot }
	if clAt.Valid { ct := ToTime(clAt); s.ClosedAt = &ct }

	// Get Records
	rows, err := r.DB.Query(`
		SELECT ar.id, ar.session_id, ar.student_id, ar.status, ar.check_in_time, ar.record_method, s.full_name, s.nis, s.nisn, s.photo
		FROM attendance_records ar
		JOIN students s ON ar.student_id = s.id
		WHERE ar.session_id = ?
		ORDER BY ar.created_at DESC
	`, id)
	
	recordedIds := []string{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var rec models.AttendanceRecord
			var stu models.Student
			var ciTime sql.NullInt64
			var nis, nisn, photo sql.NullString
			
			rows.Scan(&rec.ID, &rec.SessionID, &rec.StudentID, &rec.Status, &ciTime, &rec.RecordMethod, &stu.FullName, &nis, &nisn, &photo)
			
			if ciTime.Valid { ct := ToTime(ciTime); rec.CheckInTime = &ct }
			if nis.Valid { stu.NIS = &nis.String }
			if nisn.Valid { stu.NISN = &nisn.String }
			if photo.Valid { stu.Photo = &photo.String }
			stu.ID = rec.StudentID
			
			rec.Student = &stu
			s.Records = append(s.Records, rec)
			recordedIds = append(recordedIds, rec.StudentID)
		}
	}

	// 3. Get All Students in Class
	sRows, err := r.DB.Query("SELECT id, full_name, nis, nisn, photo FROM students WHERE class_name = ? AND status = 'active'", s.ClassName)
	if err == nil {
		defer sRows.Close()
		for sRows.Next() {
			var stu models.Student
			var nis, nisn, photo sql.NullString
			sRows.Scan(&stu.ID, &stu.FullName, &nis, &nisn, &photo)
			if nis.Valid { stu.NIS = &nis.String }
			if nisn.Valid { stu.NISN = &nisn.String }
			if photo.Valid { stu.Photo = &photo.String }
			
			s.AllStudents = append(s.AllStudents, stu)
		}
	}
	
	s.RecordCount = len(s.Records)
	return &s, nil
}

func (r *AttendanceRepository) UpdateSessionStatus(id, status string) error {
	now := time.Now().UnixMilli()
	query := "UPDATE attendance_sessions SET status = ?, updated_at = ? WHERE id = ?"
	if status == "closed" {
		query = "UPDATE attendance_sessions SET status = ?, closed_at = ?, updated_at = ? WHERE id = ?"
		_, err := r.DB.Exec(query, status, now, now, id)
		return err
	}
	_, err := r.DB.Exec(query, status, now, id)
	return err
}

func (r *AttendanceRepository) RecordManual(req models.AttendanceManualRequest) error {
	// Check if exists
	var existId string
	err := r.DB.QueryRow("SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?", req.SessionID, req.StudentID).Scan(&existId)
	
	now := time.Now()
	nowMilli := now.UnixMilli()
	
	if err == nil {
		// Update
		_, err = r.DB.Exec("UPDATE attendance_records SET status = ?, updated_at = ? WHERE id = ?", req.Status, nowMilli, existId)
		return err
	}
	
	// Create
	_, err = r.DB.Exec(`
		INSERT INTO attendance_records (id, session_id, student_id, status, check_in_time, recorded_by, record_method, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 'admin', 'manual', ?, ?)
	`, cuid2.Generate(), req.SessionID, req.StudentID, req.Status, now, nowMilli, nowMilli)
	
	return err
}

func (r *AttendanceRepository) RecordQRScan(req models.AttendanceScanRequest) (map[string]interface{}, error) {
	tx, err := r.DB.Begin()
	if err != nil { return nil, err }
	defer tx.Rollback()

	// 1. Find student
	var studentId, studentName, className string
	var photo sql.NullString
	err = tx.QueryRow("SELECT id, full_name, class_name, photo FROM students WHERE id = ? OR qr_code = ? OR nisn = ? OR nis = ?", req.QRCode, req.QRCode, req.QRCode, req.QRCode).Scan(&studentId, &studentName, &className, &photo)
	if err != nil {
		return nil, errors.New("Siswa tidak ditemukan")
	}

	// 2. Resolve Session
	var sessionId string
	if req.SessionID != nil && *req.SessionID != "" {
		sessionId = *req.SessionID
	} else {
		today := time.Now().Format("2006-01-02")
		err = tx.QueryRow("SELECT id FROM attendance_sessions WHERE date = ? AND class_name = ? AND status = 'open'", today, className).Scan(&sessionId)
		if err != nil {
			return nil, errors.New("Tidak ada sesi aktif untuk kelas ini")
		}
	}

	// 3. Check duplicate
	var existId string
	err = tx.QueryRow("SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?", sessionId, studentId).Scan(&existId)
	if err == nil {
		// We return the student data even if error so UI can show who it was
		res := map[string]interface{}{
			"student": map[string]interface{}{
				"fullName":  studentName,
				"className": className,
			},
		}
		if photo.Valid { res["student"].(map[string]interface{})["photo"] = photo.String }
		return res, errors.New("Siswa sudah diabsen")
	}

	// 4. Insert
	recordId := cuid2.Generate()
	now := time.Now()
	nowMilli := now.UnixMilli()
	status := req.Status
	if status == "" { status = "hadir" }

	_, err = tx.Exec(`
		INSERT INTO attendance_records (id, session_id, student_id, status, check_in_time, recorded_by, record_method, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 'qr_scan', ?, ?)
	`, recordId, sessionId, studentId, status, now, req.RecordedBy, nowMilli, nowMilli)
	if err != nil { return nil, err }

	if err := tx.Commit(); err != nil { return nil, err }

	res := map[string]interface{}{
		"student": map[string]interface{}{
			"id":        studentId,
			"fullName":  studentName,
			"className": className,
		},
	}
	if photo.Valid { res["student"].(map[string]interface{})["photo"] = photo.String }
	
	return res, nil
}

func (r *AttendanceRepository) ExportAttendance(startDate, endDate, className string) ([]models.AttendanceRecord, error) {
	query := `
		SELECT ar.id, ar.session_id, ar.student_id, ar.status, ar.check_in_time, ar.record_method, s.full_name, s.nis, s.nisn, asess.date, asess.class_name
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
	
	query += " ORDER BY asess.date DESC, s.full_name ASC"
	
	rows, err := r.DB.Query(query, args...)
	if err != nil { return nil, err }
	defer rows.Close()
	
	records := []models.AttendanceRecord{}
	for rows.Next() {
		var rec models.AttendanceRecord
		var stu models.Student
		var ciTime sql.NullInt64
		var nis, nisn sql.NullString
		var sessionDate, sessionClass string
		
		err = rows.Scan(&rec.ID, &rec.SessionID, &rec.StudentID, &rec.Status, &ciTime, &rec.RecordMethod, &stu.FullName, &nis, &nisn, &sessionDate, &sessionClass)
		if err != nil { return nil, err }
		
		if ciTime.Valid { ct := ToTime(ciTime); rec.CheckInTime = &ct }
		if nis.Valid { stu.NIS = &nis.String }
		if nisn.Valid { stu.NISN = &nisn.String }
		stu.ClassName = &sessionClass
		
		rec.Student = &stu
		rec.Notes = &sessionDate // Hijack notes for date in CSV
		
		records = append(records, rec)
	}
	return records, nil
}

