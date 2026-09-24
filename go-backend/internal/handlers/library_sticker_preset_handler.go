package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// StickerPresetHandler menangani preset tata letak stiker QR perpustakaan.
// Semua route terpasang di adminGroup (hanya admin).
type StickerPresetHandler struct {
	Repo *repository.LibraryStickerPresetRepository
}

func NewStickerPresetHandler(repo *repository.LibraryStickerPresetRepository) *StickerPresetHandler {
	return &StickerPresetHandler{Repo: repo}
}

// GetStickerPresets mengembalikan seluruh preset yang tersimpan.
func (h *StickerPresetHandler) GetStickerPresets(c echo.Context) error {
	presets, err := h.Repo.ListStickerPresets()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal memuat preset"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    presets,
	})
}

// CreateStickerPreset menyimpan preset baru.
func (h *StickerPresetHandler) CreateStickerPreset(c echo.Context) error {
	var input models.StickerPreset
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data tidak valid"})
	}

	preset, err := h.Repo.CreateStickerPreset(input, currentUserID(c))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    preset,
	})
}

// UpdateStickerPreset mengubah preset yang sudah ada.
func (h *StickerPresetHandler) UpdateStickerPreset(c echo.Context) error {
	id := c.Param("id")
	var input models.StickerPreset
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data tidak valid"})
	}

	preset, err := h.Repo.UpdateStickerPreset(id, input)
	if err != nil {
		if err.Error() == "preset tidak ditemukan" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    preset,
	})
}

// DeleteStickerPreset menghapus preset berdasarkan id.
func (h *StickerPresetHandler) DeleteStickerPreset(c echo.Context) error {
	if err := h.Repo.DeleteStickerPreset(c.Param("id")); err != nil {
		if err.Error() == "preset tidak ditemukan" {
			return c.JSON(http.StatusNotFound, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
