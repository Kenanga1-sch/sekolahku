package handlers

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/shared"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/notify"
	"github.com/sekolahku/go-backend/internal/repository"
)

type AttendanceHandler struct {
	Repo    *repository.AttendanceRepository
	Holiday *repository.SchoolHolidayRepository
	// ParentNotify mengaburi orang tua saat anak tercatat hadir
	// (scan QR maupun absen manual oleh guru). Kosong = notifikasi ortu
	// nonaktif (mis. di test).
	ParentNotify *notify.ParentNotifier
}

func NewAttendanceHandler(repo *repository.AttendanceRepository, parentNotify *notify.ParentNotifier) *AttendanceHandler {
	return &AttendanceHandler{Repo: repo, ParentNotify: parentNotify}
}

func (h *AttendanceHandler) GetStats(c echo.Context) error {
	className, isGuru := h.forcedWaliClass(c)
	if isGuru && className == "" {
		// Guru tanpa wali kelas: tidak punya kelas yang boleh dilihat —
		// statistik kosong (konsisten dengan GetDailyClass/GetReport).
		return c.JSON(http.StatusOK, &models.AttendanceStats{Stats: models.DailyStats{}})
	}

	stats, err := h.Repo.GetStats(className)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat statistik"})
	}
	return c.JSON(http.StatusOK, stats)
}

// forcedWaliClass memaksa className ke kelas yang di-wali user guru.
// Mengembalikan className hasil paksaan dan true jika pemaksaan terjadi.
// Guru tanpa wali kelas → ("", true) supaya handler mengembalikan kosong.
func (h *AttendanceHandler) forcedWaliClass(c echo.Context) (string, bool) {
	role, _ := c.Get("user_role").(string)
	if role != "guru" {
		return "", false
	}
	userID, _ := c.Get("user_id").(string)
	var className string
	err := h.Repo.DB.QueryRow(
		`SELECT name FROM student_classes WHERE wali_user_id = ? AND is_active = 1`, userID,
	).Scan(&className)
	if err != nil {
		return "", true
	}
	return className, true
}

func (h *AttendanceHandler) GetDailyClass(c echo.Context) error {
	date := c.QueryParam("date")
	className := c.QueryParam("class")

	if forced, isGuru := h.forcedWaliClass(c); isGuru {
		className = forced
	}

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
		// Kegagalan DB dikirim 400 dengan err.Error() mentah — salah kode status
		// sekaligus membocorkan skema. Log di server, client dapat pesan generik.
		c.Logger().Errorf("gagal mencatat presensi manual: %v", err)
		return shared.InternalError(c)
	}

	h.notifyParentsOfAttendance(req.StudentID, req.Status, "manual")

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// notifyParentsOfAttendance mengabari orang tua siswa bahwa presensi
// anaknya baru saja tercatat. status: hadir/sakit/izin/alpha.
func (h *AttendanceHandler) notifyParentsOfAttendance(studentID, status, method string) {
	if h.ParentNotify == nil || h.ParentNotify.Parents == nil {
		return
	}

	studentName, className, err := h.ParentNotify.Parents.GetStudentBrief(studentID)
	if err != nil || studentName == "" {
		return
	}

	labels := map[string]string{
		"hadir": "telah hadir di sekolah",
		"sakit": "tercatat sakit",
		"izin":  "tercatat izin",
		"alpha": "tercatat tanpa keterangan (alpha)",
	}
	label, ok := labels[strings.ToLower(strings.TrimSpace(status))]
	if !ok {
		label = "tercatat " + status
	}

	title := "Presensi " + studentName
	body := studentName + " (" + className + ") " + label + " pada hari ini."
	h.ParentNotify.NotifyParentsOfStudent(
		studentID, "absensi", "attendance", title, body,
		"/parent/presensi", "attendance-"+studentID+"-"+repository.TodayJakarta(),
	)
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

	h.notifyParentsOfAttendance(scanResultStudentID(res), req.Status, "qr_scan")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"student": res.Student,
	})
}

// scanResultStudentID mengekstrak ID siswa dari payload Student ScanResult.
func scanResultStudentID(res *models.ScanResult) string {
	if res == nil {
		return ""
	}
	m, ok := res.Student.(map[string]interface{})
	if !ok {
		return ""
	}
	id, _ := m["id"].(string)
	return id
}

func (h *AttendanceHandler) KioskRecordAttendance(c echo.Context) error {
	var req struct {
		QRCode string `json:"qrCode"`
	}
	if err := c.Bind(&req); err != nil || req.QRCode == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "QR Code diperlukan"})
	}

	// Catat guru yang memindai (dari session JWT)
	recordedBy := "kiosk"
	if name, ok := c.Get("user_email").(string); ok && name != "" {
		recordedBy = name
	}

	res, err := h.Repo.RecordQRScanV2(models.AttendanceScanRequest{QRCode: req.QRCode, RecordedBy: recordedBy})
	if err != nil {
		if err == repository.ErrAlreadyRecorded || err == repository.ErrStudentNotFound ||
			err == repository.ErrNoClass || err == repository.ErrHoliday || err == repository.ErrInvalidStatus {
			var student interface{}
			if res != nil {
				student = res.Student
			}
			return c.JSON(http.StatusOK, map[string]interface{}{
				"success":            false,
				"attendanceRecorded": false,
				"error":              err.Error(),
				"student":            student,
			})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":            false,
			"attendanceRecorded": false,
			"error":              "Gagal merekam presensi",
		})
	}

	// QR kiosk default status "hadir" (normalizeAttendanceStatus).
	h.notifyParentsOfAttendance(scanResultStudentID(res), "", "qr_scan")

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

	if forced, isGuru := h.forcedWaliClass(c); isGuru {
		className = forced
	}

	if startDate == "" || endDate == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tanggal harus diisi"})
	}

	report, err := h.Repo.GetAttendanceReport(startDate, endDate, className)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	return c.JSON(http.StatusOK, report)
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

func (h *AttendanceHandler) UpdateSchoolHoliday(c echo.Context) error {
	var hd repository.SchoolHoliday
	if err := c.Bind(&hd); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Data tidak valid"})
	}
	if strings.TrimSpace(hd.Title) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Judul wajib diisi"})
	}
	if err := h.Holiday.Update(c.Param("id"), hd.Title, hd.Description); err != nil {
		if err.Error() == "hari libur tidak ditemukan" {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Hari libur tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memperbarui hari libur"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AttendanceHandler) GetNationalHolidays(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": repository.NationalHolidays()})
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
