package handlers

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

func setupStudentBulkTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)

	stmts := []string{
		`CREATE TABLE student_classes (id TEXT PRIMARY KEY, name TEXT, grade INTEGER, academic_year TEXT, is_active INTEGER DEFAULT 1)`,
		`CREATE TABLE students (id TEXT PRIMARY KEY, nik TEXT, nisn TEXT UNIQUE, nis TEXT UNIQUE, full_name TEXT NOT NULL, gender TEXT, birth_place TEXT, birth_date TEXT, religion TEXT, address TEXT, parent_name TEXT, father_name TEXT, father_nik TEXT, mother_name TEXT, mother_nik TEXT, guardian_name TEXT, guardian_nik TEXT, guardian_job TEXT, parent_phone TEXT, class_name TEXT, class_id TEXT, status TEXT DEFAULT 'active', photo TEXT, qr_code TEXT, is_active INTEGER DEFAULT 1, meta_data TEXT, enrolled_at INTEGER, created_at INTEGER, updated_at INTEGER, kip TEXT)`,
		`CREATE TABLE student_class_history (id TEXT PRIMARY KEY, student_id TEXT, class_id TEXT, class_name TEXT, academic_year TEXT, grade INTEGER, status TEXT, record_date INTEGER)`,
		`CREATE TABLE tabungan_siswa (id TEXT PRIMARY KEY, student_id TEXT, saldo_terakhir INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE library_members (id TEXT PRIMARY KEY, student_id TEXT, max_borrow_limit INTEGER DEFAULT 3, is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE library_loans (id TEXT PRIMARY KEY, student_id TEXT, status TEXT, created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE alumni (id TEXT PRIMARY KEY, student_id TEXT, nisn TEXT, nis TEXT, full_name TEXT, created_at INTEGER, updated_at INTEGER)`,
		`INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('c1','1A',1,'2025/2026')`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("exec: %v\nSQL: %s", err, s)
		}
	}
	return db
}

func bulkStudentCtx(e *echo.Echo, body string) (echo.Context, *httptest.ResponseRecorder) {
	var r io.Reader
	r = strings.NewReader(body)
	req := httptest.NewRequest(http.MethodPost, "/api/master/students/bulk", r)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	return e.NewContext(req, rec), rec
}

func TestBulkCreateStudents_ValidationAndSummary(t *testing.T) {
	db := setupStudentBulkTestDB(t)
	defer db.Close()
	h := NewStudentHandler(repository.NewStudentRepository(db), db)
	e := echo.New()

	body := `{
		"students": [
			{"fullName":"Valid A","nisn":"101","className":"1A"},
			{"fullName":"","nisn":"102"},
			{"fullName":"Bad Gender","gender":"X"},
			{"fullName":"Bad Date","birthDate":"20-05-2015"},
			{"fullName":"Unknown Class","className":"ZZZ"}
		]
	}`

	c, rec := bulkStudentCtx(e, body)
	if err := h.BulkCreateStudents(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if int(resp["inserted"].(float64)) != 1 {
		t.Fatalf("expected 1 inserted, got %v", resp["inserted"])
	}
	errs, _ := resp["errors"].([]any)
	if len(errs) != 4 {
		t.Fatalf("expected 4 row errors, got %d: %v", len(errs), errs)
	}
}

func TestBulkCreateStudents_UpsertDoesNotReactivate(t *testing.T) {
	db := setupStudentBulkTestDB(t)
	defer db.Close()
	h := NewStudentHandler(repository.NewStudentRepository(db), db)
	e := echo.New()

	// Siswa non-aktif.
	_, _ = db.Exec(`INSERT INTO students (id, nisn, full_name, status, is_active, qr_code) VALUES ('s1','201','Lama','inactive',0,'STU-201')`)

	body := `{"students":[{"fullName":"Lama","nisn":"201"}]}`
	c, rec := bulkStudentCtx(e, body)
	if err := h.BulkCreateStudents(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}

	var active int
	if err := db.QueryRow(`SELECT is_active FROM students WHERE id='s1'`).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if active != 0 {
		t.Fatalf("inactive student must stay inactive after re-import, is_active=%d", active)
	}

	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if int(resp["updated"].(float64)) != 1 {
		t.Fatalf("expected 1 updated, got %v", resp["updated"])
	}
}
