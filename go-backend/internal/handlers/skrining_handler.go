package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// SkriningHandler menangani modul Ruang Tumbuh (skrining & perkembangan).
//
// Hak akses:
//   - guru   : operator utama, hanya untuk kelas yang diwaliinya.
//   - staff/admin: konfigurasi + agregat (lihat semua kelas).
//   - siswa  : menjalankan game dari sesi kelasnya yang sedang aktif.
type SkriningHandler struct {
	Repo         *repository.SkriningRepository
	Academic     *repository.AcademicRepository
	Audit        *repository.AuditLogRepository
	Notifications *repository.NotificationRepository
	DB           *sql.DB
}

func NewSkriningHandler(repo *repository.SkriningRepository, academic *repository.AcademicRepository, audit *repository.AuditLogRepository, notif *repository.NotificationRepository, db *sql.DB) *SkriningHandler {
	return &SkriningHandler{Repo: repo, Academic: academic, Audit: audit, Notifications: notif, DB: db}
}

const (
	StatusPending  = "pending"
	StatusActive   = "active"
	StatusFinished = "finished"
)

func isStaffOrAdmin(role string) bool {
	r := strings.ToLower(role)
	return r == "admin" || r == "superadmin" || r == "staff"
}

// resolveStudentID mengambil student_id dari user siswa yang login.
func (h *SkriningHandler) resolveStudentID(c echo.Context) (string, error) {
	userID, _ := c.Get("user_id").(string)
	var studentID string
	err := h.DB.QueryRow(
		"SELECT COALESCE(student_id, '') FROM users WHERE id = ?", userID,
	).Scan(&studentID)
	if err != nil {
		return "", err
	}
	if studentID == "" {
		return "", sql.ErrNoRows
	}
	return studentID, nil
}

func (h *SkriningHandler) currentAcademicYear() string {
	year, err := h.Academic.GetActiveAcademicYear()
	if err != nil || year == "" {
		return ""
	}
	return year
}

func (h *SkriningHandler) audit(c echo.Context, action, resource, details string) {
	if h.Audit == nil {
		return
	}
	userID, _ := c.Get("user_id").(string)
	userName, _ := c.Get("user_name").(string)
	d := details
	_ = h.Audit.CreateLog(models.AuditLog{
		Action:    action,
		Resource:  resource,
		Details:   &d,
		UserID:    &userID,
		UserName:  &userName,
		IPAddress: ptrString(c.RealIP()),
		UserAgent: ptrString(c.Request().UserAgent()),
	})
}

func ptrString(s string) *string { return &s }

// ══════════════════════════════════════════════════════════
// GURU / STAFF
// ══════════════════════════════════════════════════════════

// ListGames: katalog game skrining yang aktif.
func (h *SkriningHandler) ListGames(c echo.Context) error {
	games, err := h.Repo.ListGames()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat daftar game"})
	}
	if games == nil {
		games = []models.ScreeningGame{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": games})
}

// ListSessions: sesi yang terlihat oleh user (wali scope).
func (h *SkriningHandler) ListSessions(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	role, _ := c.Get("user_role").(string)
	classID := c.QueryParam("classId")
	status := c.QueryParam("status")
	page, limit := parsePageLimit(c)

	sessions, total, err := h.Repo.ListSessions(userID, classID, status, isStaffOrAdmin(role), page, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat daftar sesi"})
	}
	if sessions == nil {
		sessions = []models.ScreeningSession{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    sessions,
		"total":   total,
	})
}

// CreateSession: guru membuat sesi untuk kelas yang diwaliinya.
func (h *SkriningHandler) CreateSession(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	role, _ := c.Get("user_role").(string)

	var req models.CreateScreeningSessionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format permintaan tidak valid"})
	}
	if strings.TrimSpace(req.GameID) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Game skrining harus dipilih"})
	}

	// Kelas: kelas wali user, kecuali staff/admin boleh menentukan classId.
	classID, className := "", ""
	if cid := c.QueryParam("classId"); cid != "" && isStaffOrAdmin(role) {
		classID = cid
	} else {
		var err error
		classID, className, err = h.Repo.GetWaliClassID(userID)
		if err != nil || classID == "" {
			return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda bukan wali kelas manapun"})
		}
		if className == "" {
			var ns string
			_ = h.DB.QueryRow("SELECT name FROM student_classes WHERE id = ?", classID).Scan(&ns)
			className = ns
		}
	}

	game, err := h.Repo.GetGame(req.GameID)
	if err != nil || game == nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Game tidak ditemukan"})
	}

	sess, err := h.Repo.CreateSession(game.ID, classID, className, userID, h.currentAcademicYear(), strings.TrimSpace(req.Title), strings.TrimSpace(req.Notes))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal membuat sesi skrining"})
	}

	h.audit(c, "CREATE", "screening_session", "Membuat sesi skrining: "+game.Name+" ("+sess.ID+")")

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": sess})
}

