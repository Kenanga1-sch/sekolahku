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

// setupParentMutasiDB siapkan skema minimal untuk uji endpoint mutasi keluar
// portal orang tua: users (untuk fan-out notifikasi), students, parent_students,
// mutasi_out_requests, admin_notifications.
func setupParentMutasiDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)

	stmts := []string{
		`CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT)`,
		`INSERT INTO users (id, role) VALUES ('a1','admin'), ('a2','superadmin')`,
		`CREATE TABLE students (
			id TEXT PRIMARY KEY, full_name TEXT, nisn TEXT, class_name TEXT, is_active INTEGER DEFAULT 1
		)`,
		`INSERT INTO students (id, full_name, nisn, class_name) VALUES
			('s1','Anak Test','1234567890','Kelas 4A'),
			('s2','Anak Lain','0987654321','Kelas 5B')`,
		`CREATE TABLE parent_students (
			id TEXT PRIMARY KEY, user_id TEXT, student_id TEXT, relation TEXT,
			is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER,
			UNIQUE(user_id, student_id)
		)`,
		`INSERT INTO parent_students (id, user_id, student_id, relation) VALUES
			('ps1','p1','s1','orangtua')`,
		`CREATE TABLE mutasi_out_requests (
			id TEXT PRIMARY KEY, student_id TEXT, destination_school TEXT,
			destination_class TEXT, letter_no TEXT, reason TEXT, reason_detail TEXT,
			status TEXT, downloaded_at INTEGER, processed_at INTEGER, completed_at INTEGER,
			created_at INTEGER, updated_at INTEGER
		)`,
		`CREATE TABLE admin_notifications (
			id TEXT PRIMARY KEY, user_id TEXT, type TEXT, category TEXT,
			title TEXT, message TEXT, target_url TEXT, is_read INTEGER DEFAULT 0,
			metadata TEXT, created_at INTEGER
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("exec %q: %v", s, err)
		}
	}
	return db
}

func newParentMutasiHandler(db *sql.DB) *ParentHandler {
	return NewParentHandler(
		repository.NewParentRepository(db),
		repository.NewUserRepository(db),
		repository.NewAttendanceRepository(db),
		repository.NewNotificationRepository(db),
		nil,
		repository.NewPreferenceRepository(db),
		repository.NewMutasiRepository(db),
	)
}

func callCreateMutasiOut(db *sql.DB, userID, body string) (*httptest.ResponseRecorder, *ParentHandler) {
	h := newParentMutasiHandler(db)
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/parent/mutasi-keluar", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)
	ctx.Set("user_id", userID)
	ctx.Set("user_role", "orangtua")
	_ = h.CreateMutasiOut(ctx)
	return rec, h
}

func TestParentCreateMutasiOutSuccess(t *testing.T) {
	db := setupParentMutasiDB(t)
	defer db.Close()

	rec, _ := callCreateMutasiOut(db, "p1", `{"studentId":"s1","destinationSchool":"SDN 2 Kenanga","reason":"domisili"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM mutasi_out_requests WHERE student_id='s1'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Errorf("expected 1 request, got %d", count)
	}

	// Notifikasi fan-out ke admin + superadmin.
	var notifCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM admin_notifications`).Scan(&notifCount); err != nil {
		t.Fatal(err)
	}
	if notifCount != 2 {
		t.Errorf("expected 2 notifications (admin+superadmin), got %d", notifCount)
	}
}

func TestParentCreateMutasiOutNotOwnChild(t *testing.T) {
	db := setupParentMutasiDB(t)
	defer db.Close()

	rec, _ := callCreateMutasiOut(db, "p1", `{"studentId":"s2","destinationSchool":"SDN 2 Kenanga","reason":"domisili"}`)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for other's child, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestParentCreateMutasiOutDuplicate(t *testing.T) {
	db := setupParentMutasiDB(t)
	defer db.Close()

	rec, _ := callCreateMutasiOut(db, "p1", `{"studentId":"s1","destinationSchool":"SDN 2 Kenanga","reason":"domisili"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("first request expected 201, got %d", rec.Code)
	}

	rec2, _ := callCreateMutasiOut(db, "p1", `{"studentId":"s1","destinationSchool":"SDN 3 Kenanga","reason":"domisili"}`)
	if rec2.Code != http.StatusConflict {
		t.Fatalf("expected 409 for duplicate, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

func TestParentListMutasiOutScoped(t *testing.T) {
	db := setupParentMutasiDB(t)
	defer db.Close()

	callCreateMutasiOut(db, "p1", `{"studentId":"s1","destinationSchool":"SDN 2 Kenanga","reason":"domisili"}`)
	// Sisipkan permohonan milik siswa lain (bukan anak p1) — tidak boleh ikut.
	if _, err := db.Exec(`INSERT INTO mutasi_out_requests (id, student_id, destination_school, reason, status, created_at, updated_at)
		VALUES ('x1','s2','SDN X','domisili','draft',1,1)`); err != nil {
		t.Fatal(err)
	}

	h := newParentMutasiHandler(db)
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/parent/mutasi-keluar", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)
	ctx.Set("user_id", "p1")
	_ = h.ListMutasiOut(ctx)

	if !strings.Contains(rec.Body.String(), `"studentId":"s1"`) {
		t.Errorf("expected own child's request in list, got: %s", rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), `"studentId":"s2"`) {
		t.Errorf("other student's request leaked into list: %s", rec.Body.String())
	}
}
