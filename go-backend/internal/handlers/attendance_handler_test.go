package handlers

import (
	"database/sql"
	"encoding/json"
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
		INSERT INTO attendance_sessions (id, date, class_name, teacher_name, status, created_at)
		VALUES
			('sess-1', '2026-06-01', '1A', 'Guru A', 'active', 1710000000000),
			('sess-2', '2026-06-01', '1B', 'Guru B', 'closed', 1710000001000);
	`)
	if err != nil {
		t.Fatalf("failed to create attendance schema: %v", err)
	}
	return db
}

func TestAttendanceGetSessionsPagination(t *testing.T) {
	db := setupAttendanceTestDB(t)
	defer db.Close()

	handler := NewAttendanceHandler(repository.NewAttendanceRepository(db))
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/api/attendance/sessions?page=1&perPage=1", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := handler.GetSessions(ctx); err != nil {
		t.Fatalf("GetSessions returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp["total"] != float64(2) {
		t.Errorf("expected total=2, got %v", resp["total"])
	}
	data, ok := resp["data"].([]interface{})
	if !ok {
		t.Fatalf("expected data array, got %T", resp["data"])
	}
	if len(data) != 1 {
		t.Errorf("expected 1 session on page 1, got %d", len(data))
	}
}

func TestAttendanceGetSessionsFilterByDate(t *testing.T) {
	db := setupAttendanceTestDB(t)
	defer db.Close()

	handler := NewAttendanceHandler(repository.NewAttendanceRepository(db))
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/api/attendance/sessions?date=2026-06-02", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := handler.GetSessions(ctx); err != nil {
		t.Fatalf("GetSessions returned error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp["total"] != float64(0) {
		t.Errorf("expected total=0 for no sessions on that date, got %v", resp["total"])
	}
}
