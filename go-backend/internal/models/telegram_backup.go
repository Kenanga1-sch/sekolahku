package models

// TelegramBackupSettings represents configuration for automated SQLite backups to Telegram
type TelegramBackupSettings struct {
	ID           string `json:"id"`
	BotToken     string `json:"botToken"`
	ChatID       string `json:"chatId"`
	IsEnabled    bool   `json:"isEnabled"`
	LastBackupAt int64  `json:"lastBackupAt"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt"`
}
