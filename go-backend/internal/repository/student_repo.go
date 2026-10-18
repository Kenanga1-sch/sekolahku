package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type StudentRepository struct {
	DB *sql.DB
}

func NewStudentRepository(db *sql.DB) *StudentRepository {
	return &StudentRepository{DB: db}
}

func cleanStudentStringPtr(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

// ErrClassNotFound dikembalikan bila className diisi namun tidak ada di master
// kelas (student_classes). Import/input WAJIB memakai kelas yang sudah ada —
// kelas tidak pernah dibuat otomatis.
type ClassNotFoundError struct {
	ClassName string
}

func (e *ClassNotFoundError) Error() string {
	return fmt.Sprintf("Kelas %q tidak ditemukan. Gunakan nama kelas yang sudah terdaftar.", e.ClassName)
}

// resolveClassLinkage menyelaraskan classId <-> className dengan verifikasi
// KETAT: bila salah satu diisi, keduanya harus menunjuk kelas yang benar-benar
// ada di master. Bila className diisi tapi tidak ditemukan -> error (TOLAK),
// tidak lagi diam-diam mengosongkan class_id.
func resolveClassLinkage(q Queryer, s *models.Student) error {
	className := ""
	if s.ClassName != nil {
		className = strings.TrimSpace(*s.ClassName)
	}
	classID := ""
	if s.ClassID != nil {
		classID = strings.TrimSpace(*s.ClassID)
	}

	switch {
	case classID != "":
		// classId disediakan -> pastikan ada, lalu isi className dari master.
		var name string
		if err := q.QueryRow("SELECT name FROM student_classes WHERE id = ?", classID).Scan(&name); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return &ClassNotFoundError{ClassName: classID}
			}
			return err
		}
		s.ClassName = &name
	case className != "":
		// className disediakan -> WAJIB ada di master kelas.
		var id string
		if err := q.QueryRow("SELECT id FROM student_classes WHERE name = ?", className).Scan(&id); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return &ClassNotFoundError{ClassName: className}
			}
			return err
		}
		s.ClassID = &id
	}
	return nil
}

// validateProvidedClass memverifikasi kelas yang SECARA EKSPLISIT diberikan
// pada input (bukan hasil merge dari data existing). Dipakai sebelum merge
// agar className yang salah tidak "tertelan" oleh classId lama saat update.
func validateProvidedClass(q Queryer, s *models.Student) error {
	if s.ClassName != nil {
		if name := strings.TrimSpace(*s.ClassName); name != "" {
			var id string
			if err := q.QueryRow("SELECT id FROM student_classes WHERE name = ?", name).Scan(&id); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					return &ClassNotFoundError{ClassName: name}
				}
				return err
			}
		}
	}
	if s.ClassID != nil {
		if cid := strings.TrimSpace(*s.ClassID); cid != "" {
			var name string
			if err := q.QueryRow("SELECT name FROM student_classes WHERE id = ?", cid).Scan(&name); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					return &ClassNotFoundError{ClassName: cid}
				}
				return err
			}
		}
	}
	return nil
}

// StudentQRCodePrefix adalah namespace QR siswa. Namespace ini memastikan
// QR siswa tidak pernah bentrok dengan QR aset perpustakaan ("BK-") maupu
// identifier lain. Satu QR ini terbaca di semua modul (perpustakaan,
// tabungan, presensi) karena students.qr_code adalah single source of truth.
const StudentQRCodePrefix = "STU-"

// NewStudentQRCode menghasilkan QR unik untuk siswa baru.
// Format profesional: STU-{NISN} — stabil seumur hidup siswa (NISN unik
// secara nasional & dijamin UNIQUE oleh constraint DB), mudah diaudit manual.
// Fallback STU-{cuid} untuk siswa tanpa NISN (mis. belum verifikasi dokumen).
func NewStudentQRCode(nisn *string, studentID string) string {
	if nisn != nil {
		if n := strings.TrimSpace(*nisn); n != "" {
			return StudentQRCodePrefix + n
		}
	}
	return StudentQRCodePrefix + strings.ToUpper(studentID)
}

