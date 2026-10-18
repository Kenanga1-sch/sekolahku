package repository

import (
	"database/sql"
	errlib "errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type MutasiRepository struct {
	DB *sql.DB
	// regNumMu serializes nomor registrasi harian; SQLite WAL tidak menjamin
	// atomic count+insert antar koneksi. Cukup untuk beban satu sekolah.
	// ponytail: ganti sequence table bila multi-instance.
	regNumMu sync.Mutex
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
	// Unik per hari: INSERT bersamaan dengan nomor sama akan gagal,
	// caller (CreateMutasiRequest) retry dengan nomor berikutnya.
	_, _ = r.DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_mutasi_requests_regnum_day ON mutasi_requests(registration_number)")
	_, _ = r.DB.Exec("CREATE INDEX IF NOT EXISTS idx_mutasi_requests_created ON mutasi_requests(created_at)")
	_, _ = r.DB.Exec("CREATE INDEX IF NOT EXISTS idx_mutasi_logs_created ON mutasi_logs(created_at)")
	_, _ = r.DB.Exec("CREATE INDEX IF NOT EXISTS idx_mutasi_out_created ON mutasi_out_requests(created_at)")
}

func (r *MutasiRepository) GetMutasiRequests(page, perPage int, month string) ([]models.MutasiRequest, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 500 {
		perPage = 500
	}
	offset := (page - 1) * perPage

	monthFilter := ""
	monthArgs := []interface{}{}
	if month != "" && month != "all" {
		// month: "YYYY-MM" → batasi created_at ke rentang bulan tersebut (epoch ms)
		if t, err := time.Parse("2006-01", month); err == nil {
			start := t.UnixMilli()
			end := t.AddDate(0, 1, 0).UnixMilli() - 1
			monthFilter = " WHERE created_at >= ? AND created_at <= ?"
			monthArgs = append(monthArgs, start, end)
		}
	}

	var total int
	if err := r.DB.QueryRow(`
		SELECT COUNT(*) FROM (
			SELECT id, created_at FROM mutasi_requests
			UNION
			SELECT id, created_at FROM mutasi_logs WHERE mutasi_type = 'masuk' AND (nisn IS NULL OR nisn = '' OR nisn NOT IN (SELECT nisn FROM mutasi_requests WHERE nisn IS NOT NULL AND nisn != ''))
		)`+monthFilter, monthArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// monthFilter menempati placeholder WHERE yang datang sebelum
	// LIMIT ? OFFSET ?, jadi bind monthArgs lebih dulu (posisional).
	args := append(append([]interface{}{}, monthArgs...), perPage, offset)
	rows, err := r.DB.Query(`
		SELECT id, registration_number, student_name, nisn, gender, origin_school, 
		       origin_school_address, origin_nis, origin_class, target_grade, target_class_id, parent_name, 
			   whatsapp_number, approval_no, approval_date, status_approval, status_delivery, created_at, updated_at
		FROM (
			SELECT id, registration_number, student_name, nisn, gender, origin_school, 
			       origin_school_address, origin_nis, origin_class, target_grade, target_class_id, parent_name, 
				   whatsapp_number, approval_no, approval_date, status_approval, status_delivery, created_at, updated_at
			FROM mutasi_requests

			UNION ALL

			SELECT ml.id as id,
			       COALESCE(ml.approval_no, 'MUT-DIRECT') as registration_number,
			       ml.student_name,
			       ml.nisn,
			       COALESCE(ml.gender, 'L') as gender,
			       ml.origin_or_destination as origin_school,
			       NULL as origin_school_address,
			       ml.origin_nis,
			       ml.origin_class,
			       COALESCE(sc.grade, sch.grade, 1) as target_grade,
			       s.class_id as target_class_id,
			       '-' as parent_name,
			       '-' as whatsapp_number,
			       ml.approval_no,
			       ml.approval_date,
			       'principal_approved' as status_approval,
			       'direct' as status_delivery,
			       ml.created_at,
			       ml.created_at as updated_at
			FROM mutasi_logs ml
			LEFT JOIN students s ON ml.student_id = s.id
			LEFT JOIN student_classes sc ON s.class_id = sc.id
			LEFT JOIN student_class_history sch ON sch.id = (
				SELECT id FROM student_class_history 
				WHERE student_id = ml.student_id 
				ORDER BY record_date DESC LIMIT 1
			)
			WHERE ml.mutasi_type = 'masuk'
			  AND (ml.nisn IS NULL OR ml.nisn = '' OR ml.nisn NOT IN (SELECT nisn FROM mutasi_requests WHERE nisn IS NOT NULL AND nisn != ''))
		)`+monthFilter+`
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, args...)
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

		if osa.Valid {
			m.OriginSchoolAddress = &osa.String
		}
		if onis.Valid {
			m.OriginNis = &onis.String
		}
		if oclass.Valid {
			m.OriginClass = &oclass.String
		}
		if tcid.Valid {
			m.TargetClassID = &tcid.String
		}
		if appno.Valid {
			m.ApprovalNo = &appno.String
		}
		if appdate.Valid {
			m.ApprovalDate = &appdate.String
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
	now := time.Now().UnixMilli()

	query := `
		INSERT INTO mutasi_requests (
			id, registration_number, student_name, nisn, gender, origin_school,
			origin_school_address, origin_nis, origin_class, target_grade, parent_name, whatsapp_number,
			approval_no, approval_date, status_approval, status_delivery, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	var regNum string
	// ponytail: retry 3x cukup — unik index memastikan tidak ada duplikat,
	// mutex di repo menutup race antar goroutine dalam satu proses.
	for attempt := 0; attempt < 3; attempt++ {
		regNum = r.GenerateRegistrationNumber()
		_, err := r.DB.Exec(query,
			id, regNum, m.StudentName, m.NISN, m.Gender, m.OriginSchool,
			m.OriginSchoolAddress, m.OriginNis, m.OriginClass, m.TargetGrade, m.ParentName, m.WhatsappNumber,
			m.ApprovalNo, m.ApprovalDate, "pending", "unsent", now, now,
		)
		if err == nil {
			return regNum, nil
		}
		if !strings.Contains(err.Error(), "UNIQUE") {
			return "", err
		}
	}
	return "", fmt.Errorf("gagal membuat nomor registrasi unik")
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
		if err != nil {
			return fmt.Errorf("data permohonan tidak ditemukan: %w", err)
		}
		classIDToUse := targetClassID
		if classIDToUse == nil && tcid.Valid {
			classIDToUse = &tcid.String
		}

		var existingID string
		if err := tx.QueryRow("SELECT id FROM students WHERE nisn = ?", req.NISN).Scan(&existingID); err != nil && !errlib.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("gagal cek NISN siswa: %w", err)
		}
		if existingID != "" {
			return fmt.Errorf("NISN %s sudah terdaftar sebagai siswa aktif", req.NISN)
		}

		studentID := cuid2.Generate()
		var className string
		var nis *string
		if classIDToUse != nil && *classIDToUse != "" {
			if err := tx.QueryRow("SELECT name FROM student_classes WHERE id = ?", *classIDToUse).Scan(&className); err != nil && !errlib.Is(err, sql.ErrNoRows) {
				return fmt.Errorf("gagal mengambil nama kelas: %w", err)
			}
			// NIS otomatis untuk siswa mutasi masuk: tahun ajaran + tingkat
			// kelas tujuan + nomor urut berikutnya (tidak pernah dipakai ulang).
			var grade int
			var academicYear string
			if err := tx.QueryRow("SELECT grade, academic_year FROM student_classes WHERE id = ?", *classIDToUse).Scan(&grade, &academicYear); err == nil {
				if generated, genErr := NextNIS(tx, academicYear, grade, *classIDToUse); genErr == nil {
					nis = &generated
				} else {
					log.Printf("ERROR generate NIS mutasi masuk %s: %v", req.NISN, genErr)
				}
			}
		}

		_, err = tx.Exec(`
			INSERT INTO students (
				id, nisn, nis, full_name, gender, class_name, class_id,
				status, qr_code, is_active, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, 1, ?, ?)
		`, studentID, req.NISN, nis, req.StudentName, req.Gender, className, classIDToUse, NewStudentQRCode(nil, studentID), now, now)
		if err != nil {
			return err
		}

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
		if onis.Valid {
			oNis = &onis.String
		}
		if oclass.Valid {
			oClass = &oclass.String
		}
		if appno.Valid {
			aNo = &appno.String
		}
		if appdate.Valid {
			aDate = &appdate.String
		}

		_, _ = tx.Exec(`
			INSERT INTO mutasi_logs (
				id, mutasi_type, student_id, student_name, nisn, gender,
				origin_or_destination, origin_nis, origin_class, approval_date, approval_no,
				mutation_date, reason, created_at
			) VALUES (?, 'masuk', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Mutasi Masuk Disetujui', ?)
		`, logID, studentID, req.StudentName, req.NISN, req.Gender,
			req.OriginSchool, oNis, oClass, aDate, aNo, now, now)

		if err := tx.Commit(); err != nil {
			return err
		}

		// Sinkronisasi lintas modul di luar transaksi; kegagalan tidak
		// membatalkan mutasi tapi wajib tercatat agar bisa diperbaiki manual.
		if err := AutoSyncStudentToSavingsAndLibrary(r.DB, studentID); err != nil {
			log.Printf("ERROR sync tabungan/perpustakaan untuk mutasi masuk %s: %v", studentID, err)
		}
		if err := AutoSyncStudentToBukuInduk(r.DB, studentID); err != nil {
			log.Printf("ERROR sync buku induk untuk mutasi masuk %s: %v", studentID, err)
		}
		return nil
	}

	return tx.Commit()
}

func (r *MutasiRepository) GenerateRegistrationNumber() string {
	now := time.Now()
	datePart := now.Format("20060102")

	r.regNumMu.Lock()
	defer r.regNumMu.Unlock()

	var count int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM mutasi_requests WHERE created_at >= ? AND created_at < ?",
		time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).UnixMilli(),
		time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).AddDate(0, 0, 1).UnixMilli(),
	).Scan(&count); err != nil {
		log.Printf("ERROR counting today's mutasi requests: %v", err)
		// fallback: timestamp-based agar tetap unik walau COUNT gagal
		return fmt.Sprintf("MUT-%s-%d", datePart, now.UnixMilli()%1000000)
	}

	return fmt.Sprintf("MUT-%s-%03d", datePart, count+1)
}

