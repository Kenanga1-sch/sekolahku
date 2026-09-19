package handlers

import (
	"database/sql"
	"net/http"
	"regexp"
	"strconv"
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
	Prefs         *repository.PreferenceRepository
	Mutasi        *repository.MutasiRepository
}

func NewParentHandler(repo *repository.ParentRepository, users *repository.UserRepository, attendance *repository.AttendanceRepository, notifications *repository.NotificationRepository, pushSvc *push.Service, prefs *repository.PreferenceRepository, mutasi *repository.MutasiRepository) *ParentHandler {
	return &ParentHandler{Repo: repo, Users: users, Attendance: attendance, Notifications: notifications, Push: pushSvc, Prefs: prefs, Mutasi: mutasi}
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
			Category:  "absensi",
			Title:     "Pengajuan " + req.Type + " baru",
			Message:   fullName + " (" + className + ") mengajukan " + req.Type + " pada " + req.StartDate + ".",
			TargetURL: StrPtr("/presensi/pengajuan"),
		}, "admin", "superadmin", "guru")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "id": id})
}

// GetMyLeaves riwayat pengajuan milik orang tua (paginated).
func (h *ParentHandler) GetMyLeaves(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	limitStr := c.QueryParam("limit")
	pageStr := c.QueryParam("page")
	limit := 20
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}
	page := 1
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}
	offset := (page - 1) * limit
	list, total, err := h.Repo.GetLeaveByParent(userID, limit, offset)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	totalPages := (total + limit - 1) / limit
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"data":       list,
		"total":      total,
		"page":       page,
		"totalPages": totalPages,
	})
}

// CancelLeave membatalkan pengajuan izin/sakit milik orang tua (hanya jika status pending).
func (h *ParentHandler) CancelLeave(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	id := c.Param("id")
	lr, err := h.Repo.GetLeaveByID(id)
	if err != nil || lr == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Pengajuan tidak ditemukan"})
	}
	if lr.ParentUserID != userID {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Bukan pengajuan Anda"})
	}
	if lr.Status != "pending" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Hanya pengajuan berstatus menunggu yang dapat dibatalkan"})
	}
	if err := h.Repo.UpdateLeaveStatus(id, "cancelled", userID, "Dibatalkan oleh orang tua"); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal membatalkan pengajuan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ============ Preferensi notifikasi ============

// validNotifCategories daftar kategori yang dikenal sistem preferensi.
var validNotifCategories = map[string]bool{
	repository.NotifCategoryAbsensi:    true,
	repository.NotifCategoryTabungan:  true,
	repository.NotifCategoryPengumuman: true,
	repository.NotifCategoryPR:        true,
	repository.NotifCategoryUmum:      true,
}

