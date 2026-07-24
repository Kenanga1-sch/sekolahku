package repository

import (
	"database/sql"
	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
	"testing"
)

func setupAcademicTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open in-memory db: %v", err)
	}

	// Create tables
	_, err = db.Exec(`
		CREATE TABLE academic_years (
			id TEXT PRIMARY KEY,
			name TEXT,
			semester TEXT,
			is_active INTEGER DEFAULT 0,
			start_date TEXT,
			end_date TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE student_classes (
			id TEXT PRIMARY KEY,
			name TEXT,
			grade INTEGER,
			academic_year TEXT,
			teacher_name TEXT,
			capacity INTEGER,
			is_active INTEGER DEFAULT 1,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE school_settings (
			id TEXT PRIMARY KEY,
			current_academic_year TEXT
		);
		CREATE TABLE students (
			id TEXT PRIMARY KEY,
			full_name TEXT NOT NULL,
			class_id TEXT,
			class_name TEXT,
			status TEXT DEFAULT 'active',
			is_active INTEGER DEFAULT 1,
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
	`)
	if err != nil {
		t.Fatalf("Failed to create tables: %v", err)
	}

	return db
}

func TestAcademicRepository_GetActiveAcademicYear(t *testing.T) {
	db := setupAcademicTestDB(t)
	defer db.Close()
	repo := NewAcademicRepository(db)

	t.Run("From academic_years", func(t *testing.T) {
		_, err := db.Exec(`INSERT INTO academic_years (id, name, is_active) VALUES (?, ?, ?)`, "y1", "2023/2024", 1)
		if err != nil {
			t.Fatal(err)
		}

		year, err := repo.GetActiveAcademicYear()
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if year != "2023/2024" {
			t.Errorf("Expected 2023/2024, got %s", year)
		}
	})

	t.Run("Fallback to school_settings", func(t *testing.T) {
		_, _ = db.Exec(`DELETE FROM academic_years`)
		_, err := db.Exec(`INSERT INTO school_settings (id, current_academic_year) VALUES (?, ?)`, "s1", "2022/2023")
		if err != nil {
			t.Fatal(err)
		}

		year, err := repo.GetActiveAcademicYear()
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if year != "2022/2023" {
			t.Errorf("Expected 2022/2023, got %s", year)
		}
	})
}

func TestAcademicRepository_ClassCRUD(t *testing.T) {
	db := setupAcademicTestDB(t)
	defer db.Close()
	repo := NewAcademicRepository(db)

	c := models.AcademicClass{
		ID:           "c1",
		Name:         "Class 1A",
		Grade:        1,
		AcademicYear: "2023/2024",
		Capacity:     30,
	}

	t.Run("Create", func(t *testing.T) {
		err := repo.CreateClass(c)
		if err != nil {
			t.Errorf("Create failed: %v", err)
		}
	})

	t.Run("GetByID", func(t *testing.T) {
		res, err := repo.GetClassByID("c1")
		if err != nil {
			t.Fatal(err)
		}
		if res == nil || res.Name != "Class 1A" {
			t.Error("Failed to get correct class")
		}
	})

	t.Run("Delete", func(t *testing.T) {
		err := repo.DeleteClass("c1")
		if err != nil {
			t.Fatal(err)
		}
		res, _ := repo.GetClassByID("c1")
		if res != nil {
			t.Error("Class should be deleted")
		}
	})
}

func TestAcademicRepository_PromotionAndGraduation(t *testing.T) {
	db := setupAcademicTestDB(t)
	defer db.Close()
	repo := NewAcademicRepository(db)

	if err := repo.CreateClass(models.AcademicClass{ID: "class-1", Name: "1A", Grade: 1, AcademicYear: "2025/2026", Capacity: 30}); err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateClass(models.AcademicClass{ID: "class-2", Name: "2A", Grade: 2, AcademicYear: "2025/2026", Capacity: 30}); err != nil {
		t.Fatal(err)
	}
	_, err := db.Exec(`INSERT INTO students (id, full_name, class_id, class_name, status, is_active) VALUES (?, ?, ?, ?, ?, ?)`, "student-1", "Siswa Satu", "class-1", "1A", "active", 1)
	if err != nil {
		t.Fatal(err)
	}

	targetID := "class-2"
	count, err := repo.ProcessPromotion(models.PromotionRequest{
		StudentIds:    []string{"student-1"},
		TargetClassId: &targetID,
		ActionType:    "promotion",
	})
	if err != nil {
		t.Fatalf("promotion returned error: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one promoted student, got %d", count)
	}

	var className string
	if err := db.QueryRow(`SELECT class_name FROM students WHERE id = ?`, "student-1").Scan(&className); err != nil {
		t.Fatal(err)
	}
	if className != "2A" {
		t.Fatalf("expected promoted class 2A, got %s", className)
	}

	count, err = repo.ProcessPromotion(models.PromotionRequest{
		StudentIds: []string{"student-1"},
		ActionType: "graduation",
	})
	if err != nil {
		t.Fatalf("graduation returned error: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one graduated student, got %d", count)
	}

	var status string
	var isActive int
	if err := db.QueryRow(`SELECT status, is_active FROM students WHERE id = ?`, "student-1").Scan(&status, &isActive); err != nil {
		t.Fatal(err)
	}
	if status != "graduated" || isActive != 0 {
		t.Fatalf("expected graduated inactive student, got status=%s active=%d", status, isActive)
	}
}

func TestAcademicRepository_GetSuggestedCapacity(t *testing.T) {
	db := setupAcademicTestDB(t)
	defer db.Close()
	repo := NewAcademicRepository(db)

	// Create Kelas 1 (2025/2026) with capacity 28
	if err := repo.CreateClass(models.AcademicClass{
		ID:           "c-1a",
		Name:         "1A",
		Grade:        1,
		AcademicYear: "2025/2026",
		Capacity:     28,
	}); err != nil {
		t.Fatal(err)
	}

	// Test 1: Grade 2 in 2026/2027 should inherit 28 from Grade 1 (2025/2026)
	cap, source, err := repo.GetSuggestedCapacity(2, "2A", "2026/2027")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cap != 28 {
		t.Fatalf("expected capacity 28, got %d", cap)
	}
	if source == "" {
		t.Fatalf("expected non-empty inheritedFrom source")
	}

	// Test 2: Grade 1 in 2026/2027 should return default 28 without inheritance source
	cap1, source1, err := repo.GetSuggestedCapacity(1, "1A", "2026/2027")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cap1 != 28 {
		t.Fatalf("expected default capacity 28, got %d", cap1)
	}
	if source1 != "" {
		t.Fatalf("expected empty source for Grade 1, got %s", source1)
	}
}
