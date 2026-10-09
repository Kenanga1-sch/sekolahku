package repository

import (
	"database/sql"
	"errors"
	"testing"

	_ "modernc.org/sqlite"
)

func setupGtkAttendanceTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`
		CREATE TABLE employee_details (
			id TEXT PRIMARY KEY, name TEXT, nip TEXT, nuptk TEXT,
			qr_code TEXT, category TEXT
		);
		CREATE TABLE employee_attendance (
			id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, date TEXT NOT NULL,
			status TEXT DEFAULT 'hadir', check_in_time INTEGER, recorded_by TEXT,
			record_method TEXT DEFAULT 'scan', notes TEXT, created_at INTEGER, updated_at INTEGER
		);
		CREATE UNIQUE INDEX idx_employee_attendance_unique ON employee_attendance(employee_id, date);
		INSERT INTO employee_details (id, name, nip, qr_code, category) VALUES
			('emp-1', 'Budi', '197001011990031001', 'GTK-197001011990031001', 'guru'),
			('emp-2', 'Siti', NULL, 'GTK-EMP-2', 'staff');
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}
	return db
}

func TestAttendanceGTKScanIdempotentPerDay(t *testing.T) {
	db := setupGtkAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceGTKRepository(db)

	name, cat, already, _, err := repo.ScanGTK("GTK-197001011990031001", "", "u1")
	if err != nil || already || name != "Budi" || cat != "guru" {
		t.Fatalf("first scan: name=%q cat=%q already=%v err=%v", name, cat, already, err)
	}
	// Scan ulang → already, tidak dobel.
	_, _, already, _, err = repo.ScanGTK("197001011990031001", "hadir", "u1")
	if err != nil || !already {
		t.Fatalf("second scan should be already=true: already=%v err=%v", already, err)
	}
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM employee_attendance`).Scan(&count)
	if count != 1 {
		t.Fatalf("expected 1 record, got %d", count)
	}
}

func TestAttendanceGTKUnknownAndInvalidStatus(t *testing.T) {
	db := setupGtkAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceGTKRepository(db)

	if _, _, _, _, err := repo.ScanGTK("TIDAK-ADA", "", "u1"); !errors.Is(err, ErrStudentNotFound) {
		t.Fatalf("expected ErrStudentNotFound, got %v", err)
	}
	if _, _, _, _, err := repo.ScanGTK("GTK-EMP-2", "entah", "u1"); !errors.Is(err, ErrInvalidStatus) {
		t.Fatalf("expected ErrInvalidStatus, got %v", err)
	}
}

func TestAttendanceGTKDailyShowsAbsentAsEmpty(t *testing.T) {
	db := setupGtkAttendanceTestDB(t)
	defer db.Close()
	repo := NewAttendanceGTKRepository(db)

	if _, _, _, _, err := repo.ScanGTK("GTK-197001011990031001", "", "u1"); err != nil {
		t.Fatal(err)
	}
	rows, err := repo.GetGTKDaily(TodayJakarta())
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected all GTK listed, got %d", len(rows))
	}
	hadir, belum := 0, 0
	for _, r := range rows {
		if r.Status == "hadir" {
			hadir++
		} else if r.Status == "" {
			belum++
		}
	}
	if hadir != 1 || belum != 1 {
		t.Fatalf("expected 1 hadir + 1 belum, got hadir=%d belum=%d", hadir, belum)
	}
}
