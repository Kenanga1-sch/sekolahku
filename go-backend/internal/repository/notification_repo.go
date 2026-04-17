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

func (r *NotificationRepository) GetNotifications(userID string, limit int) ([]models.Notification, error) {
	query := `
		SELECT id, user_id, type, category, title, message, target_url, is_read, metadata, created_at
		FROM admin_notifications
		WHERE (user_id IS NULL OR user_id = ?)
		ORDER BY created_at DESC
		LIMIT ?
	`
	rows, err := r.DB.Query(query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []models.Notification
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
