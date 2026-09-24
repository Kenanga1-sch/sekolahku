package config

import (
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	for _, k := range []string{"HOST", "PORT", "TELEGRAM_TOKEN", "TELEGRAM_CHAT_ID", "TELEGRAM_API", "DB_PATH", "AUTH_TOKEN", "THUMB_CACHE_DIR", "MAX_UPLOAD_SIZE", "ALLOWED_ORIGINS"} {
		t.Setenv(k, "")
	}
	cfg := Load()
	if cfg.Host != "" {
		t.Errorf("expected empty host, got %s", cfg.Host)
	}
	if cfg.Port != "8080" {
		t.Errorf("expected port 8080, got %s", cfg.Port)
	}
	if cfg.TelegramAPI != "https://api.telegram.org" {
		t.Errorf("expected default telegram api, got %s", cfg.TelegramAPI)
	}
	if cfg.DBPath != "./cloudstorage.db" {
		t.Errorf("expected default db path, got %s", cfg.DBPath)
	}
	if cfg.ThumbCacheDir != "./thumbcache" {
		t.Errorf("expected default thumb cache dir, got %s", cfg.ThumbCacheDir)
	}
	if cfg.MaxUploadSize != 2048*1024*1024 {
		t.Errorf("expected default max upload size, got %d", cfg.MaxUploadSize)
	}
	if cfg.AllowedOrigins != "" {
		t.Errorf("expected empty allowed origins, got %s", cfg.AllowedOrigins)
	}
}

func TestLoadOverrides(t *testing.T) {
	t.Setenv("PORT", "9000")
	t.Setenv("MAX_UPLOAD_SIZE", "1048576")
	t.Setenv("ALLOWED_ORIGINS", "https://example.com")
	cfg := Load()
	if cfg.Port != "9000" {
		t.Errorf("expected port 9000, got %s", cfg.Port)
	}
	if cfg.MaxUploadSize != 1048576 {
		t.Errorf("expected max upload size 1048576, got %d", cfg.MaxUploadSize)
	}
	if cfg.AllowedOrigins != "https://example.com" {
		t.Errorf("expected allowed origins https://example.com, got %s", cfg.AllowedOrigins)
	}
}

func TestLoadInvalidIntFallsBack(t *testing.T) {
	t.Setenv("MAX_UPLOAD_SIZE", "not-a-number")
	cfg := Load()
	if cfg.MaxUploadSize != 2048*1024*1024 {
		t.Errorf("expected fallback max upload size, got %d", cfg.MaxUploadSize)
	}
}
