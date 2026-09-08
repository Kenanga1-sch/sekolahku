package handlers

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/middleware"
	"github.com/sekolahku/go-backend/internal/repository"
)

// ============ Otorisasi scope PIC ruangan ============

func (h *InventoryHandler) resolveScope(c echo.Context) (repository.InventoryScope, error) {
	userID, _ := c.Get("user_id").(string)
	role, _ := c.Get("user_role").(string)
	return repository.ResolveInventoryScope(h.Repo.DB, userID, role)
}

func (h *InventoryHandler) isAdmin(c echo.Context) bool {
	role, _ := c.Get("user_role").(string)
	// Pakai konstanta middleware, bukan string literal, supaya definisi "admin"
	// tidak bisa melenceng dari yang dipakai RoleMiddleware.
	return role == middleware.RoleAdmin || role == middleware.RoleSuperadmin
}

// scopeDeny menolak akses dengan pesan jelas.
func scopeDeny(c echo.Context) error {
	return c.JSON(http.StatusForbidden, map[string]string{
		"error": "Anda hanya memiliki akses pada ruangan yang menjadi tanggung jawab Anda",
	})
}

// ============ Pengajuan peminjaman aset ruangan lain ============

type borrowRequestPayload struct {
	AssetID  string `json:"assetId"`
	Quantity int    `json:"quantity"`
	Reason   string `json:"reason"`
}

// CreateBorrowRequest: PIC mengajukan peminjaman aset ruangan lain.
// Admin tidak perlu pengajuan — bisa langsung transaksi.
func (h *InventoryHandler) CreateBorrowRequest(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Tidak terautentikasi"})
	}

	var req borrowRequestPayload
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data tidak valid"})
	}
	req.AssetID = strings.TrimSpace(req.AssetID)
	if req.AssetID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Aset wajib dipilih"})
	}
	if req.Quantity < 1 {
		req.Quantity = 1
	}

	// Ruangan aset harus di luar scope user (kalau dalam scope, tidak perlu pengajuan)
	roomID, err := repository.AssetRoomID(h.Repo.DB, req.AssetID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Aset tidak ditemukan"})
	}
	scope, err := h.resolveScope(c)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	if scope.IsPICOf(roomID) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Aset ini ada di ruangan Anda — tidak perlu pengajuan, langsung kelola"})
	}

	id, err := h.Repo.CreateBorrowRequest(req.AssetID, roomID, userID, strings.TrimSpace(req.Reason), req.Quantity)
	if err != nil {
		return inventoryError(c, err)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    map[string]interface{}{"id": id, "status": "pending"},
	})
}

// GetBorrowRequests: daftar pengajuan (PIC melihat miliknya, admin melihat semua).
func (h *InventoryHandler) GetBorrowRequests(c echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	statusFilter := strings.TrimSpace(c.QueryParam("status"))

	// Non-admin hanya boleh melihat pengajuannya sendiri.
	scopeRequester := ""
	if !h.isAdmin(c) {
		if userID == "" {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Sesi tidak dikenali"})
		}
		scopeRequester = userID
	}

	list, err := h.Repo.ListBorrowRequests(scopeRequester, statusFilter)
	if err != nil {
		return inventoryError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": list})
}

// ReviewBorrowRequest: admin menyetujui/menolak pengajuan.
// Persetujuan kini mengurangi stok aset dalam transaksi yang sama.
func (h *InventoryHandler) ReviewBorrowRequest(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Action string `json:"action"` // approve | reject
	}
	if err := c.Bind(&req); err != nil || (req.Action != "approve" && req.Action != "reject") {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Aksi harus approve atau reject"})
	}

	adminID, _ := c.Get("user_id").(string)
	if adminID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Sesi tidak dikenali"})
	}

	newStatus, err := h.Repo.ReviewBorrowRequest(id, adminID, req.Action)
	if err != nil {
		return inventoryError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "status": newStatus})
}

