package handlers

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type PrintSettingsHandler struct {
	repo *repository.PrintSettingsRepository
}

func NewPrintSettingsHandler(repo *repository.PrintSettingsRepository) *PrintSettingsHandler {
	return &PrintSettingsHandler{repo: repo}
}

// GetByModule mengembalikan pengaturan cetak sebuah modul (default bila belum ada).
func (h *PrintSettingsHandler) GetByModule(c echo.Context) error {
	module := strings.TrimSpace(c.Param("module"))
	if module == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Modul wajib diisi"})
	}
	s, err := h.repo.Get(module)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": s})
}

// Save menyimpan pengaturan cetak sebuah modul (admin).
func (h *PrintSettingsHandler) Save(c echo.Context) error {
	module := strings.TrimSpace(c.Param("module"))
	if module == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Modul wajib diisi"})
	}
	var body models.PrintSettings
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid request body"})
	}
	for _, m := range []float64{body.MarginTopMm, body.MarginBottomMm, body.MarginLeftMm, body.MarginRightMm} {
		if m < 0 || m > 50 {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Margin harus 0–50 mm"})
		}
	}
	if body.KeepRows < 0 || body.KeepRows > 100 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Jumlah baris ikut halaman 0–100"})
	}
	body.Module = module
	if err := h.repo.Save(&body); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	s, err := h.repo.Get(module)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": s})
}
