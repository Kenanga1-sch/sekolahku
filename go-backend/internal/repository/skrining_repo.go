package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// SkriningRepository mengelola modul Ruang Tumbuh (skrining & perkembangan).
type SkriningRepository struct {
	DB *sql.DB
}

func NewSkriningRepository(db *sql.DB) *SkriningRepository {
	return &SkriningRepository{DB: db}
}

func (r *SkriningRepository) genID() string {
	return cuid2.Generate()
}

// ══════════════════════════════════════════════════════════
// GAMES (katalog, seeded)
// ══════════════════════════════════════════════════════════

func (r *SkriningRepository) ListGames() ([]models.ScreeningGame, error) {
	rows, err := r.DB.Query(`
		SELECT id, code, name, domain, description, icon, version, order_number, is_active
		FROM screening_games
		WHERE deleted_at IS NULL
		ORDER BY order_number ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var games []models.ScreeningGame
	for rows.Next() {
		var g models.ScreeningGame
		var isActive int
		var description, icon sql.NullString
		if err := rows.Scan(&g.ID, &g.Code, &g.Name, &g.Domain, &description, &icon, &g.Version, &g.OrderNumber, &isActive); err != nil {
			return nil, err
		}
		g.IsActive = isActive == 1
		g.Description = description.String
		g.Icon = icon.String
		games = append(games, g)
	}
	return games, nil
}

func (r *SkriningRepository) GetGame(gameID string) (*models.ScreeningGame, error) {
	var g models.ScreeningGame
	var isActive int
	var description, icon sql.NullString
	err := r.DB.QueryRow(`
		SELECT id, code, name, domain, description, icon, version, order_number, is_active
		FROM screening_games WHERE id = ? AND deleted_at IS NULL
	`, gameID).Scan(&g.ID, &g.Code, &g.Name, &g.Domain, &description, &icon, &g.Version, &g.OrderNumber, &isActive)
	if err != nil {
		return nil, err
	}
	g.IsActive = isActive == 1
	g.Description = description.String
	g.Icon = icon.String
	return &g, nil
}

// ══════════════════════════════════════════════════════════
// SESSIONS
// ══════════════════════════════════════════════════════════

// CreateSession membuat sesi + snapshot roster kelas saat itu.
func (r *SkriningRepository) CreateSession(gameID, classID, className, teacherUserID, academicYear, title, notes string) (*models.ScreeningSession, error) {
	now := UnixMilli()
	sessID := r.genID()

	tx, err := r.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	_, err = tx.Exec(`
		INSERT INTO screening_sessions
			(id, game_id, class_id, class_name, teacher_user_id, academic_year, title, notes, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
	`, sessID, gameID, classID, className, teacherUserID, academicYear, title, notes, now, now)
	if err != nil {
		return nil, err
	}

	// Snapshot roster siswa aktif kelas ini. Id unik per (session, student).
	_, err = tx.Exec(`
		INSERT INTO screening_session_students (id, session_id, student_id)
		SELECT 'sss_' || ? || '_' || s.id, ?, s.id FROM students s
		WHERE s.class_id = ? AND (s.is_active = 1 OR s.status = 'active')
	`, sessID, sessID, classID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return r.GetSession(sessID)
}

func (r *SkriningRepository) GetSession(id string) (*models.ScreeningSession, error) {
	var s models.ScreeningSession
	var className, title, notes, gameIcon sql.NullString
	var startedAt, finishedAt sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT s.id, s.game_id, s.class_id, s.class_name, s.teacher_user_id, s.academic_year,
		       s.title, s.status, s.started_at, s.finished_at, s.notes, s.created_at, s.updated_at,
		       g.name, g.icon, g.domain,
		       (SELECT COUNT(*) FROM screening_session_students ss WHERE ss.session_id = s.id),
		       (SELECT COUNT(*) FROM screening_attempts a
		        WHERE a.session_id = s.id AND a.status = 'completed')
		FROM screening_sessions s
		JOIN screening_games g ON g.id = s.game_id
		WHERE s.id = ? AND s.deleted_at IS NULL
	`, id).Scan(
		&s.ID, &s.GameID, &s.ClassID, &className, &s.TeacherUserID, &s.AcademicYear,
		&title, &s.Status, &startedAt, &finishedAt, &notes, &s.CreatedAt, &s.UpdatedAt,
		&s.GameName, &gameIcon, &s.Domain, &s.TotalStudents, &s.CompletedCount,
	)
	if err != nil {
		return nil, err
	}
	if className.Valid {
		s.ClassName = className.String
	}
	if gameIcon.Valid {
		s.GameIcon = gameIcon.String
	}
	if title.Valid {
		s.Title = title.String
	}
	if notes.Valid {
		s.Notes = notes.String
	}
	if startedAt.Valid {
		s.StartedAt = startedAt.Int64
	}
	if finishedAt.Valid {
		s.FinishedAt = finishedAt.Int64
	}
	return &s, nil
}

// ListSessions mengambil sesi yang terlihat oleh seorang user. Guru biasa
// hanya melihat sesi miliknya sendiri (= wali kelasnya); staff/admin melihat
// semua (scopeAll = true).
func (r *SkriningRepository) ListSessions(teacherUserID, classID, status string, scopeAll bool, page, limit int) ([]models.ScreeningSession, int, error) {
	where := []string{"s.deleted_at IS NULL"}
	args := []interface{}{}
	if !scopeAll {
		where = append(where, "s.teacher_user_id = ?")
		args = append(args, teacherUserID)
	}
	if classID != "" {
		where = append(where, "s.class_id = ?")
		args = append(args, classID)
	}
	if status != "" {
		where = append(where, "s.status = ?")
		args = append(args, status)
	}
	whereClause := strings.Join(where, " AND ")

	var total int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM screening_sessions s WHERE "+whereClause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT s.id, s.game_id, s.class_id, s.class_name, s.teacher_user_id, s.academic_year,
		       s.title, s.status, s.started_at, s.finished_at, s.notes, s.created_at, s.updated_at,
		       g.name, g.icon, g.domain,
		       (SELECT COUNT(*) FROM screening_session_students ss WHERE ss.session_id = s.id),
		       (SELECT COUNT(*) FROM screening_attempts a
		        WHERE a.session_id = s.id AND a.status = 'completed')
		FROM screening_sessions s
		JOIN screening_games g ON g.id = s.game_id
		WHERE %s
		ORDER BY s.created_at DESC
		LIMIT ? OFFSET ?
	`, whereClause)
	rows, err := r.DB.Query(query, append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var sessions []models.ScreeningSession
	for rows.Next() {
		var s models.ScreeningSession
		var className, title, notes, gameIcon sql.NullString
		var startedAt, finishedAt sql.NullInt64
		if err := rows.Scan(
			&s.ID, &s.GameID, &s.ClassID, &className, &s.TeacherUserID, &s.AcademicYear,
			&title, &s.Status, &startedAt, &finishedAt, &notes, &s.CreatedAt, &s.UpdatedAt,
			&s.GameName, &gameIcon, &s.Domain, &s.TotalStudents, &s.CompletedCount,
		); err != nil {
			return nil, 0, err
		}
		if className.Valid {
			s.ClassName = className.String
		}
		if gameIcon.Valid {
			s.GameIcon = gameIcon.String
		}
		if title.Valid {
			s.Title = title.String
		}
		if notes.Valid {
			s.Notes = notes.String
		}
		if startedAt.Valid {
			s.StartedAt = startedAt.Int64
		}
		if finishedAt.Valid {
			s.FinishedAt = finishedAt.Int64
		}
		sessions = append(sessions, s)
	}
	return sessions, total, nil
}

// UpdateSessionStatus memperbarui status sesi beserta cap waktunya.
func (r *SkriningRepository) UpdateSessionStatus(id, status string) error {
	now := UnixMilli()
	switch status {
	case "active":
		_, err := r.DB.Exec(`UPDATE screening_sessions SET status = 'active', started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?`, now, now, id)
		return err
	case "finished":
		_, err := r.DB.Exec(`UPDATE screening_sessions SET status = 'finished', finished_at = ?, updated_at = ? WHERE id = ?`, now, now, id)
		return err
	case "cancelled":
		_, err := r.DB.Exec(`UPDATE screening_sessions SET status = 'cancelled', updated_at = ? WHERE id = ?`, now, id)
		return err
	default:
		return fmt.Errorf("status tidak dikenal: %s", status)
	}
}

// GetSessionRoster mengambil roster siswa + status attempt terakhirnya.
func (r *SkriningRepository) GetSessionRoster(sessionID string) ([]models.SessionRosterItem, error) {
	rows, err := r.DB.Query(`
		SELECT ss.student_id, s.full_name,
		       lat.id, lat.attempt_number, lat.status,
		       res.accuracy, res.level_reached,
		       (SELECT COUNT(*) FROM teacher_observations o WHERE o.session_id = ss.session_id AND o.student_id = ss.student_id)
		FROM screening_session_students ss
		JOIN students s ON s.id = ss.student_id
		LEFT JOIN screening_attempts lat
		       ON lat.session_id = ss.session_id
		      AND lat.attempt_number = (
		          SELECT MAX(a.attempt_number) FROM screening_attempts a
		          WHERE a.session_id = ss.session_id AND a.student_id = ss.student_id
		      )
		LEFT JOIN screening_results res ON res.attempt_id = lat.id
		WHERE ss.session_id = ?
		ORDER BY s.full_name ASC
	`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.SessionRosterItem
	for rows.Next() {
		var it models.SessionRosterItem
		var attemptID sql.NullString
		var attemptNo sql.NullInt64
		var attemptStatus sql.NullString
		var accuracy sql.NullFloat64
		var levelReached sql.NullInt64
		var obsCount int
		if err := rows.Scan(&it.StudentID, &it.StudentName, &attemptID, &attemptNo, &attemptStatus, &accuracy, &levelReached, &obsCount); err != nil {
			return nil, err
		}
		if attemptID.Valid {
			it.AttemptID = attemptID.String
		}
		if attemptNo.Valid {
			it.AttemptNo = int(attemptNo.Int64)
		}
		if attemptStatus.Valid {
			it.AttemptStatus = attemptStatus.String
		}
		if accuracy.Valid {
			acc := accuracy.Float64
			it.Accuracy = &acc
		}
		if levelReached.Valid {
			lr := int(levelReached.Int64)
			it.LevelReached = &lr
		}
		it.HasObservation = obsCount > 0
		items = append(items, it)
	}
	return items, nil
}

// ══════════════════════════════════════════════════════════
// ATTEMPTS
// ══════════════════════════════════════════════════════════

// StartAttempt membuat attempt baru (atau mengembalikan yang sedang berjalan
// jika ada) untuk pasangan session+student.
func (r *SkriningRepository) StartAttempt(sessionID, studentID string) (*models.ScreeningAttempt, error) {
	sess, err := r.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	game, err := r.GetGame(sess.GameID)
	if err != nil {
		return nil, err
	}

	// Lanjutkan attempt yang belum selesai, jika ada.
	var existing models.ScreeningAttempt
	err = r.DB.QueryRow(`
		SELECT id, attempt_number, status FROM screening_attempts
		WHERE session_id = ? AND student_id = ? AND status = 'in_progress'
	`, sessionID, studentID).Scan(&existing.ID, &existing.AttemptNumber, &existing.Status)
	if err == nil {
		return r.GetAttempt(existing.ID)
	}
	if !errIsNoRows(err) {
		return nil, err
	}

	now := UnixMilli()
	attemptID := r.genID()
	var nextNo int
	if err := r.DB.QueryRow(`
		SELECT COALESCE(MAX(attempt_number), 0) + 1 FROM screening_attempts
		WHERE session_id = ? AND student_id = ?
	`, sessionID, studentID).Scan(&nextNo); err != nil {
		return nil, err
	}

	_, err = r.DB.Exec(`
		INSERT INTO screening_attempts
			(id, session_id, student_id, game_id, game_version, attempt_number, status, started_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?)
	`, attemptID, sessionID, studentID, game.ID, game.Version, nextNo, now, now, now)
	if err != nil {
		return nil, err
	}
	return r.GetAttempt(attemptID)
}

func errIsNoRows(err error) bool {
	return err != nil && err == sql.ErrNoRows
}

func (r *SkriningRepository) GetAttempt(id string) (*models.ScreeningAttempt, error) {
	var a models.ScreeningAttempt
	var studentName, gameName, domain, gameVersion, deviceType, browser, inputType sql.NullString
	var startedAt, completedAt, durationMs, screenWidth, screenHeight sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT a.id, a.session_id, a.student_id, a.game_id, a.game_version, a.attempt_number,
		       a.status, a.started_at, a.completed_at, a.duration_ms,
		       a.device_type, a.browser, a.screen_width, a.screen_height, a.input_type,
		       a.created_at,
		       s.full_name, g.name, g.domain
		FROM screening_attempts a
		JOIN students s ON s.id = a.student_id
		JOIN screening_games g ON g.id = a.game_id
		WHERE a.id = ?
	`, id).Scan(
		&a.ID, &a.SessionID, &a.StudentID, &a.GameID, &gameVersion, &a.AttemptNumber,
		&a.Status, &startedAt, &completedAt, &durationMs,
		&deviceType, &browser, &screenWidth, &screenHeight, &inputType,
		&a.CreatedAt,
		&studentName, &gameName, &domain,
	)
	if err != nil {
		return nil, err
	}
	a.StudentName = studentName.String
	a.GameName = gameName.String
	a.Domain = domain.String
	a.GameVersion = gameVersion.String
	a.DeviceType = deviceType.String
	a.Browser = browser.String
	a.InputType = inputType.String
	if startedAt.Valid {
		a.StartedAt = startedAt.Int64
	}
	if completedAt.Valid {
		a.CompletedAt = completedAt.Int64
	}
	if durationMs.Valid {
		a.DurationMs = durationMs.Int64
	}
	if screenWidth.Valid {
		a.ScreenWidth = int(screenWidth.Int64)
	}
	if screenHeight.Valid {
		a.ScreenHeight = int(screenHeight.Int64)
	}
	return &a, nil
}

