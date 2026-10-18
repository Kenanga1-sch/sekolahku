package handlers

import (
	"strings"

	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

func setupWaliKelasTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	repository.SetHolidayDB(db)
	stmts := []string{
		`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, username TEXT UNIQUE, password_hash TEXT, role TEXT DEFAULT 'user', full_name TEXT, phone TEXT, is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER, image TEXT, email_verified INTEGER, must_change_password INTEGER DEFAULT 0)`,
		`CREATE TABLE student_classes (id TEXT PRIMARY KEY, name TEXT NOT NULL, grade INTEGER, academic_year TEXT, teacher_name TEXT, capacity INTEGER DEFAULT 40, is_active BOOLEAN DEFAULT 1, created_at INTEGER, updated_at INTEGER, wali_user_id TEXT)`,
		`CREATE TABLE students (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, class_name TEXT, class_id TEXT, status TEXT DEFAULT 'active', is_active INTEGER DEFAULT 1, nis TEXT, nisn TEXT UNIQUE, qr_code TEXT UNIQUE, photo TEXT, birth_date TEXT, nik TEXT, gender TEXT, birth_place TEXT, religion TEXT, address TEXT, parent_name TEXT, father_name TEXT, father_nik TEXT, mother_name TEXT, mother_nik TEXT, guardian_name TEXT, guardian_nik TEXT, guardian_job TEXT, parent_phone TEXT, meta_data TEXT, enrolled_at INTEGER, created_at INTEGER, updated_at INTEGER, kip TEXT)`,
		`CREATE TABLE student_class_history (id TEXT PRIMARY KEY, student_id TEXT, class_id TEXT, class_name TEXT, academic_year TEXT, grade INTEGER, status TEXT, record_date INTEGER)`,
		`CREATE TABLE school_holidays (id TEXT PRIMARY KEY, date TEXT, title TEXT, description TEXT)`,
		`CREATE TABLE attendance_sessions (id TEXT PRIMARY KEY, date TEXT, class_id TEXT, class_name TEXT, academic_year TEXT, status TEXT, opened_at INTEGER, created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE attendance_records (id TEXT PRIMARY KEY, session_id TEXT, student_id TEXT, status TEXT, check_in_time INTEGER, recorded_by TEXT, record_method TEXT, notes TEXT, created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE tabungan_siswa (id TEXT PRIMARY KEY, student_id TEXT UNIQUE, saldo_terakhir REAL DEFAULT 0, created_at INTEGER)`,
		`INSERT INTO users (id, name, email, role, is_active, created_at, updated_at) VALUES ('g1', 'Guru Satu', 'g1@test.com', 'guru', 1, 1000, 1000)`,
		`INSERT INTO users (id, name, email, role, is_active, created_at, updated_at) VALUES ('g2', 'Guru Dua Tanpa Wali', 'g2@test.com', 'guru', 1, 1000, 1000)`,
		`INSERT INTO users (id, name, email, role, is_active, created_at, updated_at) VALUES ('adm', 'Admin', 'a@test.com', 'admin', 1, 1000, 1000)`,
		`INSERT INTO student_classes (id, name, grade, academic_year, capacity, is_active, wali_user_id, created_at, updated_at) VALUES ('c1', 'Kelas 1', 1, '2026/2027', 28, 1, 'g1', 1000, 1000)`,
		`INSERT INTO student_classes (id, name, grade, academic_year, capacity, is_active, wali_user_id, created_at, updated_at) VALUES ('c2', 'Kelas 2', 2, '2026/2027', 28, 1, NULL, 1000, 1000)`,
		`INSERT INTO students (id, full_name, class_name, class_id, status, is_active) VALUES ('s1', 'Siswa Kelas 1', 'Kelas 1', 'c1', 'active', 1)`,
		`INSERT INTO students (id, full_name, class_name, class_id, status, is_active) VALUES ('s2', 'Siswa Kelas 2', 'Kelas 2', 'c2', 'active', 1)`,
		`INSERT INTO tabungan_siswa (id, student_id, saldo_terakhir, created_at) VALUES ('t1', 's1', 5000, 1000)`,
		`INSERT INTO tabungan_siswa (id, student_id, saldo_terakhir, created_at) VALUES ('t2', 's2', 7000, 1000)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("exec: %v\nSQL: %s", err, s)
		}
	}
	return db
}

func guruContext(t *testing.T, e *echo.Echo, userID string) (echo.Context, *httptest.ResponseRecorder) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", userID)
	c.Set("user_role", "guru")
	return c, rec
}

// Test 1: Guru wali Kelas 1 GET /api/classes → hanya Kelas 1
func TestGetClasses_GuruScoped(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	h := &StudentHandler{Repo: repository.NewStudentRepository(db), DB: db}
	e := echo.New()

	c, rec := guruContext(t, e, "g1")
	if err := h.GetClasses(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	body := rec.Body.String()
	if rec.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", rec.Code, body)
	}
	if !contains(body, `"Kelas 1"`) {
		t.Errorf("expected Kelas 1 in response, got: %s", body)
	}
	if contains(body, `"Kelas 2"`) {
		t.Errorf("Kelas 2 must not appear for guru wali Kelas 1, got: %s", body)
	}
}

// Test 2: Guru TANPA wali kelas → daftar kosong, bukan semua kelas
func TestGetClasses_GuruTanpaWali(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	h := &StudentHandler{Repo: repository.NewStudentRepository(db), DB: db}
	e := echo.New()

	c, rec := guruContext(t, e, "g2")
	if err := h.GetClasses(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	body := rec.Body.String()
	if contains(body, `"Kelas 1"`) || contains(body, `"Kelas 2"`) {
		t.Errorf("guru tanpa wali kelas must see no classes, got: %s", body)
	}
}

// Test 3: Admin → semua kelas
func TestGetClasses_AdminUnscoped(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	h := &StudentHandler{Repo: repository.NewStudentRepository(db), DB: db}
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", "adm")
	c.Set("user_role", "admin")

	if err := h.GetClasses(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	body := rec.Body.String()
	if !contains(body, "Kelas 1") || !contains(body, "Kelas 2") {
		t.Errorf("admin must see all classes, got: %s", body)
	}
}

// Test 4: Guru paksa kelas di presensi — param class diabaikan
func TestGetDailyClass_GuruForced(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	h := NewAttendanceHandler(repository.NewAttendanceRepository(db), nil)
	e := echo.New()

	// Tanggal kerja deterministik — tanpa param date, GetDailyClass memakai
	// today() dan mengembalikan holiday tiap Minggu sehingga test flaky.
	req := httptest.NewRequest(http.MethodGet, "/?date=2026-09-15&class=Kelas+2", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", "g1")
	c.Set("user_role", "guru")
	c.QueryParams() // parse

	if err := h.GetDailyClass(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	body := rec.Body.String()
	if contains(body, "Siswa Kelas 2") {
		t.Errorf("guru wali Kelas 1 must not see Kelas 2 students, got: %s", body)
	}
	if !contains(body, "Siswa Kelas 1") {
		t.Errorf("expected Kelas 1 students in response, got: %s", body)
	}
}

// Test 5: Tabungan GetSiswa — guru hanya siswa kelasnya
func TestGetSiswa_GuruScoped(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	h := NewSavingsHandler(repository.NewSavingsRepository(db), repository.NewNotificationRepository(db), nil, nil)
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/?", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", "g1")
	c.Set("user_role", "guru")

	if err := h.GetSiswa(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	body := rec.Body.String()
	if !contains(body, "Siswa Kelas 1") {
		t.Errorf("expected siswa Kelas 1, got: %s", body)
	}
	if contains(body, "Siswa Kelas 2") {
		t.Errorf("guru must not see siswa Kelas 2, got: %s", body)
	}
}

// Test 6: Guru tanpa wali → GetSiswa kosong (bukan semua siswa)
func TestGetSiswa_GuruTanpaWaliKosong(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	h := NewSavingsHandler(repository.NewSavingsRepository(db), repository.NewNotificationRepository(db), nil, nil)
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/?", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", "g2")
	c.Set("user_role", "guru")

	if err := h.GetSiswa(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	body := rec.Body.String()
	if contains(body, "Siswa Kelas 1") || contains(body, "Siswa Kelas 2") {
		t.Errorf("guru tanpa wali must see empty list, got: %s", body)
	}
}

// Test 7: GetClassesWithReps — guru hanya kelasnya
func TestGetClassesWithReps_GuruScoped(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	h := NewSavingsHandler(repository.NewSavingsRepository(db), repository.NewNotificationRepository(db), nil, nil)
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", "g1")
	c.Set("user_role", "guru")

	if err := h.GetClassesWithReps(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	body := rec.Body.String()
	if !contains(body, "Kelas 1") {
		t.Errorf("expected Kelas 1, got: %s", body)
	}
	if contains(body, "Kelas 2") {
		t.Errorf("guru must not see Kelas 2, got: %s", body)
	}
}

// Test 8: UpdateClass menyimpan wali_user_id dan GetWaliClass menemukannya.
// Menguji lewat handler penuu (Echo Bind) — skenario nyata dari admin UI.
func TestUpdateClass_SimpanWali(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	repo := repository.NewAcademicRepository(db)
	h := NewAcademicHandler(repo)
	e := echo.New()

	// httptest.NewRequest(target="/") tidak membaca ContentLength dari Body
	// yang diganti manual; Echo Binder melewatkan body dengan ContentLength 0.
	// Pakai strings.NewReader supaya ContentLength terisi.
	req := httptest.NewRequest(http.MethodPut, "/", strings.NewReader(`{"name":"Kelas 2","grade":2,"academicYear":"2026/2027","capacity":28,"isActive":true,"waliUserId":"g2"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("c2")

	if err := h.UpdateClass(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec.Code != 200 {
		t.Fatalf("UpdateClass returned %d: %s", rec.Code, rec.Body.String())
	}

	var wali sql.NullString
	if err := db.QueryRow(`SELECT wali_user_id FROM student_classes WHERE id = 'c2'`).Scan(&wali); err != nil {
		t.Fatal(err)
	}
	if !wali.Valid || wali.String != "g2" {
		t.Fatalf("expected wali_user_id=g2, got %v", wali)
	}

	// GetWaliClass harus menemukan kelas untuk guru g2
	classID, className, err := repo.GetWaliClass("g2")
	if err != nil || classID != "c2" || className != "Kelas 2" {
		t.Fatalf("GetWaliClass(g2) = %q,%q,%v; want c2,Kelas 2,nil", classID, className, err)
	}
}

// seedAttendanceToday menyiapkan 1 sesi + 1 record per kelas untuk hari ini
// (JAKARTA, mengikuti repository.TodayJakarta) — dipakai test GetStats.
func seedAttendanceToday(t *testing.T, db *sql.DB) {
	t.Helper()
	today := repository.TodayJakarta()
	if _, err := db.Exec(`
		INSERT INTO attendance_sessions (id, date, class_id, class_name, academic_year, status, created_at, updated_at)
			VALUES ('sess1', ?, 'c1', 'Kelas 1', '2026/2027', 'open', 1000, 1000),
			       ('sess2', ?, 'c2', 'Kelas 2', '2026/2027', 'open', 1000, 1000);
		INSERT INTO attendance_records (id, session_id, student_id, status, created_at, updated_at)
			VALUES ('ar1', 'sess1', 's1', 'hadir', 1000, 1000),
			       ('ar2', 'sess2', 's2', 'alpha', 1000, 1000);
	`, today, today); err != nil {
		t.Fatalf("seed attendance: %v", err)
	}
}

// Test 9: GetStats guru wali → hanya siswa & record kelasnya sendiri.
func TestGetStats_GuruScoped(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	seedAttendanceToday(t, db)
	h := NewAttendanceHandler(repository.NewAttendanceRepository(db), nil)
	e := echo.New()

	c, rec := guruContext(t, e, "g1")
	if err := h.GetStats(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !contains(body, `"totalStudents":1`) {
		t.Errorf("guru wali harus menghitung 1 siswa kelasnya, got: %s", body)
	}
	if !contains(body, `"hadir":1`) || contains(body, `"alpha":1`) {
		t.Errorf("angka kehadiran harus milik Kelas 1 saja, got: %s", body)
	}
	if !contains(body, `"className":"Kelas 1"`) {
		t.Errorf("respons harus menyertakan kelas wali, got: %s", body)
	}
}

// Test 10: GetStats guru tanpa wali → statistik kosong, bukan data sekolah.
func TestGetStats_GuruTanpaWali(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	seedAttendanceToday(t, db)
	h := NewAttendanceHandler(repository.NewAttendanceRepository(db), nil)
	e := echo.New()

	c, rec := guruContext(t, e, "g2")
	if err := h.GetStats(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !contains(body, `"totalStudents":0`) {
		t.Errorf("guru tanpa wali harus mendapat statistik 0, got: %s", body)
	}
	if contains(body, `"totalStudents":2`) || contains(body, `"hadir":1`) {
		t.Errorf("guru tanpa wali tidak boleh melihat data sekolah, got: %s", body)
	}
	if contains(body, `"className"`) {
		t.Errorf("tanpa kelas, respons tidak boleh punya className, got: %s", body)
	}
}

// Test 11: GetStats admin → tetap seluruh sekolah (tanpa scope).
func TestGetStats_AdminUnscoped(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	seedAttendanceToday(t, db)
	h := NewAttendanceHandler(repository.NewAttendanceRepository(db), nil)
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", "adm")
	c.Set("user_role", "admin")

	if err := h.GetStats(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !contains(body, `"totalStudents":2`) {
		t.Errorf("admin harus melihat 2 siswa sekolah, got: %s", body)
	}
	if !contains(body, `"hadir":1`) || !contains(body, `"alpha":1`) {
		t.Errorf("admin harus melihat record semua kelas, got: %s", body)
	}
	if contains(body, `"className"`) {
		t.Errorf("data sekolah tidak boleh punya className, got: %s", body)
	}
}

// Test 12: Direktori GetStudents — guru wali hanya melihat siswa kelasnya,
// daftar maupun ringkasan (summary).
func TestGetStudents_GuruScoped(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	h := &StudentHandler{Repo: repository.NewStudentRepository(db), DB: db}
	e := echo.New()

	c, rec := guruContext(t, e, "g1")
	if err := h.GetStudents(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !contains(body, "Siswa Kelas 1") {
		t.Errorf("guru wali harus melihat siswa kelasnya, got: %s", body)
	}
	if contains(body, "Siswa Kelas 2") {
		t.Errorf("guru wali tidak boleh melihat siswa kelas lain, got: %s", body)
	}
	if !contains(body, `"active":1`) {
		t.Errorf("summary harus hanya menghitung kelas wali (1 siswa), got: %s", body)
	}
}

// Test 13: GetStudents guru tanpa wali → daftar & summary kosong.
func TestGetStudents_GuruTanpaWali(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	h := &StudentHandler{Repo: repository.NewStudentRepository(db), DB: db}
	e := echo.New()

	c, rec := guruContext(t, e, "g2")
	if err := h.GetStudents(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if contains(body, "Siswa Kelas 1") || contains(body, "Siswa Kelas 2") {
		t.Errorf("guru tanpa wali harus mendapat daftar kosong, got: %s", body)
	}
	if !contains(body, `"active":0`) {
		t.Errorf("summary guru tanpa wali harus 0, got: %s", body)
	}
}

// Test 14: GetStudents admin → seluruh sekolah.
func TestGetStudents_AdminUnscoped(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	h := &StudentHandler{Repo: repository.NewStudentRepository(db), DB: db}
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", "adm")
	c.Set("user_role", "admin")

	if err := h.GetStudents(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	body := rec.Body.String()
	if !contains(body, "Siswa Kelas 1") || !contains(body, "Siswa Kelas 2") {
		t.Errorf("admin harus melihat semua siswa, got: %s", body)
	}
	if !contains(body, `"active":2`) {
		t.Errorf("summary admin harus 2 siswa, got: %s", body)
	}
}

// Test 15: GetStudentByID — guru tidak boleh membuka siswa kelas lain.
func TestGetStudentByID_GuruLuarKelas_Ditolak(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	h := &StudentHandler{Repo: repository.NewStudentRepository(db), DB: db}
	e := echo.New()

	c, rec := guruContext(t, e, "g1")
	c.SetParamNames("id")
	c.SetParamValues("s2")

	if err := h.GetStudentByID(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec.Code != http.StatusNotFound {
		t.Fatalf("siswa kelas lain harus 404, got %d: %s", rec.Code, rec.Body.String())
	}
	if contains(rec.Body.String(), "Siswa Kelas 2") {
		t.Errorf("data siswa kelas lain tidak boleh bocor, got: %s", rec.Body.String())
	}

	// Siswa kelasnya sendiri tetap boleh dibuka.
	c2, rec2 := guruContext(t, e, "g1")
	c2.SetParamNames("id")
	c2.SetParamValues("s1")
	if err := h.GetStudentByID(c2); err != nil {
		t.Fatalf("handler: %v", err)
	}
	if rec2.Code != http.StatusOK || !contains(rec2.Body.String(), "Siswa Kelas 1") {
		t.Errorf("guru wali harus bisa membuka siswanya, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

// Test 16: SimpleSearch guru wali hanya menemukan siswa kelasnya.
func TestSimpleSearch_GuruScoped(t *testing.T) {
	db := setupWaliKelasTestDB(t)
	defer db.Close()
	h := &StudentHandler{Repo: repository.NewStudentRepository(db), DB: db}
	e := echo.New()

	req := httptest.NewRequest(http.MethodGet, "/?q=Siswa", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", "g1")
	c.Set("user_role", "guru")

	if err := h.SimpleSearch(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	body := rec.Body.String()
	if !contains(body, "Siswa Kelas 1") {
		t.Errorf("guru wali harus menemukan siswanya, got: %s", body)
	}
	if contains(body, "Siswa Kelas 2") {
		t.Errorf("guru wali tidak boleh menemukan siswa kelas lain, got: %s", body)
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (func() bool {
		for i := 0; i+len(substr) <= len(s); i++ {
			if s[i:i+len(substr)] == substr {
				return true
			}
		}
		return false
	})()
}
