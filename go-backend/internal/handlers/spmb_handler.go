package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type SPMBHandler struct {
	Repo *repository.SPMBRepository
}

func NewSPMBHandler(repo *repository.SPMBRepository) *SPMBHandler {
	return &SPMBHandler{Repo: repo}
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

func (h *SPMBHandler) CreatePeriod(c echo.Context) error {
	var req models.CreateSPMBPeriodRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Format data tidak valid",
		})
	}

	var quotaInt int
	switch v := req.Quota.(type) {
	case float64:
		quotaInt = int(v)
	case string:
		fmt.Sscanf(v, "%d", &quotaInt)
	case int:
		quotaInt = v
	default:
		quotaInt = 0
	}

	sd, err := time.Parse(time.RFC3339, req.StartDate)
	if err != nil {
		sd, err = time.Parse("2006-01-02T15:04:05.999Z", req.StartDate)
		if err != nil {
			// Fallback to simpler format if sent by a simple input[type=date]
			sd, err = time.Parse("2006-01-02", req.StartDate)
			if err != nil {
				return c.JSON(http.StatusBadRequest, map[string]interface{}{
					"success": false,
					"error":   "Format tanggal awal tidak valid",
				})
			}
		}
	}

	ed, err := time.Parse(time.RFC3339, req.EndDate)
	if err != nil {
		ed, err = time.Parse("2006-01-02T15:04:05.999Z", req.EndDate)
		if err != nil {
			ed, err = time.Parse("2006-01-02", req.EndDate)
			if err != nil {
				return c.JSON(http.StatusBadRequest, map[string]interface{}{
					"success": false,
					"error":   "Format tanggal akhir tidak valid",
				})
			}
		}
	}

	period, err := h.Repo.CreatePeriod(req, sd, ed, quotaInt)
	if err != nil {
		c.Logger().Error("Failed to create period:", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal membuat periode",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    period,
	})
}
