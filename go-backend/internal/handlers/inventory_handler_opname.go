package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// ============ Opname (Stocktaking) ============

func (h *InventoryHandler) GetOpnames(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit = 20
	}
	items, total, err := h.Repo.GetOpnames(page, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      items,
		"totalItems": total,
	})
}

func (h *InventoryHandler) CreateOpname(c echo.Context) error {
	var payload inventoryOpnamePayload
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	date, err := parseInventoryDate(payload.Date)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	if date == nil {
		now := time.Now()
		date = &now
	}
	roomID := payload.RoomID
	if roomID == nil {
		roomID = payload.LegacyRoomID
	}
	auditorID := payload.AuditorID
	if auditorID == nil {
		auditorID = payload.LegacyAuditorID
	}
	if len(payload.Items) == 0 || string(payload.Items) == "null" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data item opname wajib diisi"})
	}
	o := models.InventoryOpname{
		Date:      *date,
		RoomID:    normalizeStringPtr(roomID),
		AuditorID: normalizeStringPtr(auditorID),
		Items:     string(payload.Items),
		Status:    "PENDING",
		Note:      normalizeStringPtr(payload.Note),
	}
	if err := h.Repo.CreateOpname(o); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *InventoryHandler) ApplyOpname(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.ApplyOpname(id); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, repository.ErrInventoryBusinessRule) {
			status = http.StatusBadRequest
		}
		return c.JSON(status, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ============ Audit Logs ============

func (h *InventoryHandler) GetAuditLogs(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit = 20
	}
	action := c.QueryParam("action")
	entity := c.QueryParam("entity")
	logs, total, err := h.Repo.GetAuditLogs(page, limit, action, entity)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      logs,
		"data":       logs,
		"totalItems": total,
		"totalPages": (total + limit - 1) / limit,
	})
}
