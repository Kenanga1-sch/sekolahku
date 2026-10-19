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

// setupParentLinkDB menyiapkan skema minimal untuk uji penautan akun ortu.
func setupParentLinkDB(t *testing.T) *sql.DB {
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
		`INSERT INTO users (id, name, email, role, phone, username, is_active) VALUES
			('guru1', 'Guru Ortu', 'guru@test.com', 'guru', '081111111111', '081111111111', 1),
			('ortu1', 'Ortu Aktif', 'ortu@test.com', 'orangtua', '082222222222', '082222222222', 1),
			('ortuoff', 'Ortu Nonaktif', 'off@test.com', 'orangtua', '083333333333', '083333333333', 0)`,
		`CREATE TABLE parent_students (
			id TEXT PRIMARY KEY, user_id TEXT NOT NULL, student_id TEXT NOT NULL,
			relation TEXT DEFAULT 'orangtua', is_active INTEGER DEFAULT 1,
			created_at INTEGER, updated_at INTEGER, UNIQUE(user_id, student_id)
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("exec %q: %v", s, err)
		}
	}
	return db
}

func newParentLinkHandler(db *sql.DB) *ParentHandler {
	return &ParentHandler{
		Repo:  repository.NewParentRepository(db),
		Users: repository.NewUserRepository(db),
	}
}

func callLinkParent(t *testing.T, db *sql.DB, studentID, body string) *httptest.ResponseRecorder {
	t.Helper()
	h := newParentLinkHandler(db)
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/master/students/"+studentID+"/parents", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(studentID)
	if err := h.LinkParent(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	return rec
}

func countParentLinks(t *testing.T, db *sql.DB) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM parent_students`).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	return n
}

// Akun guru (walau punya nomor HP) tidak boleh ditautkan sebagai ortu.
func TestLinkParent_RejectsGuruAccount(t *testing.T) {
	db := setupParentLinkDB(t)
	defer db.Close()

	rec := callLinkParent(t, db, "s1", `{"phone":"081111111111"}`)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "akun terpisah") {
		t.Errorf("pesan harus mengarahkan ke akun terpisah: %s", rec.Body.String())
	}
	if n := countParentLinks(t, db); n != 0 {
		t.Fatalf("tidak boleh ada tautan, dapat %d", n)
	}
}

// userId akun guru juga ditolak.
func TestLinkParent_RejectsGuruByUserID(t *testing.T) {
	db := setupParentLinkDB(t)
	defer db.Close()

	rec := callLinkParent(t, db, "s1", `{"userId":"guru1"}`)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", rec.Code, rec.Body.String())
	}
	if n := countParentLinks(t, db); n != 0 {
		t.Fatalf("tidak boleh ada tautan, dapat %d", n)
	}
}

// Akun orangtua aktif boleh ditautkan.
func TestLinkParent_AcceptsActiveOrangtua(t *testing.T) {
	db := setupParentLinkDB(t)
	defer db.Close()

	rec := callLinkParent(t, db, "s1", `{"phone":"082222222222","relation":"ibu"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if n := countParentLinks(t, db); n != 1 {
		t.Fatalf("harus ada 1 tautan, dapat %d", n)
	}
	var userID, relation string
	if err := db.QueryRow(`SELECT user_id, relation FROM parent_students`).Scan(&userID, &relation); err != nil {
		t.Fatalf("query: %v", err)
	}
	if userID != "ortu1" || relation != "ibu" {
		t.Fatalf("tautan salah: user=%s relation=%s", userID, relation)
	}
}

// Akun orangtua nonaktif ditolak.
func TestLinkParent_RejectsInactiveAccount(t *testing.T) {
	db := setupParentLinkDB(t)
	defer db.Close()

	rec := callLinkParent(t, db, "s1", `{"phone":"083333333333"}`)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", rec.Code, rec.Body.String())
	}
	if n := countParentLinks(t, db); n != 0 {
		t.Fatalf("tidak boleh ada tautan, dapat %d", n)
	}
}

// Nomor tidak dikenal -> 404.
func TestLinkParent_UnknownPhone(t *testing.T) {
	db := setupParentLinkDB(t)
	defer db.Close()

	rec := callLinkParent(t, db, "s1", `{"phone":"089999999999"}`)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

// Tanpa phone/userId -> 400.
func TestLinkParent_RequiresIdentity(t *testing.T) {
	db := setupParentLinkDB(t)
	defer db.Close()

	rec := callLinkParent(t, db, "s1", `{}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}
