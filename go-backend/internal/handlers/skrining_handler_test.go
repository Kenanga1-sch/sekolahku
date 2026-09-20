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

// setupSkriningHandlerTestDB menyediakan skema minimal yang dipakai
// GetStaffAggregate (game, sesi, roster, attempt, hasil) + satu sesi selesai.
func setupSkriningHandlerTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db := openSkriningHandlerDB(t)
	execSkriningHandlerSchema(t, db)
	if _, err := db.Exec(`
		INSERT INTO screening_games (id, code, name, domain, is_active, created_at, updated_at)
			VALUES ('game-tangkap-target', 'tangkap-target', 'Tangkap Target', 'perhatian', 1, 0, 0);
		INSERT INTO screening_sessions (id, game_id, class_id, class_name, teacher_user_id, academic_year, title, status, created_at, updated_at)
			VALUES ('ses-1', 'game-tangkap-target', 'c1', 'Kelas 4', 'g1', '2026/2027', 'Sesi A', 'finished', 1000, 1000);
		INSERT INTO screening_session_students (id, session_id, student_id) VALUES ('ss-1', 'ses-1', 's1');
		INSERT INTO screening_attempts (id, session_id, student_id, game_id, status, started_at, completed_at, created_at, updated_at)
			VALUES ('att-1', 'ses-1', 's1', 'game-tangkap-target', 'completed', 1000, 2000, 1000, 2000);
		INSERT INTO screening_results (id, attempt_id, session_id, student_id, game_id, domain, metrics, level_reached, accuracy, computed_at)
			VALUES ('res-1', 'att-1', 'ses-1', 's1', 'game-tangkap-target', 'perhatian', '{}', 3, 87.5, 2000);
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	return db
}

// setupSkriningHandlerEmptyTestDB: skema tanpa data — replikasi persis kondisi
// produksi saat belum ada sesi skrining sama sekali.
func setupSkriningHandlerEmptyTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db := openSkriningHandlerDB(t)
	execSkriningHandlerSchema(t, db)
	return db
}

func openSkriningHandlerDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	return db
}

func execSkriningHandlerSchema(t *testing.T, db *sql.DB) {
	t.Helper()
	schema := `
		CREATE TABLE screening_games (
			id TEXT PRIMARY KEY, code TEXT UNIQUE, name TEXT NOT NULL, domain TEXT NOT NULL,
			description TEXT, icon TEXT, version TEXT DEFAULT '1.0', order_number INTEGER DEFAULT 0,
			is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER
		);
		CREATE TABLE screening_sessions (
			id TEXT PRIMARY KEY, game_id TEXT NOT NULL, class_id TEXT NOT NULL, class_name TEXT,
			teacher_user_id TEXT NOT NULL, academic_year TEXT, title TEXT,
			status TEXT DEFAULT 'pending', started_at INTEGER, finished_at INTEGER, notes TEXT,
			created_at INTEGER, updated_at INTEGER, deleted_at INTEGER
		);
		CREATE TABLE screening_session_students (
			id TEXT PRIMARY KEY, session_id TEXT NOT NULL, student_id TEXT NOT NULL,
			UNIQUE(session_id, student_id)
		);
		CREATE TABLE screening_attempts (
			id TEXT PRIMARY KEY, session_id TEXT NOT NULL, student_id TEXT NOT NULL,
			game_id TEXT NOT NULL, status TEXT DEFAULT 'in_progress',
			started_at INTEGER, completed_at INTEGER, created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE screening_results (
			id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE, session_id TEXT NOT NULL,
			student_id TEXT NOT NULL, game_id TEXT NOT NULL, domain TEXT NOT NULL,
			metrics TEXT NOT NULL, level_reached INTEGER, accuracy REAL, computed_at INTEGER
		);
		CREATE TABLE student_classes (
			id TEXT PRIMARY KEY, name TEXT NOT NULL, academic_year TEXT, is_active INTEGER DEFAULT 1,
			wali_user_id TEXT
		);
		CREATE TABLE students (
			id TEXT PRIMARY KEY, full_name TEXT, class_id TEXT, status TEXT DEFAULT 'active',
			is_active INTEGER DEFAULT 1
		);
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("create schema: %v", err)
	}
}

