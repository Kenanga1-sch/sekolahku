package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type InventoryHandler struct {
	Repo *repository.InventoryRepository
}

func NewInventoryHandler(repo *repository.InventoryRepository) *InventoryHandler {
	return &InventoryHandler{Repo: repo}
}

// ============ Payload Types ============

type inventoryAssetPayload struct {
	Name                  string          `json:"name"`
	Code                  *string         `json:"code"`
	Category              string          `json:"category"`
	PurchaseDate          *string         `json:"purchase_date"`
	Price                 int             `json:"price"`
	Quantity              int             `json:"quantity"`
	RoomID                *string         `json:"room"`
	ConditionGood         int             `json:"condition_good"`
	ConditionLightDamaged int             `json:"condition_light_damaged"`
	ConditionHeavyDamaged int             `json:"condition_heavy_damaged"`
	ConditionLost         int             `json:"condition_lost"`
	Notes                 *string         `json:"notes"`
	Extra                 json.RawMessage `json:"-"`
}

type inventoryTransactionPayload struct {
	ItemID           string  `json:"itemId"`
	LegacyItemID     string  `json:"item_id"`
	Type             string  `json:"type"`
	Quantity         int     `json:"quantity"`
	Date             *string `json:"date"`
	Description      *string `json:"description"`
	Recipient        *string `json:"recipient"`
	ProofImage       *string `json:"proofImage"`
	LegacyProofImage *string `json:"proof_image"`
	UserID           *string `json:"userId"`
	LegacyUserID     *string `json:"user_id"`
}

type inventoryOpnamePayload struct {
	Date            *string         `json:"date"`
	RoomID          *string         `json:"room"`
	LegacyRoomID    *string         `json:"room_id"`
	AuditorID       *string         `json:"auditor"`
	LegacyAuditorID *string         `json:"auditor_id"`
	Items           json.RawMessage `json:"items"`
	Status          string          `json:"status"`
	Note            *string         `json:"note"`
}

// ============ Shared Helpers ============

func parseInventoryDate(value *string) (*time.Time, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, nil
	}
	raw := strings.TrimSpace(*value)
	layouts := []string{time.RFC3339, "2006-01-02"}
	for _, layout := range layouts {
		parsed, err := time.Parse(layout, raw)
		if err == nil {
			return &parsed, nil
		}
	}
	return nil, errors.New("Format tanggal tidak valid")
}

func normalizeStringPtr(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func buildInventoryAsset(payload inventoryAssetPayload) (models.InventoryAsset, error) {
	purchaseDate, err := parseInventoryDate(payload.PurchaseDate)
	if err != nil {
		return models.InventoryAsset{}, err
	}
	return models.InventoryAsset{
		Name:                  strings.TrimSpace(payload.Name),
		Code:                  normalizeStringPtr(payload.Code),
		Category:              strings.TrimSpace(payload.Category),
		Price:                 payload.Price,
		Quantity:              payload.Quantity,
		RoomID:                normalizeStringPtr(payload.RoomID),
		ConditionGood:         payload.ConditionGood,
		ConditionLightDamaged: payload.ConditionLightDamaged,
		ConditionHeavyDamaged: payload.ConditionHeavyDamaged,
		ConditionLost:         payload.ConditionLost,
		PurchaseDate:          purchaseDate,
		Notes:                 normalizeStringPtr(payload.Notes),
	}, nil
}

// ============ Stats & Analytics ============

func (h *InventoryHandler) GetStats(c echo.Context) error {
	stats, err := h.Repo.GetStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    stats,
	})
}

func (h *InventoryHandler) GetData(c echo.Context) error {
	dataType := c.QueryParam("type")
	switch dataType {
	case "category-distribution":
		data, err := h.Repo.GetCategoryDistribution()
		if err != nil {
			c.Logger().Error("Failed to get category distribution:", err)
			return c.JSON(http.StatusOK, []interface{}{})
		}
		return c.JSON(http.StatusOK, data)
	case "condition-breakdown":
		data, err := h.Repo.GetConditionBreakdown()
		if err != nil {
			c.Logger().Error("Failed to get condition breakdown:", err)
			return c.JSON(http.StatusOK, []interface{}{})
		}
		return c.JSON(http.StatusOK, data)
	case "recent-audit":
		data, err := h.Repo.GetRecentAudit(10)
		if err != nil {
			c.Logger().Error("Failed to get recent audit:", err)
			return c.JSON(http.StatusOK, []interface{}{})
		}
		return c.JSON(http.StatusOK, data)
	case "top-rooms":
		data, err := h.Repo.GetTopRoomsByValue(5)
		if err != nil {
			c.Logger().Error("Failed to get top rooms:", err)
			return c.JSON(http.StatusOK, []interface{}{})
		}
		return c.JSON(http.StatusOK, data)
	default:
		return c.JSON(http.StatusOK, []interface{}{})
	}
}

// ============ Assets CRUD ============

func (h *InventoryHandler) GetAssets(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit = 20
	}
	roomId := c.QueryParam("roomId")
	search := c.QueryParam("search")
	category := c.QueryParam("category")

	items, total, err := h.Repo.GetAssets(page, limit, roomId, search, category)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"items":      items,
		"totalItems": total,
		"totalPages": (total + limit - 1) / limit,
	})
}

func (h *InventoryHandler) GetAsset(c echo.Context) error {
	id := c.Param("id")
	asset, err := h.Repo.GetAssetByID(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	if asset == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Asset not found"})
	}
	return c.JSON(http.StatusOK, asset)
}

func (h *InventoryHandler) CreateAsset(c echo.Context) error {
	var payload inventoryAssetPayload
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	a, err := buildInventoryAsset(payload)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	if a.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama aset wajib diisi"})
	}
	if a.Quantity < 0 || a.Price < 0 || a.ConditionGood < 0 || a.ConditionLightDamaged < 0 || a.ConditionHeavyDamaged < 0 || a.ConditionLost < 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Jumlah dan harga tidak boleh negatif"})
	}
	id, err := h.Repo.CreateAsset(a)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]string{"id": id, "success": "true"})
}

func (h *InventoryHandler) UpdateAsset(c echo.Context) error {
	id := c.Param("id")
	var payload inventoryAssetPayload
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	a, err := buildInventoryAsset(payload)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	if a.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama aset wajib diisi"})
	}
	if a.Quantity < 0 || a.Price < 0 || a.ConditionGood < 0 || a.ConditionLightDamaged < 0 || a.ConditionHeavyDamaged < 0 || a.ConditionLost < 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Jumlah dan harga tidak boleh negatif"})
	}
	if err := h.Repo.UpdateAsset(id, a); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]string{"success": "true"})
}

func (h *InventoryHandler) DeleteAsset(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteAsset(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]string{"success": "true"})
}
