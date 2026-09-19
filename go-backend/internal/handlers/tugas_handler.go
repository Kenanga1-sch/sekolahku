package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// TugasHandler menangani modul Tugas & PR (guru → siswa).
//
// Hak akses:
//   - guru   : memberikan tugas ke kelas yang diwaliinya saja.
//   - staff/admin : boleh menentukan kelas mana pun (param classId).
//   - siswa  : melihat & mengumpulkan tugas kelasnya sendiri.
//   - orang tua : memantau tugas anaknya.
type TugasHandler struct {
	Repo          *repository.TugasRepository
	Academic      *repository.AcademicRepository
	Audit         *repository.AuditLogRepository
	Notifications *repository.NotificationRepository
	DB            *sql.DB
}

func NewTugasHandler(repo *repository.TugasRepository, academic *repository.AcademicRepository,
	audit *repository.AuditLogRepository, notif *repository.NotificationRepository,
	db *sql.DB) *TugasHandler {
	return &TugasHandler{Repo: repo, Academic: academic, Audit: audit,
		Notifications: notif, DB: db}
}

const (
	TugasStatusPublished = "published"
	TugasStatusArchived  = "archived"
	SubmissionSubmitted  = "submitted"
	SubmissionGraded     = "graded"
)

// resolveStudentID mengambil student_id dari user siswa yang login.
func (h *TugasHandler) resolveStudentID(c echo.Context) (string, error) {
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

// resolveClass menentukan kelas target: kelas wali guru, atau classId eksplisit
// untuk staff/admin.
func (h *TugasHandler) resolveClass(c echo.Context) (classID, className string, err error) {
	role, _ := c.Get("user_role").(string)
	if cid := strings.TrimSpace(c.QueryParam("classId")); cid != "" && isStaffOrAdmin(role) {
		var name string
		if e := h.DB.QueryRow("SELECT name FROM student_classes WHERE id = ?", cid).Scan(&name); e != nil {
			return cid, "", nil
		}
		return cid, name, nil
	}
	userID, _ := c.Get("user_id").(string)
	return h.Academic.GetWaliClass(userID)
}

func (h *TugasHandler) currentAcademicYear() string {
	year, err := h.Academic.GetActiveAcademicYear()
	if err != nil || year == "" {
		return ""
	}
	return year
}

func (h *TugasHandler) audit(c echo.Context, action, resource, details string) {
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

// canAccessTugas: guru hanya boleh mengakses tugas miliknya; staff/admin bebas.
func (h *TugasHandler) canAccessTugas(c echo.Context, t *models.Tugas) bool {
	if t == nil {
		return false
	}
	role, _ := c.Get("user_role").(string)
	if isStaffOrAdmin(role) {
		return true
	}
	userID, _ := c.Get("user_id").(string)
	return t.TeacherUserID == userID
}

// formatDue merender UnixMilli ke tanggal Indonesia (WIB).
func formatDue(millis int64) string {
	t := time.UnixMilli(millis).In(repository.JakartaLoc())
	return t.Format("02 Jan 2006, 15:04")
}

// ══════════════════════════════════════════════════════════
// GURU / STAFF
// ══════════════════════════════════════════════════════════

// ListTugas: tugas yang terlihat oleh user (wali scope).
func (h *TugasHandler) ListTugas(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	role, _ := c.Get("user_role").(string)
	classID := c.QueryParam("classId")
	status := c.QueryParam("status")
	search := c.QueryParam("q")
	page, limit := parsePageLimit(c)

	list, total, err := h.Repo.ListTugas(userID, classID, status, search, isStaffOrAdmin(role), page, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat daftar tugas"})
	}
	if list == nil {
		list = []models.Tugas{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    list,
		"total":   total,
		"page":    page,
		"limit":   limit,
	})
}

// CreateTugas: guru membuat tugas untuk kelas walinya.
func (h *TugasHandler) CreateTugas(c echo.Context) error {
	var req models.CreateTugasRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format permintaan tidak valid"})
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Judul tugas wajib diisi"})
	}
	if len(title) > 200 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Judul tugas terlalu panjang (maksimal 200 karakter)"})
	}

	classID, className, err := h.resolveClass(c)
	if err != nil || classID == "" {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda bukan wali kelas manapun"})
	}

	subjectID := strings.TrimSpace(req.SubjectID)
	subjectName, _ := h.Repo.GetSubjectName(subjectID)

	allowLate := true
	if req.AllowLate != nil {
		allowLate = *req.AllowLate
	}
	var dueAt *int64
	if req.DueAt != nil && *req.DueAt > 0 {
		dueAt = req.DueAt
	}

	userID, _ := c.Get("user_id").(string)
	t := &models.Tugas{
		TeacherUserID:  userID,
		ClassID:        classID,
		ClassName:      className,
		SubjectID:      subjectID,
		SubjectName:    subjectName,
		AcademicYear:   h.currentAcademicYear(),
		Title:          title,
		Description:    strings.TrimSpace(req.Description),
		AttachmentURL:  strings.TrimSpace(req.AttachmentURL),
		AttachmentName: strings.TrimSpace(req.AttachmentName),
		DueAt:          dueAt,
		AllowLate:      allowLate,
		Status:         TugasStatusPublished,
	}
	created, err := h.Repo.CreateTugas(t)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Judul tugas sudah ada untuk kelas ini tahun ajaran ini"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan tugas"})
	}

	h.notifyNewTugas(created)
	h.audit(c, "CREATE", "tugas", "Membuat tugas: "+title+" ("+created.ID+")")
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": created})
}

