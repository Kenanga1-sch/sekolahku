package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
	_ "modernc.org/sqlite"
)

// setupParentDashboardDB siapkan skema minimal untuk uji GetDashboard: students,
// parent_students, attendance, tugas + submissions, leave_requests, mutasi, tabungan.
func setupParentDashboardDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)

	stmts := []string{
		`CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT)`,
		`CREATE TABLE students (
			id TEXT PRIMARY KEY, full_name TEXT, nisn TEXT, class_id TEXT, class_name TEXT,
			photo TEXT, is_active INTEGER DEFAULT 1
		)`,
		`CREATE TABLE parent_students (
			id TEXT PRIMARY KEY, user_id TEXT, student_id TEXT, relation TEXT,
			is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER,
			UNIQUE(user_id, student_id)
		)`,
		`CREATE TABLE attendance_sessions (
			id TEXT PRIMARY KEY, date TEXT NOT NULL, class_id TEXT, class_name TEXT NOT NULL,
			academic_year TEXT, teacher_name TEXT, status TEXT DEFAULT 'open',
			opened_at INTEGER, closed_at INTEGER, notes TEXT, created_at INTEGER, updated_at INTEGER
		)`,
		`CREATE TABLE attendance_records (
			id TEXT PRIMARY KEY, session_id TEXT NOT NULL, student_id TEXT NOT NULL,
			status TEXT DEFAULT 'hadir' NOT NULL, check_in_time INTEGER, recorded_by TEXT,
			record_method TEXT DEFAULT 'manual' NOT NULL, notes TEXT,
			created_at INTEGER, updated_at INTEGER
		)`,
		`CREATE TABLE tugas (
			id TEXT PRIMARY KEY, teacher_user_id TEXT NOT NULL, class_id TEXT NOT NULL,
			class_name TEXT, subject_id TEXT, subject_name TEXT, academic_year TEXT,
			title TEXT NOT NULL, description TEXT, attachment_url TEXT, attachment_name TEXT,
			due_at INTEGER, allow_late INTEGER NOT NULL DEFAULT 1,
			status TEXT NOT NULL DEFAULT 'published', created_at INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER
		)`,
		`CREATE TABLE tugas_submissions (
			id TEXT PRIMARY KEY, tugas_id TEXT NOT NULL, student_id TEXT NOT NULL,
			answer_text TEXT, attachment_url TEXT, attachment_name TEXT,
			submitted_at INTEGER NOT NULL, is_late INTEGER NOT NULL DEFAULT 0,
			score REAL, feedback TEXT, graded_by TEXT, graded_at INTEGER,
			status TEXT NOT NULL DEFAULT 'submitted', created_at INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER
		)`,
		`CREATE TABLE leave_requests (
			id TEXT PRIMARY KEY, student_id TEXT NOT NULL, parent_user_id TEXT NOT NULL,
			type TEXT NOT NULL DEFAULT 'izin', start_date TEXT NOT NULL, end_date TEXT NOT NULL,
			reason TEXT NOT NULL, attachment_path TEXT, status TEXT NOT NULL DEFAULT 'pending',
			reviewed_by TEXT, reviewed_at INTEGER, review_note TEXT,
			created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
		)`,
		`CREATE TABLE mutasi_out_requests (
			id TEXT PRIMARY KEY, student_id TEXT, destination_school TEXT,
			destination_street TEXT, destination_village TEXT, destination_district TEXT,
			destination_regency TEXT, destination_province TEXT,
			destination_class TEXT, letter_no TEXT, reason TEXT, reason_detail TEXT,
			status TEXT, downloaded_at INTEGER, processed_at INTEGER, completed_at INTEGER,
			created_at INTEGER, updated_at INTEGER
		)`,
		`CREATE TABLE tabungan_siswa (
			id TEXT PRIMARY KEY, student_id TEXT UNIQUE NOT NULL, saldo_terakhir INTEGER DEFAULT 0,
			created_at INTEGER, updated_at INTEGER
		)`,
		`CREATE TABLE tabungan_transaksi (
			id TEXT PRIMARY KEY, siswa_id TEXT NOT NULL, user_id TEXT NOT NULL, setoran_id TEXT,
			tipe TEXT NOT NULL, nominal INTEGER NOT NULL, status TEXT DEFAULT 'pending',
			catatan TEXT, verified_by TEXT, verified_at INTEGER, created_at INTEGER, updated_at INTEGER
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("exec %q: %v", s, err)
		}
	}
	return db
}

func seedParentDashboardDB(t *testing.T, db *sql.DB) {
	t.Helper()
	today := repository.TodayJakarta()
	now := repository.UnixMilli()

	if _, err := db.Exec(`INSERT INTO users (id, role) VALUES ('p1','orangtua'), ('p2','orangtua'), ('p0','orangtua')`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`
		INSERT INTO students (id, full_name, nisn, class_id, class_name) VALUES
			('s1','Anak Test','1234567890','c1','Kelas 4A'),
			('s2','Anak Lain','0987654321','c2','Kelas 5B')
	`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`
		INSERT INTO parent_students (id, user_id, student_id, relation) VALUES
			('ps1','p1','s1','orangtua'),
			('ps2','p2','s2','orangtua')
	`); err != nil {
		t.Fatal(err)
	}

	// Kehadiran: hari ini hadir + 2 hari lalu hadir (untuk rekap mingguan).
	if _, err := db.Exec(`
		INSERT INTO attendance_sessions (id, date, class_id, class_name, status, created_at, updated_at) VALUES
			('as1', ?, 'c1','Kelas 4A','closed', ?, ?),
			('as2', date(?, '-2 days'), 'c1','Kelas 4A','closed', ?, ?)
	`, today, now, now, today, now, now); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`
		INSERT INTO attendance_records (id, session_id, student_id, status, check_in_time, record_method, created_at, updated_at) VALUES
			('ar1','as1','s1','hadir', ?, 'qr_scan', ?, ?),
			('ar2','as2','s1','hadir', ?, 'manual', ?, ?)
	`, now, now, now, now-2*86400000, now-2*86400000, now-2*86400000); err != nil {
		t.Fatal(err)
	}

	// Tugas kelas c1: satu sudah dikumpulkan, satu lewat batas waktu.
	// Tugas kelas c2 milik anak lain (tidak boleh dihitung untuk p1).
	if _, err := db.Exec(`
		INSERT INTO tugas (id, teacher_user_id, class_id, class_name, title, due_at, allow_late, status, created_at, updated_at) VALUES
			('t1','u1','c1','Kelas 4A','PR Matematika', ?, 1, 'published', ?, ?),
			('t2','u1','c1','Kelas 4A','PR Bahasa', ?, 0, 'published', ?, ?),
			('t3','u1','c2','Kelas 5B','PR IPA', ?, 1, 'published', ?, ?)
	`, now+86400000, now, now, now-86400000, now, now, now+86400000, now, now); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`
		INSERT INTO tugas_submissions (id, tugas_id, student_id, submitted_at, is_late, status, created_at, updated_at) VALUES
			('sub1','t1','s1', ?, 0, 'submitted', ?, ?)
	`, now, now, now); err != nil {
		t.Fatal(err)
	}

	// Pengajuan izin s1 menunggu; s2 milik p2 tidak relevan.
	if _, err := db.Exec(`
		INSERT INTO leave_requests (id, student_id, parent_user_id, type, start_date, end_date, reason, status, created_at, updated_at) VALUES
			('lr1','s1','p1','izin', ?, ?, 'Acara keluarga','pending', ?, ?),
			('lr2','s2','p2','sakit', ?, ?, 'Demam','approved', ?, ?)
	`, today, today, now, now, today, today, now, now); err != nil {
		t.Fatal(err)
	}

	// Mutasi s1 masih diproses; mutasi s2 (milik p2) sudah selesai.
	if _, err := db.Exec(`
		INSERT INTO mutasi_out_requests (id, student_id, destination_school, reason, status, created_at, updated_at) VALUES
			('m1','s1','SDN Tujuan','domisili','processed', ?, ?),
			('m2','s2','SDN Lain','domisili','completed', ?, ?)
	`, now, now, now, now); err != nil {
		t.Fatal(err)
	}

	// Tabungan s1: saldo + transaksi tersimpan terakhir.
	if _, err := db.Exec(`
		INSERT INTO tabungan_siswa (id, student_id, saldo_terakhir, created_at, updated_at) VALUES
			('ts1','s1', 50000, ?, ?)
	`, now, now); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`
		INSERT INTO tabungan_transaksi (id, siswa_id, user_id, tipe, nominal, status, catatan, created_at, updated_at) VALUES
			('tt1','s1','p1','setor', 20000, 'verified', 'Setoran awal', ?, ?),
			('tt2','s2','p2','setor', 99000, 'verified', 'Bocor', ?, ?)
	`, now, now, now, now); err != nil {
		t.Fatal(err)
	}
}

func callGetDashboard(db *sql.DB, userID string) (*httptest.ResponseRecorder, *ParentHandler) {
	h := newParentMutasiHandler(db)
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/parent/dashboard", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)
	ctx.Set("user_id", userID)
	ctx.Set("user_role", "orangtua")
	_ = h.GetDashboard(ctx)
	return rec, h
}

func TestParentDashboardAggregate(t *testing.T) {
	db := setupParentDashboardDB(t)
	defer db.Close()
	seedParentDashboardDB(t, db)

	rec, _ := callGetDashboard(db, "p1")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var res struct {
		Success bool                          `json:"success"`
		Data    []models.ParentDashboardChild `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !res.Success || len(res.Data) != 1 {
		t.Fatalf("expected 1 child, got %d: %s", len(res.Data), rec.Body.String())
	}

	child := res.Data[0]
	if child.StudentID != "s1" {
		t.Errorf("expected s1, got %s", child.StudentID)
	}
	if child.AttendanceToday == nil || child.AttendanceToday.Status != "hadir" {
		t.Errorf("expected hadir today, got %+v", child.AttendanceToday)
	}
	if child.Weekly.Hadir != 2 {
		t.Errorf("expected 2 hadir this week, got %d", child.Weekly.Hadir)
	}
	if child.Tugas.Total != 2 || child.Tugas.Belum != 1 || child.Tugas.Terlambat != 1 {
		t.Errorf("unexpected tugas counts: %+v", child.Tugas)
	}
	if child.PendingLeaves != 1 {
		t.Errorf("expected 1 pending leave, got %d", child.PendingLeaves)
	}
	if child.LatestTransaction == nil || child.LatestTransaction.Tipe != "setor" || child.LatestTransaction.Nominal != 20000 {
		t.Errorf("unexpected latest transaction: %+v", child.LatestTransaction)
	}
	if child.Mutasi == nil || child.Mutasi.Status != "processed" || child.Mutasi.DestinationSchool != "SDN Tujuan" {
		t.Errorf("unexpected active mutasi: %+v", child.Mutasi)
	}
	if child.Balance != 50000 {
		t.Errorf("expected balance 50000, got %d", child.Balance)
	}
}

func TestParentDashboardScopedToOwnChildren(t *testing.T) {
	db := setupParentDashboardDB(t)
	defer db.Close()
	seedParentDashboardDB(t, db)

	// p2 hanya melihat anaknya sendiri; mutasi s1 (milik p1) tidak boleh muncul.
	rec, _ := callGetDashboard(db, "p2")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), `"studentId":"s1"`) {
		t.Errorf("other parent's child leaked: %s", rec.Body.String())
	}

	// p0 tidak punya anak tertaut — tetap 200 dengan array kosong.
	rec0, _ := callGetDashboard(db, "p0")
	if rec0.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec0.Code, rec0.Body.String())
	}
	if !strings.Contains(rec0.Body.String(), `"data":[]`) {
		t.Errorf("expected empty data array, got: %s", rec0.Body.String())
	}
}
