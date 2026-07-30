package repository

import (
	"database/sql"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// ───────── Document Types ─────────

func (r *AlumniRepository) GetDocumentTypes() ([]models.AlumniDocumentType, error) {
	rows, err := r.DB.Query("SELECT id, name, code, description, is_required, max_file_size_mb, allowed_types, sort_order FROM alumni_document_types WHERE is_active=1 ORDER BY sort_order ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []models.AlumniDocumentType
	for rows.Next() {
		var t models.AlumniDocumentType
		var desc sql.NullString
		if err := rows.Scan(&t.ID, &t.Name, &t.Code, &desc, &t.IsRequired, &t.MaxFileSizeMB, &t.AllowedTypes, &t.SortOrder); err != nil {
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

// ───────── Documents ─────────

func (r *AlumniRepository) GetAlumniDocuments(alumniID string) ([]models.AlumniDocument, error) {
	rows, err := r.DB.Query(`
		SELECT d.id, d.alumni_id, d.document_type_id, d.file_name, d.file_path, d.file_size, d.mime_type,
		       d.document_number, d.issue_date, d.verification_status, d.notes, d.created_at,
		       t.name, t.code
		FROM alumni_documents d LEFT JOIN alumni_document_types t ON d.document_type_id=t.id
		WHERE d.alumni_id=?`, alumniID)
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
		if err := rows.Scan(&d.ID, &d.AlumniID, &d.DocumentTypeID, &d.FileName, &d.FilePath, &d.FileSize, &d.MimeType,
			&dn, &isd, &d.VerificationStatus, &notes, &crat, &t.Name, &t.Code); err != nil {
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
	_, err := r.DB.Exec(`INSERT INTO alumni_documents (id, alumni_id, document_type_id, file_name, file_path, file_size, mime_type, document_number, issue_date, verification_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, d.AlumniID, d.DocumentTypeID, d.FileName, d.FilePath, d.FileSize, d.MimeType, d.DocumentNumber, d.IssueDate, "pending", d.Notes, now, now)
	return err
}

func (r *AlumniRepository) GetDocumentByID(id string) (*models.AlumniDocument, error) {
	var d models.AlumniDocument
	var t models.AlumniDocumentType
	var documentNumber, issueDate, verifiedBy, verificationNotes, notes, typeName, typeCode sql.NullString
	var verifiedAt, createdAt sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT d.id, d.alumni_id, d.document_type_id, d.file_name, d.file_path, d.file_size,
		       d.mime_type, d.document_number, d.issue_date, d.verification_status,
		       d.verified_by, d.verified_at, d.verification_notes, d.notes, d.created_at,
		       t.name, t.code
		FROM alumni_documents d LEFT JOIN alumni_document_types t ON d.document_type_id=t.id
		WHERE d.id=?`, id).Scan(
		&d.ID, &d.AlumniID, &d.DocumentTypeID, &d.FileName, &d.FilePath, &d.FileSize,
		&d.MimeType, &documentNumber, &issueDate, &d.VerificationStatus,
		&verifiedBy, &verifiedAt, &verificationNotes, &notes, &createdAt,
		&typeName, &typeCode)
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
	res, err := r.DB.Exec(`UPDATE alumni_documents SET verification_status=?, verified_at=?, verification_notes=?, updated_at=? WHERE id=?`, status, now, notes, now, id)
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
	res, err := r.DB.Exec("DELETE FROM alumni_documents WHERE id=?", id)
	if err != nil {
		return nil, err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return nil, sql.ErrNoRows
	}
	return doc, nil
}

// ───────── Photo ─────────

func (r *AlumniRepository) UpdatePhoto(id, photoPath string) error {
	now := time.Now().UnixMilli()
	res, err := r.DB.Exec("UPDATE alumni SET photo=?, updated_at=? WHERE id=?", photoPath, now, id)
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
	if err := r.DB.QueryRow("SELECT photo FROM alumni WHERE id=?", id).Scan(&photo); err != nil {
		return "", err
	}
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec("UPDATE alumni SET photo=NULL, updated_at=? WHERE id=?", now, id)
	if err != nil {
		return "", err
	}
	if photo.Valid {
		return photo.String, nil
	}
	return "", nil
}

// ───────── Pickups ─────────

func (r *AlumniRepository) GetDocumentPickups(alumniID string) ([]models.DocumentPickup, error) {
	rows, err := r.DB.Query(`
		SELECT p.id, p.alumni_id, p.document_type_id, p.recipient_name, p.recipient_relation,
		       p.pickup_date, p.notes, t.name, t.code
		FROM document_pickups p LEFT JOIN alumni_document_types t ON p.document_type_id=t.id
		WHERE p.alumni_id=? ORDER BY p.pickup_date DESC`, alumniID)
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
		if err := rows.Scan(&p.ID, &p.AlumniID, &tid, &p.RecipientName, &rel, &pdate, &notes, &tname, &tcode); err != nil {
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
	_, err := r.DB.Exec(`INSERT INTO document_pickups (id, alumni_id, document_type_id, recipient_name, recipient_relation, recipient_id_number, recipient_phone, pickup_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, p.AlumniID, p.DocumentTypeID, p.RecipientName, p.RecipientRelation, p.RecipientIDNumber, p.RecipientPhone, pDate, p.Notes, now)
	return err
}
