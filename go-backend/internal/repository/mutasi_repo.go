package repository

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type MutasiRepository struct {
	DB *sql.DB
}

func NewMutasiRepository(db *sql.DB) *MutasiRepository {
	return &MutasiRepository{DB: db}
}

func (r *MutasiRepository) GetMutasiRequests(page, perPage int) ([]models.MutasiRequest, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM mutasi_requests").Scan(&total)

	query := `
		SELECT id, registration_number, student_name, nisn, gender, origin_school, 
		       origin_school_address, target_grade, target_class_id, parent_name, 
			   whatsapp_number, status_approval, status_delivery, created_at, updated_at
		FROM mutasi_requests
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`
	rows, err := r.DB.Query(query, perPage, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.MutasiRequest
	for rows.Next() {
		var m models.MutasiRequest
		var osa, tcid sql.NullString
		var crat, upat sql.NullInt64

		err := rows.Scan(
			&m.ID, &m.RegistrationNumber, &m.StudentName, &m.NISN, &m.Gender, &m.OriginSchool,
			&osa, &m.TargetGrade, &tcid, &m.ParentName, &m.WhatsappNumber,
			&m.StatusApproval, &m.StatusDelivery, &crat, &upat,
		)
		if err != nil {
			return nil, 0, err
		}

		if osa.Valid {
			m.OriginSchoolAddress = &osa.String
		}
		if tcid.Valid {
			m.TargetClassID = &tcid.String
		}

		m.CreatedAt = SafeTime(crat)
		m.UpdatedAt = SafeTime(upat)

		results = append(results, m)
	}
	if results == nil {
		results = []models.MutasiRequest{}
	}
	return results, total, nil
}

func (r *MutasiRepository) CreateMutasiRequest(m models.MutasiRequest) (string, error) {
	id := cuid2.Generate()
	regNum := r.GenerateRegistrationNumber()
	now := time.Now().UnixMilli()

	query := `
		INSERT INTO mutasi_requests (
			id, registration_number, student_name, nisn, gender, origin_school,
			origin_school_address, target_grade, parent_name, whatsapp_number,
			status_approval, status_delivery, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query,
		id, regNum, m.StudentName, m.NISN, m.Gender, m.OriginSchool,
		m.OriginSchoolAddress, m.TargetGrade, m.ParentName, m.WhatsappNumber,
		"pending", "unsent", now, now,
	)
	return regNum, err
}

func (r *MutasiRepository) UpdateMutasiRequestStatus(id string, status string, targetClassID *string) error {
	now := time.Now().UnixMilli()
	var query string
	var args []interface{}

	if targetClassID != nil && strings.TrimSpace(*targetClassID) != "" {
		query = "UPDATE mutasi_requests SET status_approval = ?, target_class_id = ?, updated_at = ? WHERE id = ?"
		args = append(args, status, strings.TrimSpace(*targetClassID), now, id)
	} else {
		query = "UPDATE mutasi_requests SET status_approval = ?, updated_at = ? WHERE id = ?"
		args = append(args, status, now, id)
	}

	res, err := r.DB.Exec(query, args...)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *MutasiRepository) GenerateRegistrationNumber() string {
	now := time.Now()
	datePart := now.Format("20060102")

	var count int
	// Count today's requests to increment
	// Using a simple count for now, in production might need a more robust sequence
	r.DB.QueryRow("SELECT COUNT(*) FROM mutasi_requests WHERE date(created_at/1000, 'unixepoch') = date('now')").Scan(&count)

	return fmt.Sprintf("MUT-%s-%03d", datePart, count+1)
}

func (r *MutasiRepository) GetMutasiOutRequests(page, perPage int) ([]models.MutasiOutRequest, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM mutasi_out_requests").Scan(&total)

	query := `
		SELECT m.id, m.student_id, s.full_name as student_name, s.nisn, s.class_name,
		       m.destination_school, m.reason, m.reason_detail, m.status,
			   m.downloaded_at, m.processed_at, m.completed_at, m.created_at, m.updated_at
		FROM mutasi_out_requests m
		JOIN students s ON m.student_id = s.id
		ORDER BY m.created_at DESC
		LIMIT ? OFFSET ?
	`
	rows, err := r.DB.Query(query, perPage, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.MutasiOutRequest
	for rows.Next() {
		var m models.MutasiOutRequest
		var rd sql.NullString
		var dat, pat, cat, crat, upat sql.NullInt64

		err := rows.Scan(
			&m.ID, &m.StudentID, &m.StudentName, &m.NISN, &m.ClassName,
			&m.DestinationSchool, &m.Reason, &rd, &m.Status,
			&dat, &pat, &cat, &crat, &upat,
		)
		if err != nil {
			return nil, 0, err
		}

		if rd.Valid {
			m.ReasonDetail = &rd.String
		}

		m.DownloadedAt = SafeTime(dat)
		m.ProcessedAt = SafeTime(pat)
		m.CompletedAt = SafeTime(cat)
		m.CreatedAt = SafeTime(crat)
		m.UpdatedAt = SafeTime(upat)

		results = append(results, m)
	}
	if results == nil {
		results = []models.MutasiOutRequest{}
	}
	return results, total, nil
}

func (r *MutasiRepository) GetMutasiOutByID(id string) (*models.MutasiOutRequest, error) {
	query := `
		SELECT m.id, m.student_id, s.full_name as student_name, s.nisn, s.class_name,
		       m.destination_school, m.reason, m.reason_detail, m.status,
			   m.downloaded_at, m.processed_at, m.completed_at, m.created_at, m.updated_at
		FROM mutasi_out_requests m
		JOIN students s ON m.student_id = s.id
		WHERE m.id = ?
	`
	var m models.MutasiOutRequest
	var rd sql.NullString
	var dat, pat, cat, crat, upat sql.NullInt64

	err := r.DB.QueryRow(query, id).Scan(
		&m.ID, &m.StudentID, &m.StudentName, &m.NISN, &m.ClassName,
		&m.DestinationSchool, &m.Reason, &rd, &m.Status,
		&dat, &pat, &cat, &crat, &upat,
	)
	if err != nil {
		return nil, err
	}

	if rd.Valid {
		m.ReasonDetail = &rd.String
	}

	m.DownloadedAt = SafeTime(dat)
	m.ProcessedAt = SafeTime(pat)
	m.CompletedAt = SafeTime(cat)
	m.CreatedAt = SafeTime(crat)
	m.UpdatedAt = SafeTime(upat)

	return &m, nil
}

func (r *MutasiRepository) UpdateMutasiOutStatus(id string, status string) error {
	now := time.Now().UnixMilli()
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var res sql.Result
	switch status {
	case "processed":
		res, err = tx.Exec("UPDATE mutasi_out_requests SET status = ?, processed_at = COALESCE(processed_at, ?), updated_at = ? WHERE id = ?", status, now, now, id)
	case "completed":
		res, err = tx.Exec("UPDATE mutasi_out_requests SET status = ?, completed_at = COALESCE(completed_at, ?), updated_at = ? WHERE id = ?", status, now, now, id)
	default:
		res, err = tx.Exec("UPDATE mutasi_out_requests SET status = ?, updated_at = ? WHERE id = ?", status, now, id)
	}
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}

	if status == "completed" {
		var studentID string
		if err := tx.QueryRow("SELECT student_id FROM mutasi_out_requests WHERE id = ?", id).Scan(&studentID); err != nil {
			return err
		}

		// Enforce student obligations clearance before transfer
		clear, reason, err := CheckStudentClearance(tx, studentID)
		if err != nil {
			return err
		}
		if !clear {
			return fmt.Errorf("siswa masih memiliki sangkutan yang belum diselesaikan: %s", reason)
		}

		_, err = tx.Exec(`
			UPDATE students
			SET status = 'transferred', is_active = 0, class_id = NULL, class_name = NULL, updated_at = ?
			WHERE id = ?
		`, now, studentID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *MutasiRepository) GetMutasiRequestByRegNum(regNum, nisn string) (*models.MutasiRequest, error) {
	query := `
		SELECT id, registration_number, student_name, nisn, gender, origin_school, 
		       origin_school_address, target_grade, target_class_id, parent_name, 
			   whatsapp_number, status_approval, status_delivery, created_at, updated_at
		FROM mutasi_requests
		WHERE registration_number = ? AND nisn = ?
	`
	var m models.MutasiRequest
	var osa, tcid sql.NullString
	var crat, upat sql.NullInt64

	err := r.DB.QueryRow(query, regNum, nisn).Scan(
		&m.ID, &m.RegistrationNumber, &m.StudentName, &m.NISN, &m.Gender, &m.OriginSchool,
		&osa, &m.TargetGrade, &tcid, &m.ParentName, &m.WhatsappNumber,
		&m.StatusApproval, &m.StatusDelivery, &crat, &upat,
	)
	if err != nil {
		return nil, err
	}

	if osa.Valid {
		m.OriginSchoolAddress = &osa.String
	}
	if tcid.Valid {
		m.TargetClassID = &tcid.String
	}

	m.CreatedAt = SafeTime(crat)
	m.UpdatedAt = SafeTime(upat)

	return &m, nil
}

func (r *MutasiRepository) GetStudentForPublicValidation(nisn, birthDate string) (*models.Student, error) {
	query := `
		SELECT id, nik, nisn, nis, full_name, gender, birth_place, birth_date, 
		       parent_name, class_name, class_id, status
		FROM students
		WHERE nisn = ? AND birth_date = ? AND is_active = 1
	`
	var s models.Student
	var nik, nis, nisn_val, gender, bp, bd, pn, cn, cid sql.NullString

	err := r.DB.QueryRow(query, nisn, birthDate).Scan(
		&s.ID, &nik, &nisn_val, &nis, &s.FullName, &gender, &bp, &bd,
		&pn, &cn, &cid, &s.Status,
	)
	if err != nil {
		return nil, err
	}

	if nik.Valid {
		s.NIK = Ptr(nik.String)
	}
	if nisn_val.Valid {
		s.NISN = Ptr(nisn_val.String)
	}
	if nis.Valid {
		s.NIS = Ptr(nis.String)
	}
	if gender.Valid {
		s.Gender = Ptr(gender.String)
	}
	if bp.Valid {
		s.BirthPlace = Ptr(bp.String)
	}
	if bd.Valid {
		s.BirthDate = Ptr(bd.String)
	}
	if pn.Valid {
		s.ParentName = Ptr(pn.String)
	}
	if cn.Valid {
		s.ClassName = Ptr(cn.String)
	}
	if cid.Valid {
		s.ClassID = Ptr(cid.String)
	}

	return &s, nil
}

func (r *MutasiRepository) CreateMutasiOutRequest(m models.MutasiOutRequest) error {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()

	query := `
		INSERT INTO mutasi_out_requests (
			id, student_id, destination_school, reason, reason_detail, 
			status, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query,
		id, m.StudentID, m.DestinationSchool, m.Reason, m.ReasonDetail,
		"draft", now, now,
	)
	return err
}

func (r *MutasiRepository) GetSchoolName() string {
	var name string
	err := r.DB.QueryRow("SELECT school_name FROM school_settings LIMIT 1").Scan(&name)
	if err != nil {
		return "Sekolahku"
	}
	return name
}

func (r *MutasiRepository) DirectMutasiMasuk(s models.Student, reason string) error {
	now := time.Now().UnixMilli()
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if s.ID == "" {
		s.ID = cuid2.Generate()
	}
	if s.QRCode == "" {
		s.QRCode = s.ID
	}
	s.Status = "active"
	s.IsActive = true
    
	if s.ClassID != nil && *s.ClassID != "" {
		var className string
		if err := tx.QueryRow("SELECT name FROM student_classes WHERE id = ?", *s.ClassID).Scan(&className); err == nil {
			s.ClassName = &className
		}
	}

	_, err = tx.Exec(`
		INSERT INTO students (
			id, nisn, full_name, gender, class_name, class_id,
			status, qr_code, is_active, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, s.ID, s.NISN, s.FullName, s.Gender, s.ClassName, s.ClassID,
		s.Status, s.QRCode, s.IsActive, now, now)
	if err != nil {
		return err
	}

	// Insert class history for mutation
	if s.ClassID != nil && *s.ClassID != "" {
		var grade int
		var academicYear string
		if err2 := tx.QueryRow("SELECT grade, academic_year FROM student_classes WHERE id = ?", *s.ClassID).Scan(&grade, &academicYear); err2 == nil {
			historyID := cuid2.Generate()
			tx.Exec(`
				INSERT INTO student_class_history (id, student_id, class_id, class_name, academic_year, grade, status, record_date)
				VALUES (?, ?, ?, ?, ?, ?, 'mutated_in', ?)
			`, historyID, s.ID, *s.ClassID, s.ClassName, academicYear, grade, time.Now().Unix())
		}
	}

	var meta string
	if s.MetaData != nil {
		meta = *s.MetaData
	}

	logID := cuid2.Generate()
	_, err = tx.Exec(`
		INSERT INTO mutasi_logs (
			id, mutasi_type, student_id, student_name, nisn, gender,
			origin_or_destination, mutation_date, reason, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, logID, "masuk", s.ID, s.FullName, s.NISN, s.Gender,
		meta, now, reason, now) // meta_data can store origin school
	if err != nil {
		return err
	}

	err = tx.Commit()
	if err == nil {
		_ = AutoSyncStudentToSavingsAndLibrary(r.DB, s.ID)
		_ = AutoSyncStudentToBukuInduk(r.DB, s.ID)
	}
	return err
}

func (r *MutasiRepository) DirectMutasiKeluar(studentID string, destinationSchool, reason string) error {
	now := time.Now().UnixMilli()
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	clear, clearanceReason, err := CheckStudentClearance(tx, studentID)
	if err != nil {
		return err
	}
	if !clear {
		return fmt.Errorf("siswa masih memiliki sangkutan yang belum diselesaikan: %s", clearanceReason)
	}

	var studentName, nisn, gender sql.NullString
	var oldClassID, oldClassName sql.NullString
	if err := tx.QueryRow("SELECT full_name, nisn, gender, class_id, class_name FROM students WHERE id = ?", studentID).Scan(&studentName, &nisn, &gender, &oldClassID, &oldClassName); err != nil {
		return err
	}

	// Get class info for history before deactivating
	if oldClassID.Valid && oldClassID.String != "" {
		var grade int
		var academicYear string
		if err2 := tx.QueryRow("SELECT grade, academic_year FROM student_classes WHERE id = ?", oldClassID.String).Scan(&grade, &academicYear); err2 == nil {
			historyID := cuid2.Generate()
			tx.Exec(`
				INSERT INTO student_class_history (id, student_id, class_id, class_name, academic_year, grade, status, record_date)
				VALUES (?, ?, ?, ?, ?, ?, 'mutated_out', ?)
			`, historyID, studentID, oldClassID.String, oldClassName.String, academicYear, grade, time.Now().Unix())
		}
	}

	_, err = tx.Exec(`
		UPDATE students
		SET status = 'transferred', is_active = 0, class_id = NULL, class_name = NULL, updated_at = ?
		WHERE id = ?
	`, now, studentID)
	if err != nil {
		return err
	}

	logID := cuid2.Generate()
	_, err = tx.Exec(`
		INSERT INTO mutasi_logs (
			id, mutasi_type, student_id, student_name, nisn, gender,
			origin_or_destination, mutation_date, reason, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, logID, "keluar", studentID, studentName.String, nisn.String, gender.String,
		destinationSchool, now, reason, now)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *MutasiRepository) GetMutasiLogs(page, perPage int) ([]models.MutasiLog, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM mutasi_logs").Scan(&total)

	query := `
		SELECT id, mutasi_type, student_id, student_name, nisn, gender,
		       origin_or_destination, mutation_date, reason, created_at
		FROM mutasi_logs
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`
	rows, err := r.DB.Query(query, perPage, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.MutasiLog
	for rows.Next() {
		var m models.MutasiLog
		var sid, gender, reason sql.NullString
		var mutDate, crAt sql.NullInt64

		err := rows.Scan(
			&m.ID, &m.MutasiType, &sid, &m.StudentName, &m.NISN, &gender,
			&m.OriginOrDestination, &mutDate, &reason, &crAt,
		)
		if err != nil {
			return nil, 0, err
		}

		if sid.Valid {
			m.StudentID = &sid.String
		}
		if gender.Valid {
			m.Gender = &gender.String
		}
		if reason.Valid {
			m.Reason = &reason.String
		}

		m.MutationDate = SafeTime(mutDate)
		m.CreatedAt = SafeTime(crAt)

		results = append(results, m)
	}
	if results == nil {
		results = []models.MutasiLog{}
	}
	return results, total, nil
}