// GetSession: detail sesi + roster.
func (h *SkriningHandler) GetSession(c echo.Context) error {
	id := c.Param("id")
	sess, err := h.Repo.GetSession(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Sesi tidak ditemukan"})
	}
	if !h.canAccessSession(c, sess) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke sesi ini"})
	}
	roster, _ := h.Repo.GetSessionRoster(id)
	if roster == nil {
		roster = []models.SessionRosterItem{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    map[string]interface{}{"session": sess, "roster": roster},
	})
}

// StartSession: guru memulai sesi (siswa dapat mulai bermain).
func (h *SkriningHandler) StartSession(c echo.Context) error {
	id := c.Param("id")
	sess, err := h.Repo.GetSession(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Sesi tidak ditemukan"})
	}
	if !h.canAccessSession(c, sess) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke sesi ini"})
	}
	if sess.Status == StatusFinished {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Sesi sudah selesai"})
	}
	if err := h.Repo.UpdateSessionStatus(id, StatusActive); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memulai sesi"})
	}
	h.audit(c, "START", "screening_session", "Memulai sesi skrining: "+sess.ID)
	sess, _ = h.Repo.GetSession(id)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": sess})
}

// FinishSession: guru mengakhiri sesi.
func (h *SkriningHandler) FinishSession(c echo.Context) error {
	id := c.Param("id")
	sess, err := h.Repo.GetSession(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Sesi tidak ditemukan"})
	}
	if !h.canAccessSession(c, sess) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke sesi ini"})
	}
	if err := h.Repo.UpdateSessionStatus(id, StatusFinished); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal mengakhiri sesi"})
	}
	h.audit(c, "FINISH", "screening_session", "Mengakhiri sesi skrining: "+sess.ID)
	sess, _ = h.Repo.GetSession(id)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": sess})
}

// GetStudentResult: hasil attempt terakhir seorang siswa pada sesi.
func (h *SkriningHandler) GetStudentResult(c echo.Context) error {
	sessionID := c.Param("id")
	studentID := c.Param("studentId")
	sess, err := h.Repo.GetSession(sessionID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Sesi tidak ditemukan"})
	}
	if !h.canAccessSession(c, sess) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke sesi ini"})
	}

	attemptID, attemptStatus, err := h.Repo.GetStudentAttemptStatus(sessionID, studentID)
	response := map[string]interface{}{
		"session":     sess,
		"hasAttempt":  err == nil,
		"attemptStatus": attemptStatus,
	}
	if err == nil && attemptStatus == "completed" {
		if result, rerr := h.Repo.GetAttemptResult(attemptID); rerr == nil {
			response["result"] = result
		}
		if attempt, aerr := h.Repo.GetAttempt(attemptID); aerr == nil {
			response["attempt"] = attempt
		}
	}
	if obs, oerr := h.Repo.GetObservation(sessionID, studentID); oerr == nil {
		response["observation"] = obs
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": response})
}

// SaveObservation: guru menyimpan hasil pengamatan (§26).
func (h *SkriningHandler) SaveObservation(c echo.Context) error {
	sessionID := c.Param("id")
	var req models.SaveObservationRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format permintaan tidak valid"})
	}
	if strings.TrimSpace(req.StudentID) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Siswa harus dipilih"})
	}

	sess, err := h.Repo.GetSession(sessionID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Sesi tidak ditemukan"})
	}
	if !h.canAccessSession(c, sess) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke sesi ini"})
	}

	userID, _ := c.Get("user_id").(string)
	if err := h.Repo.SaveObservation(sessionID, req.StudentID, userID, req.Checklist, strings.TrimSpace(req.Notes)); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan observasi"})
	}
	h.audit(c, "CREATE", "teacher_observation", "Mengisi observasi siswa pada sesi "+sessionID)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ClassDashboard: statistik kelas untuk guru (§29).
