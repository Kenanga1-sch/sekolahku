package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

// setupStudentImportTestDB menyiapkan skema yang cukup untuk jalur import
// massal: students + student_classes + tabel pendukung AutoSync
// (student_class_history, tabungan_siswa, library_members, alumni,
// library_loans, savings tables) agar BulkUpsertStudents berjalan utuh.
func setupStudentImportTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}
	// In-memory DB bersifat per-koneksi; batasi 1 koneksi agar transaksi
	// per-baris BulkUpsertStudents melihat skema yang sama.
	db.SetMaxOpenConns(1)

	_, err = db.Exec(`
		CREATE TABLE student_classes (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			grade INTEGER,
			academic_year TEXT,
			teacher_name TEXT,
			capacity INTEGER DEFAULT 28,
			is_active INTEGER DEFAULT 1,
			wali_user_id TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE students (
			id TEXT PRIMARY KEY,
			nik TEXT,
			nisn TEXT UNIQUE,
			nis TEXT UNIQUE,
			full_name TEXT NOT NULL,
			gender TEXT,
			birth_place TEXT,
			birth_date TEXT,
			religion TEXT,
			address TEXT,
			parent_name TEXT,
			father_name TEXT,
			father_nik TEXT,
			mother_name TEXT,
			mother_nik TEXT,
			guardian_name TEXT,
			guardian_nik TEXT,
			guardian_job TEXT,
			parent_phone TEXT,
			class_name TEXT,
			class_id TEXT,
			status TEXT DEFAULT 'active',
			photo TEXT,
			qr_code TEXT,
			is_active INTEGER DEFAULT 1,
			meta_data TEXT,
			enrolled_at INTEGER,
			created_at INTEGER,
			updated_at INTEGER,
			kip TEXT
		);
		CREATE TABLE student_class_history (
			id TEXT PRIMARY KEY,
			student_id TEXT,
			class_id TEXT,
			class_name TEXT,
			academic_year TEXT,
			grade INTEGER,
			status TEXT,
			record_date INTEGER
		);
		CREATE TABLE tabungan_siswa (
			id TEXT PRIMARY KEY,
			student_id TEXT,
			saldo_terakhir INTEGER DEFAULT 0,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE library_members (
			id TEXT PRIMARY KEY,
			student_id TEXT,
			max_borrow_limit INTEGER DEFAULT 3,
			is_active INTEGER DEFAULT 1,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE library_loans (
			id TEXT PRIMARY KEY,
			student_id TEXT,
			status TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE alumni (
			id TEXT PRIMARY KEY,
			student_id TEXT,
			nisn TEXT,
			nis TEXT,
			full_name TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
	`)
	if err != nil {
		t.Fatalf("failed to create import schema: %v", err)
	}

	return db
}

func strp(s string) *string { return &s }

// Test 1: import siswa baru -> inserted.
func TestBulkUpsertStudents_InsertNew(t *testing.T) {
	db := setupStudentImportTestDB(t)
	defer db.Close()
	repo := NewStudentRepository(db)

	_, _ = db.Exec(`INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('c1','1A',1,'2025/2026')`)

	res := repo.BulkUpsertStudents([]models.Student{
		{FullName: "Siswa Baru", NISN: strp("111"), NIS: strp("001"), ClassName: strp("1A")},
	})

	if res.Inserted != 1 || res.Updated != 0 || len(res.Errors) != 0 {
		t.Fatalf("expected 1 inserted, got inserted=%d updated=%d errors=%v", res.Inserted, res.Updated, res.Errors)
	}
}

// Test 2: import ulang dengan NIS saja (tanpa NISN/NIK) -> UPDATE, bukan error.
func TestBulkUpsertStudents_UpdateByNISOnly(t *testing.T) {
	db := setupStudentImportTestDB(t)
	defer db.Close()
	repo := NewStudentRepository(db)

	_, _ = db.Exec(`INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('c1','1A',1,'2025/2026')`)

	// Pertama: siswa punya NIS tapi tanpa NISN/NIK.
	repo.BulkUpsertStudents([]models.Student{
		{FullName: "Budi Awal", NIS: strp("777"), ClassName: strp("1A")},
	})

	// Kedua: hanya NIS yang sama, sekarang mengisi field kosong.
	res := repo.BulkUpsertStudents([]models.Student{
		{FullName: "Budi Awal", NIS: strp("777"), BirthPlace: strp("Jakarta"), ClassName: strp("1A")},
	})

	if res.Updated != 1 || res.Inserted != 0 || len(res.Errors) != 0 {
		t.Fatalf("expected 1 updated via NIS, got inserted=%d updated=%d errors=%v", res.Inserted, res.Updated, res.Errors)
	}
	if n := countStudents(t, db); n != 1 {
		t.Fatalf("expected still 1 student (no duplicate), got %d", n)
	}
}

// Test 3: field kosong tidak menghapus data lama.
func TestBulkUpsertStudents_EmptyDoesNotOverwrite(t *testing.T) {
	db := setupStudentImportTestDB(t)
	defer db.Close()
	repo := NewStudentRepository(db)

	repo.BulkUpsertStudents([]models.Student{
		{FullName: "Ani", NISN: strp("222"), BirthPlace: strp("Bandung"), Address: strp("Jl. Lama")},
	})
	// Import ulang tanpa birthPlace & address -> harus dipertahankan.
	repo.BulkUpsertStudents([]models.Student{
		{FullName: "Ani", NISN: strp("222")},
	})

	s, _ := repo.GetStudentByID(onlyStudentID(t, db))
	if s.BirthPlace == nil || *s.BirthPlace != "Bandung" {
		t.Fatalf("birthPlace should be preserved, got %#v", s.BirthPlace)
	}
	if s.Address == nil || *s.Address != "Jl. Lama" {
		t.Fatalf("address should be preserved, got %#v", s.Address)
	}
}

