package handlers

import (
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
	Name                  string  `json:"name"`
	Code                  *string `json:"code"`
	Category              string  `json:"category"`
	PurchaseDate          *string `json:"purchase_date"`
	Price                 int     `json:"price"`
	Quantity              int     `json:"quantity"`
	RoomID                *string `json:"room"`
	ConditionGood         int     `json:"condition_good"`
	ConditionLightDamaged int     `json:"condition_light_damaged"`
	ConditionHeavyDamaged int     `json:"condition_heavy_damaged"`
	ConditionLost         int     `json:"condition_lost"`
	Notes                 *string `json:"notes"`
	FundingSource         *string `json:"fundingSource"`
	FiscalYear            *int    `json:"fiscalYear"`
	PhotoUrl              *string `json:"photoUrl"`
}

type inventoryTransactionPayload struct {
	ItemID      string  `json:"itemId"`
	Type        string  `json:"type"`
	Quantity    int     `json:"quantity"`
	Date        *string `json:"date"`
	Description *string `json:"description"`
	Recipient   *string `json:"recipient"`
	ProofImage  *string `json:"proofImage"`
}

type inventoryOpnamePayload struct {
	Date      *string                 `json:"date"`
	RoomID    *string                 `json:"room"`
	AuditorID *string                 `json:"auditor"`
	Items     []inventoryOpnameItemIn `json:"items"`
	Status    string                  `json:"status"`
	Note      *string                 `json:"note"`
}

// inventoryOpnameItemIn menerima baris hasil hitung dari UI.
// UI lama mengirim ID aset pada key "id", jadi keduanya diterima.
type inventoryOpnameItemIn struct {
	ID             string `json:"id"`
	AssetID        string `json:"assetId"`
	QtyGood        int    `json:"qtyGood"`
	QtyLightDamage int    `json:"qtyLightDamage"`
	QtyHeavyDamage int    `json:"qtyHeavyDamage"`
	QtyLost        int    `json:"qtyLost"`
	Note           string `json:"note"`
}

// ============ Shared Helpers ============

// inventoryPaging membaca page/limit dengan batas atas.
// Tanpa batas, klien bisa meminta ?limit=1000000 dan memaksa satu query
// mengambil seluruh tabel.
func inventoryPaging(c echo.Context, defaultLimit int) (page, limit int) {
	page, _ = strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ = strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit = defaultLimit
	}
	if limit > 200 {
		limit = 200
	}
	return page, limit
}

// inventoryError memetakan error repository ke respons HTTP yang seragam.
//
// Sebelumnya setiap handler menulis pemetaan sendiri-sendiri dengan format
// berbeda, dan error internal dikembalikan mentah ke klien (membocorkan
// pesan SQL). Error tak dikenal kini disamarkan jadi pesan generik.
func inventoryError(c echo.Context, err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, repository.ErrInventoryNotFound):
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Data tidak ditemukan"})
	case errors.Is(err, repository.ErrInventoryBusinessRule):
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	default:
		c.Logger().Error("inventory error:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
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
		FundingSource:         normalizeStringPtr(payload.FundingSource),
		FiscalYear:            payload.FiscalYear,
		PhotoUrl:              normalizeStringPtr(payload.PhotoUrl),
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

	var data interface{}
	var err error

	switch dataType {
	case "category-distribution":
		data, err = h.Repo.GetCategoryDistribution()
	case "condition-breakdown":
		data, err = h.Repo.GetConditionBreakdown()
	case "recent-audit":
		data, err = h.Repo.GetRecentAudit(10)
	case "top-rooms":
		data, err = h.Repo.GetTopRoomsByValue(5)
	default:
		// Tipe tidak dikenal => minta klien memperbaiki, jangan pura-pura "tidak ada data".
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Tipe data tidak dikenal: " + dataType,
		})
	}

	if err != nil {
		c.Logger().Error("Failed to get inventory data ("+dataType+"):", err)
		// Gagal query harus terlihat oleh klien. Mengembalikan 200 + [] membuat
		// kegagalan tidak bisa dibedakan dari "memang belum ada data".
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Gagal memuat data inventaris",
		})
	}

	return c.JSON(http.StatusOK, data)
}

// ============ Assets CRUD ============

func (h *InventoryHandler) GetAssets(c echo.Context) error {
	page, limit := inventoryPaging(c, 20)
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
	// PIC hanya boleh menambah aset di ruangannya. Aset tanpa ruangan adalah
	// aset umum lintas-ruangan, jadi pembuatannya admin saja — sebelumnya
	// kondisi ini lolos karena guard-nya bersyarat.
	if a.RoomID != nil && *a.RoomID != "" {
		if err := h.ensureRoomScope(c, *a.RoomID); err != nil {
			return err
		}
	} else if !h.isAdmin(c) {
		return scopeDeny(c)
	}
	id, err := h.Repo.CreateAsset(a)
	if err != nil {
		return inventoryError(c, err)
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"id": id, "success": true})
}

func (h *InventoryHandler) UpdateAsset(c echo.Context) error {
	id := c.Param("id")
	// PIC hanya boleh mengubah aset di ruangannya
	if err := h.ensureAssetScope(c, id); err != nil {
		return err
	}
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
	// Ruangan tujuan pemindahan juga harus dalam scope
	if a.RoomID != nil && *a.RoomID != "" {
		if err := h.ensureRoomScope(c, *a.RoomID); err != nil {
			return err
		}
	}
	if err := h.Repo.UpdateAsset(id, a); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]string{"success": "true"})
}

func (h *InventoryHandler) DeleteAsset(c echo.Context) error {
	id := c.Param("id")
	// PIC hanya boleh menghapus aset di ruangannya
	if err := h.ensureAssetScope(c, id); err != nil {
		return err
	}
	if err := h.Repo.DeleteAsset(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]string{"success": "true"})
}
