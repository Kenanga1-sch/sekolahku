package repository

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

func setupEmployeeTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE employee_details (
			id TEXT PRIMARY KEY,
			user_id TEXT,
			nip TEXT,
			nuptk TEXT,
			nik TEXT,
			employment_status TEXT,
			job_type TEXT,
			join_date TEXT,
			created_at INTEGER,
			updated_at INTEGER,
			category TEXT,
			degree TEXT,
			quote TEXT,
			photo_url TEXT,
			display_order INTEGER,
			name_without_degree TEXT,
			name TEXT,
			email TEXT,
			role TEXT,
			phone TEXT
		);
	`)
	if err != nil {
		t.Fatalf("failed to create employee schema: %v", err)
	}

	return db
}

func TestEmployeeRepositoryGetEmployeesByIDsOrderAndNulls(t *testing.T) {
	db := setupEmployeeTestDB(t)
	defer db.Close()
	repo := NewEmployeeRepository(db)

	_, err := db.Exec(`
		INSERT INTO employee_details (id, name, email, role, nip, photo_url, job_type, employment_status, user_id) VALUES
			('emp-1', 'Budi, S.Pd', 'budi@sekolah.id', 'guru', '197001011990031001', '/uploads/staff/budi.jpg', 'Guru Kelas', 'PNS', 'user-1'),
			('emp-2', 'Siti Aminah', 'siti@sekolah.id', 'staff', NULL, NULL, NULL, NULL, NULL);
	`)
	if err != nil {
		t.Fatal(err)
	}

	result, err := repo.GetEmployeesByIDs([]string{"emp-2", "emp-1", "tidak-ada"})
	if err != nil {
		t.Fatalf("GetEmployeesByIDs returned error: %v", err)
	}
	if len(result) != 2 || result[0].ID != "emp-2" || result[1].ID != "emp-1" {
		t.Fatalf("expected selected order preserved and unknown id skipped, got %#v", result)
	}
	if result[0].NIP != nil || result[0].PhotoUrl != nil {
		t.Fatalf("expected NULL columns to stay nil, got %#v", result[0])
	}
	if result[1].NIP == nil || *result[1].NIP != "197001011990031001" {
		t.Fatalf("expected NIP populated, got %#v", result[1].NIP)
	}
	if result[1].PhotoUrl == nil || *result[1].PhotoUrl != "/uploads/staff/budi.jpg" {
		t.Fatalf("expected photo_url populated, got %#v", result[1].PhotoUrl)
	}
	if !result[1].HasAccount || result[1].UserID == nil || *result[1].UserID != "user-1" {
		t.Fatalf("expected account linkage from user_id, got %#v", result[1])
	}
	if result[0].HasAccount {
		t.Fatalf("expected no account linkage without user_id")
	}

	empty, err := repo.GetEmployeesByIDs(nil)
	if err != nil {
		t.Fatalf("GetEmployeesByIDs(nil) returned error: %v", err)
	}
	if len(empty) != 0 {
		t.Fatalf("expected empty slice for no ids, got %#v", empty)
	}
}
