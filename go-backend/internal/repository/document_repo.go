package repository

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/sekolahku/go-backend/internal/models"
)

type DocumentRepository struct {
	DB *sql.DB
}

func NewDocumentRepository(db *sql.DB) *DocumentRepository {
	return &DocumentRepository{DB: db}
}

func (r *DocumentRepository) Create(doc models.SchoolDocument) error {
	_, err := r.DB.Exec(`
		INSERT INTO school_documents (id, document_type, title, recipient, reference_id, file_path, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, doc.ID, doc.DocumentType, doc.Title, doc.Recipient, doc.ReferenceID, doc.FilePath, doc.CreatedBy, doc.CreatedAt, doc.UpdatedAt)
	return err
}

func (r *DocumentRepository) GetByID(id string) (*models.SchoolDocument, error) {
	var doc models.SchoolDocument
	err := r.DB.QueryRow(`
		SELECT id, document_type, title, recipient, reference_id, file_path, created_by, created_at, updated_at
		FROM school_documents WHERE id = ?
	`, id).Scan(&doc.ID, &doc.DocumentType, &doc.Title, &doc.Recipient, &doc.ReferenceID, &doc.FilePath, &doc.CreatedBy, &doc.CreatedAt, &doc.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

func (r *DocumentRepository) Update(doc models.SchoolDocument) error {
	_, err := r.DB.Exec(`
		UPDATE school_documents SET document_type = ?, title = ?, recipient = ?, updated_at = ?
		WHERE id = ?
	`, doc.DocumentType, doc.Title, doc.Recipient, doc.UpdatedAt, doc.ID)
	return err
}

// SchoolDocumentListItem extends SchoolDocument with the creator's display name.
type SchoolDocumentListItem struct {
	models.SchoolDocument
	CreatedByName string `json:"createdByName"`
}

func (r *DocumentRepository) List(page, limit int, search, docType string) ([]SchoolDocumentListItem, int, error) {
	offset := (page - 1) * limit
	where := "1=1"
	args := []interface{}{}

	if search != "" {
		where += " AND (d.title LIKE ? OR d.recipient LIKE ?)"
		args = append(args, "%"+search+"%", "%"+search+"%")
	}
	if docType != "" {
		where += " AND d.document_type = ?"
		args = append(args, docType)
	}

	var total int
	err := r.DB.QueryRow("SELECT COUNT(*) FROM school_documents d WHERE "+where, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	sqlQuery := fmt.Sprintf(`
		SELECT d.id, d.document_type, d.title, d.recipient, d.reference_id, d.file_path, d.created_by, d.created_at, d.updated_at,
		       COALESCE(u.full_name, u.name, '') AS created_by_name
		FROM school_documents d
		LEFT JOIN users u ON d.created_by = u.id
		WHERE %s ORDER BY d.created_at DESC LIMIT ? OFFSET ?`, where)
	args = append(args, limit, offset)

	rows, err := r.DB.Query(sqlQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var docs []SchoolDocumentListItem
	for rows.Next() {
		var item SchoolDocumentListItem
		err := rows.Scan(&item.ID, &item.DocumentType, &item.Title, &item.Recipient, &item.ReferenceID, &item.FilePath, &item.CreatedBy, &item.CreatedAt, &item.UpdatedAt, &item.CreatedByName)
		if err != nil {
			log.Printf("[WARN] document_repo.List: scan error: %v", err)
			continue
		}
		docs = append(docs, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return docs, total, nil
}

func (r *DocumentRepository) Delete(id string) (int64, error) {
	result, err := r.DB.Exec("DELETE FROM school_documents WHERE id = ?", id)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
