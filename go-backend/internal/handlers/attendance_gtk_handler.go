package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
)

// AttendanceGTKHandler mengelola presensi GTK (guru & tenaga kependidikan)
// lewat scan kartu GTK — terpisah dari presensi siswa (tanpa sesi/kelas).
type AttendanceGTKHandler struct {
	Repo *repository.AttendanceGTKRepository
}

func NewAttendanceGTKHandler(repo *repository.AttendanceGTKRepository) *AttendanceGTKHandler {
	return &AttendanceGTKHandler{Repo: repo}
}

// ScanGTK: POST /gtk-attendance/scan — rekam hadir (idempotent per hari).
func (h *AttendanceGTKHandler) ScanGTK(c echo.Context) error {
	var req struct {
		QRCode     string `json:"qrCode"`
		Status     string `json:"status"`
		RecordedBy string `json:"recordedBy"`
	}
	if err := c.Bind(&req); err != nil || req.QRCode == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "QR code tidak valid"})
	}
	if req.RecordedBy == "" {
		req.RecordedBy, _ = c.Get("user_id").(string)
	}

	name, category, already, _, err := h.Repo.ScanGTK(req.QRCode, req.Status, req.RecordedBy)
	if err != nil {
		if errors.Is(err, repository.ErrStudentNotFound) {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Kartu GTK tidak dikenali"})
		}
		if errors.Is(err, repository.ErrInvalidStatus) {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Status presensi tidak valid"})
		}
		c.Logger().Error("ScanGTK: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	msg := "Kehadiran GTK tercatat"
	if already {
		msg = "GTK sudah tercatat hadir hari ini"
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true, "already": already,
		"employee": map[string]interface{}{"name": name, "category": category},
		"message":  msg,
	})
}

// GetGTKDaily: GET /gtk-attendance/daily?date= — rekap hari ini (default).
func (h *AttendanceGTKHandler) GetGTKDaily(c echo.Context) error {
	rows, err := h.Repo.GetGTKDaily(c.QueryParam("date"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": rows})
}

// GetGTKReport: GET /gtk-attendance/report?start=&end= — rekap rentang tanggal.
func (h *AttendanceGTKHandler) GetGTKReport(c echo.Context) error {
	rows, err := h.Repo.GetGTKReport(c.QueryParam("start"), c.QueryParam("end"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": rows})
}
