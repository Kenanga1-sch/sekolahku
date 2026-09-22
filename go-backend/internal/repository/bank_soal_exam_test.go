package repository

import (
	"database/sql"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

// setupBankSoalExamDB menyiapkan SQLite in-memory dengan skema minimal
// untuk menguji alur ujian (mode, penugasan, attempt, deadline).
func setupBankSoalExamDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE students (
			id TEXT PRIMARY KEY,
			full_name TEXT,
			class_id TEXT
		);
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			name TEXT,
			student_id TEXT
		);
		CREATE TABLE student_classes (
			id TEXT PRIMARY KEY,
			name TEXT
		);
		CREATE TABLE question_banks (
			id TEXT PRIMARY KEY, subject_id TEXT, class_id TEXT, bab_id TEXT,
			kurikulum_id TEXT, semester TEXT, title TEXT NOT NULL, description TEXT,
			created_by TEXT NOT NULL DEFAULT '', created_at INTEGER DEFAULT 0,
			updated_at INTEGER DEFAULT 0, deleted_at INTEGER
		);
		CREATE TABLE questions (
			id TEXT PRIMARY KEY, bank_id TEXT NOT NULL, type TEXT DEFAULT 'pg_single',
			content TEXT NOT NULL, media_url TEXT, media_type TEXT, options TEXT,
			correct_answer TEXT, explanation TEXT, points INTEGER DEFAULT 1,
			order_number INTEGER DEFAULT 0, difficulty TEXT DEFAULT 'medium',
			created_by TEXT NOT NULL DEFAULT '', created_at INTEGER DEFAULT 0,
			updated_at INTEGER DEFAULT 0, deleted_at INTEGER
		);
		CREATE TABLE question_sets (
			id TEXT PRIMARY KEY, name TEXT NOT NULL, bank_id TEXT NOT NULL,
			academic_year TEXT, mode TEXT NOT NULL DEFAULT 'latihan',
			shuffle_questions INTEGER DEFAULT 0, shuffle_options INTEGER DEFAULT 0,
			timer_minutes INTEGER, max_attempts INTEGER, available_from INTEGER,
			available_until INTEGER, result_visible INTEGER DEFAULT 1,
			created_by TEXT NOT NULL DEFAULT '', created_at INTEGER DEFAULT 0,
			updated_at INTEGER DEFAULT 0, deleted_at INTEGER
		);
		CREATE TABLE question_set_items (
			id TEXT PRIMARY KEY, set_id TEXT NOT NULL, question_id TEXT NOT NULL,
			order_number INTEGER DEFAULT 0, points_override INTEGER,
			UNIQUE(set_id, question_id)
		);
		CREATE TABLE student_practices (
			id TEXT PRIMARY KEY, student_id TEXT NOT NULL, set_id TEXT NOT NULL,
			started_at INTEGER, finished_at INTEGER, total_score REAL DEFAULT 0,
			max_score REAL DEFAULT 0, is_completed INTEGER DEFAULT 0,
			attempt_number INTEGER DEFAULT 1, created_at INTEGER DEFAULT 0,
			question_order TEXT, deadline_at INTEGER
		);
		CREATE TABLE student_practice_answers (
			id TEXT PRIMARY KEY, practice_id TEXT NOT NULL, question_id TEXT NOT NULL,
			answer TEXT, is_correct INTEGER, points_earned REAL DEFAULT 0,
			answered_at INTEGER, UNIQUE(practice_id, question_id)
		);
		CREATE TABLE exam_assignments (
			id TEXT PRIMARY KEY, set_id TEXT NOT NULL, class_id TEXT NOT NULL,
			assigned_by TEXT NOT NULL DEFAULT '', created_at INTEGER DEFAULT 0,
			UNIQUE(set_id, class_id)
		);
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}
	return db
}

func TestExamAssignmentReplaceAndList(t *testing.T) {
	db := setupBankSoalExamDB(t)
	repo := NewExamAssignmentRepository(db)

	if _, err := db.Exec(`INSERT INTO student_classes (id, name) VALUES ('c1','7A'),('c2','7B')`); err != nil {
		t.Fatal(err)
	}

	if err := repo.ReplaceForSet("set1", []string{"c1", "c2"}, "user1"); err != nil {
		t.Fatalf("replace: %v", err)
	}
	got, err := repo.ListBySet("set1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("want 2 assignments, got %d", len(got))
	}

	// Replace lagi dengan 1 kelas -> yang lama harus hilang.
	if err := repo.ReplaceForSet("set1", []string{"c2"}, "user1"); err != nil {
		t.Fatalf("replace2: %v", err)
	}
	got, _ = repo.ListBySet("set1")
	if len(got) != 1 || got[0].ClassID != "c2" {
		t.Fatalf("want only c2, got %+v", got)
	}
	if got[0].ClassName == nil || *got[0].ClassName != "7B" {
		t.Errorf("class name not joined: %+v", got[0])
	}
}

