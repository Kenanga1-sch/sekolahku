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

// ComputerHandler melayani modul "Komputer Belajar" perpustakaan.
type ComputerHandler struct {
	Repo         *repository.ComputerRepository
	Notification *repository.NotificationRepository
	DB           *sql.DB
}

func NewComputerHandler(repo *repository.ComputerRepository, notif *repository.NotificationRepository, db *sql.DB) *ComputerHandler {
	return &ComputerHandler{Repo: repo, Notification: notif, DB: db}
}

// resolveStudentID: student_id dari user login (role siswa).
func (h *ComputerHandler) resolveStudentID(c echo.Context) (string, error) {
	userID, _ := c.Get("user_id").(string)
	var studentID string
	err := h.DB.QueryRow("SELECT COALESCE(student_id, '') FROM users WHERE id = ?", userID).Scan(&studentID)
	if err != nil {
		return "", err
	}
	if studentID == "" {
		return "", sql.ErrNoRows
	}
	return studentID, nil
}

func badRequest(c echo.Context, msg string) error {
	return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": msg})
}

// ================= Stasiun =================

func (h *ComputerHandler) ListStations(c echo.Context) error {
	stations, err := h.Repo.ListStations()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat komputer"})
	}
	// Sertakan sesi aktif supaya UI bisa menampilkan status "sedang dipakai".
	type stationView struct {
		models.ComputerStation
		ActiveSession *models.ComputerSession `json:"activeSession,omitempty"`
	}
	out := make([]stationView, 0, len(stations))
	for _, s := range stations {
		sv := stationView{ComputerStation: s}
		if sess, _ := h.Repo.GetActiveSessionByStation(s.ID); sess != nil {
			sv.ActiveSession = sess
		}
		out = append(out, sv)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": out})
}

func (h *ComputerHandler) CreateStation(c echo.Context) error {
	var req models.CreateComputerStationRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "Data tidak valid")
	}
	st, err := h.Repo.CreateStation(req)
	if err != nil {
		return badRequest(c, err.Error())
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "data": st})
}

func (h *ComputerHandler) UpdateStation(c echo.Context) error {
	var req models.CreateComputerStationRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "Data tidak valid")
	}
	if err := h.Repo.UpdateStation(c.Param("id"), req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memperbarui komputer"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *ComputerHandler) DeleteStation(c echo.Context) error {
	if err := h.Repo.DeleteStation(c.Param("id")); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menghapus komputer"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ================= Kuota =================

func (h *ComputerHandler) ListQuotaPolicies(c echo.Context) error {
	items, err := h.Repo.ListQuotaPolicies()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat kebijakan kuota"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": items})
}

func (h *ComputerHandler) SetQuotaPolicy(c echo.Context) error {
	var req models.SetQuotaPolicyRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "Data tidak valid")
	}
	if err := h.Repo.SetQuotaPolicy(models.ComputerQuotaPolicy{ClassName: req.ClassName, Minutes: req.Minutes}); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan kuota"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *ComputerHandler) ListQuotas(c echo.Context) error {
	items, err := h.Repo.ListQuotas(c.QueryParam("className"), 500)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat kuota siswa"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": items})
}

func (h *ComputerHandler) SetStudentQuota(c echo.Context) error {
	var req models.SetStudentQuotaRequest
	if err := c.Bind(&req); err != nil || req.StudentID == "" {
		return badRequest(c, "Data tidak valid")
	}
	if err := h.Repo.SetStudentQuota(req.StudentID, req.TotalMinutes); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan kuota siswa"})
	}
	q, _ := h.Repo.GetQuota(req.StudentID)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": q})
}

// GetMyQuota: siswa melihat sisa kuota sendiri.
func (h *ComputerHandler) GetMyQuota(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Akun tidak terhubung ke data siswa"})
	}
	q, err := h.Repo.GetQuota(studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat kuota"})
	}
	if q.StudentName == "" {
		_ = h.DB.QueryRow(`SELECT COALESCE(full_name,''), COALESCE(class_name,'') FROM students WHERE id = ?`, studentID).Scan(&q.StudentName, &q.ClassName)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": q})
}

// ================= Laporan baca =================

