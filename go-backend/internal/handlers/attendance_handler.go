package handlers

import (
	"bytes"
	"encoding/csv"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type AttendanceHandler struct {
	Repo *repository.AttendanceRepository
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

func (h *AttendanceHandler) GetSessions(c echo.Context) error {
	date := c.QueryParam("date")
	status := c.QueryParam("status")
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))

	sessions, total, err := h.Repo.GetSessions(date, status, page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true, "data": sessions, "total": total, "page": page, "perPage": perPage,
	})
}

func (h *AttendanceHandler) CreateSession(c echo.Context) error {
	var req models.CreateAttendanceSessionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	id, err := h.Repo.CreateSession(req)
	if err != nil {
		if err.Error() == "CONFLICT" {
			return c.JSON(http.StatusConflict, map[string]interface{}{
				"success":  false,
				"error":    "Sesi untuk kelas ini sudah ada hari ini",
				"existing": map[string]string{"id": id},
			})
		}
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *AttendanceHandler) GetSessionByID(c echo.Context) error {
	id := c.Param("id")
	session, err := h.Repo.GetSessionByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Sesi tidak ditemukan"})
	}

	var hadir, sakit, izin, alpha int
	for _, r := range session.Records {
		switch r.Status {
		case "hadir":
			hadir++
		case "sakit":
			sakit++
		case "izin":
			izin++
		case "alpha":
			alpha++
		}
	}

	belumAbsen := len(session.AllStudents) - len(session.Records)
	if belumAbsen < 0 {
		belumAbsen = 0
	}

	res := map[string]interface{}{
		"id":          session.ID,
		"date":        session.Date,
		"className":   session.ClassName,
		"teacherName": session.TeacherName,
		"status":      session.Status,
		"notes":       session.Notes,
		"openedAt":    session.OpenedAt,
		"closedAt":    session.ClosedAt,
		"records":     session.Records,
		"allStudents": session.AllStudents,
		"stats": map[string]interface{}{
			"total":      len(session.AllStudents),
			"hadir":      hadir,
			"sakit":      sakit,
			"izin":       izin,
			"alpha":      alpha,
			"belumAbsen": belumAbsen,
		},
	}

	return c.JSON(http.StatusOK, res)
}

func (h *AttendanceHandler) UpdateSession(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Status string `json:"status"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	if err := h.Repo.UpdateSessionStatus(id, req.Status); err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "tidak valid") || strings.Contains(err.Error(), "tidak ditemukan") {
			status = http.StatusBadRequest
		}
		return c.JSON(status, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AttendanceHandler) RecordManual(c echo.Context) error {
	var req models.AttendanceManualRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	if err := h.Repo.RecordManual(req); err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "tidak valid") ||
			strings.Contains(err.Error(), "harus") ||
			strings.Contains(err.Error(), "ditutup") ||
			strings.Contains(err.Error(), "ditemukan") ||
			strings.Contains(err.Error(), "bukan kelas") {
			status = http.StatusBadRequest
		}
		return c.JSON(status, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AttendanceHandler) ScanQR(c echo.Context) error {
	var req models.AttendanceScanRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	res, err := h.Repo.RecordQRScan(req)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "Siswa sudah diabsen" {
			status = http.StatusConflict
		} else if err.Error() == "Siswa tidak ditemukan" || err.Error() == "Tidak ada sesi aktif untuk kelas ini" || err.Error() == "Sesi tidak ditemukan" {
			status = http.StatusNotFound
		} else if strings.Contains(err.Error(), "tidak valid") ||
			strings.Contains(err.Error(), "kosong") ||
			strings.Contains(err.Error(), "ditutup") ||
			strings.Contains(err.Error(), "belum memiliki kelas") ||
			strings.Contains(err.Error(), "bukan kelas") {
			status = http.StatusBadRequest
		}

		var student interface{}
		if res != nil {
			student = res.Student
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

	res, err := h.Repo.RecordQRScan(models.AttendanceScanRequest{QRCode: req.QRCode})
	if err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":           false,
			"attendanceRecorded": false,
			"error":             "Gagal merekam presensi",
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
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
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
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
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

// GetStudentSummary returns attendance summary per academic year for a student
func (h *AttendanceHandler) GetStudentSummary(c echo.Context) error {
	studentID := c.Param("studentId")
	if studentID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "studentId diperlukan"})
	}

	summary, err := h.Repo.GetStudentAttendanceSummary(studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    summary,
	})
}
