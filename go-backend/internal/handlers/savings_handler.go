package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/notify"
	"github.com/sekolahku/go-backend/internal/repository"
)

type SavingsHandler struct {
	Repo          *repository.SavingsRepository
	Notifications *repository.NotificationRepository
	// ParentNotify mengabari orang tua saat saldo tabungan anak berubah
	// (transaksi diverifikasi bendahara). Kosong = nonaktif (mis. di test).
	ParentNotify *notify.ParentNotifier
}

func NewSavingsHandler(repo *repository.SavingsRepository, notifications *repository.NotificationRepository, parentNotify *notify.ParentNotifier) *SavingsHandler {
	return &SavingsHandler{Repo: repo, Notifications: notifications, ParentNotify: parentNotify}
}

// ============ Siswa (Student Savings) ============

func (h *SavingsHandler) GetSiswa(c echo.Context) error {
	if qrCode := c.QueryParam("qrCode"); qrCode != "" {
		s, err := h.Repo.GetSiswaByQR(qrCode)
		if err != nil || s == nil {
			return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": []models.TabunganSiswa{}, "items": []models.TabunganSiswa{}, "totalPages": 1})
		}
		list := []models.TabunganSiswa{*s}
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "items": list, "totalPages": 1, "totalItems": 1})
	}

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit, _ = strconv.Atoi(c.QueryParam("perPage"))
	}
	if limit < 1 {
		limit = 20
	}
	search := c.QueryParam("search")
	classId := c.QueryParam("classId")
	if classId == "" {
		classId = c.QueryParam("kelasId")
	}

	// Guru dipaksa hanya melihat siswa kelas yang ia wali-kan;
	// parameter classId dari frontend diabaikan demi konsistensi
	// dengan scoping di /api/classes dan presensi.
	if role, _ := c.Get("user_role").(string); role == "guru" {
		userID, _ := c.Get("user_id").(string)
		var forced, forcedName string
		err := h.Repo.DB.QueryRow(
			`SELECT id, name FROM student_classes WHERE wali_user_id = ? AND is_active = 1`, userID,
		).Scan(&forced, &forcedName)
		if err != nil {
			// Guru tanpa wali kelas: kosongkan filter supaya tidak
			// justru menampilkan semua siswa.
			classId = "__no_wali__"
		} else {
			classId = forced
		}
	}

	list, total, err := h.Repo.GetSiswa(page, limit, search, classId)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	totalPages := (total + limit - 1) / limit
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"data":       list,
		"items":      list,
		"totalItems": total,
		"totalPages": totalPages,
		"pagination": map[string]interface{}{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"totalPages": totalPages,
		},
	})
}

func (h *SavingsHandler) GetDetailSiswa(c echo.Context) error {
	id := c.Param("id")
	s, err := h.Repo.GetSiswaByQR(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if s == nil {
		var studentID string
		var isActive int
		var status string
		err = h.Repo.DB.QueryRow(`
			SELECT id, is_active, COALESCE(status, '') 
			FROM students 
			WHERE id = ? OR nisn = ? OR qr_code = ?
		`, id, id, id).Scan(&studentID, &isActive, &status)
		if err == nil && (isActive == 1 || status == "active" || status == "aktif") {
			_ = repository.AutoSyncStudentToSavingsAndLibrary(h.Repo.DB, studentID)
			s, err = h.Repo.GetSiswaByQR(id)
			if err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
			}
		}
	}
	if s == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Siswa tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": s})
}

func (h *SavingsHandler) SyncSavings(c echo.Context) error {
	count, err := h.Repo.SyncFromStudents()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": strconv.Itoa(count) + " siswa berhasil disinkronisasi ke Tabungan",
		"count":   count,
	})
}

func (h *SavingsHandler) CreateSiswa(c echo.Context) error {
	return c.JSON(http.StatusGone, map[string]interface{}{
		"success": false,
		"error":   "Data siswa kini dikelola di Manajemen Siswa (single source). Siswa baru otomatis mendapat rekening tabungan.",
	})
}

func (h *SavingsHandler) UpdateSiswa(c echo.Context) error {
	return c.JSON(http.StatusGone, map[string]interface{}{
		"success": false,
		"error":   "Data siswa kini dikelola di Manajemen Siswa (single source). Perubahan otomatis tampil di Tabungan.",
	})
}

func (h *SavingsHandler) DeleteSiswa(c echo.Context) error {
	if err := h.Repo.DeleteSiswa(c.Param("id")); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Siswa tabungan dinonaktifkan"})
}

func (h *SavingsHandler) CheckPublicBalance(c echo.Context) error {
	var req struct {
		Identifier string `json:"identifier"`
		BirthDate  string `json:"birthDate"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	s, err := h.Repo.GetPublicBalance(req.Identifier, req.BirthDate)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Data siswa tidak ditemukan atau data tidak cocok"})
	}
	if s == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Data siswa tidak ditemukan atau data tidak cocok"})
	}
	className := "-"
	if s.Kelas != nil {
		className = s.Kelas.Nama
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"name":       s.Nama,
			"className":  className,
			"balance":    s.SaldoTerakhir,
			"lastUpdate": s.UpdatedAt,
		},
	})
}

// statementMonthRange mengubah "YYYY-MM" jadi rentang [awal, akhir] bulan.
// Bulan kosong berarti bulan berjalan (waktu Jakarta).
func statementMonthRange(month string) (string, string, error) {
	month = strings.TrimSpace(month)
	if month == "" {
		loc, err := time.LoadLocation("Asia/Jakarta")
		if err != nil {
			loc = time.UTC
		}
		month = time.Now().In(loc).Format("2006-01")
	}
	t, err := time.Parse("2006-01", month)
	if err != nil {
		return "", "", errors.New("format bulan tidak valid (YYYY-MM)")
	}
	start := t.Format("2006-01-02")
	end := time.Date(t.Year(), t.Month()+1, 0, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	return start, end, nil
}

// GetPublicStatement menyediakan rekening koran untuk orang tua/siswa tanpa
// login. Identitas diverifikasi lewat NISN/NIS/QR + tanggal lahir — persis
// pola CheckPublicBalance — lalu mutasi disusun ulang oleh GetStatement.
// Dulu layanan ini hanya tautan menu yang menunj rute tak bernama (404).
func (h *SavingsHandler) GetPublicStatement(c echo.Context) error {
	var req struct {
		Identifier string `json:"identifier"`
		BirthDate  string `json:"birthDate"`
		Month      string `json:"month"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	identifier := strings.TrimSpace(req.Identifier)
	birthDate := strings.TrimSpace(req.BirthDate)
	if identifier == "" || birthDate == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "NISN dan tanggal lahir wajib diisi"})
	}
	if _, err := time.Parse("2006-01-02", birthDate); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Format tanggal lahir tidak valid"})
	}
	startDate, endDate, err := statementMonthRange(req.Month)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	s, err := h.Repo.GetPublicBalance(identifier, birthDate)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	if s == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Data siswa tidak ditemukan atau data tidak cocok"})
	}
	st, err := h.Repo.GetStatement(s.ID, startDate, endDate)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	if st == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Data siswa tidak ditemukan atau data tidak cocok"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": st})
}
