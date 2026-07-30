package handlers

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/middleware"
	"github.com/sekolahku/go-backend/internal/models"
)

// Period management

func (h *SPMBHandler) GetActivePeriod(c echo.Context) error {
	period, err := h.Repo.GetActivePeriod()
	if err != nil {
		c.Logger().Error("Failed to get active period:", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal mengambil data periode aktif",
		})
	}

	isOpen := false
	if period != nil {
		now := time.Now()
		if period.StartDate != nil && period.EndDate != nil {
			if now.After(*period.StartDate) && now.Before(*period.EndDate) {
				isOpen = true
			}
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"period":  period,
		"isOpen":  isOpen,
	})
}

func (h *SPMBHandler) GetPeriods(c echo.Context) error {
	periods, err := h.Repo.GetPeriods()
	if err != nil {
		c.Logger().Error("Failed to get periods:", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal mengambil data periode",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    periods,
	})
}

func (h *SPMBHandler) CreatePeriod(c echo.Context) error {
	var req models.CreateSPMBPeriodRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Format data tidak valid",
		})
	}
	period, err := h.Repo.CreatePeriod(req)
	if err != nil {
		c.Logger().Error("Failed to create period:", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal membuat periode",
		})
	}

	middleware.CacheInvalidate("/api/public/spmb/landing")
	middleware.CacheInvalidate("/api/public/spmb/registrants")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    period,
	})
}

func (h *SPMBHandler) UpdatePeriod(c echo.Context) error {
	id := c.Param("id")
	var req models.UpdateSPMBPeriodRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.UpdatePeriod(id, req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	middleware.CacheInvalidate("/api/public/spmb/landing")
	middleware.CacheInvalidate("/api/public/spmb/registrants")

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SPMBHandler) DeletePeriod(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeletePeriod(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	middleware.CacheInvalidate("/api/public/spmb/landing")
	middleware.CacheInvalidate("/api/public/spmb/registrants")

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