// Test 4: siswa non-aktif, import ulang tanpa status -> tetap non-aktif.
func TestBulkUpsertStudents_StatusNotReactivated(t *testing.T) {
	db := setupStudentImportTestDB(t)
	defer db.Close()
	repo := NewStudentRepository(db)

	id, _ := repo.CreateStudent(models.Student{FullName: "Cokro", NISN: strp("333"), Status: "inactive"})
	// Import ulang tanpa menyetel status.
	repo.BulkUpsertStudents([]models.Student{
		{FullName: "Cokro", NISN: strp("333")},
	})

	s, _ := repo.GetStudentByID(id)
	if s.IsActive || s.Status == "active" {
		t.Fatalf("inactive student must stay inactive, got status=%s active=%v", s.Status, s.IsActive)
	}
}

// Test 5: kelas tidak dikenal -> baris ditolak; kelas dikenal -> masuk.
func TestBulkUpsertStudents_UnknownClassRejected(t *testing.T) {
	db := setupStudentImportTestDB(t)
	defer db.Close()
	repo := NewStudentRepository(db)

	_, _ = db.Exec(`INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('c1','1A',1,'2025/2026')`)

	res := repo.BulkUpsertStudents([]models.Student{
		{FullName: "Valid", NISN: strp("444"), ClassName: strp("1A")},
		{FullName: "Invalid", NISN: strp("555"), ClassName: strp("KELAS_PALSU")},
	})

	if res.Inserted != 1 || len(res.Errors) != 1 {
		t.Fatalf("expected 1 inserted + 1 error, got inserted=%d errors=%v", res.Inserted, res.Errors)
	}
	if n := countStudents(t, db); n != 1 {
		t.Fatalf("expected only valid student persisted, got %d", n)
	}
}

// Test 6: partial mode — 1 baris gagal, baris lain tetap sukses & tidak setengah jadi.
func TestBulkUpsertStudents_PartialKeepsSuccesses(t *testing.T) {
	db := setupStudentImportTestDB(t)
	defer db.Close()
	repo := NewStudentRepository(db)

	_, _ = db.Exec(`INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('c1','1A',1,'2025/2026')`)

	res := repo.BulkUpsertStudents([]models.Student{
		{FullName: "Satu", NISN: strp("601"), ClassName: strp("1A")},
		{FullName: "Dua", NISN: strp("602"), ClassName: strp("KELAS_PALSU")}, // kelas tak ada -> gagal
		{FullName: "Tiga", NISN: strp("603"), ClassName: strp("1A")},
	})

	if res.Inserted != 2 || len(res.Errors) != 1 {
		t.Fatalf("expected 2 inserted + 1 error, got inserted=%d errors=%v", res.Inserted, res.Errors)
	}
	if n := countStudents(t, db); n != 2 {
		t.Fatalf("expected 2 persisted students, got %d", n)
	}
}

// Test 7: identitas bertentangan (NISN vs NIS menunjuk siswa berbeda) -> ditolak.
func TestBulkUpsertStudents_ConflictingIdentity(t *testing.T) {
	db := setupStudentImportTestDB(t)
	defer db.Close()
	repo := NewStudentRepository(db)

	repo.CreateStudent(models.Student{FullName: "A", NISN: strp("701")})
	repo.CreateStudent(models.Student{FullName: "B", NIS: strp("702")})

	res := repo.BulkUpsertStudents([]models.Student{
		{FullName: "Tabrakan", NISN: strp("701"), NIS: strp("702")},
	})

	if len(res.Errors) != 1 {
		t.Fatalf("expected conflicting identity error, got %v", res.Errors)
	}
	if res.Inserted != 0 || res.Updated != 0 {
		t.Fatalf("conflicting row must not be written, got inserted=%d updated=%d", res.Inserted, res.Updated)
	}
}

func countStudents(t *testing.T, db *sql.DB) int {
	t.Helper()
	var n int
	if err := db.QueryRow("SELECT COUNT(*) FROM students").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func onlyStudentID(t *testing.T, db *sql.DB) string {
	t.Helper()
	var id string
	if err := db.QueryRow("SELECT id FROM students LIMIT 1").Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

// Test 8: update siswa existing dengan kelas tak dikenal -> HARUS ditolak.
func TestBulkUpsertStudents_UnknownClassRejectedOnUpdate(t *testing.T) {
	db := setupStudentImportTestDB(t)
	defer db.Close()
	repo := NewStudentRepository(db)

	_, _ = db.Exec(`INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('c1','1A',1,'2025/2026')`)

	// Siswa existing dengan className saja, classId nil (data legacy).
	repo.BulkUpsertStudents([]models.Student{
		{FullName: "Legacy", NIS: strp("888"), ClassName: strp("1A")},
	})

	// Update dengan kelas tak dikenal -> harus error, kelas lama tetap.
	res := repo.BulkUpsertStudents([]models.Student{
		{FullName: "Legacy", NIS: strp("888"), ClassName: strp("KELAS_PALSU")},
	})

	if len(res.Errors) != 1 {
		t.Fatalf("expected 1 error on unknown class update, got %v", res.Errors)
	}
	id := onlyStudentID(t, db)
	s, _ := repo.GetStudentByID(id)
	if s.ClassName == nil || *s.ClassName != "1A" {
		t.Fatalf("class must stay unchanged, got %#v", s.ClassName)
	}
}