// TestSkriningStaffAggregateRoleCheck: StaffAggregate dulunya membaca context
// key "role" yang tidak pernah diisi JWT middleware (yang benar "user_role"),
// sehingga superadmin/admin/staf selalu kena 403 dan halaman agregat skrining
// menampilkan "Gagal memuat agregat skrining".
func TestSkriningStaffAggregateRoleCheck(t *testing.T) {
	h := &SkriningHandler{Repo: repository.NewSkriningRepository(setupSkriningHandlerTestDB(t))}

	for _, role := range []string{"superadmin", "admin", "staff"} {
		req := httptest.NewRequest(http.MethodGet, "/api/ruang-tumbuh/aggregate", nil)
		rec := httptest.NewRecorder()
		c := echo.New().NewContext(req, rec)
		c.Set("user_role", role)

		if err := h.StaffAggregate(c); err != nil {
			t.Fatalf("role %s: handler error: %v", role, err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("role %s: expected 200, got %d (%s)", role, rec.Code, rec.Body.String())
		}
		var resp map[string]interface{}
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("role %s: decode response: %v", role, err)
		}
		if resp["success"] != true {
			t.Fatalf("role %s: expected success=true, got %v", role, resp)
		}
		data, ok := resp["data"].(map[string]interface{})
		if !ok {
			t.Fatalf("role %s: expected data object, got %T", role, resp["data"])
		}
		// Agregat benar-benar terisi, bukan sekadar lolos gate role.
		if data["totalStudents"] != float64(1) {
			t.Errorf("role %s: totalStudents = %v, want 1", role, data["totalStudents"])
		}
		if data["screenedCount"] != float64(1) {
			t.Errorf("role %s: screenedCount = %v, want 1", role, data["screenedCount"])
		}
		stats, _ := data["domainStats"].([]interface{})
		if len(stats) != 1 {
			t.Errorf("role %s: domainStats len = %d, want 1", role, len(stats))
		}
		sessions, _ := data["recentSessions"].([]interface{})
		if len(sessions) != 1 {
			t.Errorf("role %s: recentSessions len = %d, want 1", role, len(sessions))
		}
	}

	// Role non-staff tetap ditolak di level handler.
	req := httptest.NewRequest(http.MethodGet, "/api/ruang-tumbuh/aggregate", nil)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	c.Set("user_role", "guru")
	_ = h.StaffAggregate(c)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("guru: expected 403, got %d", rec.Code)
	}
}