// GetTugas: detail satu tugas + agregat pengumpulan.
func (h *TugasHandler) GetTugas(c echo.Context) error {
	t, err := h.Repo.GetTugas(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Tugas tidak ditemukan"})
	}
	if !h.canAccessTugas(c, t) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke tugas ini"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": t})
}

// UpdateTugas: guru mengubah konten tugas (kelas tidak bisa diubah).
func (h *TugasHandler) UpdateTugas(c echo.Context) error {
	t, err := h.Repo.GetTugas(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Tugas tidak ditemukan"})
	}
	if !h.canAccessTugas(c, t) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke tugas ini"})
	}

	var req models.UpdateTugasRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format permintaan tidak valid"})
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Judul tugas wajib diisi"})
	}

	subjectID := strings.TrimSpace(req.SubjectID)
	subjectName, _ := h.Repo.GetSubjectName(subjectID)

	allowLate := true
	if req.AllowLate != nil {
		allowLate = *req.AllowLate
	}
	var dueAt *int64
	if req.DueAt != nil && *req.DueAt > 0 {
		dueAt = req.DueAt
	}

	update := &models.Tugas{
		ID:             t.ID,
		Title:          title,
		Description:    strings.TrimSpace(req.Description),
		SubjectID:      subjectID,
		SubjectName:    subjectName,
		AttachmentURL:  strings.TrimSpace(req.AttachmentURL),
		AttachmentName: strings.TrimSpace(req.AttachmentName),
		DueAt:          dueAt,
		AllowLate:      allowLate,
	}
	if err := h.Repo.UpdateTugas(update); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memperbarui tugas"})
	}
	updated, _ := h.Repo.GetTugas(t.ID)
	h.audit(c, "UPDATE", "tugas", "Mengubah tugas: "+title+" ("+t.ID+")")
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": updated})
}

// ArchiveTugas: mempublikasi/mengarsipkan tugas tanpa menghapus.
func (h *TugasHandler) ArchiveTugas(c echo.Context) error {
	t, err := h.Repo.GetTugas(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Tugas tidak ditemukan"})
	}
	if !h.canAccessTugas(c, t) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke tugas ini"})
	}
	var req models.ArchiveTugasRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format permintaan tidak valid"})
	}
	if err := h.Repo.SetArchived(t.ID, req.Archived); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal mengubah status tugas"})
	}
	action := "mengarsipkan"
	if !req.Archived {
		action = "memublikasikan kembali"
	}
	h.audit(c, "UPDATE", "tugas", action+" tugas: "+t.Title+" ("+t.ID+")")
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Status tugas diperbarui"})
}

// DeleteTugas: soft delete tugas + pengumpulannya.
func (h *TugasHandler) DeleteTugas(c echo.Context) error {
	t, err := h.Repo.GetTugas(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Tugas tidak ditemukan"})
	}
	if !h.canAccessTugas(c, t) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke tugas ini"})
	}
	if err := h.Repo.SoftDeleteTugas(t.ID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menghapus tugas"})
	}
	h.audit(c, "DELETE", "tugas", "Menghapus tugas: "+t.Title+" ("+t.ID+")")
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Tugas dihapus"})
}

// ListRoster: roster kelas tugas + status pengumpulan tiap siswa.
func (h *TugasHandler) ListRoster(c echo.Context) error {
	t, err := h.Repo.GetTugas(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Tugas tidak ditemukan"})
	}
	if !h.canAccessTugas(c, t) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke tugas ini"})
	}
	roster, err := h.Repo.ListTugasRoster(t.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat daftar siswa"})
	}
	if roster == nil {
		roster = []models.TugasRosterItem{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": roster})
}

// ListSubmissions: semua pengumpulan sebuah tugas.
func (h *TugasHandler) ListSubmissions(c echo.Context) error {
	t, err := h.Repo.GetTugas(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Tugas tidak ditemukan"})
	}
	if !h.canAccessTugas(c, t) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke tugas ini"})
	}
	page, limit := parsePageLimit(c)
	list, total, err := h.Repo.ListSubmissions(t.ID, page, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat pengumpulan"})
	}
	if list == nil {
		list = []models.TugasSubmission{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    list,
		"total":   total,
		"page":    page,
		"limit":   limit,
	})
}

