package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupSkriningTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	schema := `
		CREATE TABLE screening_games (
			id TEXT PRIMARY KEY, code TEXT UNIQUE, name TEXT NOT NULL, domain TEXT NOT NULL,
			description TEXT, icon TEXT, version TEXT DEFAULT '1.0', order_number INTEGER DEFAULT 0,
			is_active INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER
		);
		CREATE TABLE screening_sessions (
			id TEXT PRIMARY KEY, game_id TEXT NOT NULL, class_id TEXT NOT NULL, class_name TEXT,
			teacher_user_id TEXT NOT NULL, academic_year TEXT, title TEXT,
			status TEXT DEFAULT 'pending', started_at INTEGER, finished_at INTEGER, notes TEXT,
			created_at INTEGER, updated_at INTEGER, deleted_at INTEGER
		);
		CREATE TABLE screening_session_students (
			id TEXT PRIMARY KEY, session_id TEXT NOT NULL, student_id TEXT NOT NULL,
			UNIQUE(session_id, student_id)
		);
		CREATE TABLE screening_attempts (
			id TEXT PRIMARY KEY, session_id TEXT NOT NULL, student_id TEXT NOT NULL,
			game_id TEXT NOT NULL, game_version TEXT, attempt_number INTEGER DEFAULT 1,
			status TEXT DEFAULT 'in_progress', started_at INTEGER, completed_at INTEGER,
			duration_ms INTEGER, device_type TEXT, browser TEXT, screen_width INTEGER,
			screen_height INTEGER, input_type TEXT, created_at INTEGER, updated_at INTEGER
		);
		CREATE UNIQUE INDEX idx_screening_attempts_unique ON screening_attempts(session_id, student_id, attempt_number);
		CREATE TABLE screening_trials (
			id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL, trial_number INTEGER NOT NULL,
			level INTEGER, stimulus TEXT, response TEXT, is_correct INTEGER,
			reaction_time_ms INTEGER, responded_at INTEGER,
			UNIQUE(attempt_id, trial_number)
		);
		CREATE TABLE screening_results (
			id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE, session_id TEXT NOT NULL,
			student_id TEXT NOT NULL, game_id TEXT NOT NULL, domain TEXT NOT NULL,
			metrics TEXT NOT NULL, level_reached INTEGER, accuracy REAL, computed_at INTEGER
		);
		CREATE TABLE teacher_observations (
			id TEXT PRIMARY KEY, session_id TEXT NOT NULL, student_id TEXT NOT NULL,
			checklist TEXT, notes TEXT, created_by TEXT NOT NULL, created_at INTEGER, updated_at INTEGER,
			UNIQUE(session_id, student_id)
		);
		CREATE TABLE students (
			id TEXT PRIMARY KEY, full_name TEXT NOT NULL, class_id TEXT,
			status TEXT DEFAULT 'active', is_active INTEGER DEFAULT 1
		);
		CREATE TABLE student_classes (
			id TEXT PRIMARY KEY, name TEXT, academic_year TEXT, is_active INTEGER DEFAULT 1,
			wali_user_id TEXT
		);
	`
	_, err = db.Exec(schema)
	if err != nil {
		t.Fatalf("failed to create schema: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO screening_games (id, code, name, domain, version, order_number, is_active, created_at, updated_at)
		VALUES ('game-tangkap-target', 'tangkap-target', 'Tangkap Target', 'perhatian', '1.0', 1, 1, 0, 0);
		INSERT INTO student_classes (id, name, academic_year, is_active, wali_user_id) VALUES ('c1', 'Kelas 4', '2026/2027', 1, 'g1');
		INSERT INTO students (id, full_name, class_id, status, is_active) VALUES ('s1', 'Siti A', 'c1', 'active', 1);
		INSERT INTO students (id, full_name, class_id, status, is_active) VALUES ('s2', 'Budi B', 'c1', 'active', 1);
	`)
	if err != nil {
		t.Fatalf("failed to seed: %v", err)
	}

	return db
}

// buildSubmitRequest membuat SubmitAttemptRequest dengan n trial. levels[i]
// menentukan level tiap trial (default 1). fn memutuskan benar/salah,
// respons, dan reaction time tiap trial.
func buildSubmitRequest(n int, levels []int, fn func(i int) (correct bool, response string, rt int64)) models.SubmitAttemptRequest {
	trials := make([]models.TrialInput, 0, n)
	for i := 0; i < n; i++ {
		correct, response, rt := fn(i)
		level := 1
		if i < len(levels) && levels[i] > 0 {
			level = levels[i]
		}
		c := correct
		trials = append(trials, models.TrialInput{
			TrialNumber:    i + 1,
			Level:          level,
			Stimulus:       "{}",
			Response:       response,
			IsCorrect:      &c,
			ReactionTimeMs: rt,
		})
	}
	return models.SubmitAttemptRequest{Trials: trials}
}

func TestSkriningFullFlow(t *testing.T) {
	db := setupSkriningTestDB(t)
	defer db.Close()
	repo := NewSkriningRepository(db)

	// 1. Guru membuat sesi → roster snapshot berisi 2 siswa.
	sess, err := repo.CreateSession("game-tangkap-target", "c1", "Kelas 4", "g1", "2026/2027", "Sesi A", "")
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	if sess.Status != "pending" || sess.TotalStudents != 2 {
		t.Fatalf("unexpected session: %+v", sess)
	}
	roster, err := repo.GetSessionRoster(sess.ID)
	if err != nil || len(roster) != 2 {
		t.Fatalf("roster: %v len=%d", err, len(roster))
	}

	// 2. Mulai sesi, siswa mulai attempt.
	if err := repo.UpdateSessionStatus(sess.ID, "active"); err != nil {
		t.Fatalf("start session: %v", err)
	}
	attempt, err := repo.StartAttempt(sess.ID, "s1")
	if err != nil {
		t.Fatalf("StartAttempt: %v", err)
	}
	if attempt.Status != "in_progress" || attempt.AttemptNumber != 1 {
		t.Fatalf("unexpected attempt: %+v", attempt)
	}

	// 3. Submit trial mentah: 10 trial, 7 benar, 2 salah, 1 lewat (response kosong).
	req := buildSubmitRequest(10, nil, func(i int) (bool, string, int64) {
		switch {
		case i < 7:
			return true, "target", 800
		case i < 9:
			return false, "distractor", 900
		default:
			return false, "", 0 // missed (timeout)
		}
	})
	if err := repo.SubmitAttempt(attempt.ID, req); err != nil {
		t.Fatalf("SubmitAttempt: %v", err)
	}

	// 4. Hasil terhitung benar.
	result, err := repo.GetAttemptResult(attempt.ID)
	if err != nil {
		t.Fatalf("GetAttemptResult: %v", err)
	}
	if result.Metrics.TotalTrials != 10 || result.Metrics.Correct != 7 || result.Metrics.Incorrect != 2 || result.Metrics.Missed != 1 {
		t.Fatalf("unexpected metrics: %+v", result.Metrics)
	}
	if result.Metrics.Accuracy != 70 {
		t.Fatalf("expected accuracy 70, got %v", result.Metrics.Accuracy)
	}
	if result.Domain != "perhatian" {
		t.Fatalf("expected domain perhatian, got %s", result.Domain)
	}

	// 5. Attempt kedua untuk siswa yang sama menaikkan attempt_number.
	attempt2, err := repo.StartAttempt(sess.ID, "s1")
	if err != nil {
		t.Fatalf("StartAttempt 2: %v", err)
	}
	if attempt2.AttemptNumber != 2 {
		t.Fatalf("expected attempt 2, got %d", attempt2.AttemptNumber)
	}

	// 6. Observasi guru tersimpan & terbaca kembali (upsert).
	if err := repo.SaveObservation(sess.ID, "s1", "g1", []string{"mudah terdistraksi"}, "catatan"); err != nil {
		t.Fatalf("SaveObservation: %v", err)
	}
	obs, err := repo.GetObservation(sess.ID, "s1")
	if err != nil || obs.Notes != "catatan" {
		t.Fatalf("observation: %v", err)
	}
	if err := repo.SaveObservation(sess.ID, "s1", "g1", []string{"mampu mempertahankan perhatian"}, "catatan 2"); err != nil {
		t.Fatalf("SaveObservation upsert: %v", err)
	}
	obs, _ = repo.GetObservation(sess.ID, "s1")
	if obs.Notes != "catatan 2" {
		t.Fatalf("upsert failed: %s", obs.Notes)
	}
}

func TestSkriningWaliScope(t *testing.T) {
	db := setupSkriningTestDB(t)
	defer db.Close()
	repo := NewSkriningRepository(db)

	_, err := repo.CreateSession("game-tangkap-target", "c1", "Kelas 4", "g1", "2026/2027", "", "")
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	_, err = repo.CreateSession("game-tangkap-target", "c1", "Kelas 4", "g2", "2026/2027", "", "")
	if err != nil {
		t.Fatalf("CreateSession 2: %v", err)
	}

	// g1 hanya melihat miliknya.
	mine, total, err := repo.ListSessions("g1", "", "", false, 1, 20)
	if err != nil || total != 1 || len(mine) != 1 || mine[0].TeacherUserID != "g1" {
		t.Fatalf("wali scope failed: total=%d len=%d err=%v", total, len(mine), err)
	}
	// staff/admin melihat semua.
	all, total, err := repo.ListSessions("", "", "", true, 1, 20)
	if err != nil || total != 2 || len(all) != 2 {
		t.Fatalf("scope all failed: total=%d err=%v", total, err)
	}
	// GetWaliClassID: g1 wali, g2 bukan (sql.ErrNoRows).
	cid, _, err := repo.GetWaliClassID("g1")
	if err != nil || cid != "c1" {
		t.Fatalf("wali class: %v %s", err, cid)
	}
	cid, _, err = repo.GetWaliClassID("g2")
	if err != sql.ErrNoRows || cid != "" {
		t.Fatalf("expected ErrNoRows for g2, got %q err=%v", cid, err)
	}
}

func TestSkriningErrorBreakpoint(t *testing.T) {
	db := setupSkriningTestDB(t)
	defer db.Close()
	repo := NewSkriningRepository(db)

	sess, _ := repo.CreateSession("game-tangkap-target", "c1", "Kelas 4", "g1", "2026/2027", "", "")
	_ = repo.UpdateSessionStatus(sess.ID, "active")
	attempt, _ := repo.StartAttempt(sess.ID, "s1")

	// Level 1-2 semua benar, level 3 mayoritas salah → breakpoint level 3.
	req := buildSubmitRequest(6, []int{1, 1, 2, 2, 3, 3}, func(i int) (bool, string, int64) {
		if i < 4 {
			return true, "target", 800
		}
		return false, "wrong", 900
	})
	if err := repo.SubmitAttempt(attempt.ID, req); err != nil {
		t.Fatalf("SubmitAttempt: %v", err)
	}
	result, _ := repo.GetAttemptResult(attempt.ID)
	if result.Metrics.ErrorBreakpoint == nil || *result.Metrics.ErrorBreakpoint != 3 {
		t.Fatalf("expected breakpoint 3, got %v", result.Metrics.ErrorBreakpoint)
	}
	if result.Metrics.LevelReached != 3 {
		t.Fatalf("expected level 3, got %d", result.Metrics.LevelReached)
	}
}

func TestSkriningErrorBreakpointNotReached(t *testing.T) {
	db := setupSkriningTestDB(t)
	defer db.Close()
	repo := NewSkriningRepository(db)

	sess, _ := repo.CreateSession("game-tangkap-target", "c1", "Kelas 4", "g1", "2026/2027", "", "")
	_ = repo.UpdateSessionStatus(sess.ID, "active")
	attempt, _ := repo.StartAttempt(sess.ID, "s1")

	// Semua benar → tidak ada breakpoint.
	req := buildSubmitRequest(4, []int{1, 1, 2, 2}, func(i int) (bool, string, int64) {
		return true, "target", 800
	})
	if err := repo.SubmitAttempt(attempt.ID, req); err != nil {
		t.Fatalf("SubmitAttempt: %v", err)
	}
	result, _ := repo.GetAttemptResult(attempt.ID)
	if result.Metrics.ErrorBreakpoint != nil {
		t.Fatalf("expected no breakpoint, got %d", *result.Metrics.ErrorBreakpoint)
	}
}
