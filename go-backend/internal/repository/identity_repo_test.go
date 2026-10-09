package repository

import (
	"database/sql"
	"errors"
	"testing"

	_ "modernc.org/sqlite"
)

func setupIdentityTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`
		CREATE TABLE students (
			id TEXT PRIMARY KEY, full_name TEXT, class_name TEXT,
			nisn TEXT, nis TEXT, qr_code TEXT, status TEXT, is_active INTEGER, photo TEXT
		);
		CREATE TABLE employee_details (
			id TEXT PRIMARY KEY, name TEXT, nip TEXT, nuptk TEXT,
			qr_code TEXT, category TEXT, user_id TEXT, photo_url TEXT
		);
		CREATE TABLE users (
			id TEXT PRIMARY KEY, name TEXT, image TEXT
		);
		CREATE TABLE library_members (
			id TEXT PRIMARY KEY, user_id TEXT, student_id TEXT, employee_id TEXT,
			max_borrow_limit INTEGER DEFAULT 3, is_active INTEGER DEFAULT 1,
			created_at INTEGER, updated_at INTEGER
		);
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}
	return db
}

func TestResolvePersonByCodeStudentThenStaff(t *testing.T) {
	db := setupIdentityTestDB(t)
	defer db.Close()

	_, err := db.Exec(`
		INSERT INTO students (id, full_name, class_name, nisn, qr_code, status, is_active)
		VALUES ('stu-1', 'Ana', '1A', '0091234567', 'STU-0091234567', 'active', 1);
		INSERT INTO employee_details (id, name, nip, qr_code, category, user_id)
		VALUES ('emp-1', 'Budi Santoso', '197001011990031001', 'GTK-197001011990031001', 'guru', 'user-1');
	`)
	if err != nil {
		t.Fatal(err)
	}

	// Siswa via qr_code.
	p, err := ResolvePersonByCode(db, "STU-0091234567")
	if err != nil || p.Kind != "student" || p.StudentID != "stu-1" || p.ClassName != "1A" || !p.IsActive {
		t.Fatalf("student resolve: %#v err=%v", p, err)
	}
	// Siswa via NISN.
	p, err = ResolvePersonByCode(db, "0091234567")
	if err != nil || p.Kind != "student" || p.StudentID != "stu-1" {
		t.Fatalf("student via nisn: %#v err=%v", p, err)
	}
	// GTK via qr_code.
	p, err = ResolvePersonByCode(db, "GTK-197001011990031001")
	if err != nil || p.Kind != "staff" || p.EmployeeID != "emp-1" || p.UserID != "user-1" || p.Category != "guru" {
		t.Fatalf("staff resolve: %#v err=%v", p, err)
	}
	// GTK via NIP (tanpa prefix).
	p, err = ResolvePersonByCode(db, "197001011990031001")
	if err != nil || p.Kind != "staff" || p.EmployeeID != "emp-1" {
		t.Fatalf("staff via nip: %#v err=%v", p, err)
	}
	// Tidak dikenal.
	if _, err := ResolvePersonByCode(db, "TIDAK-ADA"); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("expected ErrNoRows, got %v", err)
	}
}

func TestGetMemberByCodeStaffAutoCreatesAndReuses(t *testing.T) {
	db := setupIdentityTestDB(t)
	defer db.Close()
	repo := NewLibraryRepository(db)

	_, err := db.Exec(`
		INSERT INTO employee_details (id, name, nip, qr_code, category)
		VALUES ('emp-9', 'Siti Aminah', '198002022005012002', 'GTK-198002022005012002', 'staff');
	`)
	if err != nil {
		t.Fatal(err)
	}

	// Scan pertama → auto-create anggota.
	m, err := repo.GetMemberByCode("GTK-198002022005012002")
	if err != nil {
		t.Fatalf("first scan: %v", err)
	}
	if m.EmployeeID == nil || *m.EmployeeID != "emp-9" {
		t.Fatalf("expected member linked to emp-9, got %#v", m)
	}
	if m.Name != "Siti Aminah" {
		t.Fatalf("expected display name from employee, got %q", m.Name)
	}
	if m.QrCode != "GTK-198002022005012002" {
		t.Fatalf("expected qr from employee, got %q", m.QrCode)
	}

	// Scan kedua → reuse anggota yang sama (tidak dobel).
	m2, err := repo.GetMemberByCode("198002022005012002") // via NIP
	if err != nil {
		t.Fatalf("second scan: %v", err)
	}
	if m2.ID != m.ID {
		t.Fatalf("expected same member reused, got %v vs %v", m2.ID, m.ID)
	}
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM library_members WHERE employee_id='emp-9'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected exactly 1 member row, got %d", count)
	}
}
