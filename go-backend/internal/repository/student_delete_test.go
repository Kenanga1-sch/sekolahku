package repository

import (
	"database/sql"
	"testing"
	_ "modernc.org/sqlite"
)

func setupStudentDeleteTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)

	_, err = db.Exec(`
		CREATE TABLE students (
			id TEXT PRIMARY KEY, nik TEXT, nisn TEXT, nis TEXT, full_name TEXT,
			gender TEXT, birth_place TEXT, birth_date TEXT, religion TEXT, address TEXT,
			parent_name TEXT, father_name TEXT, father_nik TEXT, mother_name TEXT, mother_nik TEXT,
			guardian_name TEXT, guardian_nik TEXT, guardian_job TEXT, parent_phone TEXT,
			class_name TEXT, class_id TEXT, status TEXT, photo TEXT, qr_code TEXT,
			is_active INTEGER DEFAULT 1, meta_data TEXT, enrolled_at INTEGER, created_at INTEGER, updated_at INTEGER, kip TEXT
		);
		CREATE TABLE library_members (
			id TEXT PRIMARY KEY, student_id TEXT, max_borrow_limit INTEGER DEFAULT 3, is_active INTEGER DEFAULT 1
		);
		CREATE TABLE library_loans (
			id TEXT PRIMARY KEY, member_id TEXT, item_id TEXT, borrow_date INTEGER, due_date INTEGER,
			return_date INTEGER, is_returned INTEGER DEFAULT 0, status TEXT,
			fine_amount INTEGER DEFAULT 0, fine_paid INTEGER DEFAULT 0
		);
		CREATE TABLE tabungan_siswa (
			id TEXT PRIMARY KEY, student_id TEXT, saldo_terakhir INTEGER DEFAULT 0
		);
		CREATE TABLE spmb_registrants (
			id TEXT PRIMARY KEY, registration_number TEXT, student_nik TEXT, previous_school TEXT
		);
		CREATE TABLE alumni (
			id TEXT PRIMARY KEY, student_id TEXT,
			nisn TEXT, nis TEXT, full_name TEXT, gender TEXT, birth_place TEXT, birth_date TEXT,
			graduation_year TEXT, graduation_date TEXT, final_class TEXT, photo TEXT,
			parent_name TEXT, parent_phone TEXT, current_address TEXT, current_phone TEXT,
			current_email TEXT, next_school TEXT, notes TEXT,
			nik TEXT, religion TEXT, address TEXT, enrolled_year TEXT, previous_school TEXT,
			father_name TEXT, father_nik TEXT, father_education TEXT, father_job TEXT,
			mother_name TEXT, mother_nik TEXT, mother_education TEXT, mother_job TEXT,
			guardian_name TEXT, guardian_nik TEXT, guardian_relation TEXT, guardian_job TEXT, guardian_phone TEXT,
			sibling_count INTEGER, child_order INTEGER, height INTEGER, weight INTEGER, blood_type TEXT,
			medical_notes TEXT, special_needs TEXT, current_occupation TEXT, current_institution TEXT,
			last_education_level TEXT, final_grade_avg TEXT,
			status TEXT, created_at INTEGER, updated_at INTEGER
		);
		INSERT INTO students (id, full_name, status, is_active, created_at, updated_at) VALUES
			('s-bebas', 'Siswa Bebas', 'active', 1, 1, 1),
			('s-pinjam', 'Siswa Pinjam Buku', 'active', 1, 1, 1),
			('s-saldo', 'Siswa Ada Saldo', 'active', 1, 1, 1);
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}
	return db
}

func TestDeleteStudentBlockedByLoan(t *testing.T) {
	db := setupStudentDeleteTestDB(t)
	defer db.Close()

	if _, err := db.Exec(`INSERT INTO library_members (id, student_id) VALUES ('m-1', 's-pinjam')`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO library_loans (id, member_id, item_id, is_returned) VALUES ('l-1', 'm-1', 'bk-1', 0)`); err != nil {
		t.Fatal(err)
	}

	err := NewStudentRepository(db).DeleteStudent("s-pinjam")
	if err == nil {
		t.Fatal("harus ditolak: masih meminjam buku")
	}
	// data tetap utuh, bukan dibakar
	var count int
	db.QueryRow("SELECT COUNT(*) FROM students WHERE id = 's-pinjam'").Scan(&count)
	if count != 1 {
		t.Fatal("siswa tidak boleh hilang saat ditolak")
	}
}

func TestDeleteStudentBlockedBySavingsBalance(t *testing.T) {
	db := setupStudentDeleteTestDB(t)
	defer db.Close()

	if _, err := db.Exec(`INSERT INTO tabungan_siswa (id, student_id, saldo_terakhir) VALUES ('ts-1', 's-saldo', 50000)`); err != nil {
		t.Fatal(err)
	}

	err := NewStudentRepository(db).DeleteStudent("s-saldo")
	if err == nil {
		t.Fatal("harus ditolak: saldo tabungan belum diambil")
	}
}

func TestDeleteStudentSoftDeletesAndArchives(t *testing.T) {
	db := setupStudentDeleteTestDB(t)
	defer db.Close()
	repo := NewStudentRepository(db)

	if err := repo.DeleteStudent("s-bebas"); err != nil {
		t.Fatalf("hapus siswa bebas tanggungan harus sukses: %v", err)
	}

	var status string
	var isActive int
	if err := db.QueryRow("SELECT status, is_active FROM students WHERE id = 's-bebas'").Scan(&status, &isActive); err != nil {
		t.Fatalf("row harus masih ada (soft delete): %v", err)
	}
	if status != "deleted" || isActive != 0 {
		t.Fatalf("expected status=deleted & is_active=0, got status=%s active=%d", status, isActive)
	}

	// AutoSync ke buku induk harus membuat arsip alumni
	var archived int
	db.QueryRow("SELECT COUNT(*) FROM alumni WHERE student_id = 's-bebas'").Scan(&archived)
	if archived != 1 {
		t.Fatalf("expected 1 alumni row from autosync, got %d", archived)
	}
}
