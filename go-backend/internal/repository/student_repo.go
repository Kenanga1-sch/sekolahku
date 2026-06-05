package repository

import (
	"database/sql"
	"errors"
	"fmt"
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
			where = append(where, "(status = 'active' OR is_active = 1)")
		case "inactive", "nonactive", "non-active", "tidak aktif", "non-aktif":
			where = append(where, "(status = 'inactive' OR is_active = 0)")
		default:
			where = append(where, "status = ?")
			args = append(args, statusLower)
		}
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
		var nik, nisn, nis, gender, className, photo, qrCode, kip sql.NullString
		var crAt sql.NullInt64

		err = rows.Scan(&s.ID, &nik, &nisn, &nis, &s.FullName, &gender, &className, &s.Status, &photo, &qrCode, &s.IsActive, &crAt, &kip)
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
		if className.Valid {
			s.ClassName = &className.String
		}
		if photo.Valid {
			s.Photo = &photo.String
		}
		if qrCode.Valid && strings.TrimSpace(qrCode.String) != "" {
			s.QRCode = qrCode.String
		} else {
			s.QRCode = s.ID
		}

		cTime := ToTime(crAt)
		s.CreatedAt = &cTime
		students = append(students, s)
	}

	// Summary
	var totalActive int
	r.DB.QueryRow("SELECT COUNT(*) FROM students WHERE status = 'active'").Scan(&totalActive)

	countRows, _ := r.DB.Query(`
		SELECT class_name, COUNT(*) as count 
		FROM students 
		WHERE status = 'active' AND class_name IS NOT NULL 
		GROUP BY class_name
	`)
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
			ByClass: byClass,
		},
	}, nil
}

func (r *StudentRepository) GetStudentByID(id string) (*models.Student, error) {
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

	err := r.DB.QueryRow(query, id).Scan(
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
	mergeStudentDefaults(&s, nil)
	if s.ID == "" {
		s.ID = cuid2.Generate()
	}
	if s.QRCode == "" {
		s.QRCode = s.ID
	} // Simplified QR for now
	now := time.Now().UnixMilli()

	// Get Class Name if classId is provided
	if s.ClassID != nil && *s.ClassID != "" {
		var className string
		if err := r.DB.QueryRow("SELECT name FROM student_classes WHERE id = ?", *s.ClassID).Scan(&className); err == nil {
			s.ClassName = &className
		}
	}

	_, err := r.DB.Exec(`
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

	return s.ID, err
}

func (r *StudentRepository) UpdateStudent(id string, s models.Student) error {
	now := time.Now().UnixMilli()
	existing, err := r.GetStudentByID(id)
	if err != nil {
		return err
	}
	if existing == nil {
		return sql.ErrNoRows
	}
	mergeStudentDefaults(&s, existing)

	if s.ClassID != nil && *s.ClassID != "" {
		var className string
		if err := r.DB.QueryRow("SELECT name FROM student_classes WHERE id = ?", *s.ClassID).Scan(&className); err == nil {
			s.ClassName = &className
		}
	}

	_, err = r.DB.Exec(`
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
	return err
}

func (r *StudentRepository) GetStudentHealth() (map[string]interface{}, error) {
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

	missingDocs := 0
	missingWeighted := missingNIK + missingMother + missingDocs
	maxIssues := total * 3
	completeness := 100
	if maxIssues > 0 {
		completeness = int(math.Round((1 - float64(missingWeighted)/float64(maxIssues)) * 100))
		if completeness < 0 {
			completeness = 0
		}
	}

	return map[string]interface{}{
		"totalStudents": total,
		"missingNik":    missingNIK,
		"missingMother": missingMother,
		"missingDocs":   missingDocs,
		"completeness":  completeness,
	}, nil
}

func (r *StudentRepository) DeleteStudent(id string) error {
	_, err := r.DB.Exec("DELETE FROM students WHERE id = ?", id)
	return err
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

func (r *StudentRepository) GetClasses() ([]map[string]interface{}, error) {
	rows, err := r.DB.Query("SELECT DISTINCT class_name FROM students WHERE class_name IS NOT NULL AND class_name != '' ORDER BY class_name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	classes := []map[string]interface{}{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		classes = append(classes, map[string]interface{}{
			"id":   name,
			"name": name,
		})
	}
	return classes, nil
}

func (r *StudentRepository) SimpleSearch(query, className string) ([]models.Student, error) {
	sqlQuery := "SELECT id, full_name, nis, nisn, class_name, gender, birth_place, birth_date, parent_name, guardian_name, parent_phone, address FROM students WHERE status = 'active'"
	args := []interface{}{}

	if query != "" {
		sqlQuery += " AND (full_name LIKE ? OR nis LIKE ? OR nisn LIKE ?)"
		pattern := "%" + query + "%"
		args = append(args, pattern, pattern, pattern)
	}

	if className != "" {
		sqlQuery += " AND class_name = ?"
		args = append(args, className)
	}

	sqlQuery += " ORDER BY full_name ASC LIMIT 50"

	rows, err := r.DB.Query(sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var students []models.Student
	for rows.Next() {
		var s models.Student
		var nis, nisn, cName, gender, bPlace, bDate, pName, guardianName, parentPhone, addr sql.NullString
		err := rows.Scan(&s.ID, &s.FullName, &nis, &nisn, &cName, &gender, &bPlace, &bDate, &pName, &guardianName, &parentPhone, &addr)
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
