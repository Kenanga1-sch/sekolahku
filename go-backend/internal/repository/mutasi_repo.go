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
	repo := &MutasiRepository{DB: db}
	repo.initDB()
	return repo
}

func (r *MutasiRepository) initDB() {
	cols := []string{
		"ALTER TABLE mutasi_logs ADD COLUMN origin_nis TEXT",
		"ALTER TABLE mutasi_logs ADD COLUMN origin_class TEXT",
		"ALTER TABLE mutasi_logs ADD COLUMN approval_date TEXT",
		"ALTER TABLE mutasi_logs ADD COLUMN approval_no TEXT",
		"ALTER TABLE mutasi_logs ADD COLUMN letter_no TEXT",
		"ALTER TABLE mutasi_logs ADD COLUMN destination_class TEXT",
		"ALTER TABLE mutasi_requests ADD COLUMN origin_nis TEXT",
		"ALTER TABLE mutasi_requests ADD COLUMN origin_class TEXT",
		"ALTER TABLE mutasi_requests ADD COLUMN approval_no TEXT",
		"ALTER TABLE mutasi_requests ADD COLUMN approval_date TEXT",
		"ALTER TABLE mutasi_out_requests ADD COLUMN letter_no TEXT",
		"ALTER TABLE mutasi_out_requests ADD COLUMN destination_class TEXT",
	}
	for _, col := range cols {
		_, _ = r.DB.Exec(col)
	}
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
		       origin_school_address, origin_nis, origin_class, target_grade, target_class_id, parent_name, 
			   whatsapp_number, approval_no, approval_date, status_approval, status_delivery, created_at, updated_at
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
		var osa, onis, oclass, tcid, appno, appdate sql.NullString
		var crat, upat sql.NullInt64

		err := rows.Scan(
			&m.ID, &m.RegistrationNumber, &m.StudentName, &m.NISN, &m.Gender, &m.OriginSchool,
			&osa, &onis, &oclass, &m.TargetGrade, &tcid, &m.ParentName, &m.WhatsappNumber,
			&appno, &appdate, &m.StatusApproval, &m.StatusDelivery, &crat, &upat,
		)
		if err != nil {
			return nil, 0, err
		}

		if osa.Valid { m.OriginSchoolAddress = &osa.String }
		if onis.Valid { m.OriginNis = &onis.String }
		if oclass.Valid { m.OriginClass = &oclass.String }
		if tcid.Valid { m.TargetClassID = &tcid.String }
		if appno.Valid { m.ApprovalNo = &appno.String }
		if appdate.Valid { m.ApprovalDate = &appdate.String }

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
			origin_school_address, origin_nis, origin_class, target_grade, parent_name, whatsapp_number,
			approval_no, approval_date, status_approval, status_delivery, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query,
		id, regNum, m.StudentName, m.NISN, m.Gender, m.OriginSchool,
		m.OriginSchoolAddress, m.OriginNis, m.OriginClass, m.TargetGrade, m.ParentName, m.WhatsappNumber,
		m.ApprovalNo, m.ApprovalDate, "pending", "unsent", now, now,
	)
	return regNum, err
}

