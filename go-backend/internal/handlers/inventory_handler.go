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

func (h *InventoryHandler) GetStats(c echo.Context) error {
	stats, err := h.Repo.GetStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    stats,
	})
}

func (h *InventoryHandler) GetRooms(c echo.Context) error {
	q := c.QueryParam("q")
	rooms, err := h.Repo.GetRooms(q)
	if err != nil {
		c.Logger().Error("Failed to get rooms:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Error"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      rooms,
		"totalItems": len(rooms),
	})
}

func (h *InventoryHandler) GetRoom(c echo.Context) error {
	id := c.Param("id")
	room, err := h.Repo.GetRoomByID(id)
	if err != nil {
		c.Logger().Error("Failed to get room:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Error"})
	}
	if room == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Room not found"})
	}
	return c.JSON(http.StatusOK, room)
}

func (h *InventoryHandler) CreateRoom(c echo.Context) error {
	var req models.CreateInventoryRoomRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama ruangan wajib diisi"})
	}

	room, err := h.Repo.CreateRoom(req)
	if err != nil {
		c.Logger().Error("Failed to create room:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Error"})
	}

	return c.JSON(http.StatusOK, room)
}

func (h *InventoryHandler) UpdateRoom(c echo.Context) error {
	id := c.Param("id")
	var req models.CreateInventoryRoomRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	room, err := h.Repo.UpdateRoom(id, req)
	if err != nil {
		c.Logger().Error("Failed to update room:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Error"})
	}

	return c.JSON(http.StatusOK, room)
}

func (h *InventoryHandler) DeleteRoom(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteRoom(id); err != nil {
		c.Logger().Error("Failed to delete room:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Error"})
	}

	return c.NoContent(http.StatusNoContent)
}

// Assets
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"success": "true"})
}

func (h *InventoryHandler) DeleteAsset(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteAsset(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"success": "true"})
}

// Items (Stock)
func (h *InventoryHandler) GetItems(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit = 20
	}
	search := c.QueryParam("search")
	category := c.QueryParam("category")

	items, total, err := h.Repo.GetItems(page, limit, search, category)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"items":      items,
		"data":       items,
		"totalItems": total,
		"totalPages": (total + limit - 1) / limit,
	})
}

func (h *InventoryHandler) GetItem(c echo.Context) error {
	id := c.Param("id")
	item, history, err := h.Repo.GetItemByID(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if item == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Barang tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"item":    item,
		"history": history,
	})
}

func (h *InventoryHandler) CreateItem(c echo.Context) error {
	var i models.InventoryItem
	if err := c.Bind(&i); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	i.Name = strings.TrimSpace(i.Name)
	i.Category = strings.TrimSpace(i.Category)
	i.Unit = strings.TrimSpace(i.Unit)
	i.Code = normalizeStringPtr(i.Code)
	i.Location = normalizeStringPtr(i.Location)
	if i.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama barang wajib diisi"})
	}
	if i.Category == "" {
		i.Category = "LAINNYA"
	}
	if i.Unit == "" {
		i.Unit = "Pcs"
	}
	if i.MinStock < 0 || i.CurrentStock < 0 || i.Price < 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Stok dan harga tidak boleh negatif"})
	}
	item, err := h.Repo.CreateItem(i)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "item": item})
}

func (h *InventoryHandler) UpdateItem(c echo.Context) error {
	id := c.Param("id")
	var i models.InventoryItem
	if err := c.Bind(&i); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	i.Name = strings.TrimSpace(i.Name)
	i.Category = strings.TrimSpace(i.Category)
	i.Unit = strings.TrimSpace(i.Unit)
	i.Code = normalizeStringPtr(i.Code)
	i.Location = normalizeStringPtr(i.Location)
	if i.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nama barang wajib diisi"})
	}
	if i.Category == "" {
		i.Category = "LAINNYA"
	}
	if i.Unit == "" {
		i.Unit = "Pcs"
	}
	if i.MinStock < 0 || i.CurrentStock < 0 || i.Price < 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Stok dan harga tidak boleh negatif"})
	}
	item, err := h.Repo.UpdateItem(id, i)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if item == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Barang tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "item": item})
}

func (h *InventoryHandler) DeleteItem(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteItem(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// Transactions
func (h *InventoryHandler) GetTransactions(c echo.Context) error {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit = 20
	}
	itemID := c.QueryParam("itemId")
	if itemID == "" {
		itemID = c.QueryParam("item_id")
	}
	trxType := c.QueryParam("type")
	items, err := h.Repo.GetTransactions(limit, itemID, trxType)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      items,
		"data":       items,
		"totalItems": len(items),
	})
}

func (h *InventoryHandler) CreateTransaction(c echo.Context) error {
	var payload inventoryTransactionPayload
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	itemID := strings.TrimSpace(payload.ItemID)
	if itemID == "" {
		itemID = strings.TrimSpace(payload.LegacyItemID)
	}
	proofImage := payload.ProofImage
	if proofImage == nil {
		proofImage = payload.LegacyProofImage
	}
	userID := payload.UserID
	if userID == nil {
		userID = payload.LegacyUserID
	}
	date, err := parseInventoryDate(payload.Date)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	t := models.InventoryTransaction{
		ItemID:      itemID,
		Type:        strings.ToUpper(strings.TrimSpace(payload.Type)),
		Quantity:    payload.Quantity,
		Date:        date,
		Description: normalizeStringPtr(payload.Description),
		Recipient:   normalizeStringPtr(payload.Recipient),
		ProofImage:  normalizeStringPtr(proofImage),
		UserID:      normalizeStringPtr(userID),
	}
	if err := h.Repo.CreateTransaction(t); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, repository.ErrInventoryBusinessRule) {
			status = http.StatusBadRequest
		}
		return c.JSON(status, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

// Opname
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      logs,
		"data":       logs,
		"totalItems": total,
		"totalPages": (total + limit - 1) / limit,
	})
}