// GetSubmission: detail satu pengumpulan.
func (h *TugasHandler) GetSubmission(c echo.Context) error {
	t, err := h.Repo.GetTugas(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Tugas tidak ditemukan"})
	}
	if !h.canAccessTugas(c, t) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke tugas ini"})
	}
	sub, err := h.Repo.GetSubmissionByID(c.Param("subId"))
	if err != nil || sub.TugasID != t.ID {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Pengumpulan tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": sub})
}

// GradeSubmission: guru menyimpan nilai + feedback (opsional).
func (h *TugasHandler) GradeSubmission(c echo.Context) error {
	t, err := h.Repo.GetTugas(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Tugas tidak ditemukan"})
	}
	if !h.canAccessTugas(c, t) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke tugas ini"})
	}
	sub, err := h.Repo.GetSubmissionByID(c.Param("subId"))
	if err != nil || sub.TugasID != t.ID {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Pengumpulan tidak ditemukan"})
	}

	var req models.GradeSubmissionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format permintaan tidak valid"})
	}
	if req.Score != nil && (*req.Score < 0 || *req.Score > 100) {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Nilai harus di antara 0 dan 100"})
	}

	userID, _ := c.Get("user_id").(string)
	if err := h.Repo.GradeSubmission(sub.ID, req.Score, strings.TrimSpace(req.Feedback), userID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan nilai"})
	}
	updated, _ := h.Repo.GetSubmissionByID(sub.ID)
	h.audit(c, "UPDATE", "tugas", "Menilai pengumpulan "+sub.StudentName+" pada tugas: "+t.Title)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": updated, "message": "Nilai tersimpan"})
}

// Remind: mengingatkan siswa yang belum mengumpulkan (notifikasi in-app).
func (h *TugasHandler) Remind(c echo.Context) error {
	t, err := h.Repo.GetTugas(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Tugas tidak ditemukan"})
	}
	if !h.canAccessTugas(c, t) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Anda tidak memiliki akses ke tugas ini"})
	}
	if h.Notifications == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]interface{}{"success": false, "error": "Layanan notifikasi tidak tersedia"})
	}
	targets, err := h.Repo.ListRemindTargets(t.ID, t.ClassID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat daftar siswa"})
	}
	title := "Pengingat Tugas: " + t.Title
	msg := "Jangan lupa kerjakan tugas" + subjectSuffix(t.SubjectName) + " dari " + orBlank(t.TeacherName) + "."
	if t.DueAt != nil {
		msg += " Batas waktu " + formatDue(*t.DueAt) + "."
	}
	target := "/tugas-saya"
	sent := 0
	for i := range targets {
		uid := targets[i]
		if err := h.Notifications.CreateNotification(models.Notification{
			UserID:    &uid,
			Type:      "warning",
			Category:  "akademik",
			Title:     title,
			Message:   msg,
			TargetURL: &target,
		}); err == nil {
			sent++
		}
	}
	h.audit(c, "CREATE", "tugas", "Mengingatkan "+strconv.Itoa(sent)+" siswa untuk tugas: "+t.Title)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "reminded": sent, "message": "Pengingat terkirim ke " + strconv.Itoa(sent) + " siswa"})
}

// ══════════════════════════════════════════════════════════
// SISWA
// ══════════════════════════════════════════════════════════

// ListMyTugas: tugas kelas siswa yang login + status pengumpulannya.
func (h *TugasHandler) ListMyTugas(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Akun tidak terhubung ke data siswa"})
	}
	classID, err := h.Repo.GetStudentClassID(studentID)
	if err != nil || classID == "" {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Anda belum terdaftar di kelas manapun"})
	}
	page, limit := parsePageLimit(c)
	list, total, err := h.Repo.ListMyTugas(studentID, classID, page, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat daftar tugas"})
	}
	if list == nil {
		list = []models.Tugas{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    list,
		"total":   total,
		"page":    page,
		"limit":   limit,
	})
}

// GetMyTugas: detail satu tugas + pengumpulan siswa sendiri.
func (h *TugasHandler) GetMyTugas(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Akun tidak terhubung ke data siswa"})
	}
	t, err := h.Repo.GetMyTugas(c.Param("id"), studentID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Tugas tidak ditemukan"})
	}
	classID, err := h.Repo.GetStudentClassID(studentID)
	if err != nil || t.ClassID != classID {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Tugas ini bukan untuk kelas Anda"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": t})
}

