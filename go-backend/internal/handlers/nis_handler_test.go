package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

func setupNISHandlerDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	stmts := []string{
		`CREATE TABLE student_classes (id TEXT PRIMARY KEY, name TEXT, grade INTEGER, academic_year TEXT, is_active INTEGER DEFAULT 1)`,
		`CREATE TABLE students (id TEXT PRIMARY KEY, nik TEXT, nisn TEXT, nis TEXT UNIQUE, full_name TEXT NOT NULL, gender TEXT, birth_place TEXT, birth_date TEXT, religion TEXT, address TEXT, parent_name TEXT, father_name TEXT, father_nik TEXT, mother_name TEXT, mother_nik TEXT, guardian_name TEXT, guardian_nik TEXT, guardian_job TEXT, parent_phone TEXT, class_name TEXT, class_id TEXT, status TEXT DEFAULT 'active', photo TEXT, qr_code TEXT, is_active INTEGER DEFAULT 1, meta_data TEXT, enrolled_at INTEGER, created_at INTEGER, updated_at INTEGER, kip TEXT)`,
		`CREATE TABLE student_class_history (id TEXT PRIMARY KEY, student_id TEXT, class_id TEXT, class_name TEXT, academic_year TEXT, grade INTEGER, status TEXT, record_date INTEGER)`,
		`CREATE TABLE tabungan_siswa (id TEXT PRIMARY KEY, student_id TEXT, saldo_terakhir INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE library_members (id TEXT PRIMARY KEY, student_id TEXT, max_borrow_limit INTEGER DEFAULT 3, is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE library_loans (id TEXT PRIMARY KEY, student_id TEXT, status TEXT, created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE alumni (id TEXT PRIMARY KEY, student_id TEXT, nisn TEXT, nis TEXT, full_name TEXT, created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE academic_years (id TEXT PRIMARY KEY, name TEXT, is_active INTEGER DEFAULT 0)`,
		`CREATE TABLE school_settings (id TEXT PRIMARY KEY, current_academic_year TEXT)`,
		`INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('c1','Kelas 1',1,'2026/2027')`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("exec: %v\nSQL: %s", err, s)
		}
	}
	return db
}

func nisStudent(t *testing.T, db *sql.DB, id, name, nis string) {
	t.Helper()
	var nisArg interface{}
	if nis != "" {
		nisArg = nis
	}
	if _, err := db.Exec(`INSERT INTO students (id, full_name, nis, class_id, status, is_active) VALUES (?, ?, ?, 'c1', 'active', 1)`, id, name, nisArg); err != nil {
		t.Fatalf("insert: %v", err)
	}
}

func TestGetNextNIS(t *testing.T) {
	db := setupNISHandlerDB(t)
	defer db.Close()
	nisStudent(t, db, "s1", "Andi", "262701001")
	nisStudent(t, db, "s2", "Budi", "262701002")

	h := NewStudentHandler(repository.NewStudentRepository(db), db)
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/api/master/students/next-nis?classId=c1", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if err := h.GetNextNIS(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var resp struct {
		Data struct {
			NIS string `json:"nis"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Data.NIS != "262701003" {
		t.Fatalf("expected 262701003, got %s", resp.Data.NIS)
	}
}

func TestGetNextNIS_RequiresClass(t *testing.T) {
	db := setupNISHandlerDB(t)
	defer db.Close()
	h := NewStudentHandler(repository.NewStudentRepository(db), db)
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/master/students/next-nis", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if err := h.GetNextNIS(c); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestIssueNIS_OrderedByName(t *testing.T) {
	db := setupNISHandlerDB(t)
	defer db.Close()
	nisStudent(t, db, "s3", "Cici", "")
	nisStudent(t, db, "s1", "Andi", "")
	nisStudent(t, db, "s2", "Budi", "")

	h := NewStudentHandler(repository.NewStudentRepository(db), db)
	e := echo.New()

	req := httptest.NewRequest(http.MethodPost, "/api/master/students/issue-nis", strings.NewReader(`{"classId":"c1"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if err := h.IssueNIS(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Data struct {
			Count    int `json:"count"`
			Assigned []struct {
				StudentID string `json:"studentId"`
				NIS       string `json:"nis"`
			} `json:"assigned"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Data.Count != 3 {
		t.Fatalf("expected 3, got %d", resp.Data.Count)
	}
	want := map[string]string{"s1": "262701001", "s2": "262701002", "s3": "262701003"}
	for _, a := range resp.Data.Assigned {
		if want[a.StudentID] != a.NIS {
			t.Fatalf("student %s got %s, want %s", a.StudentID, a.NIS, want[a.StudentID])
		}
	}
}

func TestCreateStudent_AutoAssignsNIS(t *testing.T) {
	db := setupNISHandlerDB(t)
	defer db.Close()
	h := NewStudentHandler(repository.NewStudentRepository(db), db)
	e := echo.New()

	req := httptest.NewRequest(http.MethodPost, "/api/master/students", strings.NewReader(`{"fullName":"Siswa Baru","classId":"c1"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if err := h.CreateStudent(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", rec.Code, rec.Body.String())
	}
	var nis string
	if err := db.QueryRow(`SELECT COALESCE(nis,'') FROM students WHERE full_name = 'Siswa Baru'`).Scan(&nis); err != nil {
		t.Fatal(err)
	}
	if nis != "262701001" {
		t.Fatalf("expected auto NIS 262701001, got %q", nis)
	}
}

func TestCreateStudent_KeepsManualNIS(t *testing.T) {
	db := setupNISHandlerDB(t)
	defer db.Close()
	h := NewStudentHandler(repository.NewStudentRepository(db), db)
	e := echo.New()

	req := httptest.NewRequest(http.MethodPost, "/api/master/students", strings.NewReader(`{"fullName":"Siswa Manual","classId":"c1","nis":"999888777"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if err := h.CreateStudent(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", rec.Code, rec.Body.String())
	}
	var nis string
	if err := db.QueryRow(`SELECT COALESCE(nis,'') FROM students WHERE full_name = 'Siswa Manual'`).Scan(&nis); err != nil {
		t.Fatal(err)
	}
	if nis != "999888777" {
		t.Fatalf("manual NIS overwritten: %q", nis)
	}
}
