package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type KurikulumHandler struct {
	Repo *repository.KurikulumRepository
}

func NewKurikulumHandler(repo *repository.KurikulumRepository) *KurikulumHandler {
	return &KurikulumHandler{Repo: repo}
}

func (h *KurikulumHandler) ListKurikulum(c echo.Context) error {
	onlyActive := c.QueryParam("active") == "true"
	list, err := h.Repo.List(onlyActive)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memuat daftar kurikulum",
		})
	}
	if list == nil {
		list = []models.Kurikulum{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    list,
	})
}

func (h *KurikulumHandler) CreateKurikulum(c echo.Context) error {
	var req models.CreateKurikulumRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}
	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Nama kurikulum wajib diisi",
		})
	}
	k, err := h.Repo.Create(&req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal membuat kurikulum: " + err.Error(),
		})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    k,
	})
}

func (h *KurikulumHandler) UpdateKurikulum(c echo.Context) error {
	id := c.Param("id")
	var req models.UpdateKurikulumRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}
	k, err := h.Repo.Update(id, &req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memperbarui kurikulum",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    k,
	})
}

func (h *KurikulumHandler) DeleteKurikulum(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.Delete(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menghapus kurikulum",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Kurikulum berhasil dihapus",
	})
}
