package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type AcademicAdvRepository struct {
	DB *sql.DB
}

func NewAcademicAdvRepository(db *sql.DB) *AcademicAdvRepository {
	return &AcademicAdvRepository{DB: db}
}

func (r *AcademicAdvRepository) RecordQRScan(req models.AttendanceScanRequest) (map[string]interface{}, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 1. Find student by QR
	var studentId, studentName, className string
	err = tx.QueryRow("SELECT id, full_name, class_name FROM students WHERE qr_code = ?", req.QRCode).Scan(&studentId, &studentName, &className)
	if err != nil {
		return nil, errors.New("student not found with this QR code")
	}

	// 2. Find active session
	var sessionId, sessionStatus, sessionDate, sessionClass string
	if req.SessionID != nil && *req.SessionID != "" {
		err = tx.QueryRow("SELECT id, status, date, class_name FROM attendance_sessions WHERE id = ?", *req.SessionID).Scan(&sessionId, &sessionStatus, &sessionDate, &sessionClass)
	} else {
		today := time.Now().Format("2006-01-02")
		err = tx.QueryRow("SELECT id, status, date, class_name FROM attendance_sessions WHERE date = ? AND class_name = ? AND status = 'open'", today, className).Scan(&sessionId, &sessionStatus, &sessionDate, &sessionClass)
	}

	if err != nil {
		return nil, errors.New("no active session found for this student's class")
	}

	if sessionStatus == "closed" {
		return nil, errors.New("session is already closed")
	}

	// 3. Check if already recorded
	var existingId string
	err = tx.QueryRow("SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?", sessionId, studentId).Scan(&existingId)
	if err == nil {
		return nil, errors.New("student already recorded in this session")
	}

	// 4. Create attendance record
	recordId := cuid2.Generate()
	now := time.Now()
	status := req.Status
	if status == "" {
		status = "hadir"
	}

	_, err = tx.Exec(`
		INSERT INTO attendance_records (id, session_id, student_id, status, check_in_time, recorded_by, record_method, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 'qr_scan', ?, ?)
	`, recordId, sessionId, studentId, status, now, req.RecordedBy, now, now)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"record": map[string]interface{}{
			"id": recordId,
		},
		"student": map[string]interface{}{
			"id":        studentId,
			"fullName":  studentName,
			"className": className,
		},
		"session": map[string]interface{}{
			"id":        sessionId,
			"className": sessionClass,
			"date":      sessionDate,
		},
	}, nil
}

// UpsertBulkGrades mimics app/api/kurikulum/grades/route.ts POST
func (r *AcademicAdvRepository) UpsertBulkGrades(req models.BulkGradeRequest) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now()

	for _, g := range req.Grades {
		var existId string
		err := tx.QueryRow(`
			SELECT id FROM student_grades 
			WHERE tp_id = ? AND student_id = ? AND type = ?
		`, req.TpID, g.StudentID, g.Type).Scan(&existId)

		switch err {
		case sql.ErrNoRows:
			// Insert
			_, err = tx.Exec(`
				INSERT INTO student_grades (id, tp_id, student_id, score, type, notes, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`, cuid2.Generate(), req.TpID, g.StudentID, g.Score, g.Type, g.Notes, now, now)
			if err != nil {
				return err
			}
		case nil:
			// Update
			_, err = tx.Exec(`
				UPDATE student_grades 
				SET score = ?, notes = ?, updated_at = ? 
				WHERE id = ?
			`, g.Score, g.Notes, now, existId)
			if err != nil {
				return err
			}
		default:
			return err
		}
	}

	return tx.Commit()
}
