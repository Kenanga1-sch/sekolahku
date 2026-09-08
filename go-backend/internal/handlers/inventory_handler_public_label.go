package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
)

// GetPublicLabel mengembalikan data aset atau barang untuk halaman detail
// publik yang dibuka lewat QR pada label cetak.
//
// Endpoint ini TIDAK terautentikasi — memang disengaja: QR pada label fisik
// harus bisa discan siapa pun. Karena itu respons dibatasi pada field yang
// aman untuk publik. Field sensitif (price, notes, user_id, created_at)
// sengaja tidak disertakan.
//
// Query: ?id=<record id>&t=asset|item&u=<nomor unit>
func (h *InventoryHandler) GetPublicLabel(c echo.Context) error {
	id := c.QueryParam("id")
	typ := c.QueryParam("t")
	if typ == "" {
		typ = c.QueryParam("type")
	}
	unit := 0
	if v := c.QueryParam("u"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			unit = n
		}
	}
	// b = id batch. Bila ada, nomor unit ditafsirkan dalam batch itu, sehingga
	// nomor yang sama di batch berbeda tidak rancu.
	batch := strings.TrimSpace(c.QueryParam("b"))

	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id wajib diisi"})
	}

	switch typ {
	case "asset", "aset":
		data, err := h.Repo.GetPublicAssetLabel(id, unit)
		if err != nil {
			return inventoryError(c, err)
		}
		return c.JSON(http.StatusOK, data)
	case "item", "stok", "barang":
		data, err := h.Repo.GetPublicItemLabel(id, unit, batch)
		if err != nil {
			return inventoryError(c, err)
		}
		return c.JSON(http.StatusOK, data)
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "t harus asset atau item"})
	}
}