// GetPreferences preferensi notifikasi user; kategori tanpa baris = aktif.
func (h *ParentHandler) GetPreferences(c echo.Context) error {
	if h.Prefs == nil {
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": map[string]bool{}})
	}
	userID, _ := c.Get("user_id").(string)
	prefs, err := h.Prefs.GetPreferences(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": prefs})
}

// UpdatePreferences menyimpan preferensi kategori notifikasi user.
func (h *ParentHandler) UpdatePreferences(c echo.Context) error {
	if h.Prefs == nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Preferensi tidak tersedia"})
	}
	userID, _ := c.Get("user_id").(string)
	var req struct {
		Category string `json:"category"`
		Enabled  bool   `json:"enabled"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data tidak valid"})
	}
	req.Category = strings.ToLower(strings.TrimSpace(req.Category))
	if !validNotifCategories[req.Category] {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Kategori tidak dikenal"})
	}
	if err := h.Prefs.SetPreference(userID, req.Category, req.Enabled); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan preferensi"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
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

	// Kabari orang tua + kirim push (hormati preferensi kategori absensi).
	if h.Notifications != nil {
		label := "disetujui"
		nType := "success"
		if req.Status == "rejected" {
			label = "ditolak"
			nType = "warning"
		}
		// Cek preferensi ortu sebelum kirim.
		sendNotif := true
		if h.Prefs != nil {
			sendNotif = len(h.Prefs.FilterEnabled([]string{lr.ParentUserID}, "absensi")) > 0
		}
		if sendNotif {
			_ = h.Notifications.CreateNotification(models.Notification{
				UserID:    &lr.ParentUserID,
				Type:      nType,
				Category:  "absensi",
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
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ============ Tabungan anak (portal ortu) ============

// GetChildSavings mengembalikan saldo + riwayat transaksi tabungan anak.
func (h *ParentHandler) GetChildSavings(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	studentID := strings.TrimSpace(c.Param("studentId"))
	if studentID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "studentId wajib diisi"})
	}
	ok, err := h.Repo.IsParentOf(userID, studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if !ok {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Siswa bukan anak Anda"})
	}

	// Ambil saldo.
	var balance int
	_ = h.Repo.DB.QueryRow(`SELECT COALESCE(saldo_terakhir, 0) FROM tabungan_siswa WHERE student_id = ?`, studentID).Scan(&balance)

	// Ambil 20 transaksi terakhir.
	rows, err := h.Repo.DB.Query(`
		SELECT t.id, t.tipe, t.nominal, t.status, t.catatan, t.created_at
		FROM tabungan_transaksi t
		WHERE t.siswa_id = ? AND t.status = 'verified'
		ORDER BY t.created_at DESC
		LIMIT 20
	`, studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	defer rows.Close()

	type txItem struct {
		ID        string `json:"id"`
		Tipe      string `json:"tipe"`
		Nominal   int    `json:"nominal"`
		Status    string `json:"status"`
		Catatan   string `json:"catatan"`
		CreatedAt int64  `json:"createdAt"`
	}
	txList := make([]txItem, 0)
	for rows.Next() {
		var t txItem
		var cat sql.NullString
		var crAt sql.NullInt64
		if err := rows.Scan(&t.ID, &t.Tipe, &t.Nominal, &t.Status, &cat, &crAt); err != nil {
			continue
		}
		if cat.Valid {
			t.Catatan = cat.String
		}
		if crAt.Valid {
			t.CreatedAt = crAt.Int64
		}
		txList = append(txList, t)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"balance":      balance,
			"transactions": txList,
		},
	})
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

// ============ Presensi anak (portal ortu) ============

// GetChildAttendance rekap presensi + riwayat terbaru milik anak ortu yang login.
// Query studentId opsional; tanpa itu pakai anak pertama ( UX kartu anak).
func (h *ParentHandler) GetChildAttendance(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	studentID := strings.TrimSpace(c.QueryParam("studentId"))

	if studentID != "" {
		ok, err := h.Repo.IsParentOf(userID, studentID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
		}
		if !ok {
			return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Siswa bukan anak Anda"})
		}
	} else {
		children, err := h.Repo.GetChildrenByUser(userID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
		}
		if len(children) == 0 {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Belum ada anak yang tertaut"})
		}
		studentID = children[0].StudentID
	}

	// Ringkasan per tahun ajaran + riwayat terbaru + rekap mingguan (7 hari WIB).
	if h.Attendance != nil {
		summary, err := h.Attendance.GetStudentAttendanceSummary(studentID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
		}
		recent, err := h.Repo.GetRecentAttendance(studentID, 30)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
		}
		weekly, err := h.Repo.GetWeeklyAttendance(studentID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": map[string]interface{}{
			"summary": summary,
			"recent":  recent,
			"weekly":  weekly,
		}})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": map[string]interface{}{
		"summary": []map[string]interface{}{},
		"recent":  []map[string]interface{}{},
		"weekly":  []map[string]interface{}{},
	}})
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

// ===== Mutasi Keluar (portal orang tua) =====
//
// Pengajuan pindah sekolah untuk anak yang tertaut. Berbeda dengan versi
// publik lama (NISN + tanggal lahir), di sini ke pemilikan sudah diverifikasi
// lewat parent_students, jadi ortu cukup pilih anak dan isi tujuan.

func (h *ParentHandler) ListMutasiOut(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	list, err := h.Mutasi.ListMutasiOutByParentUser(userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

func (h *ParentHandler) CreateMutasiOut(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	var req struct {
		StudentID         string `json:"studentId"`
		DestinationSchool string `json:"destinationSchool"`
		DestinationClass  string `json:"destinationClass"`
		Reason            string `json:"reason"`
		ReasonDetail      string `json:"reasonDetail"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data tidak valid"})
	}

	req.StudentID = strings.TrimSpace(req.StudentID)
	req.DestinationSchool = strings.TrimSpace(req.DestinationSchool)
	req.DestinationClass = strings.TrimSpace(req.DestinationClass)
	req.Reason = strings.TrimSpace(req.Reason)
	req.ReasonDetail = strings.TrimSpace(req.ReasonDetail)

	if req.StudentID == "" || req.DestinationSchool == "" || req.Reason == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Sekolah tujuan dan alasan wajib diisi"})
	}
	if req.Reason != "domisili" && req.Reason != "tugas_orangtua" && req.Reason != "lainnya" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Alasan tidak valid"})
	}
	if req.Reason == "lainnya" && req.ReasonDetail == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Detail alasan wajib diisi"})
	}

	// Hanya boleh mengajukan untuk anak yang tertaut ke akun ini.
	ok, err := h.Repo.IsParentOf(userID, req.StudentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if !ok {
		return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Siswa bukan anak Anda"})
	}

	// Cegah pengajuan ganda: masih ada permohonan yang belum selesai.
	active, err := h.Mutasi.HasActiveMutasiOut(req.StudentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if active {
		return c.JSON(http.StatusConflict, map[string]interface{}{"success": false, "error": "Masih ada permohonan mutasi yang sedang diproses untuk anak ini"})
	}

	m := models.MutasiOutRequest{
		StudentID:         req.StudentID,
		DestinationSchool: req.DestinationSchool,
		Reason:            req.Reason,
	}
	if req.DestinationClass != "" {
		m.DestinationClass = &req.DestinationClass
	}
	if req.ReasonDetail != "" {
		m.ReasonDetail = &req.ReasonDetail
	}

	if err := h.Mutasi.CreateMutasiOutRequest(m); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal membuat permohonan"})
	}

	// Notifikasi admin: permohonan mutasi keluar baru dari portal ortu.
	if h.Notifications != nil {
		_ = h.Notifications.NotifyRoles(models.Notification{
			Type:      "info",
			Category:  "mutasi",
			Title:     "Permohonan mutasi keluar baru",
			Message:   "Pengajuan dari portal orang tua menunggu penyelesaian surat.",
			TargetURL: StrPtr("/admin/siswa/mutasi"),
		}, "admin", "superadmin")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}
