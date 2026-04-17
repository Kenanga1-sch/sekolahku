package repository

import (
	"database/sql"
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

func (r *AlumniRepository) SeedDocumentTypes() {
	var count int
	r.DB.QueryRow("SELECT COUNT(*) FROM alumni_document_types").Scan(&count)
	if count > 0 {
		return
	}

	types := []struct {
		Name      string
		Code      string
		Desc      string
		Order     int
		Required  bool
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
		if nisn.Valid { a.NISN = &nisn.String }
		if nis.Valid { a.NIS = &nis.String }
		if gender.Valid { a.Gender = &gender.String }
		if fClass.Valid { a.FinalClass = &fClass.String }
		if photo.Valid { a.Photo = &photo.String }
		if nSchool.Valid { a.NextSchool = &nSchool.String }
		cTime := ToTime(crAt); a.CreatedAt = &cTime
		results = append(results, a)
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
		return nil, err
	}

	if sid.Valid { a.StudentID = &sid.String }
	if nisn.Valid { a.NISN = &nisn.String }
	if nis.Valid { a.NIS = &nis.String }
	if gender.Valid { a.Gender = &gender.String }
	if bp.Valid { a.BirthPlace = &bp.String }
	if bd.Valid { a.BirthDate = &bd.String }
	if fclass.Valid { a.FinalClass = &fclass.String }
	if photo.Valid { a.Photo = &photo.String }
	if pn.Valid { a.ParentName = &pn.String }
	if pp.Valid { a.ParentPhone = &pp.String }
	if ca.Valid { a.CurrentAddress = &ca.String }
	if cp.Valid { a.CurrentPhone = &cp.String }
	if ce.Valid { a.CurrentEmail = &ce.String }
	if ns.Valid { a.NextSchool = &ns.String }
	if notes.Valid { a.Notes = &notes.String }
	
	gTime := ToTime(gd); a.GraduationDate = &gTime
	cTime := ToTime(crat); a.CreatedAt = &cTime
	uTime := ToTime(upat); a.UpdatedAt = &uTime

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
			graduation_year, final_class, photo, parent_name, parent_phone,
			current_address, current_phone, current_email, next_school, notes,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, 
		id, a.StudentID, a.NISN, a.NIS, a.FullName, a.Gender, a.BirthPlace, a.BirthDate,
		a.GraduationYear, a.FinalClass, a.Photo, a.ParentName, a.ParentPhone,
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
			graduation_year = ?, final_class = ?, photo = ?, parent_name = ?, parent_phone = ?,
			current_address = ?, current_phone = ?, current_email = ?, next_school = ?, 
			notes = ?, updated_at = ?
		WHERE id = ?
	`
	_, err := r.DB.Exec(query,
		a.NISN, a.NIS, a.FullName, a.Gender, a.BirthPlace, a.BirthDate,
		a.GraduationYear, a.FinalClass, a.Photo, a.ParentName, a.ParentPhone,
		a.CurrentAddress, a.CurrentPhone, a.CurrentEmail, a.NextSchool, 
		a.Notes, now, id,
	)
	return err
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
		if desc.Valid { t.Description = &desc.String }
		results = append(results, t)
	}
	return results, nil
}

func (r *AlumniRepository) GetAlumniDocuments(alumniID string) ([]models.AlumniDocument, error) {
	query := `
		SELECT d.id, d.alumni_id, d.document_type_id, d.file_name, d.file_path, d.file_size, d.mime_type, 
		       d.document_number, d.issue_date, d.verification_status, d.created_at,
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
		var dn, isd sql.NullString
		var crat sql.NullInt64
		err := rows.Scan(&d.ID, &d.AlumniID, &d.DocumentTypeID, &d.FileName, &d.FilePath, &d.FileSize, &d.MimeType, 
			&dn, &isd, &d.VerificationStatus, &crat, &t.Name, &t.Code)
		if err != nil {
			return nil, err
		}
		if dn.Valid { d.DocumentNumber = &dn.String }
		if isd.Valid { d.IssueDate = &isd.String }
		cTime := ToTime(crat); d.CreatedAt = &cTime
		t.ID = d.DocumentTypeID
		d.DocumentType = &t
		results = append(results, d)
	}
	return results, nil
}

func (r *AlumniRepository) CreateDocument(d models.AlumniDocument) error {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	query := `
		INSERT INTO alumni_documents (
			id, alumni_id, document_type_id, file_name, file_path, file_size, 
			mime_type, document_number, issue_date, verification_status, 
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query,
		id, d.AlumniID, d.DocumentTypeID, d.FileName, d.FilePath, d.FileSize,
		d.MimeType, d.DocumentNumber, d.IssueDate, "pending",
		now, now,
	)
	return err
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
		
		if tid.Valid { p.DocumentTypeID = &tid.String }
		if rel.Valid { p.RecipientRelation = &rel.String }
		if notes.Valid { p.Notes = &notes.String }
		if tname.Valid && tcode.Valid {
			dt.ID = tid.String
			dt.Name = tname.String
			dt.Code = tcode.String
			p.DocumentType = &dt
		}
		
		pTime := ToTime(pdate); p.PickupDate = &pTime
		results = append(results, p)
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
