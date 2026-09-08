package handlers

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
)

// ============ Items (Stock) CRUD ============

func (h *InventoryHandler) GetItems(c echo.Context) error {
	page, limit := inventoryPaging(c, 20)
	search := c.QueryParam("search")
	category := c.QueryParam("category")

	items, total, err := h.Repo.GetItems(page, limit, search, category)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
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
	i.RoomID = normalizeStringPtr(i.RoomID)
	if err := h.ensureItemLocationScope(c, i.RoomID, i.Location); err != nil {
		return err
	}
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "item": item})
}

func (h *InventoryHandler) UpdateItem(c echo.Context) error {
	id := c.Param("id")
	// PIC hanya boleh mengubah barang di ruangannya
	if err := h.ensureItemScope(c, id); err != nil {
		return err
	}
	var i models.InventoryItem
	if err := c.Bind(&i); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	i.Name = strings.TrimSpace(i.Name)
	i.Category = strings.TrimSpace(i.Category)
	i.Unit = strings.TrimSpace(i.Unit)
	i.Code = normalizeStringPtr(i.Code)
	i.Location = normalizeStringPtr(i.Location)
	i.RoomID = normalizeStringPtr(i.RoomID)
	// Dua pemeriksaan, bukan satu: ensureItemScope di atas menjaga ruangan ASAL
	// (PIC tidak boleh mengutak-atik barang ruangan lain), yang ini menjaga
	// ruangan TUJUAN (PIC tidak boleh memindahkan barang miliknya ke ruangan
	// yang bukan wewenjangnya).
	if err := h.ensureItemLocationScope(c, i.RoomID, i.Location); err != nil {
		return err
	}
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	if item == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Barang tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "item": item})
}

func (h *InventoryHandler) DeleteItem(c echo.Context) error {
	id := c.Param("id")
	// PIC hanya boleh menghapus barang di ruangannya
	if err := h.ensureItemScope(c, id); err != nil {
		return err
	}
	if err := h.Repo.DeleteItem(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ============ Transactions ============

func (h *InventoryHandler) GetTransactions(c echo.Context) error {
	_, limit := inventoryPaging(c, 20)
	itemID := c.QueryParam("itemId")
	if itemID == "" {
		itemID = c.QueryParam("item_id")
	}
	trxType := c.QueryParam("type")
	items, err := h.Repo.GetTransactions(limit, itemID, trxType)
	if err != nil {
		return inventoryError(c, err)
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
	proofImage := payload.ProofImage
	// user_id SELALU dari JWT, bukan dari body request.
	// Sebelumnya nilai dari body dipakai apa adanya, sehingga siapa pun bisa
	// memalsukan siapa yang melakukan mutasi stok dan jejak audit tidak bisa dipercaya.
	userIDStr, _ := c.Get("user_id").(string)
	var userID *string
	if userIDStr != "" {
		userID = &userIDStr
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
	// PIC hanya boleh memutasi stok barang di ruangannya
	if err := h.ensureItemScope(c, itemID); err != nil {
		return err
	}
	if err := h.Repo.CreateTransaction(t); err != nil {
		return inventoryError(c, err)
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}
