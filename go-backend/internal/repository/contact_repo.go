package repository

import (
	"database/sql"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type ContactRepository struct {
	DB *sql.DB
}

func NewContactRepository(db *sql.DB) *ContactRepository {
	return &ContactRepository{DB: db}
}

func (r *ContactRepository) CreateMessage(req models.SubmitContactRequest) (string, error) {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()

	query := `INSERT INTO contact_messages (id, name, email, subject, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`
	_, err := r.DB.Exec(query, id, req.Name, req.Email, req.Subject, req.Message, now)
	return id, err
}

func (r *ContactRepository) GetMessages(page, perPage int) ([]models.ContactMessage, int, error) {
	offset := (page - 1) * perPage

	var total int
	err := r.DB.QueryRow(`SELECT COUNT(*) FROM contact_messages`).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `SELECT id, name, email, subject, message, is_read, created_at FROM contact_messages ORDER BY created_at DESC LIMIT ? OFFSET ?`
	rows, err := r.DB.Query(query, perPage, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []models.ContactMessage
	for rows.Next() {
		var m models.ContactMessage
		var ca int64
		var isRead int
		if err := rows.Scan(&m.ID, &m.Name, &m.Email, &m.Subject, &m.Message, &isRead, &ca); err != nil {
			return nil, 0, err
		}
		m.IsRead = isRead == 1
		m.CreatedAt = time.UnixMilli(ca)
		list = append(list, m)
	}
	if list == nil {
		list = []models.ContactMessage{}
	}
	return list, total, nil
}

func (r *ContactRepository) MarkAsRead(id string) error {
	res, err := r.DB.Exec(`UPDATE contact_messages SET is_read = 1 WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return err
}

func (r *ContactRepository) DeleteMessage(id string) error {
	res, err := r.DB.Exec(`DELETE FROM contact_messages WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}
