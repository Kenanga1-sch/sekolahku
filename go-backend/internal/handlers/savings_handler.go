package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type SavingsHandler struct {
	Repo *repository.SavingsRepository
}

func NewSavingsHandler(repo *repository.SavingsRepository) *SavingsHandler {
	return &SavingsHandler{Repo: repo}
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
	var req models.CreateSiswaRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.CreateSiswa(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "message": "Siswa tabungan berhasil dibuat"})
}

func (h *SavingsHandler) UpdateSiswa(c echo.Context) error {
	var req models.CreateSiswaRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.UpdateSiswa(c.Param("id"), req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Siswa tabungan berhasil diperbarui"})
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
