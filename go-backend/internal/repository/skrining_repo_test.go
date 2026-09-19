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
	CREATE TABLE parent_students (
		id TEXT PRIMARY KEY, user_id TEXT NOT NULL, student_id TEXT NOT NULL,
		is_active INTEGER DEFAULT 1, relation TEXT
	);
	CREATE TABLE parent_observations (
		id TEXT PRIMARY KEY, student_id TEXT NOT NULL, parent_user_id TEXT NOT NULL,
		academic_year TEXT, answers TEXT NOT NULL, notes TEXT,
		created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
	);
	CREATE UNIQUE INDEX idx_parent_observations_unique ON parent_observations(student_id, parent_user_id, academic_year);
	CREATE TABLE screening_recommendations (
		id TEXT PRIMARY KEY, student_id TEXT NOT NULL, session_id TEXT, domain TEXT,
		recommendation TEXT NOT NULL, follow_up_type TEXT NOT NULL DEFAULT 'observasi',
		shared_to_parent INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL,
		created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER
	);
	`
	_, err = db.Exec(schema)
	if err != nil {
		t.Fatalf("failed to create schema: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO screening_games (id, code, name, domain, version, order_number, is_active, created_at, updated_at)
		VALUES ('game-tangkap-target', 'tangkap-target', 'Tangkap Target', 'perhatian', '1.0', 1, 1, 0, 0);
		INSERT INTO screening_games (id, code, name, domain, version, order_number, is_active, created_at, updated_at)
		VALUES ('game-kereta-kata', 'kereta-kata', 'Kereta Kata', 'literasi', '1.0', 4, 1, 0, 0);
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

func TestSkriningParentObservation(t *testing.T) {
	db := setupSkriningTestDB(t)
	defer db.Close()
	repo := NewSkriningRepository(db)

	if _, err := db.Exec(`INSERT INTO parent_students (id, user_id, student_id, is_active, relation) VALUES ('ps1', 'p1', 's1', 1, 'ayah')`); err != nil {
		t.Fatalf("seed parent link: %v", err)
	}

	ok, err := repo.IsParentOf("p1", "s1")
	if err != nil || !ok {
		t.Fatalf("IsParentOf p1/s1: ok=%v err=%v", ok, err)
	}
	if ok, _ := repo.IsParentOf("p1", "s2"); ok {
		t.Fatalf("p1 bukan orang tua s2")
	}
	if ok, _ := repo.IsParentOf("px", "s1"); ok {
		t.Fatalf("px bukan orang tua")
	}

	answers := `{"perhatian":["Mudah teralihkan perhatiannya"]}`
	if err := repo.SaveParentObservation("p1", "s1", "2026/2027", answers, "catatan"); err != nil {
		t.Fatalf("SaveParentObservation: %v", err)
	}
	list, err := repo.ListParentObservations("s1")
	if err != nil || len(list) != 1 || list[0].Notes != "catatan" || list[0].Answers != answers {
		t.Fatalf("list: len=%d notes=%q err=%v", len(list), list[0].Notes, err)
	}

	// Upsert: tahun sama → timpa, tetap 1 baris.
	if err := repo.SaveParentObservation("p1", "s1", "2026/2027", answers, "catatan 2"); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	list, _ = repo.ListParentObservations("s1")
	if len(list) != 1 || list[0].Notes != "catatan 2" {
		t.Fatalf("upsert failed: len=%d notes=%q", len(list), list[0].Notes)
	}

	// Tahun ajaran berbeda → baris baru (riwayat).
	if err := repo.SaveParentObservation("p1", "s1", "2025/2026", answers, "tahun lalu"); err != nil {
		t.Fatalf("save tahun lalu: %v", err)
	}
	list, _ = repo.ListParentObservations("s1")
	if len(list) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(list))
	}
	byYear := map[string]string{}
	for _, o := range list {
		byYear[o.AcademicYear] = o.Notes
	}
	if byYear["2026/2027"] != "catatan 2" || byYear["2025/2026"] != "tahun lalu" {
		t.Fatalf("riwayat tahun salah: %v", byYear)
	}
}

func TestSkriningSharedRecommendations(t *testing.T) {
	db := setupSkriningTestDB(t)
	defer db.Close()
	repo := NewSkriningRepository(db)

	seed := func(shared int, deleted bool, id string) {
		var del interface{} = nil
		if deleted {
			del = 1
		}
		if _, err := db.Exec(`INSERT INTO screening_recommendations (id, student_id, recommendation, follow_up_type, shared_to_parent, created_by, created_at, deleted_at) VALUES (?, 's1', 'Ajakan bermain puzzle', 'observasi', ?, 'g1', 0, ?)`, id, shared, del); err != nil {
			t.Fatalf("seed rec %s: %v", id, err)
		}
	}
	seed(1, false, "r1") // dibagikan
	seed(0, false, "r2") // belum dibagikan
	seed(1, true, "r3")  // dibagikan lalu dihapus (soft delete)

	list, err := repo.ListSharedRecommendations("s1")
	if err != nil || len(list) != 1 || list[0].ID != "r1" {
		t.Fatalf("expected only r1 shared, got len=%d err=%v", len(list), err)
	}
}

func TestSkriningRecommendationFlow(t *testing.T) {
	db := setupSkriningTestDB(t)
	defer db.Close()
	repo := NewSkriningRepository(db)

	// Guru simpan rekomendasi (belum dibagikan).
	shared := false
	rec := &models.ScreeningRecommendation{
		StudentID:      "s1",
		SessionID:      "ses1",
		Domain:         "perhatian",
		Recommendation: "Latihan fokus 10 menit/hari",
		SharedToParent: shared,
		CreatedBy:      "g1",
	}
	if err := repo.SaveRecommendation(rec); err != nil {
		t.Fatalf("SaveRecommendation: %v", err)
	}
	if rec.ID == "" || rec.CreatedAt == 0 {
		t.Fatalf("expected id+timestamps set, got %+v", rec)
	}
	if rec.FollowUpType != "observasi" {
		t.Fatalf("expected default follow_up_type observasi, got %q", rec.FollowUpType)
	}

	// Lihat dari sisi guru (termasuk yang belum dibagikan).
	gList, err := repo.ListSessionRecommendations("ses1", "s1")
	if err != nil || len(gList) != 1 || gList[0].Recommendation != "Latihan fokus 10 menit/hari" {
		t.Fatalf("guru list: len=%d err=%v", len(gList), err)
	}

	// Belum dibagikan → ortu tidak melihat.
	pList, _ := repo.ListSharedRecommendations("s1")
	if len(pList) != 0 {
		t.Fatalf("parent should not see unshared rec, got %d", len(pList))
	}

	// Bagikan → ortu melihat.
	if err := repo.ToggleRecommendationShare(rec.ID, true); err != nil {
		t.Fatalf("ToggleShare: %v", err)
	}
	pList, _ = repo.ListSharedRecommendations("s1")
	if len(pList) != 1 || pList[0].ID != rec.ID {
		t.Fatalf("parent should see shared rec, got %d", len(pList))
	}
}

func TestSkriningStaffAggregate(t *testing.T) {
	db := setupSkriningTestDB(t)
	defer db.Close()
	repo := NewSkriningRepository(db)

	// Buat 2 sesi di kelas c1 dan set hasilnya.
	sess1, _ := repo.CreateSession("game-tangkap-target", "c1", "Kelas 4", "g1", "2026/2027", "A", "")
	sess2, _ := repo.CreateSession("game-kereta-kata", "c1", "Kelas 4", "g1", "2026/2027", "B", "")
	if sess1 == nil || sess2 == nil {
		t.Fatalf("CreateSession returned nil (game not seeded?)")
	}
	_ = repo.UpdateSessionStatus(sess1.ID, "active")
	_ = repo.UpdateSessionStatus(sess2.ID, "active")
	a1, _ := repo.StartAttempt(sess1.ID, "s1")
	_ = repo.SubmitAttempt(a1.ID, buildSubmitRequest(4, []int{1, 1, 2, 2}, func(i int) (bool, string, int64) {
		return true, "x", 800
	}))

	agg, err := repo.GetStaffAggregate("2026/2027")
	if err != nil {
		t.Fatalf("GetStaffAggregate: %v", err)
	}
	if agg.TotalStudents != 2 {
		t.Fatalf("expected 2 sessions, got %d", agg.TotalStudents)
	}
	if agg.ScreenedCount != 1 {
		t.Fatalf("expected 1 screened student, got %d", agg.ScreenedCount)
	}
	if len(agg.DomainStats) != 1 || agg.DomainStats[0].Domain != "perhatian" {
		t.Fatalf("expected 1 domain (perhatian), got %+v", agg.DomainStats)
	}
	if len(agg.RecentSessions) == 0 {
		t.Fatalf("expected recent sessions, got 0")
	}

	// Filter tahun yang tidak ada → kosong.
	agg2, _ := repo.GetStaffAggregate("1999/2000")
	if agg2.TotalStudents != 0 || agg2.ScreenedCount != 0 {
		t.Fatalf("expected empty for old year, got %+v", agg2)
	}
}
