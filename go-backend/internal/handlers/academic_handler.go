package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
)

type AcademicHandler struct {
	Repo *repository.AcademicRepository
}

func NewAcademicHandler(repo *repository.AcademicRepository) *AcademicHandler {
	return &AcademicHandler{Repo: repo}
}

func (h *AcademicHandler) GetActiveAcademicYear(c echo.Context) error {
	activeYear, err := h.Repo.GetActiveAcademicYear()
	
	if err != nil {
		c.Logger().Error("Failed to get active academic year:", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Failed to get active academic year",
		})
	}

	// Returns exactly what Next.js expects: { success: true, data: "2024/2025" }
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    activeYear,
	})
}