// ReturnBorrowRequest: catat pengembalian aset; stok dikembalikan ke ruangan asal.
func (h *InventoryHandler) ReturnBorrowRequest(c echo.Context) error {
	id := c.Param("id")
	userID, _ := c.Get("user_id").(string)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Sesi tidak dikenali"})
	}
	if err := h.Repo.ReturnBorrowRequest(id, userID); err != nil {
		return inventoryError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "status": "returned"})
}

// ============ Guard endpoint CRUD aset: cek scope ruangan ============

// ensureAssetScope memastikan user berhak mengubah aset (PIC ruangan aset / admin).
func (h *InventoryHandler) ensureAssetScope(c echo.Context, assetID string) error {
	scope, err := h.resolveScope(c)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	if scope.IsAdmin {
		return nil
	}
	roomID, err := repository.AssetRoomID(h.Repo.DB, assetID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Aset tidak ditemukan"})
	}
	if !scope.IsPICOf(roomID) {
		return scopeDeny(c)
	}
	return nil
}

// ensureRoomScope memastikan user berhak mengelola ruangan (PIC / admin).
func (h *InventoryHandler) ensureRoomScope(c echo.Context, roomID string) error {
	scope, err := h.resolveScope(c)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	// Admin bebas; sebelumnya tidak dicek lebih dulu sehingga perilakunya tidak
	// konsisten dengan ensureAssetScope / ensureItemScope.
	if scope.IsAdmin || scope.IsPICOf(roomID) {
		return nil
	}
	return scopeDeny(c)
}

// ensureItemScope memastikan user berhak mengubah barang habis pakai (PIC ruangan lokasinya / admin).
// Barang dengan lokasi bukan nama ruangan mana pun dianggap stok umum — semua PIC boleh.
func (h *InventoryHandler) ensureItemScope(c echo.Context, itemID string) error {
	scope, err := h.resolveScope(c)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	if scope.IsAdmin {
		return nil
	}
	roomID, err := repository.ItemRoomID(h.Repo.DB, itemID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Barang tidak ditemukan"})
	}
	if roomID == "" {
		return nil // stok umum (gudang pusat) — bebas
	}
	if !scope.IsPICOf(roomID) {
		return scopeDeny(c)
	}
	return nil
}

// ensureItemLocationScope dipakai saat barang dibuat atau dipindah: belum ada
// itemID yang bisa diperiksa, jadi tujuan penempatannya yang diperiksa. Tanpa
// ini, CreateItem sebelumnya tidak punya cek otorisasi sama sekali — peran apa
// pun yang login bisa menambah master ATK.
//
// roomID (inventory_items.room_id, sumber kebenaran sejak 000035) diperiksa
// lebih dulu dan bersifat menentukan. Kalau tidak diisi, baru fallback ke
// location yang berisi nama ruangan. Tanpa pemeriksaan roomID di sini, PIC bisa
// mengirim room milik ruangan lain sambil mengisi location dengan nama
// ruangannya sendiri: cek lolos, tetapi barang tercatat milik ruangan orang
// lain.
func (h *InventoryHandler) ensureItemLocationScope(c echo.Context, roomID, location *string) error {
	scope, err := h.resolveScope(c)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	if scope.IsAdmin {
		return nil
	}
	if roomID != nil && *roomID != "" {
		if !scope.IsPICOf(*roomID) {
			return scopeDeny(c)
		}
		return nil
	}
	if location == nil || *location == "" {
		return scopeDeny(c) // stok umum => admin saja
	}
	var resolved string
	if err := h.Repo.DB.QueryRow(
		"SELECT id FROM inventory_rooms WHERE name = ? AND deleted_at IS NULL", *location).Scan(&resolved); err != nil {
		return scopeDeny(c) // lokasi tak dikenal => admin saja
	}
	if !scope.IsPICOf(resolved) {
		return scopeDeny(c)
	}
	return nil
}

// ensureRoomCreation hanya admin boleh membuat/menghapus ruangan (PIC diberi admin).
func (h *InventoryHandler) ensureAdmin(c echo.Context) error {
	if !h.isAdmin(c) {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Hanya admin yang dapat mengelola ruangan"})
	}
	return nil
}
