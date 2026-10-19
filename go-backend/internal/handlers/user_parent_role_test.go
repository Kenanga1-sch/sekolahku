package handlers

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

func setupUserRoleTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)

	stmts := []string{
		`CREATE TABLE users (
			id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, email_verified INTEGER,
			role TEXT DEFAULT 'user', phone TEXT, username TEXT UNIQUE, full_name TEXT,
			password_hash TEXT, is_active INTEGER DEFAULT 1, must_change_password INTEGER DEFAULT 0,
			student_id TEXT, created_at INTEGER, updated_at INTEGER, image TEXT
		)`,
		`CREATE TABLE parent_students (
			id TEXT PRIMARY KEY, user_id TEXT NOT NULL, student_id TEXT NOT NULL,
			relation TEXT DEFAULT 'orangtua', is_active INTEGER DEFAULT 1,
			created_at INTEGER, updated_at INTEGER, UNIQUE(user_id, student_id)
		)`,
		`CREATE TABLE audit_logs (
			id TEXT PRIMARY KEY, action TEXT, resource TEXT, details TEXT,
			user_id TEXT, user_name TEXT, user_email TEXT, ip_address TEXT,
			user_agent TEXT, created_at INTEGER
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("exec %q: %v", s, err)
		}
	}
	return db
}

func newUserRoleHandler(db *sql.DB) *UserHandler {
	return &UserHandler{
		UserRepo:  repository.NewUserRepository(db),
		AuditRepo: repository.NewAuditLogRepository(db),
	}
}

func callCreateUser(t *testing.T, db *sql.DB, body string) *httptest.ResponseRecorder {
	t.Helper()
	h := newUserRoleHandler(db)
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/users", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if err := h.CreateUser(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	return rec
}

func callUpdateUser(t *testing.T, db *sql.DB, id, body string) *httptest.ResponseRecorder {
	t.Helper()
	h := newUserRoleHandler(db)
	e := echo.New()
	req := httptest.NewRequest(http.MethodPatch, "/api/users/"+id, strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(id)
	if err := h.UpdateUser(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	return rec
}

func TestCreateUser_OrangtuaWithoutEmailUsesPhone(t *testing.T) {
	db := setupUserRoleTestDB(t)
	defer db.Close()

	rec := callCreateUser(t, db, `{"name":"Ibu Ani","role":"orangtua","phone":"081234567890","password":"rahasia123"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var username, email, role string
	if err := db.QueryRow(`SELECT COALESCE(username,''), COALESCE(email,''), role FROM users`).Scan(&username, &email, &role); err != nil {
		t.Fatalf("query: %v", err)
	}
	if username != "081234567890" || email != "" || role != "orangtua" {
		t.Fatalf("akun ortu salah: username=%q email=%q role=%q", username, email, role)
	}
}

func TestCreateUser_OrangtuaRequiresPhone(t *testing.T) {
	db := setupUserRoleTestDB(t)
	defer db.Close()

	rec := callCreateUser(t, db, `{"name":"Ibu Ani","role":"orangtua","password":"rahasia123"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestCreateUser_NonOrangtuaRequiresEmail(t *testing.T) {
	db := setupUserRoleTestDB(t)
	defer db.Close()

	rec := callCreateUser(t, db, `{"name":"Guru Baru","role":"guru","phone":"081234567890","password":"rahasia123"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestUpdateUser_RejectsRoleChangeWhenParentLinked(t *testing.T) {
	db := setupUserRoleTestDB(t)
	defer db.Close()

	if _, err := db.Exec(`INSERT INTO users (id, name, role, phone, username) VALUES ('ortu1','Ibu Ani','orangtua','081234567890','081234567890')`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO parent_students (id, user_id, student_id) VALUES ('ps1','ortu1','s1')`); err != nil {
		t.Fatal(err)
	}

	rec := callUpdateUser(t, db, "ortu1", `{"name":"Ibu Ani","role":"guru","phone":"081234567890"}`)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "masih tertaut") {
		t.Errorf("pesan harus menjelaskan tautan: %s", rec.Body.String())
	}

	var role string
	if err := db.QueryRow(`SELECT role FROM users WHERE id='ortu1'`).Scan(&role); err != nil {
		t.Fatal(err)
	}
	if role != "orangtua" {
		t.Fatalf("role tidak boleh berubah, dapat %q", role)
	}
}

func TestUpdateUser_AllowsOrangtuaRoleWhenLinked(t *testing.T) {
	db := setupUserRoleTestDB(t)
	defer db.Close()

	if _, err := db.Exec(`INSERT INTO users (id, name, role, phone, username) VALUES ('ortu1','Ibu Ani','orangtua','081234567890','081234567890')`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO parent_students (id, user_id, student_id) VALUES ('ps1','ortu1','s1')`); err != nil {
		t.Fatal(err)
	}

	rec := callUpdateUser(t, db, "ortu1", `{"name":"Ibu Ani Baru","role":"orangtua","phone":"081234567890"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestUpdateUser_AllowsRoleChangeWhenNotLinked(t *testing.T) {
	db := setupUserRoleTestDB(t)
	defer db.Close()

	if _, err := db.Exec(`INSERT INTO users (id, name, role, email, username) VALUES ('guru1','Guru Satu','guru','guru@test.com','guru1')`); err != nil {
		t.Fatal(err)
	}

	rec := callUpdateUser(t, db, "guru1", `{"name":"Guru Satu","role":"staff","phone":""}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}
