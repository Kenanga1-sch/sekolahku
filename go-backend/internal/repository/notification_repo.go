package repository

import (
	"database/sql"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type NotificationRepository struct {
	DB *sql.DB
}

func NewNotificationRepository(db *sql.DB) *NotificationRepository {
	return &NotificationRepository{DB: db}
}

func (r *NotificationRepository) GetNotifications(userID string, limit, offset int) ([]models.Notification, error) {
	if limit < 1 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	query := `
		SELECT id, user_id, type, category, title, message, target_url, is_read, metadata, created_at
		FROM admin_notifications
		WHERE (user_id IS NULL OR user_id = ?)
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`
	rows, err := r.DB.Query(query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notifications := make([]models.Notification, 0)
	for rows.Next() {
		var n models.Notification
		var uID, target, meta sql.NullString
		if err := rows.Scan(
			&n.ID, &uID, &n.Type, &n.Category, &n.Title, &n.Message, &target, &n.IsRead, &meta, &n.CreatedAt,
		); err != nil {
			return nil, err
		}
		if uID.Valid { n.UserID = &uID.String }
		if target.Valid { n.TargetURL = &target.String }
		if meta.Valid { n.Metadata = &meta.String }
		notifications = append(notifications, n)
	}

	return notifications, nil
}

func (r *NotificationRepository) GetStats(userID string) (models.NotificationStats, error) {
	query := `
		SELECT COUNT(*) FROM admin_notifications 
		WHERE (user_id IS NULL OR user_id = ?) AND is_read = 0
	`
	var count int
	err := r.DB.QueryRow(query, userID).Scan(&count)
	return models.NotificationStats{UnreadCount: count}, err
}

// CountNotifications total notifikasi untuk user (broadcast + personal).
func (r *NotificationRepository) CountNotifications(userID string) (int, error) {
	var count int
	err := r.DB.QueryRow(`
		SELECT COUNT(*) FROM admin_notifications
		WHERE (user_id IS NULL OR user_id = ?)
	`, userID).Scan(&count)
	return count, err
}

func (r *NotificationRepository) MarkAsRead(id string) error {
	_, err := r.DB.Exec("UPDATE admin_notifications SET is_read = 1 WHERE id = ?", id)
	return err
}

func (r *NotificationRepository) MarkAllAsRead(userID string) error {
	_, err := r.DB.Exec("UPDATE admin_notifications SET is_read = 1 WHERE (user_id IS NULL OR user_id = ?)", userID)
	return err
}

func (r *NotificationRepository) CreateNotification(n models.Notification) error {
	if n.ID == "" {
		n.ID = cuid2.Generate()
	}
	if n.CreatedAt == 0 {
		n.CreatedAt = time.Now().UnixMilli()
	}

	query := `
		INSERT INTO admin_notifications (id, user_id, type, category, title, message, target_url, is_read, metadata, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, n.ID, n.UserID, n.Type, n.Category, n.Title, n.Message, n.TargetURL, n.IsRead, n.Metadata, n.CreatedAt)
	return err
}

// MarkConversationRead tandai sudah dibaca semua notifikasi yang menunjuk
// ke satu percakapan chat (target_url = /chat/open?c=<convId>). Dipanggil
// saat user membuka percakapan supaya badge langsung bersih.
func (r *NotificationRepository) MarkConversationRead(userID, convID string) error {
	_, err := r.DB.Exec(`
		UPDATE admin_notifications SET is_read = 1
		WHERE user_id = ? AND category = 'chat' AND target_url = ?
	`, userID, "/chat/open?c="+convID)
	return err
}

func (r *NotificationRepository) BroadcastNotification(n models.Notification) error {
	n.UserID = nil // NULL user_id means broadcast to all
	return r.CreateNotification(n)
}

// NotifyRoles mengirim notifikasi individual (bukan broadcast) ke semua
// user yang memegang salah satu role. Fan-out per user menjaga pengaduan
// sensitif tetap terkalung ke penerima yang tepat — broadcast akan bocor
// ke guru/staff yang bukan sasaran.
// ID dikumpulkan dulu sebelum insert agar tidak menahan cursor saat
// menulis (aman untuk pool koneksi kecil).
func (r *NotificationRepository) NotifyRoles(n models.Notification, roles ...string) error {
	if len(roles) == 0 {
		return nil
	}
	placeholders := ""
	args := make([]interface{}, 0, len(roles))
	for i, role := range roles {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		args = append(args, role)
	}
	rows, err := r.DB.Query(`SELECT id FROM users WHERE role IN (`+placeholders+`)`, args...)
	if err != nil {
		return err
	}
	ids := make([]string, 0, 8)
	for rows.Next() {
		var uid string
		if err := rows.Scan(&uid); err != nil {
			rows.Close()
			return err
		}
		ids = append(ids, uid)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	now := time.Now().UnixMilli()
	for _, uid := range ids {
		nn := n
		nn.UserID = &uid
		nn.ID = cuid2.Generate()
		nn.CreatedAt = now
		if err := r.CreateNotification(nn); err != nil {
			return err
		}
	}
	return nil
}