func (r *MutasiRepository) UpdateMutasiRequestStatus(id string, status string, targetClassID *string) error {
	now := time.Now().UnixMilli()
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var query string
	var args []interface{}

	if targetClassID != nil && strings.TrimSpace(*targetClassID) != "" {
		query = "UPDATE mutasi_requests SET status_approval = ?, target_class_id = ?, updated_at = ? WHERE id = ?"
		args = append(args, status, strings.TrimSpace(*targetClassID), now, id)
	} else {
		query = "UPDATE mutasi_requests SET status_approval = ?, updated_at = ? WHERE id = ?"
		args = append(args, status, now, id)
	}

	res, err := tx.Exec(query, args...)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}

	if status == "principal_approved" {
		var req models.MutasiRequest
		var osa, tcid, onis, oclass, appno, appdate sql.NullString
		err := tx.QueryRow(`
			SELECT student_name, nisn, gender, origin_school, origin_school_address,
			       origin_nis, origin_class, target_grade, target_class_id, approval_no, approval_date
			FROM mutasi_requests WHERE id = ?
		`, id).Scan(
			&req.StudentName, &req.NISN, &req.Gender, &req.OriginSchool, &osa,
			&onis, &oclass, &req.TargetGrade, &tcid, &appno, &appdate,
		)
		if err == nil {
			classIDToUse := targetClassID
			if classIDToUse == nil && tcid.Valid {
				classIDToUse = &tcid.String
			}

			var existingID string
			_ = tx.QueryRow("SELECT id FROM students WHERE nisn = ?", req.NISN).Scan(&existingID)
			if existingID == "" {
				studentID := cuid2.Generate()
				var className string
				if classIDToUse != nil && *classIDToUse != "" {
					_ = tx.QueryRow("SELECT name FROM student_classes WHERE id = ?", *classIDToUse).Scan(&className)
				}

				_, err = tx.Exec(`
					INSERT INTO students (
						id, nisn, full_name, gender, class_name, class_id,
						status, qr_code, is_active, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 1, ?, ?)
				`, studentID, req.NISN, req.StudentName, req.Gender, className, classIDToUse, studentID, now, now)

				if classIDToUse != nil && *classIDToUse != "" {
					var grade int
					var academicYear string
					if err2 := tx.QueryRow("SELECT grade, academic_year FROM student_classes WHERE id = ?", *classIDToUse).Scan(&grade, &academicYear); err2 == nil {
						historyID := cuid2.Generate()
						tx.Exec(`
							INSERT INTO student_class_history (id, student_id, class_id, class_name, academic_year, grade, status, record_date)
							VALUES (?, ?, ?, ?, ?, ?, 'mutated_in', ?)
						`, historyID, studentID, *classIDToUse, className, academicYear, grade, time.Now().Unix())
					}
				}

				logID := cuid2.Generate()
				var oNis, oClass, aNo, aDate *string
				if onis.Valid { oNis = &onis.String }
				if oclass.Valid { oClass = &oclass.String }
				if appno.Valid { aNo = &appno.String }
				if appdate.Valid { aDate = &appdate.String }

				_, _ = tx.Exec(`
					INSERT INTO mutasi_logs (
						id, mutasi_type, student_id, student_name, nisn, gender,
						origin_or_destination, origin_nis, origin_class, approval_date, approval_no,
						mutation_date, reason, created_at
					) VALUES (?, 'masuk', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Mutasi Masuk Disetujui', ?)
				`, logID, studentID, req.StudentName, req.NISN, req.Gender,
					req.OriginSchool, oNis, oClass, aDate, aNo, now, now)

				_ = AutoSyncStudentToSavingsAndLibrary(r.DB, studentID)
				_ = AutoSyncStudentToBukuInduk(r.DB, studentID)
			}
		}
	}

	return tx.Commit()
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
		       m.destination_school, m.destination_class, m.letter_no, m.reason, m.reason_detail, m.status,
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
		var dclass, letno, rd sql.NullString
		var dat, pat, cat, crat, upat sql.NullInt64

		err := rows.Scan(
			&m.ID, &m.StudentID, &m.StudentName, &m.NISN, &m.ClassName,
			&m.DestinationSchool, &dclass, &letno, &m.Reason, &rd, &m.Status,
			&dat, &pat, &cat, &crat, &upat,
		)
		if err != nil {
			return nil, 0, err
		}

		if dclass.Valid { m.DestinationClass = &dclass.String }
		if letno.Valid { m.LetterNo = &letno.String }
		if rd.Valid { m.ReasonDetail = &rd.String }

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
		var studentID, destinationSchool sql.NullString
		var destClass, letNo, reason sql.NullString
		if err := tx.QueryRow("SELECT student_id, destination_school, destination_class, letter_no, reason FROM mutasi_out_requests WHERE id = ?", id).Scan(&studentID, &destinationSchool, &destClass, &letNo, &reason); err != nil {
			return err
		}

		if studentID.Valid {
			clear, clearanceReason, err := CheckStudentClearance(tx, studentID.String)
			if err != nil {
				return err
			}
			if !clear {
				return fmt.Errorf("siswa masih memiliki sangkutan yang belum diselesaikan: %s", clearanceReason)
			}

			var studentName, nisn, gender sql.NullString
			var oldClassID, oldClassName sql.NullString
			_ = tx.QueryRow("SELECT full_name, nisn, gender, class_id, class_name FROM students WHERE id = ?", studentID.String).Scan(&studentName, &nisn, &gender, &oldClassID, &oldClassName)

			if oldClassID.Valid && oldClassID.String != "" {
				var grade int
				var academicYear string
				if err2 := tx.QueryRow("SELECT grade, academic_year FROM student_classes WHERE id = ?", oldClassID.String).Scan(&grade, &academicYear); err2 == nil {
					historyID := cuid2.Generate()
					tx.Exec(`
						INSERT INTO student_class_history (id, student_id, class_id, class_name, academic_year, grade, status, record_date)
						VALUES (?, ?, ?, ?, ?, ?, 'mutated_out', ?)
					`, historyID, studentID.String, oldClassID.String, oldClassName.String, academicYear, grade, time.Now().Unix())
				}
			}

			_, err = tx.Exec(`
				UPDATE students
				SET status = 'transferred', is_active = 0, class_id = NULL, class_name = NULL, updated_at = ?
				WHERE id = ?
			`, now, studentID.String)
			if err != nil {
				return err
			}

			logID := cuid2.Generate()
			var dSchool, dClass, lNo, rsn string
			if destinationSchool.Valid { dSchool = destinationSchool.String }
			if destClass.Valid { dClass = destClass.String }
			if letNo.Valid { lNo = letNo.String }
			if reason.Valid { rsn = reason.String }

			_, _ = tx.Exec(`
				INSERT INTO mutasi_logs (
					id, mutasi_type, student_id, student_name, nisn, gender,
					origin_or_destination, destination_class, letter_no,
					mutation_date, reason, created_at
				) VALUES (?, 'keluar', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, logID, studentID.String, studentName.String, nisn.String, gender.String,
				dSchool, dClass, lNo, now, rsn, now)
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
			id, student_id, destination_school, destination_class, letter_no, reason, reason_detail, 
			status, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query,
		id, m.StudentID, m.DestinationSchool, m.DestinationClass, m.LetterNo, m.Reason, m.ReasonDetail,
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

func (r *MutasiRepository) DirectMutasiMasuk(s models.Student, reason string, originNis, originClass, approvalDate, approvalNo string, mutationDate int64) error {
	now := time.Now().UnixMilli()
	mutDate := mutationDate
	if mutDate <= 0 {
		mutDate = now
	}
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

	var nisVal interface{}
	if s.NIS != nil {
		nisVal = *s.NIS
	}

	_, err = tx.Exec(`
		INSERT INTO students (
			id, nisn, nis, full_name, gender, class_name, class_id,
			status, qr_code, is_active, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, s.ID, s.NISN, nisVal, s.FullName, s.Gender, s.ClassName, s.ClassID,
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
			origin_or_destination, origin_nis, origin_class, approval_date, approval_no,
			mutation_date, reason, created_at
		) VALUES (?, 'masuk', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, logID, s.ID, s.FullName, s.NISN, s.Gender,
		meta, originNis, originClass, approvalDate, approvalNo,
		mutDate, reason, now)
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

func (r *MutasiRepository) DirectMutasiKeluar(studentID string, destinationSchool, destinationClass, letterNo, reason string, mutationDate int64) error {
	now := time.Now().UnixMilli()
	mutDate := mutationDate
	if mutDate <= 0 {
		mutDate = now
	}
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
			origin_or_destination, destination_class, letter_no,
			mutation_date, reason, created_at
		) VALUES (?, 'keluar', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, logID, studentID, studentName.String, nisn.String, gender.String,
		destinationSchool, destinationClass, letterNo,
		mutDate, reason, now)
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
		SELECT ml.id, ml.mutasi_type, ml.student_id, ml.student_name, ml.nisn,
		       s.nis, ml.gender, COALESCE(s.class_name, sch.class_name) as class_name, COALESCE(sc.grade, sch.grade) as class_grade,
		       ml.origin_or_destination, ml.origin_nis, ml.origin_class, ml.approval_date, ml.approval_no, ml.letter_no, ml.destination_class,
		       ml.mutation_date, ml.reason, ml.created_at
		FROM mutasi_logs ml
		LEFT JOIN students s ON ml.student_id = s.id
		LEFT JOIN student_classes sc ON s.class_id = sc.id
		LEFT JOIN student_class_history sch ON sch.id = (
			SELECT id FROM student_class_history 
			WHERE student_id = ml.student_id 
			ORDER BY record_date DESC LIMIT 1
		)
		ORDER BY ml.created_at DESC
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
		var sid, nis, gender, className, reason sql.NullString
		var onis, oclass, appdate, appno, letno, destclass sql.NullString
		var classGrade sql.NullInt64
		var mutDate, crAt sql.NullInt64

		err := rows.Scan(
			&m.ID, &m.MutasiType, &sid, &m.StudentName, &m.NISN,
			&nis, &gender, &className, &classGrade,
			&m.OriginOrDestination, &onis, &oclass, &appdate, &appno, &letno, &destclass,
			&mutDate, &reason, &crAt,
		)
		if err != nil {
			return nil, 0, err
		}

		if sid.Valid { m.StudentID = &sid.String }
		if nis.Valid { m.NIS = &nis.String }
		if gender.Valid { m.Gender = &gender.String }
		if className.Valid { m.ClassName = &className.String }
		if classGrade.Valid {
			g := int(classGrade.Int64)
			m.ClassGrade = &g
		}
		if onis.Valid { m.OriginNis = &onis.String }
		if oclass.Valid { m.OriginClass = &oclass.String }
		if appdate.Valid { m.ApprovalDate = &appdate.String }
		if appno.Valid { m.ApprovalNo = &appno.String }
		if letno.Valid { m.LetterNo = &letno.String }
		if destclass.Valid { m.DestinationClass = &destclass.String }

		if mutDate.Valid {
			t := time.UnixMilli(mutDate.Int64)
			m.MutationDate = &t
		}
		if reason.Valid { m.Reason = &reason.String }
		if crAt.Valid {
			t := time.UnixMilli(crAt.Int64)
			m.CreatedAt = &t
		}

		results = append(results, m)
	}
	if results == nil {
		results = []models.MutasiLog{}
	}
	return results, total, nil
}

