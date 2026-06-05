package repository

import (
	"database/sql"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func newAlumniMutasiTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}

	schema := []string{
		`CREATE TABLE students (
			id TEXT PRIMARY KEY,
			nisn TEXT,
			nis TEXT,
			full_name TEXT NOT NULL,
			gender TEXT,
			birth_place TEXT,
			birth_date TEXT,
			address TEXT,
			parent_name TEXT,
			parent_phone TEXT,
			class_name TEXT,
			class_id TEXT,
			photo TEXT,
			status TEXT DEFAULT 'active',
			is_active INTEGER DEFAULT 1,
			updated_at INTEGER,
			kip TEXT
		)`,
		`CREATE TABLE alumni (
			id TEXT PRIMARY KEY,
			student_id TEXT,
			nisn TEXT,
			nis TEXT,
			full_name TEXT NOT NULL,
			gender TEXT,
			birth_place TEXT,
			birth_date TEXT,
			graduation_year TEXT NOT NULL,
			graduation_date INTEGER,
			final_class TEXT,
			photo TEXT,
			parent_name TEXT,
			parent_phone TEXT,
			current_address TEXT,
			current_phone TEXT,
			current_email TEXT,
			next_school TEXT,
			notes TEXT,
			created_at INTEGER,
			updated_at INTEGER
		)`,
		`CREATE TABLE alumni_document_types (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			code TEXT NOT NULL,
			description TEXT,
			is_required INTEGER DEFAULT 0,
			max_file_size_mb INTEGER DEFAULT 5,
			allowed_types TEXT DEFAULT '["application/pdf","image/jpeg","image/png"]',
			sort_order INTEGER DEFAULT 0,
			is_active INTEGER DEFAULT 1,
			created_at INTEGER,
			updated_at INTEGER
		)`,
		`CREATE TABLE alumni_documents (
			id TEXT PRIMARY KEY,
			alumni_id TEXT NOT NULL,
			document_type_id TEXT NOT NULL,
			file_name TEXT NOT NULL,
			file_path TEXT NOT NULL,
			file_size INTEGER,
			mime_type TEXT,
			document_number TEXT,
			issue_date TEXT,
			verification_status TEXT DEFAULT 'pending',
			verified_by TEXT,
			verified_at INTEGER,
			verification_notes TEXT,
			notes TEXT,
			uploaded_by TEXT,
			created_at INTEGER,
			updated_at INTEGER
		)`,
		`CREATE TABLE document_pickups (
			id TEXT PRIMARY KEY,
			alumni_id TEXT NOT NULL,
			document_type_id TEXT,
			recipient_name TEXT NOT NULL,
			recipient_relation TEXT,
			recipient_id_number TEXT,
			recipient_phone TEXT,
			pickup_date INTEGER NOT NULL,
			signature_path TEXT,
			photo_proof_path TEXT,
			notes TEXT,
			handed_over_by TEXT,
			created_at INTEGER
		)`,
		`CREATE TABLE student_class_history (
			id TEXT PRIMARY KEY,
			student_id TEXT NOT NULL,
			class_id TEXT,
			class_name TEXT,
			academic_year TEXT,
			status TEXT,
			record_date INTEGER
		)`,
		`CREATE TABLE mutasi_out_requests (
			id TEXT PRIMARY KEY,
			student_id TEXT NOT NULL,
			status TEXT DEFAULT 'draft',
			processed_at INTEGER,
			completed_at INTEGER,
			updated_at INTEGER
		)`,
	}

	for _, stmt := range schema {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatal(err)
		}
	}
	return db
}

func TestAlumniRepositoryGraduateStudentsCreatesArchivesAndDeactivates(t *testing.T) {
	db := newAlumniMutasiTestDB(t)
	defer db.Close()

	_, err := db.Exec(`
		INSERT INTO students (
			id, nisn, nis, full_name, gender, birth_place, birth_date,
			address, parent_name, parent_phone, class_name, class_id, status, is_active
		) VALUES (
			's1', '1234567890', '001', 'Budi Santoso', 'L', 'Kendal', '2014-02-01',
			'Jl. Melati', 'Pak Budi', '081234', '6A', 'class-6a', 'active', 1
		)
	`)
	if err != nil {
		t.Fatal(err)
	}

	repo := NewAlumniRepository(db)
	graduationDate := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	alumni, created, deactivated, err := repo.GraduateStudents([]string{"s1"}, "2025/2026", &graduationDate, true)
	if err != nil {
		t.Fatal(err)
	}
	if created != 1 || deactivated != 1 || len(alumni) != 1 {
		t.Fatalf("expected one created/deactivated alumni, got created=%d deactivated=%d len=%d", created, deactivated, len(alumni))
	}
	if alumni[0].FullName != "Budi Santoso" || alumni[0].FinalClass == nil || *alumni[0].FinalClass != "6A" {
		t.Fatalf("unexpected alumni payload: %+v", alumni[0])
	}

	var status string
	var active int
	if err := db.QueryRow(`SELECT status, is_active FROM students WHERE id = 's1'`).Scan(&status, &active); err != nil {
		t.Fatal(err)
	}
	if status != "graduated" || active != 0 {
		t.Fatalf("expected graduated inactive student, got status=%s active=%d", status, active)
	}

	_, created, deactivated, err = repo.GraduateStudents([]string{"s1"}, "2025/2026", &graduationDate, true)
	if err != nil {
		t.Fatal(err)
	}
	if created != 0 || deactivated != 0 {
		t.Fatalf("expected idempotent graduation, got created=%d deactivated=%d", created, deactivated)
	}
}

func TestMutasiRepositoryCompletedOutRequestDeactivatesStudent(t *testing.T) {
	db := newAlumniMutasiTestDB(t)
	defer db.Close()

	_, err := db.Exec(`
		INSERT INTO students (id, full_name, class_name, class_id, status, is_active)
		VALUES ('s2', 'Siti Aminah', '5B', 'class-5b', 'active', 1)
	`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`
		INSERT INTO mutasi_out_requests (id, student_id, status)
		VALUES ('m1', 's2', 'processed')
	`)
	if err != nil {
		t.Fatal(err)
	}

	repo := NewMutasiRepository(db)
	if err := repo.UpdateMutasiOutStatus("m1", "completed"); err != nil {
		t.Fatal(err)
	}

	var requestStatus string
	var completedAt sql.NullInt64
	if err := db.QueryRow(`SELECT status, completed_at FROM mutasi_out_requests WHERE id = 'm1'`).Scan(&requestStatus, &completedAt); err != nil {
		t.Fatal(err)
	}
	if requestStatus != "completed" || !completedAt.Valid {
		t.Fatalf("expected completed request with timestamp, got status=%s completed=%v", requestStatus, completedAt.Valid)
	}

	var studentStatus string
	var active int
	var className sql.NullString
	if err := db.QueryRow(`SELECT status, is_active, class_name FROM students WHERE id = 's2'`).Scan(&studentStatus, &active, &className); err != nil {
		t.Fatal(err)
	}
	if studentStatus != "transferred" || active != 0 || className.Valid {
		t.Fatalf("expected transferred inactive student without class, got status=%s active=%d class=%v", studentStatus, active, className)
	}
}