// TestSkriningStaffAggregateEmpty: saat belum ada sesi skrining (kondisi
// produksi), backend mengirim slice nil yang diserialisasi menjadi JSON null.
// Frontend memanggil .length pada domainStats/recentSessions, jadi null
// menyebabkan TypeError dan halaman jatuh ke root error boundary. Pastikan
// response 200 berisi array (meski kosong), bukan null.
func TestSkriningStaffAggregateEmpty(t *testing.T) {
	h := &SkriningHandler{Repo: repository.NewSkriningRepository(setupSkriningHandlerEmptyTestDB(t))}

	req := httptest.NewRequest(http.MethodGet, "/api/ruang-tumbuh/aggregate", nil)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	c.Set("user_role", "admin")

	if err := h.StaffAggregate(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (%s)", rec.Code, rec.Body.String())
	}

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			TotalStudents  int               `json:"totalStudents"`
			ScreenedCount  int               `json:"screenedCount"`
			DomainStats    []json.RawMessage `json:"domainStats"`
			RecentSessions []json.RawMessage `json:"recentSessions"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !resp.Success {
		t.Fatalf("expected success=true, got body: %s", rec.Body.String())
	}
	if resp.Data.TotalStudents != 0 || resp.Data.ScreenedCount != 0 {
		t.Errorf("expected zero counts, got totalStudents=%d screenedCount=%d",
			resp.Data.TotalStudents, resp.Data.ScreenedCount)
	}
	// Kunci regresi: array (boleh kosong), bukan null — null membuat
	// agg.domainStats.length di frontend melempar TypeError.
	if resp.Data.DomainStats == nil {
		t.Errorf("domainStats = null, want [] (null membuat frontend crash pada .length): %s", rec.Body.String())
	}
	if resp.Data.RecentSessions == nil {
		t.Errorf("recentSessions = null, want [] (null membuat frontend crash pada .length): %s", rec.Body.String())
	}
}

// setupSkriningCreateSessionDB: DB dengan satu game aktif + kelas aktif yang
// diwali user 'wali-1'. Dipakai menguji CreateSession.
func setupSkriningCreateSessionDB(t *testing.T) *sql.DB {
	t.Helper()
	db := openSkriningHandlerDB(t)
	execSkriningHandlerSchema(t, db)
	if _, err := db.Exec(`
		INSERT INTO screening_games (id, code, name, domain, is_active, created_at, updated_at)
			VALUES ('game-tangkap-target', 'tangkap-target', 'Tangkap Target', 'perhatian', 1, 0, 0);
		INSERT INTO student_classes (id, name, academic_year, is_active, wali_user_id)
			VALUES ('c1', 'Kelas 4', '2026/2027', 1, 'wali-1');
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	return db
}

// TestSkriningCreateSessionStaffWithClassId: staff/admin tidak punya kelas
// wali, jadi mereka harus menentukan classId. Tanpa picker di frontend,
// request tanpa classId jatuh ke cabang wali → 403 "Anda bukan wali kelas
// manapun".
func TestSkriningCreateSessionStaffWithClassId(t *testing.T) {
	db := setupSkriningCreateSessionDB(t)
	h := &SkriningHandler{
		Repo:     repository.NewSkriningRepository(db),
		Academic: repository.NewAcademicRepository(db),
		DB:       db,
	}

	req := httptest.NewRequest(http.MethodPost, "/api/ruang-tumbuh/sessions?classId=c1",
		strings.NewReader(`{"gameId":"game-tangkap-target","title":"Sesi Uji"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	c.Set("user_role", "admin")

	if err := h.CreateSession(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (%s)", rec.Code, rec.Body.String())
	}

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			ID        string `json:"id"`
			GameID    string `json:"gameId"`
			ClassID   string `json:"classId"`
			ClassName string `json:"className"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !resp.Success || resp.Data.ID == "" {
		t.Fatalf("expected success with session, got: %s", rec.Body.String())
	}
	if resp.Data.ClassID != "c1" {
		t.Errorf("classId = %q, want \"c1\"", resp.Data.ClassID)
	}
	if resp.Data.ClassName != "Kelas 4" {
		t.Errorf("className = %q, want \"Kelas 4\"", resp.Data.ClassName)
	}
}

// TestSkriningCreateSessionNonWaliGuruDenied: guru yang bukan wali kelas
// manapun (tidak punya kelas, tidak mengirim classId) harus ditolak dengan
// pesan jelas — bukan 500 atau toast generik.
func TestSkriningCreateSessionNonWaliGuruDenied(t *testing.T) {
	db := setupSkriningCreateSessionDB(t)
	h := &SkriningHandler{
		Repo:     repository.NewSkriningRepository(db),
		Academic: repository.NewAcademicRepository(db),
		DB:       db,
	}

	req := httptest.NewRequest(http.MethodPost, "/api/ruang-tumbuh/sessions",
		strings.NewReader(`{"gameId":"game-tangkap-target","title":"Sesi Uji"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := echo.New().NewContext(req, rec)
	c.Set("user_role", "guru")

	_ = h.CreateSession(c)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d (%s)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "Anda bukan wali kelas manapun") {
		t.Errorf("expected penolakan yang jelas, got: %s", rec.Body.String())
	}
}
