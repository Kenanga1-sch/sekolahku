package repository

import (
	"database/sql"
	"strings"
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
			is_active INTEGER DEFAULT 1
		);
		CREATE TABLE attendance_sessions (
			id TEXT PRIMARY KEY,
			date TEXT NOT NULL,
			class_name TEXT NOT NULL,
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

func TestAttendanceQRRejectsWrongClassAndCloseMarksMissingAlpha(t *testing.T) {
	db := setupAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceRepository(db)

	_, err := db.Exec(`
		INSERT INTO students (id, nisn, full_name, class_name, status, qr_code, is_active) VALUES
			('student-1', '111', 'Siswa Satu', '3', 'active', 'qr-1', 1),
			('student-2', '222', 'Siswa Dua', '3', 'active', 'qr-2', 1),
			('student-3', '333', 'Siswa Tiga', '4', 'active', 'qr-3', 1);
		INSERT INTO attendance_sessions (id, date, class_name, teacher_name, status, opened_at, created_at, updated_at)
		VALUES ('session-1', '2026-06-01', '3', 'Guru', 'open', 1, 1, 1);
	`)
	if err != nil {
		t.Fatal(err)
	}

	sessionID := "session-1"
	if _, err := repo.RecordQRScan(models.AttendanceScanRequest{QRCode: "qr-1", SessionID: &sessionID}); err != nil {
		t.Fatalf("RecordQRScan returned error: %v", err)
	}

	_, err = repo.RecordQRScan(models.AttendanceScanRequest{QRCode: "qr-3", SessionID: &sessionID})
	if err == nil || !strings.Contains(err.Error(), "bukan kelas") {
		t.Fatalf("expected wrong-class error, got %v", err)
	}

	if err := repo.UpdateSessionStatus(sessionID, "closed"); err != nil {
		t.Fatalf("UpdateSessionStatus returned error: %v", err)
	}

	report, err := repo.GetAttendanceReport("2026-06-01", "2026-06-01", "3")
	if err != nil {
		t.Fatalf("GetAttendanceReport returned error: %v", err)
	}
	if report.Summary.Total != 2 || report.Summary.Hadir != 1 || report.Summary.Alpha != 1 {
		t.Fatalf("unexpected summary: %#v", report.Summary)
	}
}
