package repository

import (
	"database/sql"
	"errors"
	"os"
	"strings"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
)

type TelegramBackupRepository struct {
	db *sql.DB
}

func NewTelegramBackupRepository(db *sql.DB) *TelegramBackupRepository {
	return &TelegramBackupRepository{db: db}
}

// envCloudToken/envCloudChatID membaca kredensial bot & chat yang dipakai
// Cloud Storage. Backup Telegram memakai bot dan chat yang SAMA dengan Cloud
// Storage sebagai default, sehingga admin tidak perlu mengisi ulang.
func envCloudToken() string {
	return strings.TrimSpace(os.Getenv("CLOUDSTORAGE_BOT_TOKEN"))
}

func envCloudChatID() string {
	return strings.TrimSpace(os.Getenv("CLOUDSTORAGE_CHAT_ID"))
}

// applyEnvFallback mengisi bot_token/chat_id dari ENV Cloud Storage bila kolom
// di DB masih kosong. Nilai yang sudah diisi admin (non-kosong) tidak ditimpa,
// sehingga admin tetap bisa memakai bot/chat berbeda bila mau.
func applyEnvFallback(s *models.TelegramBackupSettings) {
	if s.BotToken == "" {
		s.BotToken = envCloudToken()
	}
	if s.ChatID == "" {
		s.ChatID = envCloudChatID()
	}
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
			token := envCloudToken()
			chatID := envCloudChatID()
			// Bila bot/chat Cloud Storage tersedia, langsung aktifkan default.
			enabled := 0
			if token != "" && chatID != "" {
				enabled = 1
			}
			_, err = r.db.Exec(`
				INSERT INTO telegram_backup_settings (id, bot_token, chat_id, is_enabled, created_at, updated_at) 
				VALUES ('default', ?, ?, ?, ?, ?)
			`, token, chatID, enabled, now, now)
			if err != nil {
				return nil, err
			}
			return &models.TelegramBackupSettings{
				ID:        "default",
				BotToken:  token,
				ChatID:    chatID,
				IsEnabled: enabled == 1,
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

	// Default dari Cloud Storage bila kolom DB masih kosong.
	applyEnvFallback(&s)

	return &s, nil
}

// EnsureDefaults memastikan baris default ada, terisi token/chat dari Cloud
// Storage bila kosong, dan is_enabled aktif secara bawaan. Idempoten: hanya
// mengisi kolom yang masih kosong dan hanya menyalakan flag bila belum
// dinyalakan, sehingga tidak menimpa konfigurasi admin.
func (r *TelegramBackupRepository) EnsureDefaults() error {
	token := envCloudToken()
	chatID := envCloudChatID()

	// Pastikan baris default ada (GetSettings membuatnya bila belum ada).
	if _, err := r.GetSettings(); err != nil {
		return err
	}

	now := time.Now().UnixMilli()

	// Isi token/chat yang masih kosong dari ENV Cloud Storage.
	if token != "" {
		if _, err := r.db.Exec(`
			UPDATE telegram_backup_settings
			SET bot_token = ?, updated_at = ?
			WHERE id = 'default' AND (bot_token IS NULL OR bot_token = '')
		`, token, now); err != nil {
			return err
		}
	}
	if chatID != "" {
		if _, err := r.db.Exec(`
			UPDATE telegram_backup_settings
			SET chat_id = ?, updated_at = ?
			WHERE id = 'default' AND (chat_id IS NULL OR chat_id = '')
		`, chatID, now); err != nil {
			return err
		}
	}

	// Aktifkan backup secara bawaan bila kredensial tersedia.
	if token != "" && chatID != "" {
		if _, err := r.db.Exec(`
			UPDATE telegram_backup_settings
			SET is_enabled = 1, updated_at = ?
			WHERE id = 'default' AND is_enabled = 0
		`, now); err != nil {
			return err
		}
	}

	return nil
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
