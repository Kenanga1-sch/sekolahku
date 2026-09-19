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
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

func setupTugasHandlerTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)

	stmts := []string{
		`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, role TEXT DEFAULT 'user', is_active INTEGER DEFAULT 1, student_id TEXT)`,
		`CREATE TABLE student_classes (id TEXT PRIMARY KEY, name TEXT, academic_year TEXT, is_active INTEGER DEFAULT 1, wali_user_id TEXT)`,
		`CREATE TABLE students (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, class_id TEXT, status TEXT DEFAULT 'active', is_active INTEGER DEFAULT 1)`,
		`CREATE TABLE subjects (id TEXT PRIMARY KEY, code TEXT, name TEXT NOT NULL, category TEXT)`,
		`CREATE TABLE academic_years (id TEXT PRIMARY KEY, name TEXT, semester TEXT, is_active INTEGER DEFAULT 0)`,
		`CREATE TABLE school_settings (current_academic_year TEXT)`,
		`CREATE TABLE tugas (id TEXT PRIMARY KEY, teacher_user_id TEXT NOT NULL, class_id TEXT NOT NULL, class_name TEXT, subject_id TEXT, subject_name TEXT, academic_year TEXT, title TEXT NOT NULL, description TEXT, attachment_url TEXT, attachment_name TEXT, due_at INTEGER, allow_late INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'published', created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER, UNIQUE(class_id, title, academic_year))`,
		`CREATE TABLE tugas_submissions (id TEXT PRIMARY KEY, tugas_id TEXT NOT NULL, student_id TEXT NOT NULL, answer_text TEXT, attachment_url TEXT, attachment_name TEXT, submitted_at INTEGER NOT NULL, is_late INTEGER NOT NULL DEFAULT 0, score REAL, feedback TEXT, graded_by TEXT, graded_at INTEGER, status TEXT NOT NULL DEFAULT 'submitted', created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER, UNIQUE(tugas_id, student_id))`,
		`CREATE TABLE admin_notifications (id TEXT PRIMARY KEY, user_id TEXT, type TEXT, category TEXT, title TEXT, message TEXT, target_url TEXT, is_read INTEGER DEFAULT 0, metadata TEXT, created_at INTEGER)`,
		`CREATE TABLE parent_students (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, student_id TEXT NOT NULL, is_active INTEGER DEFAULT 1, relation TEXT)`,
		`INSERT INTO users (id, name, email, role, is_active, student_id) VALUES ('g1', 'Guru Satu', 'g1@test.com', 'guru', 1, NULL)`,
		`INSERT INTO users (id, name, email, role, is_active, student_id) VALUES ('g2', 'Guru Lain', 'g2@test.com', 'guru', 1, NULL)`,
		`INSERT INTO users (id, name, email, role, is_active, student_id) VALUES ('adm', 'Admin', 'adm@test.com', 'admin', 1, NULL)`,
		`INSERT INTO users (id, name, email, role, is_active, student_id) VALUES ('u_s1', 'Siti', 'siti@test.com', 'siswa', 1, 's1')`,
		`INSERT INTO users (id, name, email, role, is_active, student_id) VALUES ('u_s2', 'Budi', 'budi@test.com', 'siswa', 1, 's2')`,
		`INSERT INTO users (id, name, email, role, is_active, student_id) VALUES ('p1', 'Ortu Siti', 'p1@test.com', 'orangtua', 1, NULL)`,
		`INSERT INTO student_classes (id, name, academic_year, is_active, wali_user_id) VALUES ('c1', 'Kelas 4', '2026/2027', 1, 'g1')`,
		`INSERT INTO students (id, full_name, class_id, status, is_active) VALUES ('s1', 'Siti A', 'c1', 'active', 1)`,
		`INSERT INTO students (id, full_name, class_id, status, is_active) VALUES ('s2', 'Budi B', 'c1', 'active', 1)`,
		`INSERT INTO parent_students (id, user_id, student_id, is_active, relation) VALUES ('ps1', 'p1', 's1', 1, 'ibu')`,
		`INSERT INTO subjects (id, code, name) VALUES ('sub-mtk', 'MTK', 'Matematika')`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("exec: %v\nSQL: %s", err, s)
		}
	}
	return db
}

