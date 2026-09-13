package repository

import (
	"database/sql"
	"errors"
	"strings"
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

// generateTicket membuat kode tiket 6 karakter dari cuid2 (alfanumerik).
// Dicoba beberapa kali menghadapi bentrokan; praktis tidak pernah terjadi.
func generateTicket() string {
	s := strings.ToLower(cuid2.Generate())
	if len(s) > 6 {
		s = s[:6]
	}
	return s
}

func (r *ContactRepository) CreateMessage(req models.SubmitContactRequest) (id, ticket string, err error) {
	now := time.Now().UnixMilli()
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = "Anonim"
	}
	for attempt := 0; attempt < 5; attempt++ {
		id = cuid2.Generate()
		ticket = generateTicket()
		var exists int
		if err = r.DB.QueryRow(`SELECT COUNT(*) FROM contact_messages WHERE ticket = ?`, ticket).Scan(&exists); err != nil {
			return "", "", err
		}
		if exists > 0 {
			continue
		}
		_, err = r.DB.Exec(`
			INSERT INTO contact_messages (id, name, email, phone, subject, message, category, status, ticket, is_read, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, 'baru', ?, 0, ?, ?)
		`, id, name, strings.TrimSpace(req.Email), strings.TrimSpace(req.Phone), strings.TrimSpace(req.Subject), req.Message, req.Category, ticket, now, now)
		return id, ticket, err
	}
	return "", "", errors.New("gagal membuat kode tiket unik")
}

