package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/middleware"
	"github.com/sekolahku/go-backend/internal/repository"
)

type DashboardHandler struct {
	Repo *repository.DashboardRepository
}

func NewDashboardHandler(repo *repository.DashboardRepository) *DashboardHandler {
	return &DashboardHandler{Repo: repo}
}

const dashboardStatsCacheKey = "handler:dashboard:stats"

func (h *DashboardHandler) GetStats(c echo.Context) error {
	// ponytail: statistik berat (±12 query) di-cache 60 detik; dashboard boleh basi 1 menit
	if data, ok := middleware.CacheGet(dashboardStatsCacheKey); ok {
		c.Response().Header().Set("X-Cache", "HIT")
		return c.JSONBlob(http.StatusOK, data)
	}

	stats, err := h.Repo.GetDashboardStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Terjadi kesalahan internal",
		})
	}

	resp := map[string]interface{}{
		"success": true,
		"data":    stats,
	}
	if blob, err := json.Marshal(resp); err == nil {
		middleware.CacheSet(dashboardStatsCacheKey, blob, 60*time.Second)
	}
	return c.JSON(http.StatusOK, resp)
}

func (h *DashboardHandler) GetHealth(c echo.Context) error {
	health, err := h.Repo.GetSystemHealth()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Terjadi kesalahan internal",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    health,
	})
}