func (h *SkriningHandler) ClassDashboard(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	role, _ := c.Get("user_role").(string)

	classID, className := "", ""
	if cid := c.QueryParam("classId"); cid != "" && isStaffOrAdmin(role) {
		classID = cid
	} else {
		var err error
		classID, className, err = h.Repo.GetWaliClassID(userID)
		if err != nil || classID == "" {
			return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda bukan wali kelas manapun"})
		}
	}

	dash, err := h.Repo.GetClassDashboard(classID, h.currentAcademicYear())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat dashboard"})
	}
	dash.ClassName = className
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": dash})
}

// canAccessSession: guru hanya boleh mengakses sesinya sendiri; staff/admin
// bebas.
func (h *SkriningHandler) canAccessSession(c echo.Context, sess *models.ScreeningSession) bool {
	role, _ := c.Get("user_role").(string)
	if isStaffOrAdmin(role) {
		return true
	}
	userID, _ := c.Get("user_id").(string)
	return sess.TeacherUserID == userID
}

// ══════════════════════════════════════════════════════════
// SISWA
// ══════════════════════════════════════════════════════════

// ListMySessions: sesi kelas siswa yang sedang aktif (teacher-controlled, §19).
func (h *SkriningHandler) ListMySessions(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Akun tidak terhubung ke data siswa"})
	}
	sessions, err := h.Repo.ListMySessions(studentID, StatusActive)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat sesi"})
	}

	// Lengkapi status pengerjaan siswa untuk tiap sesi.
	type SessionView struct {
		models.ScreeningSession
		MyAttemptID     string `json:"myAttemptId,omitempty"`
		MyAttemptStatus string `json:"myAttemptStatus,omitempty"`
	}
	views := []SessionView{}
	for _, s := range sessions {
		v := SessionView{ScreeningSession: s}
		if aid, st, err := h.Repo.GetStudentAttemptStatus(s.ID, studentID); err == nil {
			v.MyAttemptID = aid
			v.MyAttemptStatus = st
		}
		views = append(views, v)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": views})
}

// StartMyAttempt: siswa memulai/melanjutkan attempt pada sebuah sesi.
func (h *SkriningHandler) StartMyAttempt(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Akun tidak terhubung ke data siswa"})
	}
	sessionID := c.Param("id")

	sess, err := h.Repo.GetSession(sessionID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Sesi tidak ditemukan"})
	}
	if sess.Status != StatusActive {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Sesi belum dimulai oleh guru"})
	}
	// Hanya siswa terdaftar di roster kelas sesi tersebut.
	inRoster := false
	_ = h.DB.QueryRow(
		"SELECT 1 FROM screening_session_students WHERE session_id = ? AND student_id = ?",
		sessionID, studentID,
	).Scan(&inRoster)
	if !inRoster {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda bukan peserta sesi ini"})
	}

	attempt, err := h.Repo.StartAttempt(sessionID, studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memulai attempt"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": attempt})
}

// SubmitMyAttempt: siswa mengirim trial mentah; server menghitung metrik.
func (h *SkriningHandler) SubmitMyAttempt(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Akun tidak terhubung ke data siswa"})
	}
	attemptID := c.Param("id")

	attempt, err := h.Repo.GetAttempt(attemptID)
	if err != nil || attempt == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Attempt tidak ditemukan"})
	}
	if attempt.StudentID != studentID {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Akses ditolak"})
	}
	if attempt.Status == "completed" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Attempt sudah diselesaikan"})
	}

	var req models.SubmitAttemptRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format permintaan tidak valid"})
	}
	if len(req.Trials) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data percobaan kosong"})
	}

	if err := h.Repo.SubmitAttempt(attemptID, req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan hasil"})
	}

	result, _ := h.Repo.GetAttemptResult(attemptID)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": result})
}

// GetMyAttemptResult: hasil attempt siswa sendiri.
func (h *SkriningHandler) GetMyAttemptResult(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Akun tidak terhubung ke data siswa"})
	}
	attemptID := c.Param("id")
	attempt, err := h.Repo.GetAttempt(attemptID)
	if err != nil || attempt.StudentID != studentID {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Akses ditolak"})
	}
	result, err := h.Repo.GetAttemptResult(attemptID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Hasil belum tersedia"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": result})
}

