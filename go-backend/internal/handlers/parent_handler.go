package handlers

import (
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"

	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/push"
	"github.com/sekolahku/go-backend/internal/repository"
)

// ParentHandler melayani portal orang tua: akun, anak, dan pengajuan izin.
type ParentHandler struct {
	Repo          *repository.ParentRepository
	Users         *repository.UserRepository
	Attendance    *repository.AttendanceRepository
	Notifications *repository.NotificationRepository
	Push          *push.Service
}

func NewParentHandler(repo *repository.ParentRepository, users *repository.UserRepository, attendance *repository.AttendanceRepository, notifications *repository.NotificationRepository, pushSvc *push.Service) *ParentHandler {
	return &ParentHandler{Repo: repo, Users: users, Attendance: attendance, Notifications: notifications, Push: pushSvc}
}

var parentDateRegex = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// VerifyStudent memeriksa NISN + tanggal lahir sebelum pendaftaran akun.
// Hanya mengembalikan nama siswa — bukan data lain.
func (h *ParentHandler) VerifyStudent(c echo.Context) error {
	var req struct {
		NISN      string `json:"nisn"`
		BirthDate string `json:"birthDate"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data tidak valid"})
	}
	req.NISN = strings.TrimSpace(req.NISN)
	req.BirthDate = strings.TrimSpace(req.BirthDate)
	if !nisnRegex.MatchString(req.NISN) || !parentDateRegex.MatchString(req.BirthDate) {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "NISN (10 digit) dan tanggal lahir wajib diisi"})
	}
	studentID, fullName, err := h.Repo.FindStudentForRegistration(req.NISN, req.BirthDate)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if studentID == "" {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Data siswa tidak ditemukan atau tanggal lahir tidak cocok"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "studentName": fullName})
}

// Register mendaftarkan akun orang tua secara mandiri (verifikasi data siswa).
func (h *ParentHandler) Register(c echo.Context) error {
	var req models.ParentRegisterRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data tidak valid"})
	}
	req.NISN = strings.TrimSpace(req.NISN)
	req.BirthDate = strings.TrimSpace(req.BirthDate)
	req.Name = strings.TrimSpace(req.Name)
	req.Phone = strings.TrimSpace(req.Phone)
	if !nisnRegex.MatchString(req.NISN) || !parentDateRegex.MatchString(req.BirthDate) {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "NISN dan tanggal lahir tidak valid"})
	}
	if len(req.Name) < 3 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Nama minimal 3 karakter"})
	}
	if !whatsappRegex.MatchString(req.Phone) {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Nomor HP tidak valid (format: 08xxxxxxxxxx)"})
	}
	if len(req.Password) < 6 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Password minimal 6 karakter"})
	}

	studentID, _, err := h.Repo.FindStudentForRegistration(req.NISN, req.BirthDate)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if studentID == "" {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Data siswa tidak ditemukan atau tanggal lahir tidak cocok"})
	}
	taken, err := h.Repo.PhoneTaken(req.Phone)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if taken {
		return c.JSON(http.StatusConflict, map[string]interface{}{"success": false, "error": "Nomor HP sudah terdaftar. Silakan masuk atau hubungi sekolah."})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	hashStr := string(hash)
	phone := req.Phone
	name := req.Name
	userID, err := h.Users.CreateUser(models.User{
		Name:         &name,
		FullName:     &name,
		Username:     &phone,
		Phone:        &phone,
		PasswordHash: &hashStr,
		Role:         "orangtua",
		IsActive:     true,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal membuat akun"})
	}
	if err := h.Repo.LinkParent(userID, studentID, req.Relation); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menautkan akun ke siswa"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Akun berhasil dibuat. Silakan masuk."})
}

// GetChildren daftar anak milik orang tua yang login.
func (h *ParentHandler) GetChildren(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	children, err := h.Repo.GetChildrenByUser(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": children})
}

// CreateLeave pengajuan izin/sakit dari orang tua.
func (h *ParentHandler) CreateLeave(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	var req models.CreateLeaveRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data tidak valid"})
	}
	req.Type = strings.ToLower(strings.TrimSpace(req.Type))
	if req.Type != "izin" && req.Type != "sakit" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Jenis pengajuan harus izin atau sakit"})
	}
	if !parentDateRegex.MatchString(req.StartDate) || !parentDateRegex.MatchString(req.EndDate) {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tanggal tidak valid"})
	}
	if req.EndDate < req.StartDate {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tanggal selesai tidak boleh sebelum tanggal mulai"})
	}
	if len(strings.TrimSpace(req.Reason)) < 5 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Alasan minimal 5 karakter"})
	}
	ok, err := h.Repo.IsParentOf(userID, req.StudentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if !ok {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Siswa bukan anak Anda"})
	}
	id, err := h.Repo.CreateLeave(models.LeaveRequest{
		StudentID:    req.StudentID,
		ParentUserID: userID,
		Type:         req.Type,
		StartDate:    req.StartDate,
		EndDate:      req.EndDate,
		Reason:       strings.TrimSpace(req.Reason),
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan pengajuan"})
	}

	// Beri tahu wali kelas/admin agar ditindaklanjuti.
	if h.Notifications != nil {
		fullName, className, _ := h.Repo.GetStudentBrief(req.StudentID)
		_ = h.Notifications.NotifyRoles(models.Notification{
			Type:      "info",
			Category:  "presensi",
			Title:     "Pengajuan " + req.Type + " baru",
			Message:   fullName + " (" + className + ") mengajukan " + req.Type + " pada " + req.StartDate + ".",
			TargetURL: StrPtr("/presensi/pengajuan"),
		}, "admin", "superadmin", "guru")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "id": id})
}

// GetMyLeaves riwayat pengajuan milik orang tua.
func (h *ParentHandler) GetMyLeaves(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	list, err := h.Repo.GetLeaveByParent(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

// ============ Admin / Guru ============

// ListLeaves daftar pengajuan untuk ditinjau guru/admin.
func (h *ParentHandler) ListLeaves(c echo.Context) error {
	statusFilter := c.QueryParam("status")
	className := c.QueryParam("class")
	list, err := h.Repo.ListLeaveRequests(statusFilter, className)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

// ReviewLeave menyetujui/menolak; bila disetujui, presensi tanggal terkait
// otomatis ditandai izin/sakit (hari libur dilewati).
func (h *ParentHandler) ReviewLeave(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Status string `json:"status"`
		Note   string `json:"note"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data tidak valid"})
	}
	req.Status = strings.ToLower(strings.TrimSpace(req.Status))
	if req.Status != "approved" && req.Status != "rejected" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Status harus approved atau rejected"})
	}
	lr, err := h.Repo.GetLeaveByID(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if lr == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Pengajuan tidak ditemukan"})
	}
	reviewerID, _ := c.Get("user_id").(string)
	if err := h.Repo.UpdateLeaveStatus(id, req.Status, reviewerID, strings.TrimSpace(req.Note)); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	// Saat disetujui: tandai presensi untuk setiap hari dalam rentang.
	if req.Status == "approved" && h.Attendance != nil {
		_, className, _ := h.Repo.GetStudentBrief(lr.StudentID)
		status := "izin"
		if lr.Type == "sakit" {
			status = "sakit"
		}
		for d := lr.StartDate; d <= lr.EndDate; {
			t, perr := time.Parse("2006-01-02", d)
			if perr != nil {
				break
			}
			if holiday, _ := repository.IsHoliday(d); !holiday && t.Weekday() != time.Saturday && t.Weekday() != time.Sunday {
				_ = h.Attendance.RecordManualV2(models.AttendanceManualRequestV2{
					Date:      d,
					ClassName: className,
					StudentID: lr.StudentID,
					Status:    status,
				})
			}
			t = t.AddDate(0, 0, 1)
			d = t.Format("2006-01-02")
		}
	}

	// Kabari orang tua + kirim push.
	if h.Notifications != nil {
		label := "disetujui"
		nType := "success"
		if req.Status == "rejected" {
			label = "ditolak"
			nType = "warning"
		}
		_ = h.Notifications.CreateNotification(models.Notification{
			UserID:    &lr.ParentUserID,
			Type:      nType,
			Category:  "presensi",
			Title:     "Pengajuan " + lr.Type + " " + label,
			Message:   "Pengajuan " + lr.Type + " untuk " + lr.StudentName + " (" + lr.StartDate + ") telah " + label + ".",
			TargetURL: StrPtr("/parent"),
		})
		if h.Push != nil {
			h.Push.SendToUser(lr.ParentUserID, models.PushPayload{
				Title: "Pengajuan " + lr.Type + " " + label,
				Body:  "Untuk " + lr.StudentName + " (" + lr.StartDate + ").",
				URL:   "/parent/izin",
				Tag:   "leave-" + lr.ID,
			})
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ============ Tautan anak (admin) ============

// GetStudentParents daftar ortu tertaut ke seorang siswa.
func (h *ParentHandler) GetStudentParents(c echo.Context) error {
	studentID := c.Param("id")
	parents, err := h.Repo.ListParentsOfStudent(studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": parents})
}

// LinkParent menautkan akun (menurut nomor HP / user id) ke siswa.
func (h *ParentHandler) LinkParent(c echo.Context) error {
	studentID := c.Param("id")
	var req struct {
		Phone    string `json:"phone"`
		UserID   string `json:"userId"`
		Relation string `json:"relation"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data tidak valid"})
	}
	targetUserID := strings.TrimSpace(req.UserID)
	if targetUserID == "" {
		// Cari user berdasarkan nomor HP (username).
		user, err := h.Users.GetUserByEmail(strings.TrimSpace(req.Phone))
		if err != nil || user == nil {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Akun dengan nomor tersebut tidak ditemukan"})
		}
		targetUserID = user.ID
	}
	if err := h.Repo.LinkParent(targetUserID, studentID, req.Relation); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menautkan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// UnlinkParent melepas tautan ortu dari siswa.
func (h *ParentHandler) UnlinkParent(c echo.Context) error {
	studentID := c.Param("id")
	userID := c.Param("userId")
	if err := h.Repo.UnlinkParent(userID, studentID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal melepas tautan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
