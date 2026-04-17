package repository

import (
	"database/sql"
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

func (r *StudentRepository) GetStudents(page, limit int, query, status string) (*models.StudentResponse, error) {
	offset := (page - 1) * limit
	
	where := []string{"1=1"}
	args := []interface{}{}
	
	if query != "" {
		where = append(where, "(full_name LIKE ? OR nis LIKE ? OR nisn LIKE ?)")
		searchTerm := "%" + query + "%"
		args = append(args, searchTerm, searchTerm, searchTerm)
	}
	
	if status != "" {
		where = append(where, "status = ?")
		args = append(args, status)
	}
	
	whereClause := strings.Join(where, " AND ")
	
	// Count total
	var total int
	err := r.DB.QueryRow("SELECT COUNT(*) FROM students WHERE "+whereClause, args...).Scan(&total)
	if err != nil { return nil, err }
	
	// Get data
	selectQuery := fmt.Sprintf(`
		SELECT id, nik, nisn, nis, full_name, gender, class_name, status, is_active, created_at
		FROM students
		WHERE %s
		ORDER BY full_name ASC
		LIMIT ? OFFSET ?
	`, whereClause)
	
	listArgs := append(args, limit, offset)
	rows, err := r.DB.Query(selectQuery, listArgs...)
	if err != nil { return nil, err }
	defer rows.Close()
	
	students := []models.Student{}
	for rows.Next() {
		var s models.Student
		var nik, nisn, nis, gender, className sql.NullString
		var crAt sql.NullInt64
		
		err = rows.Scan(&s.ID, &nik, &nisn, &nis, &s.FullName, &gender, &className, &s.Status, &s.IsActive, &crAt)
		if err != nil { return nil, err }
		
		if nik.Valid { s.NIK = &nik.String }
		if nisn.Valid { s.NISN = &nisn.String }
		if nis.Valid { s.NIS = &nis.String }
		if gender.Valid { s.Gender = &gender.String }
		if className.Valid { s.ClassName = &className.String }
		
		cTime := ToTime(crAt); s.CreatedAt = &cTime
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
			if name.Valid { bc.ClassName = &name.String }
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
		       status, photo, qr_code, is_active, meta_data, enrolled_at, created_at, updated_at
		FROM students WHERE id = ?
	`
	var s models.Student
	var nik, nisn, nis, gender, bPlace, bDate, religion, addr, pName, fName, fNik, mName, mNik, gName, gNik, gJob, pPhone, cName, cId, photo, meta sql.NullString
	var enrolled, crAt, upAt sql.NullInt64

	err := r.DB.QueryRow(query, id).Scan(
		&s.ID, &nik, &nisn, &nis, &s.FullName, &gender, &bPlace, &bDate, &religion,
		&addr, &pName, &fName, &fNik, &mName, &mNik, &gName, &gNik, &gJob, &pPhone, &cName, &cId,
		&s.Status, &photo, &s.QRCode, &s.IsActive, &meta, &enrolled, &crAt, &upAt,
	)
	if err != nil { return nil, err }

	if nik.Valid { s.NIK = &nik.String }
	if nisn.Valid { s.NISN = &nisn.String }
	if nis.Valid { s.NIS = &nis.String }
	if gender.Valid { s.Gender = &gender.String }
	if bPlace.Valid { s.BirthPlace = &bPlace.String }
	if bDate.Valid { s.BirthDate = &bDate.String }
	if religion.Valid { s.Religion = &religion.String }
	if addr.Valid { s.Address = &addr.String }
	if pName.Valid { s.ParentName = &pName.String }
	if fName.Valid { s.FatherName = &fName.String }
	if fNik.Valid { s.FatherNIK = &fNik.String }
	if mName.Valid { s.MotherName = &mName.String }
	if mNik.Valid { s.MotherNIK = &mNik.String }
	if gName.Valid { s.GuardianName = &gName.String }
	if gNik.Valid { s.GuardianNIK = &gNik.String }
	if gJob.Valid { s.GuardianJob = &gJob.String }
	if pPhone.Valid { s.ParentPhone = &pPhone.String }
	if cName.Valid { s.ClassName = &cName.String }
	if cId.Valid { s.ClassID = &cId.String }
	if photo.Valid { s.Photo = &photo.String }
	if meta.Valid { s.MetaData = &meta.String }
	if enrolled.Valid { s.EnrolledAt = &enrolled.Int64 }
	
	cTime := ToTime(crAt); s.CreatedAt = &cTime
	uTime := ToTime(upAt); s.UpdatedAt = &uTime

	return &s, nil
}

func (r *StudentRepository) CreateStudent(s models.Student) (string, error) {
	if s.ID == "" { s.ID = cuid2.Generate() }
	if s.QRCode == "" { s.QRCode = s.ID } // Simplified QR for now
	now := time.Now().UnixMilli()
	
	// Get Class Name if classId is provided
	if s.ClassID != nil && *s.ClassID != "" {
		r.DB.QueryRow("SELECT name FROM student_classes WHERE id = ?", *s.ClassID).Scan(&s.ClassName)
	}

	_, err := r.DB.Exec(`
		INSERT INTO students (
			id, nik, nisn, nis, full_name, gender, birth_place, birth_date, religion,
			address, parent_name, father_name, father_nik, mother_name, mother_nik,
			guardian_name, guardian_nik, guardian_job, parent_phone, class_name, class_id,
			status, photo, qr_code, is_active, meta_data, enrolled_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, s.ID, s.NIK, s.NISN, s.NIS, s.FullName, s.Gender, s.BirthPlace, s.BirthDate, s.Religion,
		s.Address, s.ParentName, s.FatherName, s.FatherNIK, s.MotherName, s.MotherNIK,
		s.GuardianName, s.GuardianNIK, s.GuardianJob, s.ParentPhone, s.ClassName, s.ClassID,
		s.Status, s.Photo, s.QRCode, s.IsActive, s.MetaData, s.EnrolledAt, now, now)
	
	return s.ID, err
}

func (r *StudentRepository) UpdateStudent(id string, s models.Student) error {
	now := time.Now().UnixMilli()
	
	if s.ClassID != nil && *s.ClassID != "" {
		r.DB.QueryRow("SELECT name FROM student_classes WHERE id = ?", *s.ClassID).Scan(&s.ClassName)
	}

	_, err := r.DB.Exec(`
		UPDATE students SET
			nik=?, nisn=?, nis=?, full_name=?, gender=?, birth_place=?, birth_date=?, religion=?,
			address=?, parent_name=?, father_name=?, father_nik=?, mother_name=?, mother_nik=?,
			guardian_name=?, guardian_nik=?, guardian_job=?, parent_phone=?, class_name=?, class_id=?,
			status=?, photo=?, is_active=?, meta_data=?, updated_at=?
		WHERE id=?
	`, s.NIK, s.NISN, s.NIS, s.FullName, s.Gender, s.BirthPlace, s.BirthDate, s.Religion,
		s.Address, s.ParentName, s.FatherName, s.FatherNIK, s.MotherName, s.MotherNIK,
		s.GuardianName, s.GuardianNIK, s.GuardianJob, s.ParentPhone, s.ClassName, s.ClassID,
		s.Status, s.Photo, s.IsActive, s.MetaData, now, id)
	return err
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
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}

	query := fmt.Sprintf(`
		SELECT id, nik, nisn, nis, full_name, gender, birth_place, birth_date, religion,
		       address, parent_name, father_name, father_nik, mother_name, mother_nik,
		       guardian_name, guardian_nik, guardian_job, parent_phone, class_name, class_id,
		       status, photo, qr_code, is_active, meta_data, enrolled_at, created_at, updated_at
		FROM students WHERE id IN (%s)
	`, strings.Join(placeholders, ","))

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	students := []models.Student{}
	for rows.Next() {
		var s models.Student
		var nik, nisn, nis, gender, bPlace, bDate, religion, addr, pName, fName, fNik, mName, mNik, gName, gNik, gJob, pPhone, cName, cId, photo, meta sql.NullString
		var enrolled, crAt, upAt sql.NullInt64

		err := rows.Scan(
			&s.ID, &nik, &nisn, &nis, &s.FullName, &gender, &bPlace, &bDate, &religion,
			&addr, &pName, &fName, &fNik, &mName, &mNik, &gName, &gNik, &gJob, &pPhone, &cName, &cId,
			&s.Status, &photo, &s.QRCode, &s.IsActive, &meta, &enrolled, &crAt, &upAt,
		)
		if err != nil {
			return nil, err
		}

		if nik.Valid { s.NIK = &nik.String }
		if nisn.Valid { s.NISN = &nisn.String }
		if nis.Valid { s.NIS = &nis.String }
		if gender.Valid { s.Gender = &gender.String }
		if bPlace.Valid { s.BirthPlace = &bPlace.String }
		if bDate.Valid { s.BirthDate = &bDate.String }
		if religion.Valid { s.Religion = &religion.String }
		if addr.Valid { s.Address = &addr.String }
		if pName.Valid { s.ParentName = &pName.String }
		if fName.Valid { s.FatherName = &fName.String }
		if fNik.Valid { s.FatherNIK = &fNik.String }
		if mName.Valid { s.MotherName = &mName.String }
		if mNik.Valid { s.MotherNIK = &mNik.String }
		if gName.Valid { s.GuardianName = &gName.String }
		if gNik.Valid { s.GuardianNIK = &gNik.String }
		if gJob.Valid { s.GuardianJob = &gJob.String }
		if pPhone.Valid { s.ParentPhone = &pPhone.String }
		if cName.Valid { s.ClassName = &cName.String }
		if cId.Valid { s.ClassID = &cId.String }
		if photo.Valid { s.Photo = &photo.String }
		if meta.Valid { s.MetaData = &meta.String }
		if enrolled.Valid { s.EnrolledAt = &enrolled.Int64 }

		cTime := ToTime(crAt); s.CreatedAt = &cTime
		uTime := ToTime(upAt); s.UpdatedAt = &uTime

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
	sqlQuery := "SELECT id, full_name, nis, nisn, class_name, gender, birth_place, birth_date, parent_name, address FROM students WHERE status = 'active'"
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
	if err != nil { return nil, err }
	defer rows.Close()

	var students []models.Student
	for rows.Next() {
		var s models.Student
		var nis, nisn, cName, gender, bPlace, bDate, pName, addr sql.NullString
		err := rows.Scan(&s.ID, &s.FullName, &nis, &nisn, &cName, &gender, &bPlace, &bDate, &pName, &addr)
		if err != nil { return nil, err }
		if nis.Valid { s.NIS = &nis.String }
		if nisn.Valid { s.NISN = &nisn.String }
		if cName.Valid { s.ClassName = &cName.String }
		if gender.Valid { s.Gender = &gender.String }
		if bPlace.Valid { s.BirthPlace = &bPlace.String }
		if bDate.Valid { s.BirthDate = &bDate.String }
		if pName.Valid { s.ParentName = &pName.String }
		if addr.Valid { s.Address = &addr.String }
		students = append(students, s)
	}
	return students, nil
}