// MyHistory: riwayat perkembangan siswa (§28).
func (h *SkriningHandler) MyHistory(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Akun tidak terhubung ke data siswa"})
	}
	results, err := h.Repo.ListStudentResults(studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat riwayat"})
	}
	if results == nil {
		results = []models.ScreeningResult{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": results})
}

// ══════════════════════════════════════════════════════════
// ORANG TUA (§24 kuesioner, §25 rekomendasi yang dibagikan,
// §28 profil perkembangan anak)
// ══════════════════════════════════════════════════════════

// checkParentAccess memastikan user yang login adalah orang tua aktif
// dari studentID. Mengembalikan false (sekaligus respon error) bila tidak.
func (h *SkriningHandler) checkParentAccess(c echo.Context, studentID string) bool {
	if studentID == "" {
		c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Pilih anak terlebih dahulu"})
		return false
	}
	userID, _ := c.Get("user_id").(string)
	ok, err := h.Repo.IsParentOf(userID, studentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
		return false
	}
	if !ok {
		c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke anak ini"})
		return false
	}
	return true
}

// SaveParentObservation: kuesioner pengamatan orang tua (§24).
func (h *SkriningHandler) SaveParentObservation(c echo.Context) error {
	var req models.SaveParentObservationRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data tidak valid"})
	}
	studentID := strings.TrimSpace(req.StudentID)
	if !h.checkParentAccess(c, studentID) {
		return nil
	}
	if len(req.Answers) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Isi minimal satu bagian pengamatan"})
	}
	answersJSON, err := json.Marshal(req.Answers)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	year := h.currentAcademicYear()
	if err := h.Repo.SaveParentObservation(c.Get("user_id").(string), studentID, year, string(answersJSON), strings.TrimSpace(req.Notes)); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan pengamatan"})
	}
	h.audit(c, "CREATE", "parent_observation", "Pengamatan orang tua untuk student: "+studentID)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Pengamatan tersimpan. Terima kasih!"})
}

