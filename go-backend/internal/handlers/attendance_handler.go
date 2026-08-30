package handlers

import (
	"bytes"
	"encoding/csv"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type AttendanceHandler struct {
	Repo   *repository.AttendanceRepository
	Holiday *repository.SchoolHolidayRepository
}

func NewAttendanceHandler(repo *repository.AttendanceRepository) *AttendanceHandler {
	return &AttendanceHandler{Repo: repo}
}

func (h *AttendanceHandler) GetStats(c echo.Context) error {
	stats, err := h.Repo.GetStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat statistik"})
	}
	return c.JSON(http.StatusOK, stats)
}

func (h *AttendanceHandler) GetDailyClass(c echo.Context) error {
	date := c.QueryParam("date")
	className := c.QueryParam("class")

	result, err := h.Repo.GetDailyClass(date, className)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	return c.JSON(http.StatusOK, result)
}

func (h *AttendanceHandler) RecordManual(c echo.Context) error {
	var req models.AttendanceManualRequestV2
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data tidak valid"})
	}

	if err := h.Repo.RecordManualV2(req); err != nil {
		status := http.StatusBadRequest
		if err == repository.ErrHoliday {
			status = http.StatusBadRequest
		}
		return c.JSON(status, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AttendanceHandler) ScanQR(c echo.Context) error {
	var req models.AttendanceScanRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data tidak valid"})
	}

	res, err := h.Repo.RecordQRScanV2(req)
	if err != nil {
		var student interface{}
		if res != nil {
			student = res.Student
		}
		status := http.StatusBadRequest
		if err == repository.ErrAlreadyRecorded {
			status = http.StatusConflict
		} else if err == repository.ErrStudentNotFound {
			status = http.StatusNotFound
		} else if err == repository.ErrHoliday {
			status = http.StatusBadRequest
		}
		return c.JSON(status, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
			"student": student,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"student": res.Student,
	})
}

func (h *AttendanceHandler) KioskRecordAttendance(c echo.Context) error {
	var req struct {
		QRCode string `json:"qrCode"`
	}
	if err := c.Bind(&req); err != nil || req.QRCode == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "QR Code diperlukan"})
	}

	res, err := h.Repo.RecordQRScanV2(models.AttendanceScanRequest{QRCode: req.QRCode})
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":            false,
			"attendanceRecorded": false,
			"error":              "Gagal merekam presensi",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":            true,
		"attendanceRecorded": true,
		"student":            res.Student,
	})
}

func (h *AttendanceHandler) GetReport(c echo.Context) error {
	startDate := c.QueryParam("startDate")
	endDate := c.QueryParam("endDate")
	className := c.QueryParam("class")

	if startDate == "" || endDate == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tanggal harus diisi"})
	}

	report, err := h.Repo.GetAttendanceReport(startDate, endDate, className)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	return c.JSON(http.StatusOK, report)
}

func (h *AttendanceHandler) ExportCSV(c echo.Context) error {
	startDate := c.QueryParam("startDate")
	endDate := c.QueryParam("endDate")
	className := c.QueryParam("class")

	if startDate == "" || endDate == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tanggal harus diisi"})
	}

	report, err := h.Repo.GetAttendanceReport(startDate, endDate, className)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	_ = writer.Write([]string{"Tanggal", "Kelas", "Nama Siswa", "NIS/NISN", "Status", "Waktu Check-In", "Metode"})
	for _, r := range report.Records {
		nis := ""
		if r.NIS != nil {
			nis = *r.NIS
		} else if r.NISN != nil {
			nis = *r.NISN
		}
		checkIn := "-"
		if r.CheckInTime != nil {
			checkIn = *r.CheckInTime
		}
		_ = writer.Write([]string{r.Date, r.ClassName, r.StudentName, nis, r.Status, checkIn, r.RecordMethod})
	}
	writer.Flush()

	c.Response().Header().Set("Content-Type", "text/csv")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=laporan-presensi.csv")
	return c.String(http.StatusOK, buf.String())
}

func (h *AttendanceHandler) GetStudentSummary(c echo.Context) error {
	studentID := c.Param("studentId")
	if studentID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "studentId diperlukan"})
	}

	summary, err := h.Repo.GetStudentAttendanceSummary(studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    summary,
	})
}

func (h *AttendanceHandler) CheckHoliday(c echo.Context) error {
	date := c.QueryParam("date")
	isHoliday, reason := repository.IsHoliday(date)
	return c.JSON(http.StatusOK, map[string]interface{}{
		"isHoliday": isHoliday,
		"reason":    reason,
	})
}

func (h *AttendanceHandler) ListSchoolHolidays(c echo.Context) error {
	items, err := h.Holiday.List()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat hari libur"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": items})
}

func (h *AttendanceHandler) CreateSchoolHoliday(c echo.Context) error {
	var hd repository.SchoolHoliday
	if err := c.Bind(&hd); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data tidak valid"})
	}
	if hd.Date == "" || hd.Title == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tanggal dan judul wajib diisi"})
	}
	if err := h.Holiday.Create(hd); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return c.JSON(http.StatusConflict, map[string]interface{}{"success": false, "error": "Tanggal sudah terdaftar sebagai hari libur"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menambah hari libur"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *AttendanceHandler) DeleteSchoolHoliday(c echo.Context) error {
	err := h.Holiday.Delete(c.Param("id"))
	if err != nil {
		if err.Error() == "hari libur tidak ditemukan" {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Hari libur tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menghapus hari libur"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}