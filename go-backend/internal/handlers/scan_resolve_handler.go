package handlers

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/repository"
)

// ScanResolveHandler menjawab "kode ini milik siapa?" untuk semua stasiun scan
// (presensi, tabungan, perpustakaan). Siswa dulu, lalu GTK.
type ScanResolveHandler struct {
	DB *sql.DB
}

func NewScanResolveHandler(db *sql.DB) *ScanResolveHandler {
	return &ScanResolveHandler{DB: db}
}

// Resolve: POST /scan/resolve {code} → {kind, studentId|employeeId, name, ...}.
func (h *ScanResolveHandler) Resolve(c echo.Context) error {
	var req struct {
		Code string `json:"code"`
	}
	if err := c.Bind(&req); err != nil || req.Code == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Kode tidak valid"})
	}
	p, err := repository.ResolvePersonByCode(h.DB, req.Code)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Kode tidak dikenali"})
		}
		c.Logger().Error("ScanResolve: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": p})
}
