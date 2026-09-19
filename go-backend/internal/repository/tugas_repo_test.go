package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupTugasTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}
	db.SetMaxOpenConns(1)

	schema := `
		CREATE TABLE tugas (
			id TEXT PRIMARY KEY, teacher_user_id TEXT NOT NULL, class_id TEXT NOT NULL,
			class_name TEXT, subject_id TEXT, subject_name TEXT, academic_year TEXT,
			title TEXT NOT NULL, description TEXT, attachment_url TEXT, attachment_name TEXT,
			due_at INTEGER, allow_late INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'published',
			created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER,
			UNIQUE(class_id, title, academic_year)
		);
		CREATE TABLE tugas_submissions (
			id TEXT PRIMARY KEY, tugas_id TEXT NOT NULL, student_id TEXT NOT NULL,
			answer_text TEXT, attachment_url TEXT, attachment_name TEXT,
			submitted_at INTEGER NOT NULL, is_late INTEGER NOT NULL DEFAULT 0,
			score REAL, feedback TEXT, graded_by TEXT, graded_at INTEGER,
			status TEXT NOT NULL DEFAULT 'submitted',
			created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER,
			UNIQUE(tugas_id, student_id)
		);
		CREATE TABLE students (
			id TEXT PRIMARY KEY, full_name TEXT NOT NULL, class_id TEXT,
			status TEXT DEFAULT 'active', is_active INTEGER DEFAULT 1
		);
		CREATE TABLE student_classes (
			id TEXT PRIMARY KEY, name TEXT, academic_year TEXT, is_active INTEGER DEFAULT 1,
			wali_user_id TEXT
		);
		CREATE TABLE users (
			id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, role TEXT DEFAULT 'user',
			is_active INTEGER DEFAULT 1, student_id TEXT
		);
		CREATE TABLE parent_students (
			id TEXT PRIMARY KEY, user_id TEXT NOT NULL, student_id TEXT NOT NULL,
			is_active INTEGER DEFAULT 1, relation TEXT
		);
		CREATE TABLE subjects (
			id TEXT PRIMARY KEY, code TEXT, name TEXT NOT NULL, category TEXT
		);
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("failed to create schema: %v", err)
	}

	if _, err := db.Exec(`
		INSERT INTO student_classes (id, name, academic_year, is_active, wali_user_id) VALUES ('c1', 'Kelas 4', '2026/2027', 1, 'g1');
		INSERT INTO student_classes (id, name, academic_year, is_active, wali_user_id) VALUES ('c2', 'Kelas 5', '2026/2027', 1, 'gX');
		INSERT INTO students (id, full_name, class_id, status, is_active) VALUES ('s1', 'Siti A', 'c1', 'active', 1);
		INSERT INTO students (id, full_name, class_id, status, is_active) VALUES ('s2', 'Budi B', 'c1', 'active', 1);
		INSERT INTO students (id, full_name, class_id, status, is_active) VALUES ('s3', 'Cici C', 'c2', 'active', 1);
		INSERT INTO users (id, name, email, role, is_active, student_id) VALUES ('g1', 'Guru Satu', 'g1@test.com', 'guru', 1, NULL);
		INSERT INTO users (id, name, email, role, is_active, student_id) VALUES ('gX', 'Guru X', 'gx@test.com', 'guru', 1, NULL);
		INSERT INTO users (id, name, email, role, is_active, student_id) VALUES ('u_s1', 'Siti', 'siti@test.com', 'siswa', 1, 's1');
		INSERT INTO users (id, name, email, role, is_active, student_id) VALUES ('u_s2', 'Budi', 'budi@test.com', 'siswa', 1, 's2');
		INSERT INTO users (id, name, email, role, is_active, student_id) VALUES ('p1', 'Ortu Siti', 'ortu@test.com', 'orangtua', 1, NULL);
		INSERT INTO parent_students (id, user_id, student_id, is_active, relation) VALUES ('ps1', 'p1', 's1', 1, 'ibu');
		INSERT INTO subjects (id, code, name, category) VALUES ('sub-mtk', 'MTK', 'Matematika', 'exact');
	`); err != nil {
		t.Fatalf("failed to seed: %v", err)
	}
	return db
}

func TestTugasCreateAndGet(t *testing.T) {
	db := setupTugasTestDB(t)
	defer db.Close()
	r := NewTugasRepository(db)

	due := int64(1800000000000)
	created, err := r.CreateTugas(&models.Tugas{
		TeacherUserID: "g1", ClassID: "c1", ClassName: "Kelas 4",
		SubjectID: "sub-mtk", SubjectName: "Matematika",
		AcademicYear: "2026/2027", Title: "PR Matematika Hal 12",
		Description: "Kerjakan soal 1-10", DueAt: &due, AllowLate: true,
	})
	if err != nil {
		t.Fatalf("CreateTugas: %v", err)
	}
	if created.ID == "" || created.Status != "published" || !created.AllowLate {
		t.Fatalf("unexpected tugas: %+v", created)
	}
	if created.TotalStudents != 2 || created.SubmittedCount != 0 {
		t.Errorf("expected 2 students, 0 submitted; got total=%d submitted=%d", created.TotalStudents, created.SubmittedCount)
	}
	if created.SubjectName != "Matematika" || created.ClassName != "Kelas 4" {
		t.Errorf("denormalized names wrong: subject=%q class=%q", created.SubjectName, created.ClassName)
	}

	got, err := r.GetTugas(created.ID)
	if err != nil {
		t.Fatalf("GetTugas: %v", err)
	}
	if got.Title != "PR Matematika Hal 12" || got.TeacherName != "Guru Satu" {
		t.Errorf("unexpected get: %+v", got)
	}
}

func TestTugasListScope(t *testing.T) {
	db := setupTugasTestDB(t)
	defer db.Close()
	r := NewTugasRepository(db)

	if _, err := r.CreateTugas(&models.Tugas{TeacherUserID: "g1", ClassID: "c1", Title: "PR B"}); err != nil {
		t.Fatalf("create B: %v", err)
	}
	if _, err := r.CreateTugas(&models.Tugas{TeacherUserID: "gX", ClassID: "c2", Title: "PR Kelas Lain"}); err != nil {
		t.Fatalf("create other: %v", err)
	}

	mine, total, err := r.ListTugas("g1", "", "", "", false, 1, 20)
	if err != nil {
		t.Fatalf("ListTugas mine: %v", err)
	}
	if total != 1 || len(mine) != 1 || mine[0].Title != "PR B" {
		t.Fatalf("guru must see only own tugas: total=%d list=%+v", total, mine)
	}

	all, total, err := r.ListTugas("g1", "", "", "", true, 1, 20)
	if err != nil {
		t.Fatalf("ListTugas all: %v", err)
	}
	if total != 2 || len(all) != 2 {
		t.Fatalf("scopeAll must see 2 tugas, got %d", total)
	}

	filtered, total, _ := r.ListTugas("g1", "c2", "", "", true, 1, 20)
	if total != 1 || filtered[0].Title != "PR Kelas Lain" {
		t.Fatalf("classId filter broken: %+v", filtered)
	}

	searched, _, _ := r.ListTugas("g1", "", "", "Kelas Lain", true, 1, 20)
	if len(searched) != 1 {
		t.Fatalf("search filter broken: %d", len(searched))
	}
}

func TestTugasSubmissionFlow(t *testing.T) {
	db := setupTugasTestDB(t)
	defer db.Close()
	r := NewTugasRepository(db)

	tg, err := r.CreateTugas(&models.Tugas{TeacherUserID: "g1", ClassID: "c1", Title: "PR Tulis"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	sub, err := r.UpsertSubmission(tg.ID, "s1", "jawaban pertama", "", "", false)
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}
	if sub.Status != "submitted" || sub.AnswerText != "jawaban pertama" {
		t.Fatalf("unexpected submission: %+v", sub)
	}

	// Update pengumpulan.
	sub2, err := r.UpsertSubmission(tg.ID, "s1", "jawaban revisi", "/uploads/a.pdf", "a.pdf", true)
	if err != nil {
		t.Fatalf("upsert2: %v", err)
	}
	if sub2.ID != sub.ID || sub2.AnswerText != "jawaban revisi" || !sub2.IsLate {
		t.Fatalf("update path broken: %+v", sub2)
	}

	// Nilai.
	if err := r.GradeSubmission(sub.ID, pFloat(85), "Bagus", "g1"); err != nil {
		t.Fatalf("grade: %v", err)
	}
	got, _ := r.GetSubmission(tg.ID, "s1")
	if got.Status != "graded" || got.Score == nil || *got.Score != 85 || got.Feedback != "Bagus" {
		t.Fatalf("grading broken: %+v", got)
	}
	if got.GradedBy != "g1" || got.GradedAt == nil {
		t.Fatalf("graded meta missing: %+v", got)
	}
}

func pFloat(v float64) *float64 { return &v }

func TestTugasRoster(t *testing.T) {
	db := setupTugasTestDB(t)
	defer db.Close()
	r := NewTugasRepository(db)

	tg, _ := r.CreateTugas(&models.Tugas{TeacherUserID: "g1", ClassID: "c1", Title: "PR Roster"})
	_, _ = r.UpsertSubmission(tg.ID, "s1", "jwb", "", "", false)

	roster, err := r.ListTugasRoster(tg.ID)
	if err != nil {
		t.Fatalf("roster: %v", err)
	}
	if len(roster) != 2 {
		t.Fatalf("expected 2 roster rows, got %d", len(roster))
	}
	byStudent := map[string]models.TugasRosterItem{}
	for _, it := range roster {
		byStudent[it.StudentID] = it
	}
	if byStudent["s1"].Status != "submitted" || byStudent["s1"].SubmissionID == "" {
		t.Errorf("s1 should have submission: %+v", byStudent["s1"])
	}
	if byStudent["s2"].Status != "" || byStudent["s2"].SubmissionID != "" {
		t.Errorf("s2 should have no submission: %+v", byStudent["s2"])
	}
}

func TestListMyTugas(t *testing.T) {
	db := setupTugasTestDB(t)
	defer db.Close()
	r := NewTugasRepository(db)

	tg, _ := r.CreateTugas(&models.Tugas{TeacherUserID: "g1", ClassID: "c1", Title: "PR Siswa"})
	noSubmission, _ := r.CreateTugas(&models.Tugas{TeacherUserID: "g1", ClassID: "c1", Title: "PR Belum Dikerjakan"})
	archived, _ := r.CreateTugas(&models.Tugas{TeacherUserID: "g1", ClassID: "c1", Title: "PR Lama"})
	_ = r.SetArchived(archived.ID, true)
	_, _ = r.UpsertSubmission(tg.ID, "s1", "jwb", "", "", false)

	list, total, err := r.ListMyTugas("s1", "c1", 1, 20)
	if err != nil {
		t.Fatalf("ListMyTugas: %v", err)
	}
	if total != 2 || len(list) != 2 {
		t.Fatalf("siswa c1 must see 2 active tugas (archived excluded), got %d", total)
	}
	byTitle := map[string]models.Tugas{}
	for _, t := range list {
		byTitle[t.Title] = t
	}
	if byTitle["PR Siswa"].MyStatus != "submitted" || byTitle["PR Siswa"].MySubmissionID == "" {
		t.Errorf("myStatus wrong: %+v", byTitle["PR Siswa"])
	}
	// Tugas tanpa pengumpulan: kolom my.* harus NULL-safe (bukan error).
	if byTitle["PR Belum Dikerjakan"].MyStatus != "" || byTitle["PR Belum Dikerjakan"].MySubmissionID != "" {
		t.Errorf("tugas tanpa submission must have empty my fields: %+v", byTitle["PR Belum Dikerjakan"])
	}
	if byTitle["PR Siswa"].TeacherName != "Guru Satu" {
		t.Errorf("teacher name missing: %q", byTitle["PR Siswa"].TeacherName)
	}
	_ = noSubmission
}

func TestListChildrenTugas(t *testing.T) {
	db := setupTugasTestDB(t)
	defer db.Close()
	r := NewTugasRepository(db)

	tg, _ := r.CreateTugas(&models.Tugas{TeacherUserID: "g1", ClassID: "c1", Title: "PR Ortu"})
	noSub, _ := r.CreateTugas(&models.Tugas{TeacherUserID: "g1", ClassID: "c1", Title: "PR Ortu Belum Kumpul"})
	_, _ = r.UpsertSubmission(tg.ID, "s1", "jwb", "", "", false)

	list, total, err := r.ListChildrenTugas("p1", "", 1, 20)
	if err != nil {
		t.Fatalf("ListChildrenTugas: %v", err)
	}
	if total != 2 || len(list) != 2 {
		t.Fatalf("parent p1 must see 2 tugas, got %d", total)
	}
	byTitle := map[string]models.Tugas{}
	for _, t := range list {
		byTitle[t.Title] = t
	}
	if byTitle["PR Ortu"].StudentID != "s1" || byTitle["PR Ortu"].StudentName != "Siti A" {
		t.Errorf("student tag missing: %+v", byTitle["PR Ortu"])
	}
	if byTitle["PR Ortu"].MyStatus != "submitted" {
		t.Errorf("child submission status missing: %+v", byTitle["PR Ortu"])
	}
	// Tugas tanpa pengumpulan: NULL-safe.
	if byTitle["PR Ortu Belum Kumpul"].MyStatus != "" {
		t.Errorf("tugas tanpa submission must have empty myStatus: %+v", byTitle["PR Ortu Belum Kumpul"])
	}
	_ = noSub

	// Parent lain (tidak punya anak di c1) tidak melihat apa-apa.
	other, total, _ := r.ListChildrenTugas("pLain", "", 1, 20)
	if total != 0 || len(other) != 0 {
		t.Fatalf("stranger parent must see nothing, got %d", total)
	}
}

func TestTugasNotifyHelpers(t *testing.T) {
	db := setupTugasTestDB(t)
	defer db.Close()
	r := NewTugasRepository(db)

	students, err := r.ListStudentUserIDsByClass("c1")
	if err != nil {
		t.Fatalf("ListStudentUserIDsByClass: %v", err)
	}
	if len(students) != 2 {
		t.Fatalf("expected 2 student users in c1, got %v", students)
	}

	parents, err := r.ListClassParentUsers("c1")
	if err != nil {
		t.Fatalf("ListClassParentUsers: %v", err)
	}
	if len(parents) != 1 || parents[0] != "p1" {
		t.Fatalf("expected 1 parent in c1, got %v", parents)
	}

	tg, _ := r.CreateTugas(&models.Tugas{TeacherUserID: "g1", ClassID: "c1", Title: "PR Remind"})
	_, _ = r.UpsertSubmission(tg.ID, "s1", "jwb", "", "", false)

	targets, err := r.ListRemindTargets(tg.ID, "c1")
	if err != nil {
		t.Fatalf("ListRemindTargets: %v", err)
	}
	if len(targets) != 1 || targets[0] != "u_s2" {
		t.Fatalf("only u_s2 (s2) should be reminded, got %v", targets)
	}
}

func TestTugasSoftDelete(t *testing.T) {
	db := setupTugasTestDB(t)
	defer db.Close()
	r := NewTugasRepository(db)

	tg, _ := r.CreateTugas(&models.Tugas{TeacherUserID: "g1", ClassID: "c1", Title: "PR Hapus"})
	_, _ = r.UpsertSubmission(tg.ID, "s1", "jwb", "", "", false)

	if err := r.SoftDeleteTugas(tg.ID); err != nil {
		t.Fatalf("SoftDeleteTugas: %v", err)
	}
	if _, err := r.GetTugas(tg.ID); err == nil {
		t.Error("tugas should be soft-deleted (GetTugas must fail)")
	}
	list, _, _ := r.ListMyTugas("s1", "c1", 1, 20)
	if len(list) != 0 {
		t.Errorf("deleted tugas must not appear in student list, got %d", len(list))
	}
}