// SubmitMyTugas: siswa mengumpulkan/mengubah jawaban sebelum dinilai.
func (h *TugasHandler) SubmitMyTugas(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Akun tidak terhubung ke data siswa"})
	}
	t, err := h.Repo.GetTugas(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Tugas tidak ditemukan"})
	}
	classID, err := h.Repo.GetStudentClassID(studentID)
	if err != nil || t.ClassID != classID {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Tugas ini bukan untuk kelas Anda"})
	}
	if t.Status != TugasStatusPublished {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Tugas sudah diarsipkan"})
	}

	var req models.SubmitTugasRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format permintaan tidak valid"})
	}
	answer := strings.TrimSpace(req.AnswerText)
	attachment := strings.TrimSpace(req.AttachmentURL)
	if answer == "" && attachment == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Isi jawaban atau lampirkan file"})
	}

	// Sudah dinilai? tidak boleh diubah lagi.
	if existing, _ := h.Repo.GetSubmission(t.ID, studentID); existing != nil && existing.Status == SubmissionGraded {
		return c.JSON(http.StatusConflict, map[string]interface{}{"success": false, "error": "Pengumpulan Anda sudah dinilai dan tidak dapat diubah"})
	}

	// Batas waktu.
	isLate := false
	if t.DueAt != nil && repository.UnixMilli() > *t.DueAt {
		isLate = true
		if !t.AllowLate {
			return c.JSON(http.StatusConflict, map[string]interface{}{"success": false, "error": "Batas waktu tugas sudah terlewati"})
		}
	}

	sub, err := h.Repo.UpsertSubmission(t.ID, studentID, answer, attachment,
		strings.TrimSpace(req.AttachmentName), isLate)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan pengumpulan"})
	}
	h.audit(c, "CREATE", "tugas_submission", "Mengumpulkan tugas: "+t.Title)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": sub, "message": "Jawaban terkumpul"})
}

// ══════════════════════════════════════════════════════════
// ORANG TUA
// ══════════════════════════════════════════════════════════

// ListChildrenTugas: tugas semua anak orang tua + status pengumpulan.
func (h *TugasHandler) ListChildrenTugas(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	studentID := strings.TrimSpace(c.QueryParam("studentId"))
	page, limit := parsePageLimit(c)
	list, total, err := h.Repo.ListChildrenTugas(userID, studentID, page, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat tugas anak"})
	}
	if list == nil {
		list = []models.Tugas{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    list,
		"total":   total,
		"page":    page,
		"limit":   limit,
	})
}

// ══════════════════════════════════════════════════════════
// Notifikasi
// ══════════════════════════════════════════════════════════

// notifyNewTugas memberitahu siswa & orang tua kelas bahwa tugas baru dibuat.
func (h *TugasHandler) notifyNewTugas(t *models.Tugas) {
	if h.Notifications == nil {
		return
	}
	dueText := "tanpa batas waktu"
	if t.DueAt != nil {
		dueText = "batas waktu " + formatDue(*t.DueAt)
	}
	suffix := subjectSuffix(t.SubjectName)

	if students, err := h.Repo.ListStudentUserIDsByClass(t.ClassID); err == nil {
		title := "Tugas Baru: " + t.Title
		msg := orBlank(t.TeacherName) + " memberikan tugas" + suffix + ", " + dueText + ". Kerjakan melalui menu Tugas Saya."
		target := "/tugas-saya"
		for i := range students {
			uid := students[i]
			_ = h.Notifications.CreateNotification(models.Notification{
				UserID:    &uid,
				Type:      "info",
				Category:  "akademik",
				Title:     title,
				Message:   msg,
				TargetURL: &target,
			})
		}
	}
	if parents, err := h.Repo.ListClassParentUsers(t.ClassID); err == nil {
		title := "Tugas Baru untuk Anak Anda"
		msg := "Ada tugas baru" + suffix + " kelas " + orBlank(t.ClassName) + ", " + dueText + ". Pantau pengumpulan di menu Tugas."
		target := "/parent/tugas"
		for i := range parents {
			uid := parents[i]
			_ = h.Notifications.CreateNotification(models.Notification{
				UserID:    &uid,
				Type:      "info",
				Category:  "akademik",
				Title:     title,
				Message:   msg,
				TargetURL: &target,
			})
		}
	}
}

func subjectSuffix(subjectName string) string {
	if subjectName == "" {
		return ""
	}
	return " (" + subjectName + ")"
}

func orBlank(s string) string {
	if s == "" {
		return "Sekolah"
	}
	return s
}
