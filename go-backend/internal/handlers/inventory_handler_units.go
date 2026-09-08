package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// ============ Pelacakan per unit barang habis pakai ============
//
// Endpoint di sini mendukung alur: barang masuk membentuk batch bernomor, lalu
// saat barang keluar petugas memilih nomor bungkus mana yang keluar ke mana.

// GetItemUnits mengembalikan daftar nomor bungkus untuk picker pada form
// barang keluar. Secara bawaan hanya nomor yang masih tersedia, karena nomor
// yang sudah keluar tidak boleh dikeluarkan lagi.
func (h *InventoryHandler) GetItemUnits(c echo.Context) error {
	itemID := c.Param("id")
	if err := h.ensureItemScope(c, itemID); err != nil {
		return err
	}

	year := time.Now().Year()
	if v := c.QueryParam("year"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			year = n
		}
	}
	onlyAvailable := true
	if v := c.QueryParam("all"); v == "true" || v == "1" {
		onlyAvailable = false
	}

	units, err := h.Repo.GetItemUnits(itemID, year, onlyAvailable)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"year":    year,
		"units":   units,
		"data":    units,
	})
}

// GetItemBatches mengembalikan daftar penerimaan (batch) suatu barang. Dipakai
// halaman cetak label: mencetak per batch membuat nomor tidak pernah berubah.
func (h *InventoryHandler) GetItemBatches(c echo.Context) error {
	itemID := c.Param("id")
	if err := h.ensureItemScope(c, itemID); err != nil {
		return err
	}
	batches, err := h.Repo.GetItemBatches(itemID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"batches": batches,
		"data":    batches,
	})
}

// returnUnitsRequest adalah bentuk permintaan pengembalian bungkus.
type unitNumbersRequest struct {
	Numbers []int  `json:"numbers"`
	Date    *string `json:"date"`
}

// ReturnItemUnits mengembalikan bungkus yang sudah dikeluarkan menjadi
// tersedia lagi. Dipakai bila barang ternyata tidak jadi dipakai, sehingga
// penomoran dan stok kembali sinkron.
func (h *InventoryHandler) ReturnItemUnits(c echo.Context) error {
	itemID := c.Param("id")
	if err := h.ensureItemScope(c, itemID); err != nil {
		return err
	}

	var req unitNumbersRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Permintaan tidak valid"})
	}
	if len(req.Numbers) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nomor bungkus wajib diisi"})
	}

	userIDStr, _ := c.Get("user_id").(string)
	var userID *string
	if userIDStr != "" {
		userID = &userIDStr
	}

	when := time.Now()
	if req.Date != nil && strings.TrimSpace(*req.Date) != "" {
		if parsed, err := parseInventoryDate(req.Date); err == nil && parsed != nil {
			when = *parsed
		}
	}

	// Pengembalian menambah stok lagi, karena bungkus fisiknya kembali ke gudang.
	if err := h.Repo.ReturnUnits(itemID, userID, req.Numbers, when); err != nil {
		return inventoryError(c, err)
	}
	if _, err := h.Repo.DB.Exec(
		"UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?",
		len(req.Numbers), when.UnixMilli(), itemID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"count":   len(req.Numbers),
	})
}

// GetItemUnitDetail mengembalikan satu bungkus berikut riwayatnya. Dipakai
// untuk menelusuri "nomor 4 ke mana".
func (h *InventoryHandler) GetItemUnitDetail(c echo.Context) error {
	itemID := c.Param("id")
	if err := h.ensureItemScope(c, itemID); err != nil {
		return err
	}

	no, err := strconv.Atoi(c.Param("no"))
	if err != nil || no <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nomor bungkus tidak valid"})
	}
	year := time.Now().Year()
	if v := c.QueryParam("year"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			year = n
		}
	}

	units, err := h.Repo.GetItemUnits(itemID, year, false)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	for _, u := range units {
		if u.UnitNo == no {
			return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "unit": u})
		}
	}
	return c.JSON(http.StatusNotFound, map[string]string{"error": "Nomor bungkus tidak ditemukan"})
}

// issueUnitsRequest dipakai endpoint pengeluaran terpisah bila petugas
// mencatat pemakaian tanpa membuat transaksi baru.
type issueUnitsRequest struct {
	Numbers   []int   `json:"numbers"`
	IssuedTo  string  `json:"issuedTo"`
	Date      *string `json:"date"`
}

// IssueItemUnits menandai bungkus keluar ke tujuan tertentu. Alur utama
// pemakaian adalah lewat transaksi OUT (yang sudah mencatat nomor pada
// inventoryTransactionPayload.UnitNumbers); endpoint ini tersedia untuk
// pencatatan langsung.
func (h *InventoryHandler) IssueItemUnits(c echo.Context) error {
	itemID := c.Param("id")
	if err := h.ensureItemScope(c, itemID); err != nil {
		return err
	}

	var req issueUnitsRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Permintaan tidak valid"})
	}
	if len(req.Numbers) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Nomor bungkus wajib diisi"})
	}
	if strings.TrimSpace(req.IssuedTo) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Tujuan wajib diisi"})
	}

	userIDStr, _ := c.Get("user_id").(string)
	var userID *string
	if userIDStr != "" {
		userID = &userIDStr
	}

	when := time.Now()
	if req.Date != nil && strings.TrimSpace(*req.Date) != "" {
		if parsed, err := parseInventoryDate(req.Date); err == nil && parsed != nil {
			when = *parsed
		}
	}

	if err := h.Repo.IssueUnits(itemID, "", req.IssuedTo, userID, req.Numbers, when); err != nil {
		return inventoryError(c, err)
	}
	if _, err := h.Repo.DB.Exec(
		"UPDATE inventory_items SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?",
		len(req.Numbers), when.UnixMilli(), itemID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	var _ = models.ItemUnitIssued
	var _ = repository.ErrUnitNotAvailable

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"count":   len(req.Numbers),
	})
}
