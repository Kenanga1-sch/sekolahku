package repository

import (
	"database/sql"
	"time"

	"github.com/nrednav/cuid2"
)

// StudentDocument adalah dokumen pribadi siswa (KK, akta, KIP, dsb).
type StudentDocument struct {
	ID         string  `json:"id"`
	StudentID  string  `json:"studentId"`
	Title      string  `json:"title"`
	Type       string  `json:"type"`
	FilePath   string  `json:"filePath"`
	UploadedBy *string `json:"uploadedBy"`
	UploadedAt int64   `json:"uploadedAt"`
}

type StudentDocumentRepository struct {
	DB *sql.DB
}

func NewStudentDocumentRepository(db *sql.DB) *StudentDocumentRepository {
	return &StudentDocumentRepository{DB: db}
}

func (r *StudentDocumentRepository) ListByStudent(studentID string) ([]StudentDocument, error) {
	rows, err := r.DB.Query(`
		SELECT id, student_id, title, doc_type, file_path, uploaded_by, created_at
		FROM student_documents
		WHERE student_id = ?
		ORDER BY created_at DESC
	`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	docs := make([]StudentDocument, 0, 4)
	for rows.Next() {
		var d StudentDocument
		var uploadedBy sql.NullString
		if err := rows.Scan(&d.ID, &d.StudentID, &d.Title, &d.Type, &d.FilePath, &uploadedBy, &d.UploadedAt); err != nil {
			return nil, err
		}
		if uploadedBy.Valid {
			d.UploadedBy = &uploadedBy.String
		}
		docs = append(docs, d)
	}
	return docs, rows.Err()
}

func (r *StudentDocumentRepository) Create(d StudentDocument) error {
	if d.ID == "" {
		d.ID = cuid2.Generate()
	}
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO student_documents (id, student_id, title, doc_type, file_path, uploaded_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, d.ID, d.StudentID, d.Title, d.Type, d.FilePath, d.UploadedBy, now, now)
	return err
}

// GetByID mengambil dokumen sekaligus memastikan ia milik studentID.
func (r *StudentDocumentRepository) GetByID(studentID, docID string) (*StudentDocument, error) {
	var d StudentDocument
	var uploadedBy sql.NullString
	err := r.DB.QueryRow(`
		SELECT id, student_id, title, doc_type, file_path, uploaded_by, created_at
		FROM student_documents
		WHERE id = ? AND student_id = ?
	`, docID, studentID).Scan(&d.ID, &d.StudentID, &d.Title, &d.Type, &d.FilePath, &uploadedBy, &d.UploadedAt)
	if err != nil {
		return nil, err
	}
	if uploadedBy.Valid {
		d.UploadedBy = &uploadedBy.String
	}
	return &d, nil
}

func (r *StudentDocumentRepository) Delete(studentID, docID string) (bool, error) {
	res, err := r.DB.Exec(`DELETE FROM student_documents WHERE id = ? AND student_id = ?`, docID, studentID)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// StudentExists memastikan siswa ada sebelum menyimpan dokumen (FK).
func (r *StudentDocumentRepository) StudentExists(studentID string) (bool, error) {
	var n int
	err := r.DB.QueryRow(`SELECT COUNT(*) FROM students WHERE id = ?`, studentID).Scan(&n)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}
