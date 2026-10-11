package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
)

// AttendanceGTKHandler mengelola presensi GTK (guru & tenaga kependidikan)
// lewat scan kartu GTK — terpisah dari presensi siswa (tanpa sesi/kelas).
//
// Sejak 000084 hanya GTK non-ASN + Pembina Ekskul yang wajib presensi;
// PNS/PPPK dikecualikan. Scan divalidasi radius lokasi (haversine).
type AttendanceGTKHandler struct {
	Repo *repository.AttendanceGTKRepository
}

func NewAttendanceGTKHandler(repo *repository.AttendanceGTKRepository) *AttendanceGTKHandler {
	return &AttendanceGTKHandler{Repo: repo}
}

// ScanGTK: POST /gtk-attendance/scan — rekam hadir (idempotent per hari),
// dengan validasi radius lokasi bila latitude/longitude dikirim.
func (h *AttendanceGTKHandler) ScanGTK(c echo.Context) error {
	var req struct {
		QRCode            string   `json:"qrCode"`
		Status            string   `json:"status"`
		RecordedBy        string   `json:"recordedBy"`
		Latitude          *float64 `json:"latitude"`
		Longitude         *float64 `json:"longitude"`
		PointID           *string  `json:"pointId"`
		ExtracurricularID *string  `json:"extracurricularId"`
		OverrideRadius    bool     `json:"overrideRadius"`
		OverrideReason    string   `json:"overrideReason"`
	}
	if err := c.Bind(&req); err != nil || req.QRCode == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "QR code tidak valid"})
	}
	if req.RecordedBy == "" {
		req.RecordedBy, _ = c.Get("user_id").(string)
	}

	// Override radius hanya untuk admin/bendahara + alasan wajib.
	if req.OverrideRadius {
		role, _ := c.Get("user_role").(string)
		if !isBendaharaRole(role) {
			req.OverrideRadius = false
		}
		if strings.TrimSpace(req.OverrideReason) == "" {
			req.OverrideRadius = false
		}
	}

	outcome, err := h.Repo.ScanGTK(repository.ScanGTKRequest{
		QRCode:            req.QRCode,
		Status:            req.Status,
		RecordedBy:        req.RecordedBy,
		Latitude:          req.Latitude,
		Longitude:         req.Longitude,
		PointID:           req.PointID,
		ExtracurricularID: req.ExtracurricularID,
		OverrideRadius:    req.OverrideRadius,
		OverrideReason:    req.OverrideReason,
	})
	if err != nil {
		switch {
		case errors.Is(err, repository.ErrStudentNotFound):
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Kartu GTK tidak dikenali"})
		case errors.Is(err, repository.ErrInvalidStatus):
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Status presensi tidak valid"})
		case errors.Is(err, repository.ErrNotAttendanceRequired):
			return c.JSON(http.StatusForbidden, map[string]interface{}{
				"success": false,
				"error":   "GTK berstatus PNS/PPPK/P3K tidak wajib presensi",
			})
		case errors.Is(err, repository.ErrOutOfRadius):
			return c.JSON(http.StatusUnprocessableEntity, map[string]interface{}{
				"success": false,
				"error":   "Lokasi Anda di luar radius presensi",
				"data": map[string]interface{}{
					"distanceM": outcome.DistanceM,
					"pointName": outcome.PointName,
				},
			})
		default:
			c.Logger().Error("ScanGTK: ", err)
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
		}
	}

	msg := "Kehadiran GTK tercatat"
	if outcome.Already {
		msg = "GTK sudah tercatat hadir hari ini"
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"already":  outcome.Already,
		"employee": map[string]interface{}{"name": outcome.Name, "category": outcome.Category},
		"location": map[string]interface{}{
			"distanceM":    outcome.DistanceM,
			"withinRadius": outcome.WithinRad,
			"pointName":    outcome.PointName,
		},
		"message": msg,
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

// GetEkskulDaily: GET /gtk-attendance/ekskul?date= — rekap presensi ekskul harian.
func (h *AttendanceGTKHandler) GetEkskulDaily(c echo.Context) error {
	rows, err := h.Repo.GetEkskulDaily(c.QueryParam("date"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": rows})
}

// isBendaharaRole: superadmin/admin/bendahara boleh override radius.
func isBendaharaRole(role string) bool {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "superadmin", "admin", "bendahara":
		return true
	default:
		return false
	}
}

// ==========================================================================
// Titik presensi
// ==========================================================================

// ListPoints: GET /attendance/points
func (h *AttendanceGTKHandler) ListPoints(c echo.Context) error {
	points, err := h.Repo.ListPoints()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": points})
}

// CreatePoint: POST /attendance/points
func (h *AttendanceGTKHandler) CreatePoint(c echo.Context) error {
	var req struct {
		Name      string  `json:"name"`
		PointType string  `json:"pointType"`
		RefID     *string `json:"refId"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
		RadiusM   int     `json:"radiusM"`
		IsActive  *bool   `json:"isActive"`
	}
	if err := c.Bind(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Nama titik wajib diisi"})
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	radius := req.RadiusM
	if radius <= 0 {
		radius = 100
	}
	id, err := h.Repo.CreatePoint(req.Name, req.PointType, req.RefID, req.Latitude, req.Longitude, radius, active)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan titik"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "id": id})
}

// UpdatePoint: PUT /attendance/points/:id
func (h *AttendanceGTKHandler) UpdatePoint(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Name      string  `json:"name"`
		PointType string  `json:"pointType"`
		RefID     *string `json:"refId"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
		RadiusM   int     `json:"radiusM"`
		IsActive  *bool   `json:"isActive"`
	}
	if err := c.Bind(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Nama titik wajib diisi"})
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	radius := req.RadiusM
	if radius <= 0 {
		radius = 100
	}
	if err := h.Repo.UpdatePoint(id, req.Name, req.PointType, req.RefID, req.Latitude, req.Longitude, radius, active); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memperbarui titik"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// DeletePoint: DELETE /attendance/points/:id
func (h *AttendanceGTKHandler) DeletePoint(c echo.Context) error {
	if err := h.Repo.DeletePoint(c.Param("id")); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menghapus titik"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ==========================================================================
// Pengajar ekstrakurikuler
// ==========================================================================

// ListEkskul: GET /attendance/ekskul-teachers
func (h *AttendanceGTKHandler) ListEkskul(c echo.Context) error {
	rows, err := h.Repo.ListEkskulTeachers()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": rows})
}

// AssignEkskul: POST /attendance/ekskul-teachers
func (h *AttendanceGTKHandler) AssignEkskul(c echo.Context) error {
	var req struct {
		EmployeeID          string  `json:"employeeId"`
		ExtracurricularName string  `json:"extracurricularName"`
		Schedule            *string `json:"schedule"`
		PointID             *string `json:"pointId"`
		IsActive            *bool   `json:"isActive"`
	}
	if err := c.Bind(&req); err != nil || req.EmployeeID == "" || strings.TrimSpace(req.ExtracurricularName) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "GTK dan nama ekskul wajib diisi"})
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	id, err := h.Repo.AssignEkskul(req.EmployeeID, req.ExtracurricularName, req.Schedule, req.PointID, active)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan pengajar ekskul"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "id": id})
}

// UpdateEkskul: PUT /attendance/ekskul-teachers/:id
func (h *AttendanceGTKHandler) UpdateEkskul(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		ExtracurricularName string  `json:"extracurricularName"`
		Schedule            *string `json:"schedule"`
		PointID             *string `json:"pointId"`
		IsActive            *bool   `json:"isActive"`
	}
	if err := c.Bind(&req); err != nil || strings.TrimSpace(req.ExtracurricularName) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Nama ekskul wajib diisi"})
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	if err := h.Repo.UpdateEkskul(id, req.ExtracurricularName, req.Schedule, req.PointID, active); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memperbarui pengajar ekskul"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// RemoveEkskul: DELETE /attendance/ekskul-teachers/:id
func (h *AttendanceGTKHandler) RemoveEkskul(c echo.Context) error {
	if err := h.Repo.RemoveEkskul(c.Param("id")); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menghapus pengajar ekskul"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
