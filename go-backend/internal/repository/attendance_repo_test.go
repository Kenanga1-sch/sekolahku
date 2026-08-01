package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupAttendanceTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE students (
			id TEXT PRIMARY KEY,
			nisn TEXT,
			nis TEXT,
			full_name TEXT NOT NULL,
			class_name TEXT,
			status TEXT DEFAULT 'active',
			photo TEXT,
			qr_code TEXT,
			is_active INTEGER DEFAULT 1,
			kip TEXT
		);
		CREATE TABLE attendance_sessions (
			id TEXT PRIMARY KEY,
			date TEXT NOT NULL,
			class_name TEXT NOT NULL,
			class_id TEXT,
			academic_year TEXT,
			teacher_name TEXT,
			status TEXT DEFAULT 'open' NOT NULL,
			opened_at INTEGER,
			closed_at INTEGER,
			notes TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE attendance_records (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL,
			student_id TEXT NOT NULL,
			status TEXT DEFAULT 'hadir' NOT NULL,
			check_in_time INTEGER,
			recorded_by TEXT,
			record_method TEXT DEFAULT 'manual' NOT NULL,
			notes TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
	`)
	if err != nil {
		t.Fatalf("failed to create attendance schema: %v", err)
	}

	return db
}

func TestAttendanceRecordQRScanV2(t *testing.T) {
	db := setupAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceRepository(db)

	_, err := db.Exec(`
		INSERT INTO students (id, nisn, full_name, class_name, status, qr_code, is_active) VALUES
			('student-1', '111', 'Siswa Satu', '3A', 'active', 'qr-1', 1),
			('student-2', '222', 'Siswa Dua', '3A', 'active', 'qr-2', 1);
	`)
	if err != nil {
		t.Fatal(err)
	}

	// Test QR scan for active student (use a non-holiday date)
	res, err := repo.RecordQRScanV2(models.AttendanceScanRequest{QRCode: "qr-1"})
	if err != nil && err != ErrHoliday {
		t.Fatalf("RecordQRScanV2 returned unexpected error: %v", err)
	}
	if err == nil {
		if res == nil || res.Student == nil {
			t.Fatal("expected student payload in scan result")
		}
	}
}

func TestAttendanceGetDailyClass(t *testing.T) {
	db := setupAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceRepository(db)

	_, err := db.Exec(`
		INSERT INTO students (id, nisn, full_name, class_name, status, qr_code, is_active) VALUES
			('student-1', '111', 'Siswa Satu', '1A', 'active', 'qr-1', 1);
	`)
	if err != nil {
		t.Fatal(err)
	}

	result, err := repo.GetDailyClass("2026-06-02", "1A")
	if err != nil {
		t.Fatalf("GetDailyClass returned error: %v", err)
	}
	if len(result.Students) != 1 {
		t.Fatalf("expected 1 student, got %d", len(result.Students))
	}
}