// BackfillStudentQRCodes mengisi QR untuk siswa yang belum punya (data lama
// sebelum QR wajib). Idempotent — aman dijalankan berulang. Dipanggil saat
// startup API.
func BackfillStudentQRCodes(db *sql.DB) (int, error) {
	res, err := db.Exec(`
		UPDATE students
		SET qr_code = ? || COALESCE(NULLIF(TRIM(nisn), ''), UPPER(id)),
		    updated_at = ?
		WHERE qr_code IS NULL OR TRIM(qr_code) = ''
	`, StudentQRCodePrefix, time.Now().UnixMilli())
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

func mergeStudentDefaults(next *models.Student, existing *models.Student) {
	next.FullName = strings.TrimSpace(next.FullName)
	next.NIK = cleanStudentStringPtr(next.NIK)
	next.NISN = cleanStudentStringPtr(next.NISN)
	next.NIS = cleanStudentStringPtr(next.NIS)
	next.KIP = cleanStudentStringPtr(next.KIP)
	next.Gender = cleanStudentStringPtr(next.Gender)
	next.BirthPlace = cleanStudentStringPtr(next.BirthPlace)
	next.BirthDate = cleanStudentStringPtr(next.BirthDate)
	next.Religion = cleanStudentStringPtr(next.Religion)
	next.Address = cleanStudentStringPtr(next.Address)
	next.ParentName = cleanStudentStringPtr(next.ParentName)
	next.FatherName = cleanStudentStringPtr(next.FatherName)
	next.FatherNIK = cleanStudentStringPtr(next.FatherNIK)
	next.MotherName = cleanStudentStringPtr(next.MotherName)
	next.MotherNIK = cleanStudentStringPtr(next.MotherNIK)
	next.GuardianName = cleanStudentStringPtr(next.GuardianName)
	next.GuardianNIK = cleanStudentStringPtr(next.GuardianNIK)
	next.GuardianJob = cleanStudentStringPtr(next.GuardianJob)
	next.ParentPhone = cleanStudentStringPtr(next.ParentPhone)
	next.ClassName = cleanStudentStringPtr(next.ClassName)
	next.ClassID = cleanStudentStringPtr(next.ClassID)
	next.Photo = cleanStudentStringPtr(next.Photo)
	next.MetaData = cleanStudentStringPtr(next.MetaData)
	statusLower := strings.TrimSpace(strings.ToLower(next.Status))
	if statusLower == "aktif" || statusLower == "active" {
		next.Status = "active"
		next.IsActive = true
	} else if statusLower != "" {
		next.Status = statusLower
		if statusLower == "nonaktif" || statusLower == "non-active" || statusLower == "tidak aktif" || statusLower == "inactive" {
			next.Status = "inactive"
		}
		next.IsActive = false
	}

	if existing == nil {
		if next.Status == "" {
			next.Status = "active"
		}
		if !next.IsActive {
			next.IsActive = next.Status == "active"
		}
		return
	}

	if next.FullName == "" {
		next.FullName = existing.FullName
	}
	if next.NIK == nil {
		next.NIK = existing.NIK
	}
	if next.NISN == nil {
		next.NISN = existing.NISN
	}
	if next.NIS == nil {
		next.NIS = existing.NIS
	}
	if next.KIP == nil {
		next.KIP = existing.KIP
	}
	if next.Gender == nil {
		next.Gender = existing.Gender
	}
	if next.BirthPlace == nil {
		next.BirthPlace = existing.BirthPlace
	}
	if next.BirthDate == nil {
		next.BirthDate = existing.BirthDate
	}
	if next.Religion == nil {
		next.Religion = existing.Religion
	}
	if next.Address == nil {
		next.Address = existing.Address
	}
	if next.ParentName == nil {
		next.ParentName = existing.ParentName
	}
	if next.FatherName == nil {
		next.FatherName = existing.FatherName
	}
	if next.FatherNIK == nil {
		next.FatherNIK = existing.FatherNIK
	}
	if next.MotherName == nil {
		next.MotherName = existing.MotherName
	}
	if next.MotherNIK == nil {
		next.MotherNIK = existing.MotherNIK
	}
	if next.GuardianName == nil {
		next.GuardianName = existing.GuardianName
	}
	if next.GuardianNIK == nil {
		next.GuardianNIK = existing.GuardianNIK
	}
	if next.GuardianJob == nil {
		next.GuardianJob = existing.GuardianJob
	}
	if next.ParentPhone == nil {
		next.ParentPhone = existing.ParentPhone
	}
	if next.ClassName == nil {
		next.ClassName = existing.ClassName
	}
	if next.ClassID == nil {
		next.ClassID = existing.ClassID
	}
	if next.Photo == nil {
		next.Photo = existing.Photo
	}
	if next.MetaData == nil {
		next.MetaData = existing.MetaData
	}
	if next.EnrolledAt == nil {
		next.EnrolledAt = existing.EnrolledAt
	}
	if next.Status == "" {
		next.Status = existing.Status
	}
	if next.Status == "active" {
		next.IsActive = true
	} else if next.Status == "inactive" || next.Status == "nonactive" || next.Status == "non-active" {
		next.IsActive = false
	} else if !next.IsActive && existing.IsActive {
		next.IsActive = true
	}
	if next.QRCode == "" {
		next.QRCode = existing.QRCode
	}
}

func (r *StudentRepository) GetStudents(page, limit int, query, status, classID string) (*models.StudentResponse, error) {
	return r.GetStudentsScoped(page, limit, query, status, classID, "")
}

// GetStudentsScoped seperti GetStudents, tetapi bila scopeClass != "" maka
// daftar DAN ringkasan (summary) dibatasi ke kelas tersebut. Dipakai guru wali
// kelas agar kartu statistik & daftar hanya berisi siswa kelasnya.
func (r *StudentRepository) GetStudentsScoped(page, limit int, query, status, classID, scopeClass string) (*models.StudentResponse, error) {
	offset := (page - 1) * limit

	where := []string{"1=1"}
	args := []interface{}{}

	if query != "" {
		where = append(where, "(full_name LIKE ? OR nis LIKE ? OR nisn LIKE ?)")
		searchTerm := "%" + query + "%"
		args = append(args, searchTerm, searchTerm, searchTerm)
	}

	if status != "" {
		statusLower := strings.ToLower(strings.TrimSpace(status))
		switch statusLower {
		case "active", "aktif":
			where = append(where, "(status = 'active' OR is_active = 1) AND status != 'deleted'")
		case "inactive", "nonactive", "non-active", "tidak aktif", "non-aktif":
			where = append(where, "(status = 'inactive' OR is_active = 0) AND status != 'deleted'")
		case "deleted", "arsip":
			where = append(where, "status = 'deleted'")
		default:
			where = append(where, "status = ? AND status != 'deleted'")
			args = append(args, statusLower)
		}
	} else {
		where = append(where, "status != 'deleted'")
	}

	if classID != "" {
		where = append(where, "(class_id = ? OR class_name = ? OR class_name = (SELECT name FROM student_classes WHERE id = ?))")
		args = append(args, classID, classID, classID)
	}

	whereClause := strings.Join(where, " AND ")

	// Count total
	var total int
	err := r.DB.QueryRow("SELECT COUNT(*) FROM students WHERE "+whereClause, args...).Scan(&total)
	if err != nil {
		return nil, err
	}

	// Get data
	selectQuery := fmt.Sprintf(`
		SELECT id, nik, nisn, nis, full_name, gender, class_name, status, photo, qr_code, is_active, created_at, kip
		FROM students
		WHERE %s
		ORDER BY full_name ASC
		LIMIT ? OFFSET ?
	`, whereClause)

	listArgs := append(args, limit, offset)
	rows, err := r.DB.Query(selectQuery, listArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	students := []models.Student{}
	for rows.Next() {
		var s models.Student
		var nik, nisn, nis, gender, className, photo, qrCode, kip, status sql.NullString
		var crAtRaw interface{}

		err = rows.Scan(&s.ID, &nik, &nisn, &nis, &s.FullName, &gender, &className, &status, &photo, &qrCode, &s.IsActive, &crAtRaw, &kip)
		if err != nil {
			return nil, err
		}

		s.NIK = cleanStudentStringPtr(&nik.String)
		s.NISN = cleanStudentStringPtr(&nisn.String)
		s.NIS = cleanStudentStringPtr(&nis.String)
		s.Gender = cleanStudentStringPtr(&gender.String)
		s.ClassName = cleanStudentStringPtr(&className.String)
		if status.Valid && status.String != "" {
			s.Status = status.String
		} else {
			s.Status = "active"
		}
		if photo.Valid && photo.String != "" {
			s.Photo = &photo.String
		}
		if qrCode.Valid && qrCode.String != "" {
			s.QRCode = qrCode.String
		} else {
			s.QRCode = s.ID
		}
		if kip.Valid {
			s.KIP = &kip.String
		}

		var crAt sql.NullInt64
		switch v := crAtRaw.(type) {
		case int64:
			crAt = sql.NullInt64{Int64: v, Valid: true}
		case float64:
			crAt = sql.NullInt64{Int64: int64(v), Valid: true}
		case time.Time:
			crAt = sql.NullInt64{Int64: v.UnixMilli(), Valid: true}
		}

		cTime := ToTime(crAt)
		s.CreatedAt = &cTime
		students = append(students, s)
	}

	// Summary — dibatasi ke scopeClass bila ada (guru wali kelas) agar kartu
	// statistik ikut hanya menghitung siswa kelasnya.
	summaryWhere := ""
	summaryArgs := []interface{}{}
	if scopeClass != "" {
		summaryWhere = " AND (class_id = ? OR class_name = ? OR class_name = (SELECT name FROM student_classes WHERE id = ?))"
		summaryArgs = []interface{}{scopeClass, scopeClass, scopeClass}
	}

	var totalActive int
	r.DB.QueryRow("SELECT COUNT(*) FROM students WHERE status = 'active'"+summaryWhere, summaryArgs...).Scan(&totalActive)

	var totalMale, totalFemale int
	r.DB.QueryRow("SELECT COUNT(*) FROM students WHERE status = 'active' AND gender = 'L'"+summaryWhere, summaryArgs...).Scan(&totalMale)
	r.DB.QueryRow("SELECT COUNT(*) FROM students WHERE status = 'active' AND gender = 'P'"+summaryWhere, summaryArgs...).Scan(&totalFemale)

	countRows, _ := r.DB.Query(`
		SELECT class_name, COUNT(*) as count 
		FROM students 
		WHERE status = 'active' AND class_name IS NOT NULL`+summaryWhere+`
		GROUP BY class_name
	`, summaryArgs...)
	byClass := []models.StudentByClass{}
	if countRows != nil {
		defer countRows.Close()
		for countRows.Next() {
			var bc models.StudentByClass
			var name sql.NullString
			countRows.Scan(&name, &bc.Count)
			if name.Valid {
				bc.ClassName = &name.String
			}
			byClass = append(byClass, bc)
		}
	}

	return &models.StudentResponse{
		Data: students,
		Pagination: models.StudentPagination{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: int(math.Ceil(float64(total) / float64(limit))),
		},
		Summary: models.StudentSummary{
			Total:   total,
			Active:  totalActive,
			Male:    totalMale,
			Female:  totalFemale,
			ByClass: byClass,
		},
	}, nil
}

func (r *StudentRepository) GetStudentByID(id string) (*models.Student, error) {
	return r.getStudentByID(r.DB, id)
}

// getStudentByID menerima Queryer agar dapat dipakai di dalam transaksi.
func (r *StudentRepository) getStudentByID(db Queryer, id string) (*models.Student, error) {
	query := `
		SELECT id, nik, nisn, nis, full_name, gender, birth_place, birth_date, religion,
		       address, parent_name, father_name, father_nik, mother_name, mother_nik,
		       guardian_name, guardian_nik, guardian_job, parent_phone, class_name, class_id,
		       status, photo, qr_code, is_active, meta_data, enrolled_at, created_at, updated_at, kip
		FROM students WHERE id = ?
	`
	var s models.Student
	var nik, nisn, nis, gender, bPlace, bDate, religion, addr, pName, fName, fNik, mName, mNik, gName, gNik, gJob, pPhone, cName, cId, photo, qrCode, meta, kip sql.NullString
	var enrolled, crAt, upAt sql.NullInt64

	err := db.QueryRow(query, id).Scan(
		&s.ID, &nik, &nisn, &nis, &s.FullName, &gender, &bPlace, &bDate, &religion,
		&addr, &pName, &fName, &fNik, &mName, &mNik, &gName, &gNik, &gJob, &pPhone, &cName, &cId,
		&s.Status, &photo, &qrCode, &s.IsActive, &meta, &enrolled, &crAt, &upAt, &kip,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if nik.Valid {
		s.NIK = &nik.String
	}
	if nisn.Valid {
		s.NISN = &nisn.String
	}
	if nis.Valid {
		s.NIS = &nis.String
	}
	if kip.Valid {
		s.KIP = &kip.String
	}
	if gender.Valid {
		s.Gender = &gender.String
	}
	if bPlace.Valid {
		s.BirthPlace = &bPlace.String
	}
	if bDate.Valid {
		s.BirthDate = &bDate.String
	}
	if religion.Valid {
		s.Religion = &religion.String
	}
	if addr.Valid {
		s.Address = &addr.String
	}
	if pName.Valid {
		s.ParentName = &pName.String
	}
	if fName.Valid {
		s.FatherName = &fName.String
	}
	if fNik.Valid {
		s.FatherNIK = &fNik.String
	}
	if mName.Valid {
		s.MotherName = &mName.String
	}
	if mNik.Valid {
		s.MotherNIK = &mNik.String
	}
	if gName.Valid {
		s.GuardianName = &gName.String
	}
	if gNik.Valid {
		s.GuardianNIK = &gNik.String
	}
	if gJob.Valid {
		s.GuardianJob = &gJob.String
	}
	if pPhone.Valid {
		s.ParentPhone = &pPhone.String
	}
	if cName.Valid {
		s.ClassName = &cName.String
	}
	if cId.Valid {
		s.ClassID = &cId.String
	}
	if photo.Valid {
		s.Photo = &photo.String
	}
	if qrCode.Valid && strings.TrimSpace(qrCode.String) != "" {
		s.QRCode = qrCode.String
	} else {
		s.QRCode = s.ID
	}
	if meta.Valid {
		s.MetaData = &meta.String
	}
	if enrolled.Valid {
		s.EnrolledAt = &enrolled.Int64
	}

	cTime := ToTime(crAt)
	s.CreatedAt = &cTime
	uTime := ToTime(upAt)
	s.UpdatedAt = &uTime

	return &s, nil
}

func (r *StudentRepository) CreateStudent(s models.Student) (string, error) {
	id, err := r.insertStudent(r.DB, s)
	return id, err
}

// insertStudent menjalankan INSERT siswa + class history + auto-sync pada
// queryer yang diberikan (bisa *sql.DB atau *sql.Tx). Tidak membuka transaksi
// sendiri — pemanggil yang mengatur.
func (r *StudentRepository) insertStudent(q SyncQueryer, s models.Student) (string, error) {
	mergeStudentDefaults(&s, nil)
	if s.ID == "" {
		s.ID = cuid2.Generate()
	}
	// QR siswa: namespace STU- agar tidak bentrok dengan QR aset (BK-).
	// Diisi otomatis bila tidak disediakan; tetap satu QR untuk semua modul.
	if s.QRCode == "" {
		s.QRCode = NewStudentQRCode(s.NISN, s.ID)
	}
	now := time.Now().UnixMilli()

	if err := r.checkDuplicateNISAndNISNQ(q, "", s.NIS, s.NISN); err != nil {
		return "", err
	}

	// Verifikasi kelas yang diberikan user (tolak bila tidak ada).
	if err := validateProvidedClass(q, &s); err != nil {
		return "", err
	}

	// Resolve class linkage: classId ↔ className (verifikasi KETAT).
	if err := resolveClassLinkage(q, &s); err != nil {
		return "", err
	}

	_, err := q.Exec(`
		INSERT INTO students (
			id, nik, nisn, nis, full_name, gender, birth_place, birth_date, religion,
			address, parent_name, father_name, father_nik, mother_name, mother_nik,
			guardian_name, guardian_nik, guardian_job, parent_phone, class_name, class_id,
			status, photo, qr_code, is_active, meta_data, enrolled_at, created_at, updated_at, kip
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, s.ID, s.NIK, s.NISN, s.NIS, s.FullName, s.Gender, s.BirthPlace, s.BirthDate, s.Religion,
		s.Address, s.ParentName, s.FatherName, s.FatherNIK, s.MotherName, s.MotherNIK,
		s.GuardianName, s.GuardianNIK, s.GuardianJob, s.ParentPhone, s.ClassName, s.ClassID,
		s.Status, s.Photo, s.QRCode, s.IsActive, s.MetaData, s.EnrolledAt, now, now, s.KIP)

	if err != nil {
		return "", err
	}

	// Insert initial class history
	if s.ClassID != nil && *s.ClassID != "" {
		var grade int
		var academicYear string
		if err2 := q.QueryRow("SELECT grade, academic_year FROM student_classes WHERE id = ?", *s.ClassID).Scan(&grade, &academicYear); err2 == nil {
			historyID := cuid2.Generate()
			q.Exec(`
				INSERT INTO student_class_history (id, student_id, class_id, class_name, academic_year, grade, status, record_date)
				VALUES (?, ?, ?, ?, ?, ?, 'enrolled', ?)
			`, historyID, s.ID, *s.ClassID, s.ClassName, academicYear, grade, time.Now().Unix())
		}
	}

	_ = AutoSyncStudentToSavingsAndLibrary(q, s.ID)
	_ = AutoSyncStudentToBukuInduk(q, s.ID)

	return s.ID, nil
}

func (r *StudentRepository) UpdateStudent(id string, s models.Student) error {
	return r.updateStudent(r.DB, id, s)
}

// updateStudent menjalankan UPDATE siswa + auto-sync pada queryer yang
// diberikan (bisa *sql.DB atau *sql.Tx).
func (r *StudentRepository) updateStudent(q SyncQueryer, id string, s models.Student) error {
	now := time.Now().UnixMilli()
	existing, err := r.getStudentByID(q, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return sql.ErrNoRows
	}

	// Verifikasi kelas yang diberikan user SEBELUM merge, agar className yang
	// salah tidak tertelan oleh classId lama dari data existing.
	if err := validateProvidedClass(q, &s); err != nil {
		return err
	}

	mergeStudentDefaults(&s, existing)

	if err := r.checkDuplicateNISAndNISNQ(q, id, s.NIS, s.NISN); err != nil {
		return err
	}

	// Enforce student obligations clearance before deactivating
	wasActive := existing.IsActive || existing.Status == "active" || existing.Status == "aktif"
	isNowActive := s.IsActive || s.Status == "active" || s.Status == "aktif"
	if wasActive && !isNowActive {
		clear, reason, err := CheckStudentClearance(q, id)
		if err != nil {
			return err
		}
		if !clear {
			return fmt.Errorf("siswa masih memiliki sangkutan yang belum diselesaikan: %s", reason)
		}
	}

	// Resolve class linkage: classId ↔ className (verifikasi KETAT).
	if err := resolveClassLinkage(q, &s); err != nil {
		return err
	}

	_, err = q.Exec(`
		UPDATE students SET
			nik=?, nisn=?, nis=?, full_name=?, gender=?, birth_place=?, birth_date=?, religion=?,
			address=?, parent_name=?, father_name=?, father_nik=?, mother_name=?, mother_nik=?,
			guardian_name=?, guardian_nik=?, guardian_job=?, parent_phone=?, class_name=?, class_id=?,
			status=?, photo=?, is_active=?, meta_data=?, updated_at=?, kip=?
		WHERE id=?
	`, s.NIK, s.NISN, s.NIS, s.FullName, s.Gender, s.BirthPlace, s.BirthDate, s.Religion,
		s.Address, s.ParentName, s.FatherName, s.FatherNIK, s.MotherName, s.MotherNIK,
		s.GuardianName, s.GuardianNIK, s.GuardianJob, s.ParentPhone, s.ClassName, s.ClassID,
		s.Status, s.Photo, s.IsActive, s.MetaData, now, s.KIP, id)

	if err != nil {
		return err
	}

	_ = AutoSyncStudentToSavingsAndLibrary(q, id)
	_ = AutoSyncStudentToBukuInduk(q, id)

	return nil
}

// BulkRowError mendeskripsikan kegagalan satu baris pada import massal.
type BulkRowError struct {
	Index int    // indeks baris (0-based, sesuai urutan input)
	Error string // pesan kesalahan
}

// BulkUpsertResult merangkum hasil import massal (mode partial).
type BulkUpsertResult struct {
	Inserted int
	Updated  int
	Errors   []BulkRowError
}

// findStudentIDByIdentity mencari siswa existing memakai urutan kunci yang
// konsisten: NISN (unik) → NIS (unik) → NIK. Mengembalikan ID dan, bila
// ditemukan lewat lebih dari satu kunci, mengembalikan error bila kunci-kunci
// itu menunjuk ke siswa yang BERBEDA (identitas bertentangan) agar data tidak
// tertimpa keliru.
func (r *StudentRepository) findStudentIDByIdentity(nisn, nis, nik *string) (string, error) {
	trim := func(p *string) string {
		if p == nil {
			return ""
		}
		return strings.TrimSpace(*p)
	}
	nisnV, nisV, nikV := trim(nisn), trim(nis), trim(nik)

	byID := map[string]bool{}
	found := ""

	lookup := func(query string, arg string) error {
		if arg == "" {
			return nil
		}
		var id string
		err := r.DB.QueryRow(query, arg).Scan(&id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil
			}
			return err
		}
		if found == "" {
			found = id
		}
		byID[id] = true
		return nil
	}

	if err := lookup("SELECT id FROM students WHERE nisn = ?", nisnV); err != nil {
		return "", err
	}
	if err := lookup("SELECT id FROM students WHERE nis = ?", nisV); err != nil {
		return "", err
	}
	if err := lookup("SELECT id FROM students WHERE nik = ?", nikV); err != nil {
		return "", err
	}

	if len(byID) > 1 {
		return "", fmt.Errorf("identitas bertentangan: NISN/NIS/NIK menunjuk ke siswa yang berbeda")
	}
	return found, nil
}

// BulkUpsertStudents meng-import sekumpulan siswa dengan mode PARTIAL: setiap
// baris diproses dalam transaksi tersendiri sehingga baris yang gagal
// di-rollback sebagian (tidak menyisakan data setengah jadi), sementara baris
// yang sukses tetap tersimpan. Siswa existing (dicocokkan via NISN→NIS→NIK)
// akan di-UPDATE (upsert), bukan ditolak.
func (r *StudentRepository) BulkUpsertStudents(students []models.Student) BulkUpsertResult {
	res := BulkUpsertResult{Errors: []BulkRowError{}}

	for i, s := range students {
		updated, err := r.bulkUpsertOne(s)
		if err != nil {
			res.Errors = append(res.Errors, BulkRowError{Index: i, Error: err.Error()})
			continue
		}
		if updated {
			res.Updated++
		} else {
			res.Inserted++
		}
	}

	return res
}

// bulkUpsertOne memproses satu baris siswa dalam transaksi sendiri.
// Mengembalikan updated=true bila baris meng-update siswa existing.
func (r *StudentRepository) bulkUpsertOne(s models.Student) (bool, error) {
	// 1) Cari existing via identitas (NISN→NIS→NIK). Bila bertentangan -> tolak.
	existingID, err := r.findStudentIDByIdentity(s.NISN, s.NIS, s.NIK)
	if err != nil {
		return false, err
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	updated := false
	if existingID != "" {
		s.ID = existingID
		if err := r.updateStudent(tx, existingID, s); err != nil {
			return false, err
		}
		updated = true
	} else {
		s.ID = "" // pastikan insert membuat ID baru
		if _, err := r.insertStudent(tx, s); err != nil {
			return false, err
		}
	}

	if err := tx.Commit(); err != nil {
		return false, err
	}
	return updated, nil
}

func (r *StudentRepository) checkDuplicateNISAndNISN(excludeID string, nis *string, nisn *string) error {
	return r.checkDuplicateNISAndNISNQ(r.DB, excludeID, nis, nisn)
}

// checkDuplicateNISAndNISNQ menerima Queryer agar dapat dipakai di dalam tx.
func (r *StudentRepository) checkDuplicateNISAndNISNQ(db Queryer, excludeID string, nis *string, nisn *string) error {
	if nis != nil && *nis != "" {
		var name string

		// Check students table
		query := "SELECT full_name FROM students WHERE nis = ?"
		args := []interface{}{*nis}
		if excludeID != "" {
			query += " AND id != ?"
			args = append(args, excludeID)
		}
		err := db.QueryRow(query, args...).Scan(&name)
		if err == nil {
			return fmt.Errorf("NIS %s sudah digunakan oleh siswa aktif atas nama %s", *nis, name)
		}

		// Check alumni table
		queryAlumni := "SELECT full_name FROM alumni WHERE nis = ?"
		argsAlumni := []interface{}{*nis}
		if excludeID != "" {
			queryAlumni += " AND student_id != ?"
			argsAlumni = append(argsAlumni, excludeID)
		}
		err = db.QueryRow(queryAlumni, argsAlumni...).Scan(&name)
		if err == nil {
			return fmt.Errorf("NIS %s sudah digunakan oleh alumni/mutasi atas nama %s", *nis, name)
		}
	}

	if nisn != nil && *nisn != "" {
		var name string

		// Check students table
		query := "SELECT full_name FROM students WHERE nisn = ?"
		args := []interface{}{*nisn}
		if excludeID != "" {
			query += " AND id != ?"
			args = append(args, excludeID)
		}
		err := db.QueryRow(query, args...).Scan(&name)
		if err == nil {
			return fmt.Errorf("NISN %s sudah digunakan oleh siswa aktif atas nama %s", *nisn, name)
		}

		// Check alumni table
		queryAlumni := "SELECT full_name FROM alumni WHERE nisn = ?"
		argsAlumni := []interface{}{*nisn}
		if excludeID != "" {
			queryAlumni += " AND student_id != ?"
			argsAlumni = append(argsAlumni, excludeID)
		}
		err = db.QueryRow(queryAlumni, argsAlumni...).Scan(&name)
		if err == nil {
			return fmt.Errorf("NISN %s sudah digunakan oleh alumni/mutasi atas nama %s", *nisn, name)
		}
	}
	return nil
}

func (r *StudentRepository) GetStudentHealth() (*models.StudentHealth, error) {
	var total, missingNIK, missingMother int
	if err := r.DB.QueryRow(`SELECT COUNT(*) FROM students`).Scan(&total); err != nil {
		return nil, err
	}
	if err := r.DB.QueryRow(`SELECT COUNT(*) FROM students WHERE nik IS NULL OR TRIM(nik) = ''`).Scan(&missingNIK); err != nil {
		return nil, err
	}
	if err := r.DB.QueryRow(`SELECT COUNT(*) FROM students WHERE mother_name IS NULL OR TRIM(mother_name) = ''`).Scan(&missingMother); err != nil {
		return nil, err
	}

	// Buku Induk coverage: students without a linked alumni (buku induk) record
	var missingBukuInduk, activeWithoutBukuInduk int
	if err := r.DB.QueryRow(`SELECT COUNT(*) FROM students s WHERE NOT EXISTS (SELECT 1 FROM alumni a WHERE a.student_id = s.id)`).Scan(&missingBukuInduk); err != nil {
		return nil, err
	}
	if err := r.DB.QueryRow(`SELECT COUNT(*) FROM students s WHERE s.is_active = 1 AND NOT EXISTS (SELECT 1 FROM alumni a WHERE a.student_id = s.id)`).Scan(&activeWithoutBukuInduk); err != nil {
		return nil, err
	}

	missingDocs := 0
	missingWeighted := missingNIK + missingMother + missingDocs + activeWithoutBukuInduk
	maxIssues := total * 4
	completeness := 100
	if maxIssues > 0 {
		completeness = int(math.Round((1 - float64(missingWeighted)/float64(maxIssues)) * 100))
		if completeness < 0 {
			completeness = 0
		}
	}

	return &models.StudentHealth{
		TotalStudents:          total,
		MissingNik:             missingNIK,
		MissingMother:          missingMother,
		MissingDocs:            missingDocs,
		MissingBukuInduk:       missingBukuInduk,
		ActiveWithoutBukuInduk: activeWithoutBukuInduk,
		Completeness:           completeness,
	}, nil
}

func (r *StudentRepository) DeleteStudent(id string) error {
	// Siswa dengan tanggungan (buku pinjaman, denda, saldo tabungan) tidak boleh dihapus
	clear, reason, err := CheckStudentClearance(r.DB, id)
	if err != nil {
		return err
	}
	if !clear {
		return fmt.Errorf("siswa tidak dapat dihapus: %s", reason)
	}

	// Soft delete: arsipkan, jangan dibakar — riwayat tabungan/perpustakaan/buku induk tetap utuh
	now := time.Now().UnixMilli()
	_, err = r.DB.Exec(`
		UPDATE students SET is_active = 0, status = 'deleted', updated_at = ? WHERE id = ?
	`, now, id)
	if err != nil {
		return err
	}

	// Sinkronkan status arsip ke buku induk (jangan timpa data kelulusan yang sudah ada)
	_ = AutoSyncStudentToBukuInduk(r.DB, id)
	return nil
}

func (r *StudentRepository) GetStudentsByIDs(ids []string) ([]models.Student, error) {
	if len(ids) == 0 {
		return []models.Student{}, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	orderCases := make([]string, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
		orderCases[i] = "WHEN ? THEN " + fmt.Sprint(i)
	}

	query := fmt.Sprintf(`
		SELECT id, nik, nisn, nis, full_name, gender, birth_place, birth_date, religion,
		       address, parent_name, father_name, father_nik, mother_name, mother_nik,
		       guardian_name, guardian_nik, guardian_job, parent_phone, class_name, class_id,
		       status, photo, qr_code, is_active, meta_data, enrolled_at, created_at, updated_at, kip
		FROM students WHERE id IN (%s)
		ORDER BY CASE id %s END
	`, strings.Join(placeholders, ","), strings.Join(orderCases, " "))
	for _, id := range ids {
		args = append(args, id)
	}

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	students := []models.Student{}
	for rows.Next() {
		var s models.Student
		var nik, nisn, nis, gender, bPlace, bDate, religion, addr, pName, fName, fNik, mName, mNik, gName, gNik, gJob, pPhone, cName, cId, photo, qrCode, meta, kip sql.NullString
		var enrolled, crAt, upAt sql.NullInt64

		err := rows.Scan(
			&s.ID, &nik, &nisn, &nis, &s.FullName, &gender, &bPlace, &bDate, &religion,
			&addr, &pName, &fName, &fNik, &mName, &mNik, &gName, &gNik, &gJob, &pPhone, &cName, &cId,
			&s.Status, &photo, &qrCode, &s.IsActive, &meta, &enrolled, &crAt, &upAt, &kip,
		)
		if err != nil {
			return nil, err
		}

		if nik.Valid {
			s.NIK = &nik.String
		}
		if nisn.Valid {
			s.NISN = &nisn.String
		}
		if nis.Valid {
			s.NIS = &nis.String
		}
		if kip.Valid {
			s.KIP = &kip.String
		}
		if gender.Valid {
			s.Gender = &gender.String
		}
		if bPlace.Valid {
			s.BirthPlace = &bPlace.String
		}
		if bDate.Valid {
			s.BirthDate = &bDate.String
		}
		if religion.Valid {
			s.Religion = &religion.String
		}
		if addr.Valid {
			s.Address = &addr.String
		}
		if pName.Valid {
			s.ParentName = &pName.String
		}
		if fName.Valid {
			s.FatherName = &fName.String
		}
		if fNik.Valid {
			s.FatherNIK = &fNik.String
		}
		if mName.Valid {
			s.MotherName = &mName.String
		}
		if mNik.Valid {
			s.MotherNIK = &mNik.String
		}
		if gName.Valid {
			s.GuardianName = &gName.String
		}
		if gNik.Valid {
			s.GuardianNIK = &gNik.String
		}
		if gJob.Valid {
			s.GuardianJob = &gJob.String
		}
		if pPhone.Valid {
			s.ParentPhone = &pPhone.String
		}
		if cName.Valid {
			s.ClassName = &cName.String
		}
		if cId.Valid {
			s.ClassID = &cId.String
		}
		if photo.Valid {
			s.Photo = &photo.String
		}
		if qrCode.Valid && strings.TrimSpace(qrCode.String) != "" {
			s.QRCode = qrCode.String
		} else {
			s.QRCode = s.ID
		}
		if meta.Valid {
			s.MetaData = &meta.String
		}
		if enrolled.Valid {
			s.EnrolledAt = &enrolled.Int64
		}

		cTime := ToTime(crAt)
		s.CreatedAt = &cTime
		uTime := ToTime(upAt)
		s.UpdatedAt = &uTime

		students = append(students, s)
	}

	return students, nil
}

func (r *StudentRepository) GetClasses() ([]models.StudentClassItem, error) {
	rows, err := r.DB.Query("SELECT DISTINCT class_name FROM students WHERE class_name IS NOT NULL AND class_name != '' AND status != 'deleted' ORDER BY class_name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	classes := []models.StudentClassItem{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		classes = append(classes, models.StudentClassItem{
			ID:   name,
			Name: name,
		})
	}
	return classes, nil
}

func (r *StudentRepository) SimpleSearch(query, className string) ([]models.Student, error) {
	return r.simpleSearch(query, className, 50)
}

func (r *StudentRepository) SimpleSearchAll(className string) ([]models.Student, error) {
	return r.simpleSearch("", className, 0)
}

func (r *StudentRepository) simpleSearch(query, className string, limit int) ([]models.Student, error) {
	sqlQuery := "SELECT s.id, s.full_name, s.nis, s.nisn, s.class_name, s.gender, s.birth_place, s.birth_date, s.nik, s.religion, s.father_name, s.mother_name, s.parent_name, s.guardian_name, s.parent_phone, s.address FROM students s WHERE s.status = 'active'"
	args := []interface{}{}

	if query != "" {
		sqlQuery += " AND (full_name LIKE ? OR nis LIKE ? OR nisn LIKE ?)"
		pattern := "%" + query + "%"
		args = append(args, pattern, pattern, pattern)
	}

	if className != "" {
		sqlQuery += ` AND (
			s.class_name = ?
			OR s.class_id IN (
				SELECT id FROM student_classes
				WHERE name = ? OR CAST(grade AS TEXT) = ?
			)
		)`
		args = append(args, className, className, className)
	}

	sqlQuery += " ORDER BY full_name ASC"
	if limit > 0 {
		sqlQuery += fmt.Sprintf(" LIMIT %d", limit)
	}

	rows, err := r.DB.Query(sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var students []models.Student
	for rows.Next() {
		var s models.Student
		var nis, nisn, cName, gender, bPlace, bDate, nik, religion, fatherName, motherName, pName, guardianName, parentPhone, addr sql.NullString
		err := rows.Scan(&s.ID, &s.FullName, &nis, &nisn, &cName, &gender, &bPlace, &bDate, &nik, &religion, &fatherName, &motherName, &pName, &guardianName, &parentPhone, &addr)
		if err != nil {
			return nil, err
		}
		if nis.Valid {
			s.NIS = &nis.String
		}
		if nisn.Valid {
			s.NISN = &nisn.String
		}
		if cName.Valid {
			s.ClassName = &cName.String
		}
		if gender.Valid {
			s.Gender = &gender.String
		}
		if bPlace.Valid {
			s.BirthPlace = &bPlace.String
		}
		if bDate.Valid {
			s.BirthDate = &bDate.String
		}
		if nik.Valid {
			s.NIK = &nik.String
		}
		if religion.Valid {
			s.Religion = &religion.String
		}
		if fatherName.Valid {
			s.FatherName = &fatherName.String
		}
		if motherName.Valid {
			s.MotherName = &motherName.String
		}
		if pName.Valid {
			s.ParentName = &pName.String
		}
		if guardianName.Valid {
			s.GuardianName = &guardianName.String
		}
		if parentPhone.Valid {
			s.ParentPhone = &parentPhone.String
		}
		if addr.Valid {
			s.Address = &addr.String
		}
		students = append(students, s)
	}
	return students, nil
}

// SyncAllToBukuInduk synchronizes all existing students to the alumni (Buku Induk) table.
func (r *StudentRepository) SyncAllToBukuInduk() (int, error) {
	rows, err := r.DB.Query("SELECT id FROM students")
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}

	syncedCount := 0
	for _, id := range ids {
		if err := AutoSyncStudentToBukuInduk(r.DB, id); err != nil {
			log.Printf("[SyncBukuInduk] Failed to sync student %s: %v", id, err)
		} else {
			syncedCount++
		}
	}

	return syncedCount, nil
}