// ListParentObservations: riwayat kuesioner pengamatan orang tua.
func (h *SkriningHandler) ListParentObservations(c echo.Context) error {
	studentID := strings.TrimSpace(c.QueryParam("studentId"))
	if !h.checkParentAccess(c, studentID) {
		return nil
	}
	list, err := h.Repo.ListParentObservations(studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat pengamatan"})
	}
	if list == nil {
		list = []models.ParentObservation{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

// ListParentResults: profil perkembangan anak — hasil skrining dari semua
// sesi (§28). Orang tua hanya melihat anaknya sendiri.
func (h *SkriningHandler) ListParentResults(c echo.Context) error {
	studentID := strings.TrimSpace(c.QueryParam("studentId"))
	if !h.checkParentAccess(c, studentID) {
		return nil
	}
	results, err := h.Repo.ListStudentResults(studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat perkembangan anak"})
	}
	if results == nil {
		results = []models.ScreeningResult{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": results})
}

// ListParentRecommendations: rekomendasi tindak lanjut yang sudah
// dibagikan guru ke orang tua (§25).
func (h *SkriningHandler) ListParentRecommendations(c echo.Context) error {
	studentID := strings.TrimSpace(c.QueryParam("studentId"))
	if !h.checkParentAccess(c, studentID) {
		return nil
	}
	recs, err := h.Repo.ListSharedRecommendations(studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat rekomendasi"})
	}
	if recs == nil {
		recs = []models.ScreeningRecommendation{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": recs})
}

// ══════════════════════════════════════════════════════════
// GURU — rekomendasi & undangan (§25)
// ══════════════════════════════════════════════════════════

// SaveRecommendation: guru menyimpan rekomendasi tindak lanjut untuk siswa.
func (h *SkriningHandler) SaveRecommendation(c echo.Context) error {
	sessionID := c.Param("id")
	sess, err := h.Repo.GetSession(sessionID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Sesi tidak ditemukan"})
	}
	if !h.canAccessSession(c, sess) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke sesi ini"})
	}
	var req models.SaveRecommendationRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data tidak valid"})
	}
	req.StudentID = strings.TrimSpace(req.StudentID)
	req.Recommendation = strings.TrimSpace(req.Recommendation)
	if req.StudentID == "" || req.Recommendation == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Siswa dan isi rekomendasi wajib diisi"})
	}
	userID, _ := c.Get("user_id").(string)
	shared := false
	if req.SharedToParent != nil {
		shared = *req.SharedToParent
	}
	rec := &models.ScreeningRecommendation{
		StudentID:      req.StudentID,
		SessionID:      sessionID,
		Domain:         req.Domain,
		Recommendation: req.Recommendation,
		FollowUpType:   req.FollowUpType,
		SharedToParent: shared,
		CreatedBy:      userID,
	}
	if err := h.Repo.SaveRecommendation(rec); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan rekomendasi"})
	}
	h.audit(c, "CREATE", "screening_recommendation", "Rekomendasi untuk student: "+req.StudentID)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": rec, "message": "Rekomendasi tersimpan"})
}

// ListSessionRecommendations: rekomendasi satu siswa dalam sesi (guru).
func (h *SkriningHandler) ListSessionRecommendations(c echo.Context) error {
	sessionID := c.Param("id")
	studentID := strings.TrimSpace(c.QueryParam("studentId"))
	sess, err := h.Repo.GetSession(sessionID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Sesi tidak ditemukan"})
	}
	if !h.canAccessSession(c, sess) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke sesi ini"})
	}
	recs, err := h.Repo.ListSessionRecommendations(sessionID, studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat rekomendasi"})
	}
	if recs == nil {
		recs = []models.ScreeningRecommendation{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": recs})
}

// ToggleRecommendationShare: bagikan / tarik rekomendasi dari orang tua.
func (h *SkriningHandler) ToggleRecommendationShare(c echo.Context) error {
	recID := c.Param("recId")
	var req struct {
		Shared bool `json:"shared"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data tidak valid"})
	}
	if err := h.Repo.ToggleRecommendationShare(recID, req.Shared); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal mengubah status berbagi"})
	}
	action := "tarik dari orang tua"
	if req.Shared {
		action = "bagikan ke orang tua"
	}
	h.audit(c, "UPDATE", "screening_recommendation", "Rekomendasi "+recID+" "+action)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Status berbagi diperbarui"})
}

// InviteParents: kirim notifikasi undangan ke orang tua siswa kelas untuk
// mengisi pengamatan & melihat hasil skrining (§25).
func (h *SkriningHandler) InviteParents(c echo.Context) error {
	sessionID := c.Param("id")
	sess, err := h.Repo.GetSession(sessionID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Sesi tidak ditemukan"})
	}
	if !h.canAccessSession(c, sess) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke sesi ini"})
	}
	if h.Notifications == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "Layanan notifikasi tidak tersedia"})
	}
	parentUsers, err := h.Repo.ListClassParentUsers(sess.ClassID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat daftar orang tua"})
	}
	target := "/parent/perkembangan"
	title := "Undangan Pengamatan Perkembangan Anak"
	msg := "Sekolah mengundang Anda mengisi pengamatan perkembangan anak di portal orang tua."
	if sess.Title != "" {
		msg = "Sesi skrining \"" + sess.Title + "\" telah berjalan. Lihat perkembangan anak Anda & isi pengamatan di rumah."
	}
	sent := 0
	for _, uid := range parentUsers {
		uid := uid
		if err := h.Notifications.CreateNotification(models.Notification{
			UserID:    &uid,
			Type:      "info",
			Category:  "ruang_tumbuh",
			Title:     title,
			Message:   msg,
			TargetURL: &target,
		}); err == nil {
			sent++
		}
	}
	h.audit(c, "CREATE", "parent_invite", "Undangan orang tua sesi: "+sessionID)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "invited": sent, "message": "Undangan terkirim ke " + strconv.Itoa(sent) + " orang tua"})
}

// ══════════════════════════════════════════════════════════
// STAFF/ADMIN — agregat lintas kelas (§29)
// ══════════════════════════════════════════════════════════

// StaffAggregate: statistik seluruh sesi skrining untuk staff/admin.
func (h *SkriningHandler) StaffAggregate(c echo.Context) error {
	role, _ := c.Get("user_role").(string)
	if !isStaffOrAdmin(role) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Hanya staff/admin"})
	}
	year := strings.TrimSpace(c.QueryParam("academicYear"))
	agg, err := h.Repo.GetStaffAggregate(year)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat agregat"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": agg})
}
