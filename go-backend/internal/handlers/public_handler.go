package handlers

import (
	"net/http"
	"strconv"

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
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))

	staff, total, err := h.Repo.GetPublicStaff(page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": staff, "total": total, "page": page, "perPage": perPage})
}

func (h *PublicHandler) GetPublicGallery(c echo.Context) error {
	cat := c.QueryParam("category")
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))

	list, total, err := h.Repo.GetPublicGallery(cat, page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "total": total, "page": page, "perPage": perPage})
}