func (h *ComputerHandler) CreateReadingReport(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Akun tidak terhubung ke data siswa"})
	}
	var req models.CreateReadingReportRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "Data tidak valid")
	}
	report, err := h.Repo.CreateReadingReport(studentID, req)
	if err != nil {
		return badRequest(c, err.Error())
	}
	if h.Notification != nil {
		_ = h.Notification.NotifyRoles(models.Notification{
			Type:      "info",
			Category:  "perpustakaan",
			Title:     "Laporan baca baru",
			Message:   report.StudentName + " mengirim laporan baca buku \"" + report.BookTitle + "\" untuk diverifikasi.",
			TargetURL: StrPtr("/perpustakaan/komputer"),
		}, "admin", "superadmin", "guru", "staff")
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "data": report})
}

func (h *ComputerHandler) ListReadingReports(c echo.Context) error {
	items, err := h.Repo.ListReadingReports(c.QueryParam("status"), c.QueryParam("className"), 500)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat laporan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": items})
}

func (h *ComputerHandler) ListMyReadingReports(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Akun tidak terhubung ke data siswa"})
	}
	items, err := h.Repo.ListStudentReports(studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat laporan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": items})
}

func (h *ComputerHandler) ReviewReadingReport(c echo.Context) error {
	var req models.ReviewReadingReportRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "Data tidak valid")
	}
	reviewer, _ := c.Get("user_id").(string)
	if err := h.Repo.ReviewReadingReport(c.Param("id"), reviewer, req.Approve, req.Notes); err != nil {
		return c.JSON(http.StatusConflict, map[string]interface{}{"success": false, "error": err.Error()})
	}
	report, _ := h.Repo.GetReadingReport(c.Param("id"))
	if report != nil && h.Notification != nil {
		title := "Laporan baca disetujui"
		msg := "Laporan baca \"" + report.BookTitle + "\" telah disetujui. Kamu boleh memakai komputer belajar sesuai jadwal."
		if report.Status == "rejected" {
			title = "Laporan baca perlu diperbaiki"
			msg = "Laporan baca \"" + report.BookTitle + "\" belum disetujui."
			if strings.TrimSpace(report.ReviewNotes) != "" {
				msg += " Catatan guru: " + report.ReviewNotes
			}
		}
		// Notifikasi in-app ke siswa (user_id terkait student_id).
		if uid := h.userIDForStudent(report.StudentID); uid != "" {
			uidCopy := uid
			_ = h.Notification.CreateNotification(models.Notification{
				UserID:    &uidCopy,
				Type:      map[bool]string{true: "success", false: "warning"}[report.Status == "approved"],
				Category:  "perpustakaan",
				Title:     title,
				Message:   msg,
				TargetURL: StrPtr("/perpustakaan/saya/laporan-baca"),
			})
		}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": report})
}

func (h *ComputerHandler) userIDForStudent(studentID string) string {
	var uid string
	_ = h.DB.QueryRow(`SELECT id FROM users WHERE student_id = ? AND is_active = 1 LIMIT 1`, studentID).Scan(&uid)
	return uid
}

// ================= Booking =================

func (h *ComputerHandler) CreateBooking(c echo.Context) error {
	var req models.CreateComputerBookingRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "Data tidak valid")
	}
	creator, _ := c.Get("user_id").(string)
	// Bila reportId diisi, pastikan laporan sudah disetujui.
	if strings.TrimSpace(req.ReportID) != "" {
		rep, _ := h.Repo.GetReadingReport(req.ReportID)
		if rep == nil || rep.Status != "approved" {
			return badRequest(c, "Laporan baca belum disetujui; verifikasi laporan dulu sebelum booking")
		}
		if rep.StudentID != req.StudentID {
			return badRequest(c, "Laporan baca bukan milik siswa yang dipilih")
		}
	}
	booking, err := h.Repo.CreateBooking(req, creator)
	if err != nil {
		return badRequest(c, err.Error())
	}
	if h.Notification != nil {
		if uid := h.userIDForStudent(booking.StudentID); uid != "" {
			uidCopy := uid
			_ = h.Notification.CreateNotification(models.Notification{
				UserID:    &uidCopy,
				Type:      "info",
				Category:  "perpustakaan",
				Title:     "Jadwal komputer",
				Message:   "Kamu dijadwalkan memakai komputer " + booking.StationName + " selama " + strconv.Itoa(booking.PlannedMinutes) + " menit. Scan kartu di komputer pada waktunya.",
				TargetURL: StrPtr("/perpustakaan/saya/laporan-baca"),
			})
		}
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "data": booking})
}

