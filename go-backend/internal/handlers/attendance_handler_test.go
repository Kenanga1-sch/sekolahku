package handlers

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

func setupAttendanceTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE attendance_sessions (
			id TEXT PRIMARY KEY,
			date TEXT NOT NULL,
			class_name TEXT NOT NULL,
			teacher_name TEXT,
			status TEXT,
			notes TEXT,
			created_at INTEGER
		);
		CREATE TABLE attendance_records (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL,
			student_id TEXT NOT NULL,
			status TEXT NOT NULL,
			check_in_time INTEGER,
			recorded_by TEXT,
			record_method TEXT,
			notes TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE students (
			id TEXT PRIMARY KEY,
			full_name TEXT,
			nis TEXT,
			nisn TEXT,
			photo TEXT,
			class_name TEXT,
			status TEXT,
			is_active INTEGER
		);
		INSERT INTO students (id, full_name, nis, class_name, status, is_active)
		VALUES ('stu-1', 'Budi', '1001', '1A', 'active', 1),
			   ('stu-2', 'Ani', '1002', '1A', 'active', 1);
		INSERT INTO attendance_sessions (id, date, class_name, status, created_at)
		VALUES ('sess-1', '2026-06-01', '1A', 'open', 1710000000000);
		INSERT INTO attendance_records (id, session_id, student_id, status, record_method, created_at, updated_at)
		VALUES ('rec-1', 'sess-1', 'stu-1', 'hadir', 'manual', 1710000000000, 1710000000000);
	`)
	if err != nil {
		t.Fatalf("failed to create attendance schema: %v", err)
	}
	return db
}

func TestAttendanceGetDailyClass(t *testing.T) {
	db := setupAttendanceTestDB(t)
	defer db.Close()

	handler := NewAttendanceHandler(repository.NewAttendanceRepository(db))
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/api/attendance/daily?date=2026-06-01&class=1A", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := handler.GetDailyClass(ctx); err != nil {
		t.Fatalf("GetDailyClass returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAttendanceGetDailyClassHoliday(t *testing.T) {
	db := setupAttendanceTestDB(t)
	defer db.Close()

	handler := NewAttendanceHandler(repository.NewAttendanceRepository(db))
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/api/attendance/daily?date=2026-08-17&class=1A", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := handler.GetDailyClass(ctx); err != nil {
		t.Fatalf("GetDailyClass returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}
