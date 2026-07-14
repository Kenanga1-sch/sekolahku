package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
)

type TelegramBackupRepository struct {
	db *sql.DB
}

func NewTelegramBackupRepository(db *sql.DB) *TelegramBackupRepository {
	return &TelegramBackupRepository{db: db}
}

// GetSettings retrieves the telegram backup settings. Creates default if not exists.
func (r *TelegramBackupRepository) GetSettings() (*models.TelegramBackupSettings, error) {
	row := r.db.QueryRow(`
		SELECT id, bot_token, chat_id, is_enabled, last_backup_at, created_at, updated_at 
		FROM telegram_backup_settings 
		WHERE id = 'default'
	`)

	var s models.TelegramBackupSettings
	var botToken, chatId sql.NullString
	var isEnabled int
	var lastBackupAt sql.NullInt64

	err := row.Scan(
		&s.ID,
		&botToken,
		&chatId,
		&isEnabled,
		&lastBackupAt,
		&s.CreatedAt,
		&s.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Insert default row
			now := time.Now().UnixMilli()
			_, err = r.db.Exec(`
				INSERT INTO telegram_backup_settings (id, bot_token, chat_id, is_enabled, created_at, updated_at) 
				VALUES ('default', '', '', 0, ?, ?)
			`, now, now)
			if err != nil {
				return nil, err
			}
			return &models.TelegramBackupSettings{
				ID:        "default",
				CreatedAt: now,
				UpdatedAt: now,
			}, nil
		}
		return nil, err
	}

	s.BotToken = botToken.String
	s.ChatID = chatId.String
	s.IsEnabled = isEnabled == 1
	if lastBackupAt.Valid {
		s.LastBackupAt = lastBackupAt.Int64
	}

	return &s, nil
}

// UpdateSettings updates the telegram backup settings
func (r *TelegramBackupRepository) UpdateSettings(s *models.TelegramBackupSettings) error {
	now := time.Now().UnixMilli()
	
	isEnabledInt := 0
	if s.IsEnabled {
		isEnabledInt = 1
	}

	_, err := r.db.Exec(`
		UPDATE telegram_backup_settings 
		SET bot_token = ?, chat_id = ?, is_enabled = ?, updated_at = ?
		WHERE id = 'default'
	`, s.BotToken, s.ChatID, isEnabledInt, now)

	return err
}

// UpdateLastBackupTime updates the last_backup_at timestamp
func (r *TelegramBackupRepository) UpdateLastBackupTime() error {
	now := time.Now().UnixMilli()
	_, err := r.db.Exec(`
		UPDATE telegram_backup_settings 
		SET last_backup_at = ?, updated_at = ?
		WHERE id = 'default'
	`, now, now)
	return err
}
