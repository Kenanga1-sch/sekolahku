package repository

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

// Schema test disamakan dengan tabel produksi: employee_details TIDAK punya kolom is_active.
func setupPublicStaffTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}
	db.SetMaxOpenConns(1) // :memory: modernc sqlite: koneksi baru = DB baru

	_, err = db.Exec(`
		CREATE TABLE employee_details (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			degree TEXT,
			job_type TEXT,
			category TEXT,
			photo_url TEXT,
			quote TEXT,
			display_order INTEGER DEFAULT 0,
			created_at INTEGER,
			updated_at INTEGER
		);
	`)
	if err != nil {
		t.Fatalf("failed to create staff profile schema: %v", err)
	}

	return db
}

func TestPublicRepositoryGetPublicStaffUsesStaffProfiles(t *testing.T) {
	db := setupPublicStaffTestDB(t)
	defer db.Close()

	_, err := db.Exec(`
		INSERT INTO employee_details (id, name, degree, job_type, category, photo_url, quote, display_order)
		VALUES
			('staff-2', 'Guru Dua', 'S.Pd', 'Guru Kelas 2', 'guru', '/uploads/staff/guru.jpg', 'Belajar', 2),
			('staff-1', 'Kepala Sekolah', 'M.Pd', 'Kepala Sekolah', 'kepsek', '/uploads/staff/kepsek.jpg', 'Melayani', 10),
			('staff-3', 'Staf Ops', NULL, 'Operator', 'staff', NULL, NULL, 1)
	`)
	if err != nil {
		t.Fatalf("failed to seed staff profiles: %v", err)
	}

	staff, total, err := NewPublicRepository(db).GetPublicStaff(1, 20)
	if err != nil {
		t.Fatalf("GetPublicStaff returned error: %v", err)
	}
	if total != 3 {
		t.Fatalf("expected three staff profiles, got %d", total)
	}
	if len(staff) != 3 {
		t.Fatalf("expected three staff rows, got %d", len(staff))
	}
	if staff[0].ID != "staff-1" || staff[0].Category != "kepsek" {
		t.Fatalf("expected kepala sekolah first, got %#v", staff[0])
	}
	// Urutan produksi: kepsek dulu, lalu display_order ASC — staff-3 (order 1) sebelum staff-2 (order 2)
	if staff[1].ID != "staff-3" || staff[2].ID != "staff-2" || staff[2].Position != "Guru Kelas 2" {
		t.Fatalf("unexpected order after kepsek: %#v", staff[1:])
	}
}
