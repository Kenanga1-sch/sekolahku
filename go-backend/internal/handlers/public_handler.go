package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
)

type PublicHandler struct {
	Repo *repository.PublicRepository
}

func NewPublicHandler(repo *repository.PublicRepository) *PublicHandler {
	return &PublicHandler{Repo: repo}
}

func (h *PublicHandler) GetHomepageData(c echo.Context) error {
	data, err := h.Repo.GetHomepageData()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"settings": data.Settings,
		"news":     data.News,
		"activePeriod": data.ActivePeriod,
		"stats":     data.Stats,
	})
}

func (h *PublicHandler) GetPublicStaff(c echo.Context) error {
	staff, err := h.Repo.GetPublicStaff()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": staff})
}

func (h *PublicHandler) GetPublicGallery(c echo.Context) error {
	cat := c.QueryParam("category")
	list, err := h.Repo.GetPublicGallery(cat)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": list})
}
