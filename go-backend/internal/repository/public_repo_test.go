package repository

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

func setupPublicStaffTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE staff_profiles (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			degree TEXT,
			position TEXT,
			category TEXT,
			photo_url TEXT,
			nip TEXT,
			quote TEXT,
			display_order INTEGER DEFAULT 0,
			is_active BOOLEAN DEFAULT 1,
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
		INSERT INTO staff_profiles (id, name, degree, position, category, photo_url, quote, display_order, is_active)
		VALUES
			('staff-2', 'Guru Dua', 'S.Pd', 'Guru Kelas 2', 'guru', '/uploads/staff/guru.jpg', 'Belajar', 2, 1),
			('staff-1', 'Kepala Sekolah', 'M.Pd', 'Kepala Sekolah', 'kepsek', '/uploads/staff/kepsek.jpg', 'Melayani', 10, 1),
			('staff-3', 'Tidak Aktif', NULL, 'Operator', 'staff', NULL, NULL, 1, 0)
	`)
	if err != nil {
		t.Fatalf("failed to seed staff profiles: %v", err)
	}

	staff, total, err := NewPublicRepository(db).GetPublicStaff(1, 20)
	if err != nil {
		t.Fatalf("GetPublicStaff returned error: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected two active staff profiles, got %d", len(staff))
	}
	if staff[0].ID != "staff-1" || staff[0].Category != "kepsek" {
		t.Fatalf("expected kepala sekolah first, got %#v", staff[0])
	}
	if staff[1].ID != "staff-2" || staff[1].Position != "Guru Kelas 2" {
		t.Fatalf("expected guru profile second, got %#v", staff[1])
	}
}