func (r *MutasiRepository) GetMutasiOutRequests(page, perPage int, month string) ([]models.MutasiOutRequest, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 500 {
		perPage = 500
	}
	offset := (page - 1) * perPage

	monthFilter := ""
	monthArgs := []interface{}{}
	if month != "" && month != "all" {
		if t, err := time.Parse("2006-01", month); err == nil {
			start := t.UnixMilli()
			end := t.AddDate(0, 1, 0).UnixMilli() - 1
			monthFilter = " WHERE created_at >= ? AND created_at <= ?"
			monthArgs = append(monthArgs, start, end)
		}
	}

	var total int
	if err := r.DB.QueryRow(`
		SELECT COUNT(*) FROM (
			SELECT id, created_at FROM mutasi_out_requests
			UNION
			SELECT id, created_at FROM mutasi_logs WHERE mutasi_type = 'keluar' AND (student_id IS NULL OR student_id = '' OR student_id NOT IN (SELECT student_id FROM mutasi_out_requests WHERE student_id IS NOT NULL AND student_id != ''))
		)`+monthFilter, monthArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// monthFilter menempati placeholder WHERE yang datang sebelum
	// LIMIT ? OFFSET ?, jadi bind monthArgs lebih dulu (posisional).
	args := append(append([]interface{}{}, monthArgs...), perPage, offset)
	rows, err := r.DB.Query(`
		SELECT id, student_id, student_name, nisn, class_name,
		       destination_school,
		       destination_street, destination_village, destination_district,
		       destination_regency, destination_province,
		       destination_class, letter_no, reason, reason_detail, status,
			   downloaded_at, processed_at, completed_at, created_at, updated_at
		FROM (
			SELECT m.id, m.student_id, s.full_name as student_name, s.nisn, COALESCE(s.class_name, '-') as class_name,
			       m.destination_school,
			       m.destination_street, m.destination_village, m.destination_district,
			       m.destination_regency, m.destination_province,
			       m.destination_class, m.letter_no, m.reason, m.reason_detail, m.status,
				   m.downloaded_at, m.processed_at, m.completed_at, m.created_at, m.updated_at
			FROM mutasi_out_requests m
			JOIN students s ON m.student_id = s.id

			UNION ALL

			SELECT ml.id,
			       COALESCE(ml.student_id, '') as student_id,
			       ml.student_name,
			       ml.nisn,
			       COALESCE(s.class_name, sch.class_name, '-') as class_name,
			       ml.origin_or_destination as destination_school,
			       ml.destination_street,
			       ml.destination_village,
			       ml.destination_district,
			       ml.destination_regency,
			       ml.destination_province,
			       ml.destination_class,
			       ml.letter_no,
			       COALESCE(ml.reason, 'Mutasi Keluar Direct') as reason,
			       NULL as reason_detail,
			       'completed' as status,
			       ml.created_at as downloaded_at,
			       ml.created_at as processed_at,
			       ml.created_at as completed_at,
			       ml.created_at,
			       ml.created_at as updated_at
			FROM mutasi_logs ml
			LEFT JOIN students s ON ml.student_id = s.id
			LEFT JOIN student_class_history sch ON sch.id = (
				SELECT id FROM student_class_history 
				WHERE student_id = ml.student_id 
				ORDER BY record_date DESC LIMIT 1
			)
			WHERE ml.mutasi_type = 'keluar'
			  AND (ml.student_id IS NULL OR ml.student_id = '' OR ml.student_id NOT IN (SELECT student_id FROM mutasi_out_requests WHERE student_id IS NOT NULL AND student_id != ''))
		)`+monthFilter+`
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.MutasiOutRequest
	for rows.Next() {
		var m models.MutasiOutRequest
		var dstreet, dvillage, ddistrict, dregency, dprovince, dclass, letno, rd sql.NullString
		var dat, pat, cat, crat, upat sql.NullInt64

		err := rows.Scan(
			&m.ID, &m.StudentID, &m.StudentName, &m.NISN, &m.ClassName,
			&m.DestinationSchool,
			&dstreet, &dvillage, &ddistrict, &dregency, &dprovince,
			&dclass, &letno, &m.Reason, &rd, &m.Status,
			&dat, &pat, &cat, &crat, &upat,
		)
		if err != nil {
			return nil, 0, err
		}

		if dstreet.Valid {
			m.DestinationStreet = &dstreet.String
		}
		if dvillage.Valid {
			m.DestinationVillage = &dvillage.String
		}
		if ddistrict.Valid {
			m.DestinationDistrict = &ddistrict.String
		}
		if dregency.Valid {
			m.DestinationRegency = &dregency.String
		}
		if dprovince.Valid {
			m.DestinationProvince = &dprovince.String
		}
		if dclass.Valid {
			m.DestinationClass = &dclass.String
		}
		if letno.Valid {
			m.LetterNo = &letno.String
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
		SELECT id, student_id, student_name, nisn, class_name,
		       destination_school,
		       destination_street, destination_village, destination_district,
		       destination_regency, destination_province,
		       destination_class, letter_no, reason, reason_detail, status,
			   downloaded_at, processed_at, completed_at, created_at, updated_at
		FROM (
			SELECT m.id, m.student_id, s.full_name as student_name, s.nisn, COALESCE(s.class_name, '-') as class_name,
			       m.destination_school,
			       m.destination_street, m.destination_village, m.destination_district,
			       m.destination_regency, m.destination_province,
			       m.destination_class, m.letter_no, m.reason, m.reason_detail, m.status,
				   m.downloaded_at, m.processed_at, m.completed_at, m.created_at, m.updated_at
			FROM mutasi_out_requests m
			JOIN students s ON m.student_id = s.id

			UNION ALL

			SELECT ml.id,
			       COALESCE(ml.student_id, '') as student_id,
			       ml.student_name,
			       ml.nisn,
			       COALESCE(s.class_name, sch.class_name, '-') as class_name,
			       ml.origin_or_destination as destination_school,
			       ml.destination_street,
			       ml.destination_village,
			       ml.destination_district,
			       ml.destination_regency,
			       ml.destination_province,
			       ml.destination_class,
			       ml.letter_no,
			       COALESCE(ml.reason, 'Mutasi Keluar Direct') as reason,
			       NULL as reason_detail,
			       'completed' as status,
			       ml.created_at as downloaded_at,
			       ml.created_at as processed_at,
			       ml.created_at as completed_at,
			       ml.created_at,
			       ml.created_at as updated_at
			FROM mutasi_logs ml
			LEFT JOIN students s ON ml.student_id = s.id
			LEFT JOIN student_class_history sch ON sch.id = (
				SELECT id FROM student_class_history 
				WHERE student_id = ml.student_id 
				ORDER BY record_date DESC LIMIT 1
			)
			WHERE ml.mutasi_type = 'keluar'
		)
		WHERE id = ?
		LIMIT 1
	`
	var m models.MutasiOutRequest
	var dstreet, dvillage, ddistrict, dregency, dprovince, dclass, letno, rd sql.NullString
	var dat, pat, cat, crat, upat sql.NullInt64

	err := r.DB.QueryRow(query, id).Scan(
		&m.ID, &m.StudentID, &m.StudentName, &m.NISN, &m.ClassName,
		&m.DestinationSchool,
		&dstreet, &dvillage, &ddistrict, &dregency, &dprovince,
		&dclass, &letno, &m.Reason, &rd, &m.Status,
		&dat, &pat, &cat, &crat, &upat,
	)
	if err != nil {
		return nil, err
	}

	if dstreet.Valid {
		m.DestinationStreet = &dstreet.String
	}
	if dvillage.Valid {
		m.DestinationVillage = &dvillage.String
	}
	if ddistrict.Valid {
		m.DestinationDistrict = &ddistrict.String
	}
	if dregency.Valid {
		m.DestinationRegency = &dregency.String
	}
	if dprovince.Valid {
		m.DestinationProvince = &dprovince.String
	}
	if dclass.Valid {
		m.DestinationClass = &dclass.String
	}
	if letno.Valid {
		m.LetterNo = &letno.String
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
		var destStreet, destVillage, destDistrict, destRegency, destProvince, destClass, letNo, reason sql.NullString
		if err := tx.QueryRow(`
			SELECT student_id, destination_school,
			       destination_street, destination_village, destination_district,
			       destination_regency, destination_province,
			       destination_class, letter_no, reason
			FROM mutasi_out_requests WHERE id = ?`,
			id,
		).Scan(&studentID, &destinationSchool, &destStreet, &destVillage, &destDistrict, &destRegency, &destProvince, &destClass, &letNo, &reason); err != nil {
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
			if err := tx.QueryRow("SELECT full_name, nisn, gender, class_id, class_name FROM students WHERE id = ?", studentID.String).Scan(&studentName, &nisn, &gender, &oldClassID, &oldClassName); err != nil && !errlib.Is(err, sql.ErrNoRows) {
				log.Printf("ERROR fetching student for mutasi: %v", err)
			}

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
			var dStreet, dVillage, dDistrict, dRegency, dProvince interface{}
			if destinationSchool.Valid {
				dSchool = destinationSchool.String
			}
			if destStreet.Valid {
				dStreet = destStreet.String
			}
			if destVillage.Valid {
				dVillage = destVillage.String
			}
			if destDistrict.Valid {
				dDistrict = destDistrict.String
			}
			if destRegency.Valid {
				dRegency = destRegency.String
			}
			if destProvince.Valid {
				dProvince = destProvince.String
			}
			if destClass.Valid {
				dClass = destClass.String
			}
			if letNo.Valid {
				lNo = letNo.String
			}
			if reason.Valid {
				rsn = reason.String
			}

			_, _ = tx.Exec(`
				INSERT INTO mutasi_logs (
					id, mutasi_type, student_id, student_name, nisn, gender,
					origin_or_destination, destination_street, destination_village,
					destination_district, destination_regency, destination_province,
					destination_class, letter_no,
					mutation_date, reason, created_at
				) VALUES (?, 'keluar', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, logID, studentID.String, studentName.String, nisn.String, gender.String,
				dSchool, dStreet, dVillage, dDistrict, dRegency, dProvince,
				dClass, lNo, now, rsn, now)
		}
	}

	return tx.Commit()
}

// GetMutasiRequestByNISN returns the ID of any student or open mutasi request
// using this NISN, or "" if free. Mencegah dobel data mutasi masuk.
func (r *MutasiRepository) GetMutasiRequestByNISN(nisn string) (string, error) {
	var id string
	err := r.DB.QueryRow("SELECT id FROM students WHERE nisn = ? LIMIT 1", nisn).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errlib.Is(err, sql.ErrNoRows) {
		return "", err
	}
	// NISN belum jadi siswa — cek permohonan yang belum selesai
	err = r.DB.QueryRow("SELECT id FROM mutasi_requests WHERE nisn = ? AND status_approval IN ('pending','verified') LIMIT 1", nisn).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errlib.Is(err, sql.ErrNoRows) {
		return "", err
	}
	return "", nil
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

// ListMutasiOutByParentUser: permohonan mutasi keluar untuk semua anak yang
// tertaut ke akun orang tua ini (portal ortu, status pengajuan).
func (r *MutasiRepository) ListMutasiOutByParentUser(userID string) ([]models.MutasiOutRequest, error) {
	rows, err := r.DB.Query(`
		SELECT m.id, m.student_id, s.full_name, COALESCE(s.nisn, ''), COALESCE(s.class_name, '-'),
		       m.destination_school,
		       m.destination_street, m.destination_village, m.destination_district,
		       m.destination_regency, m.destination_province,
		       m.destination_class, m.letter_no, m.reason, m.reason_detail,
		       m.status, m.downloaded_at, m.processed_at, m.completed_at, m.created_at, m.updated_at
		FROM mutasi_out_requests m
		JOIN students s ON s.id = m.student_id
		JOIN parent_students ps ON ps.student_id = m.student_id AND ps.is_active = 1
		WHERE ps.user_id = ?
		ORDER BY m.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.MutasiOutRequest, 0)
	for rows.Next() {
		var m models.MutasiOutRequest
		var destStreet, destVillage, destDistrict, destRegency, destProvince sql.NullString
		var destinationClass, letterNo, reasonDetail sql.NullString
		var downloadedAt, processedAt, completedAt, createdAt, updatedAt sql.NullInt64
		if err := rows.Scan(
			&m.ID, &m.StudentID, &m.StudentName, &m.NISN, &m.ClassName,
			&m.DestinationSchool,
			&destStreet, &destVillage, &destDistrict, &destRegency, &destProvince,
			&destinationClass, &letterNo, &m.Reason, &reasonDetail,
			&m.Status, &downloadedAt, &processedAt, &completedAt, &createdAt, &updatedAt,
		); err != nil {
			return nil, err
		}
		if destStreet.Valid {
			m.DestinationStreet = &destStreet.String
		}
		if destVillage.Valid {
			m.DestinationVillage = &destVillage.String
		}
		if destDistrict.Valid {
			m.DestinationDistrict = &destDistrict.String
		}
		if destRegency.Valid {
			m.DestinationRegency = &destRegency.String
		}
		if destProvince.Valid {
			m.DestinationProvince = &destProvince.String
		}
		if destinationClass.Valid {
			m.DestinationClass = &destinationClass.String
		}
		if letterNo.Valid {
			m.LetterNo = &letterNo.String
		}
		if reasonDetail.Valid {
			m.ReasonDetail = &reasonDetail.String
		}
		m.DownloadedAt = SafeTime(downloadedAt)
		m.ProcessedAt = SafeTime(processedAt)
		m.CompletedAt = SafeTime(completedAt)
		m.CreatedAt = SafeTime(createdAt)
		m.UpdatedAt = SafeTime(updatedAt)
		list = append(list, m)
	}
	return list, nil
}

// HasActiveMutasiOut: apakah siswa masih punya permohonan yang belum selesai
// (mencegah pengajuan ganda dari portal orang tua).
func (r *MutasiRepository) HasActiveMutasiOut(studentID string) (bool, error) {
	var count int
	err := r.DB.QueryRow(`
		SELECT COUNT(*) FROM mutasi_out_requests
		WHERE student_id = ? AND status IN ('draft', 'processed')
	`, studentID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *MutasiRepository) CreateMutasiOutRequest(m models.MutasiOutRequest) error {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()

	query := `
		INSERT INTO mutasi_out_requests (
			id, student_id, destination_school, destination_street, destination_village,
			destination_district, destination_regency, destination_province,
			destination_class, letter_no, reason, reason_detail, 
			status, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query,
		id, m.StudentID, m.DestinationSchool, m.DestinationStreet, m.DestinationVillage,
		m.DestinationDistrict, m.DestinationRegency, m.DestinationProvince,
		m.DestinationClass, m.LetterNo, m.Reason, m.ReasonDetail,
		"draft", now, now,
	)
	return err
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
		s.QRCode = NewStudentQRCode(s.NISN, s.ID)
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
		if e := AutoSyncStudentToSavingsAndLibrary(r.DB, s.ID); e != nil {
			log.Printf("ERROR sync tabungan/perpustakaan untuk mutasi masuk langsung %s: %v", s.ID, e)
		}
		if e := AutoSyncStudentToBukuInduk(r.DB, s.ID); e != nil {
			log.Printf("ERROR sync buku induk untuk mutasi masuk langsung %s: %v", s.ID, e)
		}
	}
	return err
}

func (r *MutasiRepository) DirectMutasiKeluar(studentID string, destinationSchool, destinationStreet, destinationVillage, destinationDistrict, destinationRegency, destinationProvince, destinationClass, letterNo, reason string, mutationDate int64) error {
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
			origin_or_destination, destination_street, destination_village,
			destination_district, destination_regency, destination_province,
			destination_class, letter_no,
			mutation_date, reason, created_at
		) VALUES (?, 'keluar', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, logID, studentID, studentName.String, nisn.String, gender.String,
		destinationSchool, nullIfEmpty(destinationStreet), nullIfEmpty(destinationVillage),
		nullIfEmpty(destinationDistrict), nullIfEmpty(destinationRegency), nullIfEmpty(destinationProvince),
		destinationClass, letterNo,
		mutDate, reason, now)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *MutasiRepository) GetMutasiLogs(page, perPage int, month string) ([]models.MutasiLog, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	monthFilter := ""
	monthArgs := []interface{}{}
	if month != "" && month != "all" {
		if t, err := time.Parse("2006-01", month); err == nil {
			start := t.UnixMilli()
			end := t.AddDate(0, 1, 0).UnixMilli() - 1
			monthFilter = " WHERE ml.mutation_date >= ? AND ml.mutation_date <= ?"
			monthArgs = append(monthArgs, start, end)
		}
	}

	var total int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM mutasi_logs ml"+monthFilter, monthArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// monthFilter menempati placeholder WHERE yang datang sebelum
	// LIMIT ? OFFSET ?, jadi bind monthArgs lebih dulu (posisional).
	args := append(append([]interface{}{}, monthArgs...), perPage, offset)
	rows, err := r.DB.Query(`
		SELECT ml.id, ml.mutasi_type, ml.student_id, ml.student_name, ml.nisn,
		       s.nis, ml.gender, COALESCE(s.class_name, sch.class_name) as class_name, COALESCE(sc.grade, sch.grade) as class_grade,
		       ml.origin_or_destination,
		       ml.destination_street, ml.destination_village, ml.destination_district,
		       ml.destination_regency, ml.destination_province,
		       ml.origin_nis, ml.origin_class, ml.approval_date, ml.approval_no, ml.letter_no, ml.destination_class,
		       ml.mutation_date, ml.reason, ml.created_at
		FROM mutasi_logs ml
		LEFT JOIN students s ON ml.student_id = s.id
		LEFT JOIN student_classes sc ON s.class_id = sc.id
		LEFT JOIN student_class_history sch ON sch.id = (
			SELECT id FROM student_class_history 
			WHERE student_id = ml.student_id 
			ORDER BY record_date DESC LIMIT 1
		)`+monthFilter+`
		ORDER BY ml.created_at DESC
		LIMIT ? OFFSET ?
	`, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.MutasiLog
	for rows.Next() {
		var m models.MutasiLog
		var sid, nis, gender, className, reason sql.NullString
		var dstreet, dvillage, ddistrict, dregency, dprovince, onis, oclass, appdate, appno, letno, destclass sql.NullString
		var classGrade sql.NullInt64
		var mutDate, crAt sql.NullInt64

		err := rows.Scan(
			&m.ID, &m.MutasiType, &sid, &m.StudentName, &m.NISN,
			&nis, &gender, &className, &classGrade,
			&m.OriginOrDestination,
			&dstreet, &dvillage, &ddistrict, &dregency, &dprovince,
			&onis, &oclass, &appdate, &appno, &letno, &destclass,
			&mutDate, &reason, &crAt,
		)
		if err != nil {
			return nil, 0, err
		}

		if sid.Valid {
			m.StudentID = &sid.String
		}
		if nis.Valid {
			m.NIS = &nis.String
		}
		if gender.Valid {
			m.Gender = &gender.String
		}
		if className.Valid {
			m.ClassName = &className.String
		}
		if classGrade.Valid {
			g := int(classGrade.Int64)
			m.ClassGrade = &g
		}
		if dstreet.Valid {
			m.DestinationStreet = &dstreet.String
		}
		if dvillage.Valid {
			m.DestinationVillage = &dvillage.String
		}
		if ddistrict.Valid {
			m.DestinationDistrict = &ddistrict.String
		}
		if dregency.Valid {
			m.DestinationRegency = &dregency.String
		}
		if dprovince.Valid {
			m.DestinationProvince = &dprovince.String
		}
		if onis.Valid {
			m.OriginNis = &onis.String
		}
		if oclass.Valid {
			m.OriginClass = &oclass.String
		}
		if appdate.Valid {
			m.ApprovalDate = &appdate.String
		}
		if appno.Valid {
			m.ApprovalNo = &appno.String
		}
		if letno.Valid {
			m.LetterNo = &letno.String
		}
		if destclass.Valid {
			m.DestinationClass = &destclass.String
		}

		if mutDate.Valid {
			t := time.UnixMilli(mutDate.Int64)
			m.MutationDate = &t
		}
		if reason.Valid {
			m.Reason = &reason.String
		}
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

// UpdateMutasiLog patches only the document fields of a finalised Buku Mutasi
// entry. Identity columns (student_name, nisn, gender, student_id) are never
// touched. nil request fields are left unchanged.
func (r *MutasiRepository) UpdateMutasiLog(id string, req models.UpdateMutasiLogRequest) error {
	var sets []string
	var args []interface{}
	add := func(col string, v *string) {
		if v != nil {
			sets = append(sets, col+" = ?")
			args = append(args, *v)
		}
	}
	if req.MutationDate != nil {
		sets = append(sets, "mutation_date = ?")
		args = append(args, *req.MutationDate)
	}
	add("origin_or_destination", req.OriginOrDestination)
	add("destination_street", req.DestinationStreet)
	add("destination_village", req.DestinationVillage)
	add("destination_district", req.DestinationDistrict)
	add("destination_regency", req.DestinationRegency)
	add("destination_province", req.DestinationProvince)
	add("origin_nis", req.OriginNis)
	add("origin_class", req.OriginClass)
	add("approval_date", req.ApprovalDate)
	add("approval_no", req.ApprovalNo)
	add("letter_no", req.LetterNo)
	add("destination_class", req.DestinationClass)
	add("reason", req.Reason)
	if len(sets) == 0 {
		return nil
	}
	args = append(args, id)
	res, err := r.DB.Exec("UPDATE mutasi_logs SET "+strings.Join(sets, ", ")+" WHERE id = ?", args...)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errlib.New("mutasi tidak ditemukan")
	}
	return nil
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
