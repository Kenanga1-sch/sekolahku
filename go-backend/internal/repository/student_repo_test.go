package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupStudentTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE student_classes (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			grade INTEGER,
			academic_year TEXT,
			teacher_name TEXT,
			capacity INTEGER DEFAULT 28,
			is_active INTEGER DEFAULT 1,
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
	`)
	if err != nil {
		t.Fatalf("failed to create student schema: %v", err)
	}

	return db
}

func TestStudentRepositoryCreateDefaultsAndClassLookup(t *testing.T) {
	db := setupStudentTestDB(t)
	defer db.Close()
	repo := NewStudentRepository(db)

	_, err := db.Exec(`INSERT INTO student_classes (id, name, grade, academic_year) VALUES (?, ?, ?, ?)`, "class-1", "1A", 1, "2025/2026")
	if err != nil {
		t.Fatal(err)
	}

	classID := "class-1"
	emptyNISN := ""
	id, err := repo.CreateStudent(models.Student{
		FullName: " Siswa Baru ",
		NISN:     &emptyNISN,
		ClassID:  &classID,
	})
	if err != nil {
		t.Fatalf("CreateStudent returned error: %v", err)
	}

	student, err := repo.GetStudentByID(id)
	if err != nil {
		t.Fatalf("GetStudentByID returned error: %v", err)
	}
	if student.Status != "active" || !student.IsActive {
		t.Fatalf("expected active defaults, got status=%s active=%v", student.Status, student.IsActive)
	}
	if student.NISN != nil {
		t.Fatalf("expected empty NISN to be stored as nil, got %#v", student.NISN)
	}
	if student.ClassName == nil || *student.ClassName != "1A" {
		t.Fatalf("expected class name lookup, got %#v", student.ClassName)
	}
}

func TestStudentRepositoryFiltersByClassID(t *testing.T) {
	db := setupStudentTestDB(t)
	defer db.Close()
	repo := NewStudentRepository(db)

	_, err := db.Exec(`
		INSERT INTO student_classes (id, name, grade, academic_year) VALUES ('class-1', '1A', 1, '2025/2026');
		INSERT INTO students (id, full_name, class_id, class_name, status, is_active, qr_code) VALUES
			('student-1', 'Siswa Satu', 'class-1', '1A', 'active', 1, 'qr-1'),
			('student-2', 'Siswa Dua', NULL, '2A', 'active', 1, 'qr-2');
	`)
	if err != nil {
		t.Fatal(err)
	}

	result, err := repo.GetStudents(1, 10, "", "active", "class-1")
	if err != nil {
		t.Fatalf("GetStudents returned error: %v", err)
	}
	if len(result.Data) != 1 || result.Data[0].ID != "student-1" {
		t.Fatalf("expected only class-1 student, got %#v", result.Data)
	}
}

func TestStudentRepositoryGetStudentsByIDsFallbacksAndOrder(t *testing.T) {
	db := setupStudentTestDB(t)
	defer db.Close()
	repo := NewStudentRepository(db)

	_, err := db.Exec(`
		INSERT INTO students (id, full_name, class_name, status, is_active, qr_code) VALUES
			('student-1', 'Siswa Satu', '1A', 'active', 1, NULL),
			('student-2', 'Siswa Dua', '2A', 'active', 1, 'qr-2');
	`)
	if err != nil {
		t.Fatal(err)
	}

	result, err := repo.GetStudentsByIDs([]string{"student-2", "student-1"})
	if err != nil {
		t.Fatalf("GetStudentsByIDs returned error: %v", err)
	}
	if len(result) != 2 || result[0].ID != "student-2" || result[1].ID != "student-1" {
		t.Fatalf("expected selected order to be preserved, got %#v", result)
	}
	if result[1].QRCode != "student-1" {
		t.Fatalf("expected empty QR code to fall back to student ID, got %q", result[1].QRCode)
	}
}
