package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type AlumniRepository struct {
	DB *sql.DB
}

func NewAlumniRepository(db *sql.DB) *AlumniRepository {
	repo := &AlumniRepository{DB: db}
	repo.SeedDocumentTypes()
	return repo
}

func optionalString(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	value := strings.TrimSpace(ns.String)
	if value == "" {
		return nil
	}
	return &value
}

func timeToUnixMilli(t *time.Time) interface{} {
	if t == nil || t.IsZero() {
		return nil
	}
	return t.UnixMilli()
}

func (r *AlumniRepository) SeedDocumentTypes() {
	var count int
	r.DB.QueryRow("SELECT COUNT(*) FROM alumni_document_types").Scan(&count)
	if count > 0 {
		return
	}

	types := []struct {
		Name     string
		Code     string
		Desc     string
		Order    int
		Required bool
	}{
		{"Ijazah", "IJZ", "Dokumen Ijazah Asli/Legalisir", 1, true},
		{"SKHUN", "SKH", "Surat Keterangan Hasil Ujian Nasional", 2, true},
		{"Raport Akhir", "RPT", "Raport semester akhir", 3, false},
		{"SKKB", "SKB", "Surat Keterangan Kelakuan Baik", 4, false},
	}

	for _, t := range types {
		id := cuid2.Generate()
		now := time.Now().UnixMilli()
		r.DB.Exec(`
			INSERT INTO alumni_document_types (id, name, code, description, sort_order, is_required, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, id, t.Name, t.Code, t.Desc, t.Order, t.Required, now, now)
	}
}

func (r *AlumniRepository) GetAlumni(page, limit int, search, year string) ([]models.Alumni, int, error) {
	offset := (page - 1) * limit
	query := "SELECT id, nisn, nis, full_name, gender, graduation_year, final_class, photo, next_school, created_at FROM alumni WHERE 1=1"
	var args []interface{}

	if search != "" {
		query += " AND (full_name LIKE ? OR nisn LIKE ? OR nis LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern, pattern)
	}
	if year != "" {
		query += " AND graduation_year = ?"
		args = append(args, year)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM ("+query+")", args...).Scan(&total)

	query += " ORDER BY graduation_year DESC, full_name ASC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.Alumni
	for rows.Next() {
		var a models.Alumni
		var nisn, nis, gender, fClass, photo, nSchool sql.NullString
		var crAt sql.NullInt64
		err := rows.Scan(&a.ID, &nisn, &nis, &a.FullName, &gender, &a.GraduationYear, &fClass, &photo, &nSchool, &crAt)
		if err != nil {
			return nil, 0, err
		}
		a.NISN = optionalString(nisn)
		a.NIS = optionalString(nis)
		a.Gender = optionalString(gender)
		a.FinalClass = optionalString(fClass)
		a.Photo = optionalString(photo)
		a.NextSchool = optionalString(nSchool)
		a.CreatedAt = SafeTime(crAt)
		results = append(results, a)
	}
	if results == nil {
		results = []models.Alumni{}
	}
	return results, total, nil
}

func (r *AlumniRepository) GetAlumniByID(id string) (*models.Alumni, error) {
	query := `
		SELECT id, student_id, nisn, nis, full_name, gender, birth_place, birth_date, 
		       graduation_year, graduation_date, final_class, photo, parent_name, 
			   parent_phone, current_address, current_phone, current_email, 
			   next_school, notes, created_at, updated_at 
		FROM alumni WHERE id = ?
	`
	var a models.Alumni
	var sid, nisn, nis, gender, bp, bd, fclass, photo, pn, pp, ca, cp, ce, ns, notes sql.NullString
	var gd, crat, upat sql.NullInt64

	err := r.DB.QueryRow(query, id).Scan(
		&a.ID, &sid, &nisn, &nis, &a.FullName, &gender, &bp, &bd,
		&a.GraduationYear, &gd, &fclass, &photo, &pn, &pp, &ca, &cp,
		&ce, &ns, &notes, &crat, &upat,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	a.StudentID = optionalString(sid)
	a.NISN = optionalString(nisn)
	a.NIS = optionalString(nis)
	a.Gender = optionalString(gender)
	a.BirthPlace = optionalString(bp)
	a.BirthDate = optionalString(bd)
	a.FinalClass = optionalString(fclass)
	a.Photo = optionalString(photo)
	a.ParentName = optionalString(pn)
	a.ParentPhone = optionalString(pp)
	a.CurrentAddress = optionalString(ca)
	a.CurrentPhone = optionalString(cp)
	a.CurrentEmail = optionalString(ce)
	a.NextSchool = optionalString(ns)
	a.Notes = optionalString(notes)
	a.GraduationDate = SafeTime(gd)
	a.CreatedAt = SafeTime(crat)
	a.UpdatedAt = SafeTime(upat)

	// Load Documents
	a.Documents, _ = r.GetAlumniDocuments(id)

	// Load Pickups
	a.Pickups, _ = r.GetDocumentPickups(id)

	return &a, nil
}

func (r *AlumniRepository) CreateAlumni(a models.Alumni) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	query := `
		INSERT INTO alumni (
			id, student_id, nisn, nis, full_name, gender, birth_place, birth_date,
			graduation_year, graduation_date, final_class, photo, parent_name, parent_phone,
			current_address, current_phone, current_email, next_school, notes,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query,
		id, a.StudentID, a.NISN, a.NIS, a.FullName, a.Gender, a.BirthPlace, a.BirthDate,
		a.GraduationYear, timeToUnixMilli(a.GraduationDate), a.FinalClass, a.Photo, a.ParentName, a.ParentPhone,
		a.CurrentAddress, a.CurrentPhone, a.CurrentEmail, a.NextSchool, a.Notes,
		now, now,
	)
	return id, err
}

func (r *AlumniRepository) UpdateAlumni(id string, a models.Alumni) error {
	now := time.Now().UnixMilli()
	query := `
		UPDATE alumni SET
			nisn = ?, nis = ?, full_name = ?, gender = ?, birth_place = ?, birth_date = ?,
			graduation_year = ?, graduation_date = ?, final_class = ?, photo = ?, parent_name = ?, parent_phone = ?,
			current_address = ?, current_phone = ?, current_email = ?, next_school = ?, 
			notes = ?, updated_at = ?
		WHERE id = ?
	`
	_, err := r.DB.Exec(query,
		a.NISN, a.NIS, a.FullName, a.Gender, a.BirthPlace, a.BirthDate,
		a.GraduationYear, timeToUnixMilli(a.GraduationDate), a.FinalClass, a.Photo, a.ParentName, a.ParentPhone,
		a.CurrentAddress, a.CurrentPhone, a.CurrentEmail, a.NextSchool,
		a.Notes, now, id,
	)
	return err
}

func (r *AlumniRepository) GraduateStudents(studentIDs []string, graduationYear string, graduationDate *time.Time, deactivateStudents bool) ([]models.Alumni, int, int, error) {
	if len(studentIDs) == 0 {
		return []models.Alumni{}, 0, 0, nil
	}
	if strings.TrimSpace(graduationYear) == "" {
		return nil, 0, 0, fmt.Errorf("tahun kelulusan wajib diisi")
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return nil, 0, 0, err
	}
	defer tx.Rollback()

	now := time.Now().UnixMilli()
	results := []models.Alumni{}
	created := 0
	deactivated := 0

	for _, studentID := range studentIDs {
		studentID = strings.TrimSpace(studentID)
		if studentID == "" {
			continue
		}

		var nisn, nis, gender, birthPlace, birthDate, address, parentName, parentPhone, className, classID, photo sql.NullString
		var fullName string
		err := tx.QueryRow(`
			SELECT nisn, nis, full_name, gender, birth_place, birth_date, address,
			       parent_name, parent_phone, class_name, class_id, photo
			FROM students
			WHERE id = ?
		`, studentID).Scan(&nisn, &nis, &fullName, &gender, &birthPlace, &birthDate, &address, &parentName, &parentPhone, &className, &classID, &photo)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, created, deactivated, fmt.Errorf("siswa tidak ditemukan: %s", studentID)
			}
			return nil, created, deactivated, err
		}

		var existingID string
		checkArgs := []interface{}{studentID}
		checkQuery := "SELECT id FROM alumni WHERE student_id = ?"
		if nisnPtr := optionalString(nisn); nisnPtr != nil {
			checkQuery += " OR nisn = ?"
			checkArgs = append(checkArgs, *nisnPtr)
		}

		existingErr := tx.QueryRow(checkQuery+" LIMIT 1", checkArgs...).Scan(&existingID)
		alumniID := existingID
		if existingErr != nil {
			if !errors.Is(existingErr, sql.ErrNoRows) {
				return nil, created, deactivated, existingErr
			}

			alumniID = cuid2.Generate()
			_, err = tx.Exec(`
				INSERT INTO alumni (
					id, student_id, nisn, nis, full_name, gender, birth_place, birth_date,
					graduation_year, graduation_date, final_class, photo, parent_name,
					parent_phone, current_address, notes, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				alumniID, studentID, optionalString(nisn), optionalString(nis), fullName,
				optionalString(gender), optionalString(birthPlace), optionalString(birthDate),
				graduationYear, timeToUnixMilli(graduationDate), optionalString(className),
				optionalString(photo), optionalString(parentName), optionalString(parentPhone),
				optionalString(address), nil, now, now,
			)
			if err != nil {
				return nil, created, deactivated, err
			}
			created++
		}

		if deactivateStudents {
			res, err := tx.Exec(`
				UPDATE students
				SET status = 'graduated', is_active = 0, class_id = NULL, class_name = NULL, updated_at = ?
				WHERE id = ? AND (is_active = 1 OR status != 'graduated')
			`, now, studentID)
			if err != nil {
				return nil, created, deactivated, err
			}
			if rows, _ := res.RowsAffected(); rows > 0 {
				deactivated++
			}
		}

		historyID := cuid2.Generate()
		_, _ = tx.Exec(`
			INSERT INTO student_class_history (id, student_id, class_id, class_name, academic_year, status, record_date)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, historyID, studentID, optionalString(classID), optionalString(className), graduationYear, "graduated", now)

		alumni := models.Alumni{
			ID:             alumniID,
			StudentID:      &studentID,
			NISN:           optionalString(nisn),
			NIS:            optionalString(nis),
			FullName:       fullName,
			Gender:         optionalString(gender),
			BirthPlace:     optionalString(birthPlace),
			BirthDate:      optionalString(birthDate),
			GraduationYear: graduationYear,
			GraduationDate: graduationDate,
			FinalClass:     optionalString(className),
			Photo:          optionalString(photo),
			ParentName:     optionalString(parentName),
			ParentPhone:    optionalString(parentPhone),
			CurrentAddress: optionalString(address),
		}
		results = append(results, alumni)
	}

	if err := tx.Commit(); err != nil {
		return nil, created, deactivated, err
	}

	return results, created, deactivated, nil
}

func (r *AlumniRepository) DeleteAlumni(id string) error {
	_, err := r.DB.Exec("DELETE FROM alumni WHERE id = ?", id)
	return err
}

func (r *AlumniRepository) GetAlumniStats() (*models.AlumniStats, error) {
	stats := &models.AlumniStats{}
	r.DB.QueryRow("SELECT COUNT(*) FROM alumni").Scan(&stats.TotalAlumni)
	r.DB.QueryRow("SELECT COUNT(*) FROM alumni_documents").Scan(&stats.TotalDocuments)
	r.DB.QueryRow("SELECT COUNT(*) FROM alumni_documents WHERE verification_status = 'pending'").Scan(&stats.PendingVerification)
	return stats, nil
}

func (r *AlumniRepository) GetDocumentTypes() ([]models.AlumniDocumentType, error) {
	rows, err := r.DB.Query("SELECT id, name, code, description, is_required, max_file_size_mb, allowed_types, sort_order FROM alumni_document_types WHERE is_active = 1 ORDER BY sort_order ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.AlumniDocumentType
	for rows.Next() {
		var t models.AlumniDocumentType
		var desc sql.NullString
		err := rows.Scan(&t.ID, &t.Name, &t.Code, &desc, &t.IsRequired, &t.MaxFileSizeMB, &t.AllowedTypes, &t.SortOrder)
		if err != nil {
			return nil, err
		}
		t.Description = optionalString(desc)
		results = append(results, t)
	}
	if results == nil {
		results = []models.AlumniDocumentType{}
	}
	return results, nil
}

func (r *AlumniRepository) GetAlumniDocuments(alumniID string) ([]models.AlumniDocument, error) {
	query := `
		SELECT d.id, d.alumni_id, d.document_type_id, d.file_name, d.file_path, d.file_size, d.mime_type, 
		       d.document_number, d.issue_date, d.verification_status, d.notes, d.created_at,
			   t.name, t.code
		FROM alumni_documents d
		LEFT JOIN alumni_document_types t ON d.document_type_id = t.id
		WHERE d.alumni_id = ?
	`
	rows, err := r.DB.Query(query, alumniID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.AlumniDocument
	for rows.Next() {
		var d models.AlumniDocument
		var t models.AlumniDocumentType
		var dn, isd, notes sql.NullString
		var crat sql.NullInt64
		err := rows.Scan(&d.ID, &d.AlumniID, &d.DocumentTypeID, &d.FileName, &d.FilePath, &d.FileSize, &d.MimeType,
			&dn, &isd, &d.VerificationStatus, &notes, &crat, &t.Name, &t.Code)
		if err != nil {
			return nil, err
		}
		d.DocumentNumber = optionalString(dn)
		d.IssueDate = optionalString(isd)
		d.Notes = optionalString(notes)
		d.CreatedAt = SafeTime(crat)
		t.ID = d.DocumentTypeID
		d.DocumentType = &t
		results = append(results, d)
	}
	if results == nil {
		results = []models.AlumniDocument{}
	}
	return results, nil
}

func (r *AlumniRepository) CreateDocument(d models.AlumniDocument) error {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	query := `
		INSERT INTO alumni_documents (
			id, alumni_id, document_type_id, file_name, file_path, file_size, 
			mime_type, document_number, issue_date, verification_status, notes,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query,
		id, d.AlumniID, d.DocumentTypeID, d.FileName, d.FilePath, d.FileSize,
		d.MimeType, d.DocumentNumber, d.IssueDate, "pending", d.Notes,
		now, now,
	)
	return err
}

func (r *AlumniRepository) GetDocumentByID(id string) (*models.AlumniDocument, error) {
	query := `
		SELECT d.id, d.alumni_id, d.document_type_id, d.file_name, d.file_path, d.file_size,
		       d.mime_type, d.document_number, d.issue_date, d.verification_status,
		       d.verified_by, d.verified_at, d.verification_notes, d.notes, d.created_at,
		       t.name, t.code
		FROM alumni_documents d
		LEFT JOIN alumni_document_types t ON d.document_type_id = t.id
		WHERE d.id = ?
	`
	var d models.AlumniDocument
	var t models.AlumniDocumentType
	var documentNumber, issueDate, verifiedBy, verificationNotes, notes, typeName, typeCode sql.NullString
	var verifiedAt, createdAt sql.NullInt64
	err := r.DB.QueryRow(query, id).Scan(
		&d.ID, &d.AlumniID, &d.DocumentTypeID, &d.FileName, &d.FilePath, &d.FileSize,
		&d.MimeType, &documentNumber, &issueDate, &d.VerificationStatus,
		&verifiedBy, &verifiedAt, &verificationNotes, &notes, &createdAt,
		&typeName, &typeCode,
	)
	if err != nil {
		return nil, err
	}
	d.DocumentNumber = optionalString(documentNumber)
	d.IssueDate = optionalString(issueDate)
	d.VerifiedBy = optionalString(verifiedBy)
	d.VerifiedAt = SafeTime(verifiedAt)
	d.VerificationNotes = optionalString(verificationNotes)
	d.Notes = optionalString(notes)
	d.CreatedAt = SafeTime(createdAt)
	if typeName.Valid {
		t.ID = d.DocumentTypeID
		t.Name = typeName.String
		t.Code = typeCode.String
		d.DocumentType = &t
	}
	return &d, nil
}

func (r *AlumniRepository) VerifyDocument(id, status string, notes *string) error {
	now := time.Now().UnixMilli()
	res, err := r.DB.Exec(`
		UPDATE alumni_documents
		SET verification_status = ?, verified_at = ?, verification_notes = ?, updated_at = ?
		WHERE id = ?
	`, status, now, notes, now, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *AlumniRepository) DeleteDocument(id string) (*models.AlumniDocument, error) {
	doc, err := r.GetDocumentByID(id)
	if err != nil {
		return nil, err
	}
	res, err := r.DB.Exec("DELETE FROM alumni_documents WHERE id = ?", id)
	if err != nil {
		return nil, err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return nil, sql.ErrNoRows
	}
	return doc, nil
}

func (r *AlumniRepository) UpdatePhoto(id, photoPath string) error {
	now := time.Now().UnixMilli()
	res, err := r.DB.Exec("UPDATE alumni SET photo = ?, updated_at = ? WHERE id = ?", photoPath, now, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *AlumniRepository) RemovePhoto(id string) (string, error) {
	var photo sql.NullString
	if err := r.DB.QueryRow("SELECT photo FROM alumni WHERE id = ?", id).Scan(&photo); err != nil {
		return "", err
	}
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec("UPDATE alumni SET photo = NULL, updated_at = ? WHERE id = ?", now, id)
	if err != nil {
		return "", err
	}
	if photo.Valid {
		return photo.String, nil
	}
	return "", nil
}

func (r *AlumniRepository) GetDocumentPickups(alumniID string) ([]models.DocumentPickup, error) {
	query := `
		SELECT p.id, p.alumni_id, p.document_type_id, p.recipient_name, p.recipient_relation, 
		       p.pickup_date, p.notes, t.name, t.code
		FROM document_pickups p
		LEFT JOIN alumni_document_types t ON p.document_type_id = t.id
		WHERE p.alumni_id = ?
		ORDER BY p.pickup_date DESC
	`
	rows, err := r.DB.Query(query, alumniID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.DocumentPickup
	for rows.Next() {
		var p models.DocumentPickup
		var dt models.AlumniDocumentType
		var tid, rel, notes, tname, tcode sql.NullString
		var pdate sql.NullInt64

		err := rows.Scan(&p.ID, &p.AlumniID, &tid, &p.RecipientName, &rel, &pdate, &notes, &tname, &tcode)
		if err != nil {
			return nil, err
		}

		p.DocumentTypeID = optionalString(tid)
		p.RecipientRelation = optionalString(rel)
		p.Notes = optionalString(notes)
		if tname.Valid && tcode.Valid {
			dt.ID = tid.String
			dt.Name = tname.String
			dt.Code = tcode.String
			p.DocumentType = &dt
		}

		p.PickupDate = SafeTime(pdate)
		results = append(results, p)
	}
	if results == nil {
		results = []models.DocumentPickup{}
	}
	return results, nil
}

func (r *AlumniRepository) CreatePickup(p models.DocumentPickup) error {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()

	var pDate int64
	if p.PickupDate != nil {
		pDate = p.PickupDate.UnixMilli()
	} else {
		pDate = now
	}

	query := `
		INSERT INTO document_pickups (
			id, alumni_id, document_type_id, recipient_name, recipient_relation,
			recipient_id_number, recipient_phone, pickup_date, notes, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query,
		id, p.AlumniID, p.DocumentTypeID, p.RecipientName, p.RecipientRelation,
		p.RecipientIDNumber, p.RecipientPhone, pDate, p.Notes, now,
	)
	return err
}