func newTugasHandler(db *sql.DB) *TugasHandler {
	return NewTugasHandler(
		repository.NewTugasRepository(db),
		repository.NewAcademicRepository(db),
		repository.NewAuditLogRepository(db),
		repository.NewNotificationRepository(db),
		db,
	)
}

func tugasCtx(e *echo.Echo, method, path, body, userID, role string) (echo.Context, *httptest.ResponseRecorder) {
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, r)
	if body != "" {
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	}
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", userID)
	c.Set("user_role", role)
	c.Set("user_name", "Guru Satu")
	return c, rec
}

// Test 1: guru wali kelas membuat tugas → 200 + data utuh.
func TestCreateTugas_GuruWali(t *testing.T) {
	db := setupTugasHandlerTestDB(t)
	defer db.Close()
	h := newTugasHandler(db)
	e := echo.New()

	c, rec := tugasCtx(e, http.MethodPost, "/",
		`{"title":"PR Matematika Hal 12","description":"Kerjakan soal 1-10","subjectId":"sub-mtk"}`, "g1", "guru")
	if err := h.CreateTugas(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	data := resp["data"].(map[string]interface{})
	if data["title"] != "PR Matematika Hal 12" {
		t.Errorf("wrong title: %v", data["title"])
	}
	if data["subjectName"] != "Matematika" || data["className"] != "Kelas 4" {
		t.Errorf("denorm wrong: subject=%v class=%v", data["subjectName"], data["className"])
	}
	if data["totalStudents"].(float64) != 2 {
		t.Errorf("expected 2 students, got %v", data["totalStudents"])
	}
}

// Test 2: guru tanpa wali kelas → 403.
func TestCreateTugas_GuruTanpaWali(t *testing.T) {
	db := setupTugasHandlerTestDB(t)
	defer db.Close()
	h := newTugasHandler(db)
	e := echo.New()

	c, rec := tugasCtx(e, http.MethodPost, "/", `{"title":"PR"}`, "g2", "guru")
	if err := h.CreateTugas(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec.Code != 403 {
		t.Fatalf("expected 403 for guru without wali class, got %d: %s", rec.Code, rec.Body.String())
	}
}

// Test 3: judul duplikat → 400.
func TestCreateTugas_Duplikat(t *testing.T) {
	db := setupTugasHandlerTestDB(t)
	defer db.Close()
	h := newTugasHandler(db)
	e := echo.New()

	c, _ := tugasCtx(e, http.MethodPost, "/", `{"title":"PR Dup"}`, "g1", "guru")
	if err := h.CreateTugas(c); err != nil {
		t.Fatalf("first create: %v", err)
	}
	c2, rec := tugasCtx(e, http.MethodPost, "/", `{"title":"PR Dup"}`, "g1", "guru")
	if err := h.CreateTugas(c2); err != nil {
		t.Fatalf("second create: %v", err)
	}
	if rec.Code != 400 || !strings.Contains(rec.Body.String(), "sudah ada") {
		t.Fatalf("expected 400 duplicate, got %d: %s", rec.Code, rec.Body.String())
	}
}

// Test 4: tugas baru memicu notifikasi siswa & orang tua kelas.
func TestCreateTugas_Notifikasi(t *testing.T) {
	db := setupTugasHandlerTestDB(t)
	defer db.Close()
	h := newTugasHandler(db)
	e := echo.New()

	c, rec := tugasCtx(e, http.MethodPost, "/", `{"title":"PR Notif"}`, "g1", "guru")
	if err := h.CreateTugas(c); err != nil {
		t.Fatalf("create: %v", err)
	}
	if rec.Code != 200 {
		t.Fatalf("create failed: %d %s", rec.Code, rec.Body.String())
	}

	var studentNotifs, parentNotifs int
	db.QueryRow(`SELECT COUNT(*) FROM admin_notifications WHERE user_id = 'u_s1'`).Scan(&studentNotifs)
	db.QueryRow(`SELECT COUNT(*) FROM admin_notifications WHERE user_id = 'u_s2'`).Scan(&studentNotifs)
	db.QueryRow(`SELECT COUNT(*) FROM admin_notifications WHERE title LIKE '%Anak Anda%'`).Scan(&parentNotifs)
	if studentNotifs == 0 {
		t.Error("expected student notification about new tugas")
	}
	if parentNotifs == 0 {
		t.Error("expected parent notification about new tugas")
	}
}

// Test 5: siswa kelas benar submit → 200.
func TestSubmitTugas_OK(t *testing.T) {
	db := setupTugasHandlerTestDB(t)
	defer db.Close()
	h := newTugasHandler(db)
	e := echo.New()

	tg := seedTugas(t, h, e, `{"title":"PR Tulis"}`)
	c, rec := tugasCtx(e, http.MethodPost, "/", `{"answerText":"Ini jawabanku"}`, "u_s1", "siswa")
	c.SetParamNames("id")
	c.SetParamValues(tg.ID)
	if err := h.SubmitMyTugas(c); err != nil {
		t.Fatalf("submit: %v", err)
	}
	if rec.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rec.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	if data["answerText"] != "Ini jawabanku" || data["isLate"].(bool) {
		t.Errorf("unexpected submission: %v", data)
	}

	// Submit ulang sebelum dinilai → boleh.
	c2, rec2 := tugasCtx(e, http.MethodPost, "/", `{"answerText":"Revisi"}`, "u_s1", "siswa")
	c2.SetParamNames("id")
	c2.SetParamValues(tg.ID)
	if err := h.SubmitMyTugas(c2); err != nil {
		t.Fatalf("resubmit: %v", err)
	}
	if rec2.Code != 200 {
		t.Fatalf("resubmit expected 200, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

// Test 6: submit terlambat & tidak diizinkan → 409.
func TestSubmitTugas_TerlambatDitolak(t *testing.T) {
	db := setupTugasHandlerTestDB(t)
	defer db.Close()
	h := newTugasHandler(db)
	e := echo.New()

	tg := seedTugas(t, h, e, `{"title":"PR Telat","dueAt":1000,"allowLate":false}`)
	c, rec := tugasCtx(e, http.MethodPost, "/", `{"answerText":"telat"}`, "u_s1", "siswa")
	c.SetParamNames("id")
	c.SetParamValues(tg.ID)
	if err := h.SubmitMyTugas(c); err != nil {
		t.Fatalf("submit: %v", err)
	}
	if rec.Code != 409 || !strings.Contains(rec.Body.String(), "terlewati") {
		t.Fatalf("expected 409 late-rejected, got %d: %s", rec.Code, rec.Body.String())
	}
}

// Test 7: submit terlambat & diizinkan → 200 + isLate true.
func TestSubmitTugas_TerlambatDiperbolehkan(t *testing.T) {
	db := setupTugasHandlerTestDB(t)
	defer db.Close()
	h := newTugasHandler(db)
	e := echo.New()

	tg := seedTugas(t, h, e, `{"title":"PR Telat2","dueAt":1000,"allowLate":true}`)
	c, rec := tugasCtx(e, http.MethodPost, "/", `{"answerText":"telat"}`, "u_s1", "siswa")
	c.SetParamNames("id")
	c.SetParamValues(tg.ID)
	if err := h.SubmitMyTugas(c); err != nil {
		t.Fatalf("submit: %v", err)
	}
	if rec.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if !resp["data"].(map[string]interface{})["isLate"].(bool) {
		t.Error("expected isLate=true for late submission")
	}
}

// Test 8: siswa dari kelas lain → 403.
func TestSubmitTugas_KelasLain(t *testing.T) {
	db := setupTugasHandlerTestDB(t)
	defer db.Close()
	db.Exec(`INSERT INTO student_classes (id, name, academic_year, is_active, wali_user_id) VALUES ('c2', 'Kelas 5', '2026/2027', 1, NULL)`)
	db.Exec(`INSERT INTO students (id, full_name, class_id, status, is_active) VALUES ('s9', 'X', 'c2', 'active', 1)`)
	db.Exec(`INSERT INTO users (id, name, email, role, is_active, student_id) VALUES ('u_s9', 'X', 'x@test.com', 'siswa', 1, 's9')`)

	h := newTugasHandler(db)
	e := echo.New()
	tg := seedTugas(t, h, e, `{"title":"PR Kelas"}`)

	c, rec := tugasCtx(e, http.MethodPost, "/", `{"answerText":"nyasar"}`, "u_s9", "siswa")
	c.SetParamNames("id")
	c.SetParamValues(tg.ID)
	if err := h.SubmitMyTugas(c); err != nil {
		t.Fatalf("submit: %v", err)
	}
	if rec.Code != 403 {
		t.Fatalf("expected 403 cross-class, got %d: %s", rec.Code, rec.Body.String())
	}
}

// Test 9: submit kosong → 400.
func TestSubmitTugas_Kosong(t *testing.T) {
	db := setupTugasHandlerTestDB(t)
	defer db.Close()
	h := newTugasHandler(db)
	e := echo.New()
	tg := seedTugas(t, h, e, `{"title":"PR Kosong"}`)

	c, rec := tugasCtx(e, http.MethodPost, "/", `{}`, "u_s1", "siswa")
	c.SetParamNames("id")
	c.SetParamValues(tg.ID)
	if err := h.SubmitMyTugas(c); err != nil {
		t.Fatalf("submit: %v", err)
	}
	if rec.Code != 400 {
		t.Fatalf("expected 400 empty submission, got %d: %s", rec.Code, rec.Body.String())
	}
}

// Test 10: setelah dinilai, siswa tidak bisa submit ulang → 409.
func TestSubmitTugas_SudahDinilai(t *testing.T) {
	db := setupTugasHandlerTestDB(t)
	defer db.Close()
	h := newTugasHandler(db)
	e := echo.New()
	tg := seedTugas(t, h, e, `{"title":"PR Dinilai"}`)

	// siswa submit
	sc, _ := tugasCtx(e, http.MethodPost, "/", `{"answerText":"jwb"}`, "u_s1", "siswa")
	sc.SetParamNames("id")
	sc.SetParamValues(tg.ID)
	if err := h.SubmitMyTugas(sc); err != nil {
		t.Fatalf("submit: %v", err)
	}
	// guru nilai
	sub, _ := h.Repo.GetSubmission(tg.ID, "s1")
	gc, grec := tugasCtx(e, http.MethodPut, "/", `{"score":90,"feedback":"Mantap"}`, "g1", "guru")
	gc.SetParamNames("id", "subId")
	gc.SetParamValues(tg.ID, sub.ID)
	if err := h.GradeSubmission(gc); err != nil {
		t.Fatalf("grade: %v", err)
	}
	if grec.Code != 200 {
		t.Fatalf("grade expected 200, got %d: %s", grec.Code, grec.Body.String())
	}
	// siswa submit ulang → 409
	rc, rrec := tugasCtx(e, http.MethodPost, "/", `{"answerText":"ubah"}`, "u_s1", "siswa")
	rc.SetParamNames("id")
	rc.SetParamValues(tg.ID)
	if err := h.SubmitMyTugas(rc); err != nil {
		t.Fatalf("resubmit: %v", err)
	}
	if rrec.Code != 409 {
		t.Fatalf("expected 409 after graded, got %d: %s", rrec.Code, rrec.Body.String())
	}
}

// Test 11: nilai di luar 0-100 → 400.
func TestGradeSubmission_NilaiInvalid(t *testing.T) {
	db := setupTugasHandlerTestDB(t)
	defer db.Close()
	h := newTugasHandler(db)
	e := echo.New()
	tg := seedTugas(t, h, e, `{"title":"PR Nilai"}`)

	sc, _ := tugasCtx(e, http.MethodPost, "/", `{"answerText":"jwb"}`, "u_s1", "siswa")
	sc.SetParamNames("id")
	sc.SetParamValues(tg.ID)
	_ = h.SubmitMyTugas(sc)

	sub, _ := h.Repo.GetSubmission(tg.ID, "s1")
	c, rec := tugasCtx(e, http.MethodPut, "/", `{"score":150}`, "g1", "guru")
	c.SetParamNames("id", "subId")
	c.SetParamValues(tg.ID, sub.ID)
	if err := h.GradeSubmission(c); err != nil {
		t.Fatalf("grade: %v", err)
	}
	if rec.Code != 400 {
		t.Fatalf("expected 400 for score 150, got %d: %s", rec.Code, rec.Body.String())
	}
}

// Test 12: guru lain tidak bisa akses tugas → 403.
func TestGetTugas_GuruLain(t *testing.T) {
	db := setupTugasHandlerTestDB(t)
	defer db.Close()
	h := newTugasHandler(db)
	e := echo.New()
	tg := seedTugas(t, h, e, `{"title":"PR Privat"}`)

	c, rec := tugasCtx(e, http.MethodGet, "/", "", "g2", "guru")
	c.SetParamNames("id")
	c.SetParamValues(tg.ID)
	if err := h.GetTugas(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec.Code != 403 {
		t.Fatalf("expected 403 for other guru, got %d: %s", rec.Code, rec.Body.String())
	}

	// guru pemilik boleh.
	c2, rec2 := tugasCtx(e, http.MethodGet, "/", "", "g1", "guru")
	c2.SetParamNames("id")
	c2.SetParamValues(tg.ID)
	if err := h.GetTugas(c2); err != nil {
		t.Fatalf("owner get: %v", err)
	}
	if rec2.Code != 200 {
		t.Fatalf("owner expected 200, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

// Test 13: remind hanya menghubungi siswa yang belum mengumpulkan.
func TestRemind(t *testing.T) {
	db := setupTugasHandlerTestDB(t)
	defer db.Close()
	h := newTugasHandler(db)
	e := echo.New()
	tg := seedTugas(t, h, e, `{"title":"PR Ingat"}`)

	// s1 submit, s2 belum.
	sc, _ := tugasCtx(e, http.MethodPost, "/", `{"answerText":"jwb"}`, "u_s1", "siswa")
	sc.SetParamNames("id")
	sc.SetParamValues(tg.ID)
	_ = h.SubmitMyTugas(sc)

	c, rec := tugasCtx(e, http.MethodPost, "/", "", "g1", "guru")
	c.SetParamNames("id")
	c.SetParamValues(tg.ID)
	if err := h.Remind(c); err != nil {
		t.Fatalf("remind: %v", err)
	}
	if rec.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp["reminded"].(float64) != 1 {
		t.Errorf("expected reminded=1 (only s2), got %v", resp["reminded"])
	}
	var n int
	db.QueryRow(`SELECT COUNT(*) FROM admin_notifications WHERE user_id = 'u_s2' AND title LIKE '%Pengingat%'`).Scan(&n)
	if n == 0 {
		t.Error("expected reminder notification for u_s2")
	}
	var n1 int
	db.QueryRow(`SELECT COUNT(*) FROM admin_notifications WHERE user_id = 'u_s1' AND title LIKE '%Pengingat%'`).Scan(&n1)
	if n1 != 0 {
		t.Error("s1 already submitted; must not be reminded")
	}
}

// Test 14: orang tua melihat tugas anaknya (dengan status pengumpulan).
func TestListChildrenTugas_Ortu(t *testing.T) {
	db := setupTugasHandlerTestDB(t)
	defer db.Close()
	h := newTugasHandler(db)
	e := echo.New()
	tg := seedTugas(t, h, e, `{"title":"PR Ortu"}`)

	sc, _ := tugasCtx(e, http.MethodPost, "/", `{"answerText":"jwb"}`, "u_s1", "siswa")
	sc.SetParamNames("id")
	sc.SetParamValues(tg.ID)
	_ = h.SubmitMyTugas(sc)

	c, rec := tugasCtx(e, http.MethodGet, "/", "", "p1", "orangtua")
	if err := h.ListChildrenTugas(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Data []models.Tugas `json:"data"`
	}
	json.Unmarshal(rec.Body.Bytes(), &resp)
	if len(resp.Data) != 1 {
		t.Fatalf("parent must see 1 tugas, got %d", len(resp.Data))
	}
	if resp.Data[0].StudentID != "s1" || resp.Data[0].MyStatus != "submitted" {
		t.Errorf("child tugas view wrong: %+v", resp.Data[0])
	}
	_ = tg
}

// seedTugas membuat satu tugas sebagai guru wali (g1) dan mengembalikannya.
func seedTugas(t *testing.T, h *TugasHandler, e *echo.Echo, body string) *models.Tugas {
	t.Helper()
	c, rec := tugasCtx(e, http.MethodPost, "/", body, "g1", "guru")
	if err := h.CreateTugas(c); err != nil {
		t.Fatalf("seed create: %v", err)
	}
	var resp struct {
		Data models.Tugas `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("seed unmarshal: %v", err)
	}
	return &resp.Data
}