func (r *ContactRepository) GetMessages(page, perPage int, category string) ([]models.ContactMessage, int, error) {
	offset := (page - 1) * perPage

	where := ""
	args := []interface{}{}
	if category != "" {
		where = " WHERE category = ?"
		args = append(args, category)
	}

	var total int
	if err := r.DB.QueryRow(`SELECT COUNT(*) FROM contact_messages`+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `SELECT id, COALESCE(name,''), COALESCE(email,''), COALESCE(phone,''), COALESCE(subject,''), message,
		COALESCE(category,'lainnya'), COALESCE(status,'baru'), COALESCE(ticket,''), is_read, created_at, COALESCE(updated_at, created_at)
		FROM contact_messages` + where + ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
	rows, err := r.DB.Query(query, append(args, perPage, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []models.ContactMessage
	for rows.Next() {
		var m models.ContactMessage
		var ca, ua int64
		var isRead int
		if err := rows.Scan(&m.ID, &m.Name, &m.Email, &m.Phone, &m.Subject, &m.Message, &m.Category, &m.Status, &m.Ticket, &isRead, &ca, &ua); err != nil {
			return nil, 0, err
		}
		m.IsRead = isRead == 1
		m.CreatedAt = time.UnixMilli(ca)
		m.UpdatedAt = time.UnixMilli(ua)
		list = append(list, m)
	}
	if list == nil {
		list = []models.ContactMessage{}
	}
	return list, total, nil
}

// GetStatusByTicket mengambil ringkasan tiket untuk halaman cek status publik.
// Balasan disertakan sebagai "Tim Sekolah" — nama asli admin tidak diekspos.
func (r *ContactRepository) GetStatusByTicket(ticket string) (*models.ContactStatusView, error) {
	var v models.ContactStatusView
	var ca, ua int64
	err := r.DB.QueryRow(`
		SELECT COALESCE(category,'lainnya'), COALESCE(status,'baru'), COALESCE(ticket,''), created_at, COALESCE(updated_at, created_at)
		FROM contact_messages WHERE ticket = ?
	`, ticket).Scan(&v.Category, &v.Status, &v.Ticket, &ca, &ua)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	v.CreatedAt = time.UnixMilli(ca)
	v.UpdatedAt = time.UnixMilli(ua)
	if err := r.DB.QueryRow(
		`SELECT COUNT(*) FROM contact_attachments WHERE message_id = (SELECT id FROM contact_messages WHERE ticket = ?) AND kind = 'resolution'`,
		ticket,
	).Scan(&v.ResolutionCount); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	// Balasan tindak lanjut (publik: "Tim Sekolah").
	rows, err := r.DB.Query(`
		SELECT body, created_at FROM contact_replies
		WHERE message_id = (SELECT id FROM contact_messages WHERE ticket = ?)
		ORDER BY created_at ASC
	`, ticket)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	v.Replies = make([]models.ContactStatusReplyView, 0)
	for rows.Next() {
		var rep models.ContactStatusReplyView
		var rca int64
		if err := rows.Scan(&rep.Body, &rca); err != nil {
			return nil, err
		}
		rep.By = "Tim Sekolah"
		rep.CreatedAt = time.UnixMilli(rca)
		v.Replies = append(v.Replies, rep)
	}
	return &v, nil
}

// GetMessageByID mengambil satu pesan lengkap (untuk halaman detail admin).
// Tidak menyertakan lampiran — ambil lewat GetAttachments.
func (r *ContactRepository) GetMessageByID(id string) (*models.ContactMessage, error) {
	var m models.ContactMessage
	var ca, ua int64
	var isRead int
	err := r.DB.QueryRow(`
		SELECT id, COALESCE(name,''), COALESCE(email,''), COALESCE(phone,''), COALESCE(subject,''), message,
			COALESCE(category,'lainnya'), COALESCE(status,'baru'), COALESCE(ticket,''), is_read, created_at, COALESCE(updated_at, created_at)
		FROM contact_messages WHERE id = ?
	`, id).Scan(&m.ID, &m.Name, &m.Email, &m.Phone, &m.Subject, &m.Message, &m.Category, &m.Status, &m.Ticket, &isRead, &ca, &ua)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	m.IsRead = isRead == 1
	m.CreatedAt = time.UnixMilli(ca)
	m.UpdatedAt = time.UnixMilli(ua)
	return &m, nil
}

// AddReply mencatat balasan tindak lanjut dari admin.
func (r *ContactRepository) AddReply(messageID, body, authorID, authorName string) (string, error) {
	id := cuid2.Generate()
	_, err := r.DB.Exec(`
		INSERT INTO contact_replies (id, message_id, body, author_id, author_name, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, messageID, body, authorID, authorName, time.Now().UnixMilli())
	return id, err
}

// GetReplies daftar balasan satu pesan (internal admin — nama asli tampil).
func (r *ContactRepository) GetReplies(messageID string) ([]models.ContactReply, error) {
	rows, err := r.DB.Query(`
		SELECT id, message_id, body, COALESCE(author_id,''), COALESCE(author_name,''), created_at
		FROM contact_replies WHERE message_id = ? ORDER BY created_at ASC
	`, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.ContactReply
	for rows.Next() {
		var rep models.ContactReply
		var authorID string
		var ca int64
		if err := rows.Scan(&rep.ID, &rep.MessageID, &rep.Body, &authorID, &rep.AuthorName, &ca); err != nil {
			return nil, err
		}
		if authorID != "" {
			rep.AuthorID = &authorID
		}
		rep.CreatedAt = time.UnixMilli(ca)
		list = append(list, rep)
	}
	if list == nil {
		list = []models.ContactReply{}
	}
	return list, nil
}

// AddAttachment mencatat lampiran yang sudah tersimpan di disk.
func (r *ContactRepository) AddAttachment(a models.ContactAttachment) (string, error) {
	if a.ID == "" {
		a.ID = cuid2.Generate()
	}
	if a.CreatedAt.IsZero() {
		a.CreatedAt = time.Now()
	}
	_, err := r.DB.Exec(`
		INSERT INTO contact_attachments (id, message_id, kind, file_kind, file_path, original_name, file_size, mime_type, uploaded_by, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, a.ID, a.MessageID, a.Kind, a.FileKind, a.FilePath, a.OriginalName, a.FileSize, a.MimeType, a.UploadedBy, a.CreatedAt.UnixMilli())
	return a.ID, err
}

// GetAttachments daftar lampiran satu pesan.
func (r *ContactRepository) GetAttachments(messageID string) ([]models.ContactAttachment, error) {
	rows, err := r.DB.Query(`
		SELECT id, message_id, kind, file_kind, file_path, COALESCE(original_name,''), file_size, COALESCE(mime_type,''), uploaded_by, created_at
		FROM contact_attachments WHERE message_id = ? ORDER BY created_at ASC
	`, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.ContactAttachment
	for rows.Next() {
		var a models.ContactAttachment
		var ca int64
		var uploaded sql.NullString
		if err := rows.Scan(&a.ID, &a.MessageID, &a.Kind, &a.FileKind, &a.FilePath, &a.OriginalName, &a.FileSize, &a.MimeType, &uploaded, &ca); err != nil {
			return nil, err
		}
		if uploaded.Valid {
			a.UploadedBy = &uploaded.String
		}
		a.CreatedAt = time.UnixMilli(ca)
		list = append(list, a)
	}
	return list, nil
}

// UpdateStatus menandai penindaklanjutan admin; mengubah status otomatis
// dianggap sudah dibaca.
func (r *ContactRepository) UpdateStatus(id, status string) error {
	res, err := r.DB.Exec(`UPDATE contact_messages SET status = ?, is_read = 1, updated_at = ? WHERE id = ?`, status, time.Now().UnixMilli(), id)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
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
