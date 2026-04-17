package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type ContactHandler struct {
	Repo *repository.ContactRepository
}

func NewContactHandler(repo *repository.ContactRepository) *ContactHandler {
	return &ContactHandler{Repo: repo}
}

func (h *ContactHandler) SubmitMessage(c echo.Context) error {
	var req models.SubmitContactRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Format data tidak valid",
		})
	}

	if req.Name == "" || req.Email == "" || req.Message == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Nama, Email, dan Pesan wajib diisi",
		})
	}

	id, err := h.Repo.CreateMessage(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal mengirim pesan: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]string{
			"id": id,
		},
	})
}

func (h *ContactHandler) ListMessages(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 { page = 1 }
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if perPage < 1 { perPage = 10 }

	messages, total, err := h.Repo.GetMessages(page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"items":      messages,
			"total":      total,
			"page":       page,
			"perPage":    perPage,
			"totalPages": (total + perPage - 1) / perPage,
		},
	})
}

func (h *ContactHandler) MarkAsRead(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.MarkAsRead(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *ContactHandler) DeleteMessage(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteMessage(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