func TestListSetsForStudentScoping(t *testing.T) {
	db := setupBankSoalExamDB(t)
	repo := NewBankSoalRepository(db)
	assignRepo := NewExamAssignmentRepository(db)

	if _, err := db.Exec(`
		INSERT INTO students (id, full_name, class_id) VALUES ('s1','Siswa A','c1'),('s2','Siswa B','c2');
		INSERT INTO student_classes (id, name) VALUES ('c1','7A'),('c2','7B');
		INSERT INTO question_banks (id, subject_id, title, created_by) VALUES ('b1','sub1','Bank','u');
		INSERT INTO question_sets (id, name, bank_id, mode, result_visible, created_at) VALUES
			('latihan1','Latihan Bebas','b1','latihan',1,100),
			('ujian1','Ujian 7A','b1','ujian',1,200),
			('ujian2','Ujian 7B','b1','ujian',1,300);
	`); err != nil {
		t.Fatal(err)
	}
	// ujian1 -> kelas c1, ujian2 -> kelas c2
	if err := assignRepo.ReplaceForSet("ujian1", []string{"c1"}, "u"); err != nil {
		t.Fatal(err)
	}
	if err := assignRepo.ReplaceForSet("ujian2", []string{"c2"}, "u"); err != nil {
		t.Fatal(err)
	}

	// s1 (kelas c1) -> latihan1 + ujian1 saja.
	sets, err := repo.ListSetsForStudent("s1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	names := map[string]bool{}
	for _, s := range sets {
		names[s.Name] = true
	}
	if !names["Latihan Bebas"] || !names["Ujian 7A"] {
		t.Errorf("s1 harus lihat latihan + ujian kelasnya: %v", names)
	}
	if names["Ujian 7B"] {
		t.Errorf("s1 TIDAK boleh lihat ujian kelas lain (7B)")
	}
}

func TestCreatePracticeDeadlineAndOrder(t *testing.T) {
	db := setupBankSoalExamDB(t)
	repo := NewBankSoalRepository(db)

	if _, err := db.Exec(`
		INSERT INTO question_sets (id, name, bank_id, mode, created_at) VALUES ('set1','Ujian','b1','ujian',100);
		INSERT INTO questions (id, bank_id, content, type) VALUES ('q1','b1','Soal 1','pg_single'),('q2','b1','Soal 2','pg_single');
		INSERT INTO question_set_items (id, set_id, question_id, order_number) VALUES ('i1','set1','q1',1),('i2','set1','q2',2);
	`); err != nil {
		t.Fatal(err)
	}

	deadline := time.Now().Add(30 * time.Minute).UTC()
	p, err := repo.CreatePractice("stu1", "set1", &deadline, []string{"q2", "q1"})
	if err != nil {
		t.Fatalf("create practice: %v", err)
	}
	if p.AttemptNumber != 1 {
		t.Errorf("attempt number = %d, want 1", p.AttemptNumber)
	}
	if p.DeadlineAt == nil || p.DeadlineAt.Unix() != deadline.Unix() {
		t.Errorf("deadline mismatch: got %v want %v", p.DeadlineAt, deadline)
	}
	if p.QuestionOrder != `["q2","q1"]` {
		t.Errorf("question order = %q", p.QuestionOrder)
	}

	// Attempt kedua -> nomor 2.
	p2, _ := repo.CreatePractice("stu1", "set1", nil, nil)
	if p2.AttemptNumber != 2 {
		t.Errorf("attempt2 = %d, want 2", p2.AttemptNumber)
	}
	n, _ := repo.CountAttempts("stu1", "set1")
	if n != 2 {
		t.Errorf("count attempts = %d, want 2", n)
	}
}

func TestSubmitPracticeRejectsExpired(t *testing.T) {
	db := setupBankSoalExamDB(t)
	repo := NewBankSoalRepository(db)

	if _, err := db.Exec(`
		INSERT INTO question_sets (id, name, bank_id, mode) VALUES ('set1','Ujian','b1','ujian');
		INSERT INTO questions (id, bank_id, content, type, correct_answer, points) VALUES ('q1','b1','Soal','pg_single','A',1);
		INSERT INTO student_practices (id, student_id, set_id, is_completed, created_at, deadline_at)
			VALUES ('pold','stu1','set1',0,100,?) , ('pnew','stu1','set1',0,100,NULL);
	`, nowMs()-120_000); err != nil { // deadline 2 menit lalu
		t.Fatal(err)
	}

	// Lewat deadline (grace 60s) -> harus error.
	err := repo.SubmitPractice("pold", nil)
	if err == nil || err.Error() != "waktu ujian telah berakhir" {
		t.Errorf("want expired error, got %v", err)
	}

	// Tanpa deadline -> sukses.
	if err := repo.SubmitPractice("pnew", nil); err != nil {
		t.Errorf("submit tanpa deadline harus sukses: %v", err)
	}
}

func TestSubmitPracticeRejectsDouble(t *testing.T) {
	db := setupBankSoalExamDB(t)
	repo := NewBankSoalRepository(db)

	if _, err := db.Exec(`
		INSERT INTO question_sets (id, name, bank_id, mode) VALUES ('set1','Ujian','b1','ujian');
		INSERT INTO student_practices (id, student_id, set_id, is_completed, created_at)
			VALUES ('pdone','stu1','set1',1,100);
	`); err != nil {
		t.Fatal(err)
	}

	err := repo.SubmitPractice("pdone", nil)
	if err == nil || err.Error() != "ujian sudah dikumpulkan" {
		t.Errorf("want already-submitted error, got %v", err)
	}
}
