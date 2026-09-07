package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
)

// ============ Opname (Stocktaking) ============

func (h *InventoryHandler) GetOpnames(c echo.Context) error {
	page, limit := inventoryPaging(c, 20)
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
	auditorID := payload.AuditorID
	if len(payload.Items) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data item opname wajib diisi"})
	}

	items := make([]models.InventoryOpnameItem, 0, len(payload.Items))
	for _, it := range payload.Items {
		assetID := it.AssetID
		if assetID == "" {
			assetID = it.ID
		}
		if assetID == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data aset opname tidak valid"})
		}
		items = append(items, models.InventoryOpnameItem{
			AssetID:             assetID,
			CountedGood:         it.QtyGood,
			CountedLightDamaged: it.QtyLightDamage,
			CountedHeavyDamaged: it.QtyHeavyDamage,
			CountedLost:         it.QtyLost,
			Note:                it.Note,
		})
	}

	o := models.InventoryOpname{
		Date:      *date,
		RoomID:    normalizeStringPtr(roomID),
		AuditorID: normalizeStringPtr(auditorID),
		Items:     items,
		Status:    "PENDING",
		Note:      normalizeStringPtr(payload.Note),
	}
	// Opname hanya untuk ruangan yang menjadi tanggung jawab PIC
	if o.RoomID != nil && *o.RoomID != "" {
		if err := h.ensureRoomScope(c, *o.RoomID); err != nil {
			return err
		}
	}
	if err := h.Repo.CreateOpname(o); err != nil {
		return inventoryError(c, err)
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *InventoryHandler) ApplyOpname(c echo.Context) error {
	id := c.Param("id")
	// Menerapkan hasil opname: PIC ruangan terkait atau admin
	if !h.isAdmin(c) {
		scope, err := h.resolveScope(c)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
		}
		var roomID sql.NullString
		if err := h.Repo.DB.QueryRow("SELECT room_id FROM inventory_opname WHERE id = ?", id).Scan(&roomID); err == nil && roomID.Valid {
			if !scope.IsPICOf(roomID.String) {
				return c.JSON(http.StatusForbidden, map[string]string{"error": "Opname ini untuk ruangan yang bukan tanggung jawab Anda"})
			}
		}
	}
	if err := h.Repo.ApplyOpname(id); err != nil {
		return inventoryError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ============ Audit Logs ============

func (h *InventoryHandler) GetAuditLogs(c echo.Context) error {
	page, limit := inventoryPaging(c, 20)
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