func (r *MutasiRepository) GetMutasiRekap(monthStart, monthEnd int64) ([]models.MutasiRekapItem, error) {
	grades := []int{1, 2, 3, 4, 5, 6}
	var items []models.MutasiRekapItem

	for _, grade := range grades {
		var activeL, activeP int
		var masukL, masukP int
		var keluarL, keluarP int

		// Count currently active students per grade by gender
		r.DB.QueryRow(`
			SELECT 
				COALESCE(SUM(CASE WHEN s.gender = 'L' THEN 1 ELSE 0 END), 0),
				COALESCE(SUM(CASE WHEN s.gender = 'P' THEN 1 ELSE 0 END), 0)
			FROM students s
			JOIN student_classes sc ON s.class_id = sc.id
			WHERE s.is_active = 1 AND sc.grade = ?
		`, grade).Scan(&activeL, &activeP)

		// Count masuk this month per grade by gender (from mutasi_logs, gender stored in log)
		r.DB.QueryRow(`
			SELECT 
				COALESCE(SUM(CASE WHEN ml.gender = 'L' THEN 1 ELSE 0 END), 0),
				COALESCE(SUM(CASE WHEN ml.gender = 'P' THEN 1 ELSE 0 END), 0)
			FROM mutasi_logs ml
			LEFT JOIN students s ON ml.student_id = s.id
			LEFT JOIN student_classes sc ON s.class_id = sc.id
			LEFT JOIN student_class_history sch ON sch.id = (
				SELECT id FROM student_class_history 
				WHERE student_id = ml.student_id 
				ORDER BY record_date DESC LIMIT 1
			)
			WHERE ml.mutasi_type = 'masuk'
			  AND ml.mutation_date >= ? AND ml.mutation_date <= ?
			  AND COALESCE(sc.grade, sch.grade, 0) = ?
		`, monthStart, monthEnd, grade).Scan(&masukL, &masukP)

		// Count keluar this month per grade by gender (from mutasi_logs, gender stored in log)
		r.DB.QueryRow(`
			SELECT 
				COALESCE(SUM(CASE WHEN ml.gender = 'L' THEN 1 ELSE 0 END), 0),
				COALESCE(SUM(CASE WHEN ml.gender = 'P' THEN 1 ELSE 0 END), 0)
			FROM mutasi_logs ml
			LEFT JOIN students s ON ml.student_id = s.id
			LEFT JOIN student_classes sc ON s.class_id = sc.id
			LEFT JOIN student_class_history sch ON sch.id = (
				SELECT id FROM student_class_history 
				WHERE student_id = ml.student_id 
				ORDER BY record_date DESC LIMIT 1
			)
			WHERE ml.mutasi_type = 'keluar'
			  AND ml.mutation_date >= ? AND ml.mutation_date <= ?
			  AND COALESCE(sc.grade, sch.grade, 0) = ?
		`, monthStart, monthEnd, grade).Scan(&keluarL, &keluarP)

		awalL := activeL - masukL + keluarL
		awalP := activeP - masukP + keluarP
		if awalL < 0 {
			awalL = 0
		}
		if awalP < 0 {
			awalP = 0
		}

		items = append(items, models.MutasiRekapItem{
			Grade:   grade,
			AwalL:   awalL,
			AwalP:   awalP,
			MasukL:  masukL,
			MasukP:  masukP,
			KeluarL: keluarL,
			KeluarP: keluarP,
			AkhirL:  activeL,
			AkhirP:  activeP,
		})
	}

	return items, nil
}
