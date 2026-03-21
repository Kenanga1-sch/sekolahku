package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type EOfficeHandler struct {
	Repo *repository.EOfficeRepository
}

func NewEOfficeHandler(repo *repository.EOfficeRepository) *EOfficeHandler {
	return &EOfficeHandler{Repo: repo}
}

func (h *EOfficeHandler) Numbering(c echo.Context) error {
	var req models.NumberingRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	nextSeq, err := h.Repo.CalculateNextLetterSequence(req)
	if err != nil {
		c.Logger().Error("Failed to calculate numbering:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, models.NumberingResponse{NextSequence: nextSeq})
}

func (h *EOfficeHandler) Increment(c echo.Context) error {
	var req models.IncrementRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	if err := h.Repo.IncrementLetterSequence(req); err != nil {
		c.Logger().Error("Failed to increment numbering:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":     true,
		"newSequence": req.SequenceNumber,
	})
}

func (h *EOfficeHandler) GetPublicAnnouncements(c echo.Context) error {
	list, err := h.Repo.GetAnnouncements(false) // Public only sees published
	if err != nil {
		c.Logger().Error("Failed to fetch announcements:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, list)
}
