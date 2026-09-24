package config

import (
	"os"
	"strconv"
)

type Config struct {
	Host            string
	Port            string
	TelegramToken   string
	TelegramChatID  string
	TelegramAPI     string
	DBPath          string
	AuthToken       string
	ThumbCacheDir   string
	MaxUploadSize   int64
	AllowedOrigins  string
	ShareExpiryDays int64
	ThumbCleanHours int64
	EncryptionEnabled bool
	EncryptionKey   string
}

func Load() *Config {
	return &Config{
		Host:              getEnv("HOST", ""),
		Port:              getEnv("PORT", "8080"),
		TelegramToken:     getEnv("TELEGRAM_TOKEN", ""),
		TelegramChatID:    getEnv("TELEGRAM_CHAT_ID", ""),
		TelegramAPI:       getEnv("TELEGRAM_API", "https://api.telegram.org"),
		DBPath:            getEnv("DB_PATH", "./cloudstorage.db"),
		AuthToken:         getEnv("AUTH_TOKEN", ""),
		ThumbCacheDir:     getEnv("THUMB_CACHE_DIR", "./thumbcache"),
		MaxUploadSize:     getEnvInt64("MAX_UPLOAD_SIZE", 2048*1024*1024),
		AllowedOrigins:    getEnv("ALLOWED_ORIGINS", ""),
		ShareExpiryDays:   getEnvInt64("SHARE_EXPIRY_DAYS", 0),
		ThumbCleanHours:   getEnvInt64("THUMB_CLEAN_HOURS", 24),
		EncryptionEnabled: getEnv("ENCRYPTION_ENABLED", "false") == "true",
		EncryptionKey:     getEnv("ENCRYPTION_KEY", ""),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvInt64(key string, fallback int64) int64 {
	if val := os.Getenv(key); val != "" {
		if n, err := strconv.ParseInt(val, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}