// SubmitAttempt menyimpan trial mentah, menghitung metrik, dan menutup attempt
// — semuanya dalam satu transaksi.
func (r *SkriningRepository) SubmitAttempt(attemptID string, req models.SubmitAttemptRequest) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var attemptIDCheck, sessionID, studentID, gameID string
	err = tx.QueryRow(`
		SELECT id, session_id, student_id, game_id FROM screening_attempts WHERE id = ?
	`, attemptID).Scan(&attemptIDCheck, &sessionID, &studentID, &gameID)
	if err != nil {
		return err
	}

	now := UnixMilli()

	// 1. Simpan trial mentah.
	stmt, err := tx.Prepare(`
		INSERT INTO screening_trials
			(id, attempt_id, trial_number, level, stimulus, response, is_correct, reaction_time_ms, responded_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, t := range req.Trials {
		var correctVal interface{}
		if t.IsCorrect != nil {
			if *t.IsCorrect {
				correctVal = 1
			} else {
				correctVal = 0
			}
		}
		if _, err := stmt.Exec(r.genID(), attemptID, t.TrialNumber, t.Level, t.Stimulus, t.Response, correctVal, t.ReactionTimeMs, now); err != nil {
			return err
		}
	}

	// 2. Hitung metrik dari trial mentah.
	var metrics models.ScreeningMetrics
	metrics.TotalTrials = len(req.Trials)
	for _, t := range req.Trials {
		if t.IsCorrect != nil && *t.IsCorrect {
			metrics.Correct++
		} else if strings.TrimSpace(t.Response) == "" {
			metrics.Missed++
		} else {
			metrics.Incorrect++
		}
		if t.Level > metrics.LevelReached {
			metrics.LevelReached = t.Level
		}
	}
	rts := []float64{}
	for _, t := range req.Trials {
		if t.ReactionTimeMs > 0 {
			rts = append(rts, float64(t.ReactionTimeMs))
		}
	}
	if len(rts) > 0 {
		sort.Float64s(rts)
		var sum float64
		for _, v := range rts {
			sum += v
		}
		metrics.RTAvg = sum / float64(len(rts))
		metrics.RTMin = int64(rts[0])
		metrics.RTMax = int64(rts[len(rts)-1])
		if len(rts)%2 == 1 {
			metrics.RTMedian = rts[len(rts)/2]
		} else {
			metrics.RTMedian = (rts[len(rts)/2-1] + rts[len(rts)/2]) / 2
		}
		var sqSum float64
		for _, v := range rts {
			sqSum += (v - metrics.RTAvg) * (v - metrics.RTAvg)
		}
		metrics.RTVariability = sqSum / float64(len(rts))
	}
	if metrics.TotalTrials > 0 {
		metrics.Accuracy = float64(metrics.Correct) / float64(metrics.TotalTrials) * 100
	}
	metrics.ErrorBreakpoint = computeErrorBreakpoint(req.Trials)

	// 3. Upsert hasil.
	_, err = tx.Exec(`
		INSERT INTO screening_results (id, attempt_id, session_id, student_id, game_id, domain, metrics, level_reached, accuracy, computed_at)
		VALUES (?, ?, ?, ?, ?, (SELECT domain FROM screening_games WHERE id = ?), ?, ?, ?, ?)
		ON CONFLICT(attempt_id) DO UPDATE SET metrics = excluded.metrics, level_reached = excluded.level_reached,
		                                      accuracy = excluded.accuracy, computed_at = excluded.computed_at
	`, r.genID(), attemptID, sessionID, studentID, gameID, gameID, metrics.JSON(), metrics.LevelReached, metrics.Accuracy, now)
	if err != nil {
		return err
	}

	// 4. Tutup attempt.
	duration := int64(0)
	var startedAt sql.NullInt64
	if err := tx.QueryRow("SELECT started_at FROM screening_attempts WHERE id = ?", attemptID).Scan(&startedAt); err == nil && startedAt.Valid {
		duration = now - startedAt.Int64
	}
	_, err = tx.Exec(`
		UPDATE screening_attempts SET status = 'completed', completed_at = ?, duration_ms = ?,
		                              device_type = ?, browser = ?, screen_width = ?, screen_height = ?, input_type = ?,
		                              updated_at = ?
		WHERE id = ?
	`, now, duration, req.DeviceType, req.Browser, req.ScreenWidth, req.ScreenHeight, req.InputType, now, attemptID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// computeErrorBreakpoint: level pertama (urut naik) dengan >=2 trial dan
// tingkat kesalahan > 50% — titik kesulitan mulai meningkat. Hanya dihitung
// untuk game bertingkat (ada trial dengan level > 0).
func computeErrorBreakpoint(trials []models.TrialInput) *int {
	byLevel := map[int][]models.TrialInput{}
	for _, t := range trials {
		if t.Level > 0 {
			byLevel[t.Level] = append(byLevel[t.Level], t)
		}
	}
	if len(byLevel) == 0 {
		return nil
	}
	levels := []int{}
	for lv := range byLevel {
		levels = append(levels, lv)
	}
	sort.Ints(levels)
	for _, lv := range levels {
		ts := byLevel[lv]
		if len(ts) < 2 {
			continue
		}
		errCount := 0
		for _, t := range ts {
			if t.IsCorrect == nil || !*t.IsCorrect {
				errCount++
			}
		}
		if float64(errCount)/float64(len(ts)) > 0.5 {
			return &lv
		}
	}
	return nil
}

// GetAttemptResult mengambil attempt + hasil terhitungnya.
func (r *SkriningRepository) GetAttemptResult(attemptID string) (*models.ScreeningResult, error) {
	var res models.ScreeningResult
	var metricsJSON string
	err := r.DB.QueryRow(`
		SELECT r.id, r.attempt_id, r.session_id, r.student_id, r.game_id, r.domain, r.metrics, r.level_reached, r.accuracy, r.computed_at
		FROM screening_results r WHERE r.attempt_id = ?
	`, attemptID).Scan(&res.ID, &res.AttemptID, &res.SessionID, &res.StudentID, &res.GameID, &res.Domain, &metricsJSON, &res.LevelReached, &res.Accuracy, &res.ComputedAt)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(metricsJSON), &res.Metrics); err != nil {
		return nil, err
	}
	return &res, nil
}

// ListStudentResults mengambil riwayat hasil siswa per domain (profil
// perkembangan dari waktu ke waktu, §28).
func (r *SkriningRepository) ListStudentResults(studentID string) ([]models.ScreeningResult, error) {
	rows, err := r.DB.Query(`
		SELECT r.id, r.attempt_id, r.session_id, r.student_id, r.game_id, r.domain, r.metrics, r.level_reached, r.accuracy, r.computed_at
		FROM screening_results r
		JOIN screening_attempts a ON a.id = r.attempt_id
		WHERE r.student_id = ? AND a.status = 'completed'
		ORDER BY r.computed_at ASC
	`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.ScreeningResult
	for rows.Next() {
		var res models.ScreeningResult
		var metricsJSON string
		if err := rows.Scan(&res.ID, &res.AttemptID, &res.SessionID, &res.StudentID, &res.GameID, &res.Domain, &metricsJSON, &res.LevelReached, &res.Accuracy, &res.ComputedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(metricsJSON), &res.Metrics); err != nil {
			continue
		}
		results = append(results, res)
	}
	return results, nil
}

// GetStudentLatestResult mengambil hasil attempt terakhir yang selesai untuk
// pasangan session+student.
func (r *SkriningRepository) GetStudentLatestResult(sessionID, studentID string) (*models.ScreeningResult, error) {
	var attemptID string
	err := r.DB.QueryRow(`
		SELECT id FROM screening_attempts
		WHERE session_id = ? AND student_id = ? AND status = 'completed'
		ORDER BY attempt_number DESC LIMIT 1
	`, sessionID, studentID).Scan(&attemptID)
	if err != nil {
		return nil, err
	}
	return r.GetAttemptResult(attemptID)
}

// ListMySessions mengambil sesi aktif untuk kelas seorang siswa.
func (r *SkriningRepository) ListMySessions(studentID, status string) ([]models.ScreeningSession, error) {
	rows, err := r.DB.Query(`
		SELECT s.id, s.game_id, s.class_id, s.class_name, s.teacher_user_id, s.academic_year,
		       s.title, s.status, s.started_at, s.finished_at, s.notes, s.created_at, s.updated_at,
		       g.name, g.icon, g.domain,
		       (SELECT COUNT(*) FROM screening_session_students ss WHERE ss.session_id = s.id),
		       (SELECT COUNT(*) FROM screening_attempts a
		        WHERE a.session_id = s.id AND a.status = 'completed')
		FROM screening_sessions s
		JOIN screening_games g ON g.id = s.game_id
		JOIN students st ON st.class_id = s.class_id
		WHERE st.id = ? AND s.deleted_at IS NULL AND s.status = ?
		ORDER BY s.started_at DESC, s.created_at DESC
	`, studentID, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []models.ScreeningSession
	for rows.Next() {
		var s models.ScreeningSession
		var className, title, notes, gameIcon sql.NullString
		var startedAt, finishedAt sql.NullInt64
		if err := rows.Scan(
			&s.ID, &s.GameID, &s.ClassID, &className, &s.TeacherUserID, &s.AcademicYear,
			&title, &s.Status, &startedAt, &finishedAt, &notes, &s.CreatedAt, &s.UpdatedAt,
			&s.GameName, &gameIcon, &s.Domain, &s.TotalStudents, &s.CompletedCount,
		); err != nil {
			return nil, err
		}
		if className.Valid {
			s.ClassName = className.String
		}
		if gameIcon.Valid {
			s.GameIcon = gameIcon.String
		}
		if title.Valid {
			s.Title = title.String
		}
		if notes.Valid {
			s.Notes = notes.String
		}
		if startedAt.Valid {
			s.StartedAt = startedAt.Int64
		}
		if finishedAt.Valid {
			s.FinishedAt = finishedAt.Int64
		}
		sessions = append(sessions, s)
	}
	return sessions, nil
}

// GetStudentAttemptStatus: apakah siswa sudah punya attempt pada sesi ini.
func (r *SkriningRepository) GetStudentAttemptStatus(sessionID, studentID string) (attemptID string, status string, err error) {
	err = r.DB.QueryRow(`
		SELECT id, status FROM screening_attempts
		WHERE session_id = ? AND student_id = ?
		ORDER BY attempt_number DESC LIMIT 1
	`, sessionID, studentID).Scan(&attemptID, &status)
	return attemptID, status, err
}

// ══════════════════════════════════════════════════════════
// OBSERVATIONS (guru)
// ══════════════════════════════════════════════════════════

func (r *SkriningRepository) SaveObservation(sessionID, studentID, createdBy string, checklist []string, notes string) error {
	now := UnixMilli()
	checklistJSON, _ := json.Marshal(checklist)
	_, err := r.DB.Exec(`
		INSERT INTO teacher_observations (id, session_id, student_id, checklist, notes, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(session_id, student_id) DO UPDATE SET checklist = excluded.checklist, notes = excluded.notes, updated_at = excluded.updated_at
	`, r.genID(), sessionID, studentID, string(checklistJSON), notes, createdBy, now, now)
	return err
}

func (r *SkriningRepository) GetObservation(sessionID, studentID string) (*models.TeacherObservation, error) {
	var o models.TeacherObservation
	var checklist, notes sql.NullString
	err := r.DB.QueryRow(`
		SELECT id, session_id, student_id, checklist, notes, created_by, created_at, updated_at
		FROM teacher_observations WHERE session_id = ? AND student_id = ?
	`, sessionID, studentID).Scan(&o.ID, &o.SessionID, &o.StudentID, &checklist, &notes, &o.CreatedBy, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return nil, err
	}
	o.Checklist = checklist.String
	o.Notes = notes.String
	return &o, nil
}

// ══════════════════════════════════════════════════════════
// DASHBOARD (guru)
// ══════════════════════════════════════════════════════════

func (r *SkriningRepository) GetClassDashboard(classID, academicYear string) (*models.ScreeningDashboard, error) {
	d := &models.ScreeningDashboard{ClassID: classID, AcademicYear: academicYear}

	if err := r.DB.QueryRow(`
		SELECT COUNT(*) FROM students WHERE class_id = ? AND (is_active = 1 OR status = 'active')
	`, classID).Scan(&d.TotalStudents); err != nil {
		return nil, err
	}

	if err := r.DB.QueryRow(`
		SELECT COUNT(DISTINCT a.student_id)
		FROM screening_attempts a
		JOIN screening_sessions s ON s.id = a.session_id
		WHERE s.class_id = ? AND a.status = 'completed'
	`, classID).Scan(&d.ScreenedCount); err != nil {
		return nil, err
	}

	rows, err := r.DB.Query(`
		SELECT g.domain, COUNT(*) AS attempts, AVG(r.accuracy) AS avg_acc
		FROM screening_results r
		JOIN screening_sessions s ON s.id = r.session_id
		JOIN screening_games g ON g.id = r.game_id
		WHERE s.class_id = ?
		GROUP BY g.domain
		ORDER BY attempts DESC
	`, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var st models.ScreeningDomainStat
		if err := rows.Scan(&st.Domain, &st.Attempts, &st.AvgAccuracy); err != nil {
			return nil, err
		}
		if label, ok := models.DomainLabels[st.Domain]; ok {
			st.DomainLabel = label
		} else {
			st.DomainLabel = st.Domain
		}
		d.DomainStats = append(d.DomainStats, st)
	}

	sessions, _, err := r.ListSessions("", classID, "", true, 1, 5)
	if err != nil {
		return nil, err
	}
	d.RecentSessions = sessions
	return d, nil
}

// GetWaliClassID mengambil id kelas yang diwali seorang user (kosong bila
// user bukan wali kelas manapun).
func (r *SkriningRepository) GetWaliClassID(userID string) (classID, className string, err error) {
	err = r.DB.QueryRow(
		`SELECT id, name FROM student_classes WHERE wali_user_id = ? AND is_active = 1`,
		userID,
	).Scan(&classID, &className)
	return classID, className, err
}
