package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// SavingsGTKHandler mengelola rekening tabungan GTK (guru & tenaga
// kependidikan). Ringkas: lookup by scan, detail, list rekap, setor/tarik.
type SavingsGTKHandler struct {
	Repo *repository.SavingsGTKRepository
}

func NewSavingsGTKHandler(repo *repository.SavingsGTKRepository) *SavingsGTKHandler {
	return &SavingsGTKHandler{Repo: repo}
}

// GetGtkByQR: GET /tabungan/gtk?qrCode= — resolve kartu GTK → rekening (auto-create).
func (h *SavingsGTKHandler) GetGtkByQR(c echo.Context) error {
	code := c.QueryParam("qrCode")
	g, err := h.Repo.GetGtkByQR(code)
	if err != nil {
		c.Logger().Error("GetGtkByQR: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if g == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "GTK tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": g})
}

// GetGtkDetail: GET /tabungan/gtk/:id
func (h *SavingsGTKHandler) GetGtkDetail(c echo.Context) error {
	g, tx, err := h.Repo.GetGtkDetail(c.Param("id"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Rekening tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": g, "transactions": tx})
}

// GetGtkList: GET /tabungan/gtk?search=&page=&limit= — daftar rekap rekening GTK.
func (h *SavingsGTKHandler) GetGtkList(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit = 20
	}
	offset := (page - 1) * limit
	list, total, err := h.Repo.GetGtkList(c.QueryParam("search"), limit, offset)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	totalPages := 1
	if total > 0 {
		totalPages = (total + limit - 1) / limit
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true, "data": list, "total": total, "totalPages": totalPages, "page": page,
	})
}

// CreateGtkTransaksi: POST /tabungan/gtk/transaksi — setor/tarik (langsung).
func (h *SavingsGTKHandler) CreateGtkTransaksi(c echo.Context) error {
	var req models.CreateGtkTransaksiRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if req.UserID == "" {
		req.UserID, _ = c.Get("user_id").(string)
	}
	g, err := h.Repo.CreateGtkTransaksi(req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": g, "message": "Transaksi tabungan GTK tercatat"})
}
