package repository

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

func setupBankSoalTagsDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	_, err = db.Exec(`
		CREATE TABLE questions (
			id TEXT PRIMARY KEY, bank_id TEXT NOT NULL, type TEXT DEFAULT 'pg_single',
			content TEXT NOT NULL, media_url TEXT, media_type TEXT, options TEXT,
			correct_answer TEXT, explanation TEXT, points INTEGER DEFAULT 1,
			order_number INTEGER DEFAULT 0, difficulty TEXT DEFAULT 'medium',
			bloom_level TEXT, created_by TEXT NOT NULL DEFAULT '', created_at INTEGER DEFAULT 0,
			updated_at INTEGER DEFAULT 0, deleted_at INTEGER
		);
		CREATE TABLE question_tags (
			id TEXT PRIMARY KEY, question_id TEXT NOT NULL, tag TEXT NOT NULL,
			created_at INTEGER DEFAULT 0, UNIQUE(question_id, tag)
		);
	`)
	if err != nil {
		t.Fatalf("schema: %v", err)
	}
	return db
}

func TestQuestionTagsReplaceAndLoad(t *testing.T) {
	db := setupBankSoalTagsDB(t)
	repo := NewBankSoalRepository(db)

	if _, err := db.Exec(`INSERT INTO questions (id, bank_id, content) VALUES ('q1','b1','Soal satu')`); err != nil {
		t.Fatal(err)
	}

	// Simpan tags (dengan duplikat & spasi -> dedup).
	if err := repo.replaceQuestionTags("q1", []string{"hots", " uts ", "hots", ""}); err != nil {
		t.Fatalf("replace: %v", err)
	}
	tags := repo.loadTagsForQuestions([]string{"q1"})["q1"]
	if len(tags) != 2 {
		t.Fatalf("want 2 tags (dedup), got %v", tags)
	}

	// Replace dengan set baru -> yang lama hilang.
	if err := repo.replaceQuestionTags("q1", []string{"remedial"}); err != nil {
		t.Fatalf("replace2: %v", err)
	}
	tags = repo.loadTagsForQuestions([]string{"q1"})["q1"]
	if len(tags) != 1 || tags[0] != "remedial" {
		t.Fatalf("want [remedial], got %v", tags)
	}
}

func TestListQuestionsFilterByTagAndBloom(t *testing.T) {
	db := setupBankSoalTagsDB(t)
	repo := NewBankSoalRepository(db)

	if _, err := db.Exec(`
		INSERT INTO questions (id, bank_id, content, bloom_level) VALUES
			('q1','b1','Mudah','remember'),
			('q2','b1','Sulit','analyze');
	`); err != nil {
		t.Fatal(err)
	}
	if err := repo.replaceQuestionTags("q2", []string{"hots"}); err != nil {
		t.Fatal(err)
	}

	// Filter bloom=analyze -> hanya q2.
	qs, total, err := repo.ListQuestions("b1", "", "", "analyze", "", 1, 50)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if total != 1 || len(qs) != 1 || qs[0].ID != "q2" {
		t.Fatalf("bloom filter salah: total=%d qs=%v", total, qs)
	}

	// Filter tag=hots -> hanya q2.
	qs, _, err = repo.ListQuestions("b1", "", "", "", "hots", 1, 50)
	if err != nil {
		t.Fatalf("list tag: %v", err)
	}
	if len(qs) != 1 || qs[0].ID != "q2" {
		t.Fatalf("tag filter salah: %v", qs)
	}
	if len(qs[0].Tags) != 1 || qs[0].Tags[0] != "hots" {
		t.Errorf("tags tidak ter-load: %v", qs[0].Tags)
	}
}

func setupBankSoalAnalyticsDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	_, err = db.Exec(`
		CREATE TABLE question_sets (id TEXT PRIMARY KEY, name TEXT);
		CREATE TABLE questions (
			id TEXT PRIMARY KEY, type TEXT, content TEXT, difficulty TEXT,
			bloom_level TEXT, deleted_at INTEGER
		);
		CREATE TABLE question_set_items (id TEXT PRIMARY KEY, set_id TEXT, question_id TEXT, order_number INTEGER);
		CREATE TABLE student_practices (
			id TEXT PRIMARY KEY, student_id TEXT, set_id TEXT, total_score REAL,
			max_score REAL, is_completed INTEGER
		);
		CREATE TABLE student_practice_answers (
			id TEXT PRIMARY KEY, practice_id TEXT, question_id TEXT, is_correct INTEGER, points_earned REAL
		);
	`)
	if err != nil {
		t.Fatalf("schema: %v", err)
	}
	return db
}

func TestGetSetAnalytics(t *testing.T) {
	db := setupBankSoalAnalyticsDB(t)
	repo := NewBankSoalRepository(db)

	if _, err := db.Exec(`
		INSERT INTO question_sets (id, name) VALUES ('set1','UTS Matematika');
		INSERT INTO questions (id, type, content, difficulty, bloom_level) VALUES
			('q1','pg_single','Soal mudah','easy','remember'),
			('q2','pg_single','Soal sulit','hard','analyze');
		INSERT INTO question_set_items (id, set_id, question_id, order_number) VALUES
			('i1','set1','q1',1),('i2','set1','q2',2);
		-- 2 siswa, skor 80% dan 40%
		INSERT INTO student_practices (id, student_id, set_id, total_score, max_score, is_completed) VALUES
			('p1','s1','set1',8,10,1),
			('p2','s2','set1',4,10,1);
		-- q1: 3 benar dari 5 (60% ok). q2: 1 benar dari 5 (20% too_hard).
		INSERT INTO student_practice_answers (id, practice_id, question_id, is_correct, points_earned) VALUES
			('a1','p1','q1',1,8),('a2','p2','q1',0,0),
			('a5','p3','q1',1,0),('a6','p4','q1',1,0),('a7','p5','q1',0,0),
			('a3','p1','q2',1,0),('a4','p2','q2',0,0),
			('a8','p3','q2',0,0),('a9','p4','q2',0,0),('a10','p5','q2',0,0);
	`); err != nil {
		t.Fatal(err)
	}

	an, err := repo.GetSetAnalytics("set1")
	if err != nil {
		t.Fatalf("analytics: %v", err)
	}
	if an.SetName != "UTS Matematika" {
		t.Errorf("set name = %q", an.SetName)
	}
	if an.AttemptCount != 2 || an.StudentCount != 2 {
		t.Errorf("attempts=%d students=%d, want 2/2", an.AttemptCount, an.StudentCount)
	}
	if an.AveragePercent < 59 || an.AveragePercent > 61 {
		t.Errorf("average percent = %.1f, want ~60", an.AveragePercent)
	}
	if an.HighestPercent != 80 || an.LowestPercent != 40 {
		t.Errorf("high/low = %.0f/%.0f, want 80/40", an.HighestPercent, an.LowestPercent)
	}
	if an.PassRate != 50 {
		t.Errorf("pass rate = %.0f, want 50", an.PassRate)
	}
	if len(an.Items) != 2 {
		t.Fatalf("items = %d, want 2", len(an.Items))
	}
	// q1: 3 benar dari 5 -> 60%, flag ok.
	if an.Items[0].CorrectRate != 60 || an.Items[0].Flag != "ok" {
		t.Errorf("q1 rate=%.0f flag=%s, want 60/ok", an.Items[0].CorrectRate, an.Items[0].Flag)
	}
	// q2: 1 dari 5 -> 20% -> too_hard.
	if an.Items[1].Flag != "too_hard" {
		t.Errorf("q2 flag = %s, want too_hard", an.Items[1].Flag)
	}
}
