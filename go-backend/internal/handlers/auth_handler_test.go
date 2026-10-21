package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

func setupAuthTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			name TEXT,
			email TEXT UNIQUE,
			email_verified INTEGER,
			image TEXT,
			username TEXT,
			password_hash TEXT,
			role TEXT NOT NULL DEFAULT 'user',
			full_name TEXT,
			phone TEXT,
			is_active INTEGER DEFAULT 1,
			must_change_password INTEGER DEFAULT 0,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE audit_logs (
			id TEXT PRIMARY KEY,
			action TEXT,
			resource TEXT,
			details TEXT,
			user_id TEXT,
			user_name TEXT,
			user_email TEXT,
			ip_address TEXT,
			user_agent TEXT,
			created_at INTEGER
		);
	`)
	if err != nil {
		t.Fatalf("failed to create schema: %v", err)
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	_, err = db.Exec(`
		INSERT INTO users (id, name, email, role, password_hash, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 1, 1710000000000, 1710000000000)
	`, "user-1", "Test User", "admin@sekolah.sch.id", "admin", string(hash))
	if err != nil {
		t.Fatalf("failed to seed user: %v", err)
	}

	return db
}

func TestAuthHandlerLoginSuccess(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	defer os.Unsetenv("JWT_SECRET")

	db := setupAuthTestDB(t)
	defer db.Close()

	handler := NewAuthHandler(repository.NewUserRepository(db), repository.NewAuditLogRepository(db), nil, nil)
	e := echo.New()
	body := `{"email":"admin@sekolah.sch.id","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := handler.Login(ctx); err != nil {
		t.Fatalf("Login returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp["success"] != true {
		t.Errorf("expected success=true, got %v", resp["success"])
	}
	if resp["token"] == "" {
		t.Errorf("expected non-empty token")
	}

	// Regression: cookie session harus persisten (MaxAge ~365 hari). Dulu
	// MaxAge di-set setelah SetCookie → no-op → session hilang saat app ditutup.
	var sessionMaxAge, infoMaxAge int
	for _, c := range rec.Result().Cookies() {
		switch c.Name {
		case "session":
			sessionMaxAge = c.MaxAge
		case "user_info":
			infoMaxAge = c.MaxAge
		}
	}
	if sessionMaxAge != sessionMaxAge {
		t.Errorf("expected session cookie MaxAge=%d, got %d", sessionMaxAge, sessionMaxAge)
	}
	if infoMaxAge != sessionMaxAge {
		t.Errorf("expected user_info cookie MaxAge=%d, got %d", sessionMaxAge, infoMaxAge)
	}
}

func TestAuthHandlerLoginWrongPassword(t *testing.T) {
	db := setupAuthTestDB(t)
	defer db.Close()

	handler := NewAuthHandler(repository.NewUserRepository(db), repository.NewAuditLogRepository(db), nil, nil)
	e := echo.New()
	body := `{"email":"admin@sekolah.sch.id","password":"wrongpass"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := handler.Login(ctx); err != nil {
		t.Fatalf("Login returned error: %v", err)
	}
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAuthHandlerLoginUnknownUser(t *testing.T) {
	db := setupAuthTestDB(t)
	defer db.Close()

	handler := NewAuthHandler(repository.NewUserRepository(db), repository.NewAuditLogRepository(db), nil, nil)
	e := echo.New()
	body := `{"email":"nonexistent@test.com","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := handler.Login(ctx); err != nil {
		t.Fatalf("Login returned error: %v", err)
	}
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

// TestAuthHandlerLoginInactiveUser memastikan user yang sudah dinonaktifkan
// (is_active = 0) tidak bisa login meski passwordnya benar.
func TestAuthHandlerLoginInactiveUser(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	defer os.Unsetenv("JWT_SECRET")

	db := setupAuthTestDB(t)
	defer db.Close()

	// Nonaktifkan user yang sudah di-seed.
	if _, err := db.Exec(`UPDATE users SET is_active = 0 WHERE email = ?`, "admin@sekolah.sch.id"); err != nil {
		t.Fatalf("gagal menonaktifkan user: %v", err)
	}

	handler := NewAuthHandler(repository.NewUserRepository(db), repository.NewAuditLogRepository(db), nil, nil)
	e := echo.New()
	body := `{"email":"admin@sekolah.sch.id","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := handler.Login(ctx); err != nil {
		t.Fatalf("Login returned error: %v", err)
	}
	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 for inactive user, got %d: %s", rec.Code, rec.Body.String())
	}

	// Pastikan tidak ada token yang dikeluarkan.
	var resp map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err == nil {
		if tok, ok := resp["token"]; ok && tok != "" && tok != nil {
			t.Errorf("user nonaktif tetap menerima token: %v", tok)
		}
	}
}

// TestAuthHandlerLoginActiveUserStillWorks memastikan user aktif tetap bisa
// login (pengecekan is_active tidak merusak alur normal).
func TestAuthHandlerLoginActiveUserStillWorks(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	defer os.Unsetenv("JWT_SECRET")

	db := setupAuthTestDB(t)
	defer db.Close()

	// Eksplisit: is_active = 1.
	if _, err := db.Exec(`UPDATE users SET is_active = 1 WHERE email = ?`, "admin@sekolah.sch.id"); err != nil {
		t.Fatalf("gagal mengaktifkan user: %v", err)
	}

	handler := NewAuthHandler(repository.NewUserRepository(db), repository.NewAuditLogRepository(db), nil, nil)
	e := echo.New()
	body := `{"email":"admin@sekolah.sch.id","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := handler.Login(ctx); err != nil {
		t.Fatalf("Login returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 for active user, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAuthHandlerLoginInvalidPayload(t *testing.T) {
	db := setupAuthTestDB(t)
	defer db.Close()

	handler := NewAuthHandler(repository.NewUserRepository(db), repository.NewAuditLogRepository(db), nil, nil)
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`invalid json`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := handler.Login(ctx); err != nil {
		t.Fatalf("Login returned error: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}
