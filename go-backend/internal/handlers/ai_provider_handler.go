package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type AIProviderHandler struct {
	repo *repository.AIProviderRepository
}

func NewAIProviderHandler(repo *repository.AIProviderRepository) *AIProviderHandler {
	return &AIProviderHandler{repo: repo}
}

func (h *AIProviderHandler) GetAll(c echo.Context) error {
	list, err := h.repo.GetAll()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    list,
	})
}

func (h *AIProviderHandler) Create(c echo.Context) error {
	var req models.AIProviderRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Payload tidak valid"})
	}
	if req.Name == "" || req.ProviderType == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama dan Tipe Provider wajib diisi"})
	}

	res, err := h.repo.Create(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    res,
	})
}

func (h *AIProviderHandler) Update(c echo.Context) error {
	id := c.Param("id")
	var req models.AIProviderRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Payload tidak valid"})
	}

	res, err := h.repo.Update(id, req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    res,
	})
}

func (h *AIProviderHandler) Delete(c echo.Context) error {
	id := c.Param("id")
	if err := h.repo.Delete(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Provider AI berhasil dihapus",
	})
}