func (h *ComputerHandler) ListBookings(c echo.Context) error {
	fromMs := parseMsQuery(c.QueryParam("from"))
	toMs := parseMsQuery(c.QueryParam("to"))
	items, err := h.Repo.ListBookings(fromMs, toMs, c.QueryParam("studentId"), c.QueryParam("stationId"), c.QueryParam("status"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat jadwal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": items})
}

func (h *ComputerHandler) ListMyBookings(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Akun tidak terhubung ke data siswa"})
	}
	items, err := h.Repo.ListBookings(0, 0, studentID, "", "")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat jadwal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": items})
}

func (h *ComputerHandler) CancelBooking(c echo.Context) error {
	if err := h.Repo.CancelBooking(c.Param("id")); err != nil {
		return c.JSON(http.StatusConflict, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ================= Sesi & kiosk =================

// StartSessionByScan: dipanggil dari kiosk komputer. Body: {code, stationCode}.
// Identitas siswa dari QR; stasiun dari kode URL. Bila ada booking aktif untuk
// siswa+stasiun ini, dipakai; jika tidak, sesi dibuat langsung (jika kuota ada).
func (h *ComputerHandler) StartSessionByScan(c echo.Context) error {
	var req struct {
		Code        string `json:"code"`
		StationCode string `json:"stationCode"`
	}
	if err := c.Bind(&req); err != nil || req.Code == "" || req.StationCode == "" {
		return badRequest(c, "Kode tidak valid")
	}
	station, err := h.Repo.GetStationByCode(req.StationCode)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if station == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Komputer tidak dikenali"})
	}
	h.Repo.TouchStation(station.ID)

	person, err := repository.ResolvePersonByCode(h.DB, req.Code)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Kartu tidak dikenali"})
	}
	if person.Kind != "student" {
		return badRequest(c, "Hanya kartu siswa yang dapat memakai komputer belajar")
	}

	// Cegah stasiun dipakai dua orang.
	if active, _ := h.Repo.GetActiveSessionByStation(station.ID); active != nil {
		if active.StudentID != person.StudentID {
			return c.JSON(http.StatusConflict, map[string]interface{}{"success": false, "error": "Komputer ini sedang dipakai siswa lain"})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": active})
	}

	// Cari booking siswa ini yang belum dimulai/aktif di stasiun ini.
	var booking *models.ComputerBooking
	if bookings, _ := h.Repo.ListBookings(0, 0, person.StudentID, station.ID, "booked"); len(bookings) > 0 {
		booking = &bookings[0]
	}

	session, err := h.Repo.StartSession(station.ID, person.StudentID, booking)
	if err != nil {
		return c.JSON(http.StatusConflict, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": session})
}

// GetStationSession: kiosk memantau sesi aktif + sisa waktu di stasiunnya.
func (h *ComputerHandler) GetStationSession(c echo.Context) error {
	station, err := h.Repo.GetStationByCode(c.Param("code"))
	if err != nil || station == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Komputer tidak dikenali"})
	}
	h.Repo.TouchStation(station.ID)
	session, err := h.Repo.GetActiveSessionByStation(station.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	resp := map[string]interface{}{
		"success": true,
		"station": map[string]interface{}{"id": station.ID, "code": station.Code, "name": station.Name},
		"session": session,
	}
	if session != nil {
		now := time.Now()
		resp["remainingSeconds"] = int(session.DeadlineAt.Sub(now).Seconds())
		resp["expired"] = !now.Before(session.DeadlineAt)
	}
	return c.JSON(http.StatusOK, resp)
}

// EndSession: menutup sesi (kiosk memanggil saat waktu habis atau petugas manual).
func (h *ComputerHandler) EndSession(c echo.Context) error {
	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.Bind(&req)
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		reason = "manual"
	}
	session, err := h.Repo.EndSession(c.Param("id"), reason)
	if err != nil {
		return c.JSON(http.StatusConflict, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": session})
}

// ListSessions: riwayat pemakaian untuk laporan.
func (h *ComputerHandler) ListSessions(c echo.Context) error {
	fromMs := parseMsQuery(c.QueryParam("from"))
	toMs := parseMsQuery(c.QueryParam("to"))
	items, err := h.Repo.ListSessions(fromMs, toMs, c.QueryParam("studentId"), c.QueryParam("stationId"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat riwayat"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": items})
}

func parseMsQuery(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil || v <= 0 {
		return 0
	}
	if v < 1e12 { // detik → ms
		return v * 1000
	}
	return v
}
