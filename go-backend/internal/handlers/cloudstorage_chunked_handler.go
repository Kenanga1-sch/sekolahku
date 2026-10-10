package handlers

// Endpoint upload bertahap (chunked) untuk file besar yang melebihi batas
// request Cloudflare Tunnel (~100MB). Lihat cloudstorage/chunked.go untuk
// alur lengkap.

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
)

// CreateUploadSession: klien minta sesi baru sebelum memotong file.
func (h *CloudStorageHandler) CreateUploadSession(c echo.Context) error {
	var req struct {
		FileName    string  `json:"fileName"`
		MimeType    string  `json:"mimeType"`
		ParentID    *string `json:"parentId"`
		TotalSize   int64   `json:"totalSize"`
		TotalChunks int     `json:"totalChunks"`
		ChunkSize   int64   `json:"chunkSize"`
		Encrypted   bool    `json:"encrypted"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Permintaan tidak valid"})
	}
	name := strings.TrimSpace(req.FileName)
	if name == "" || req.TotalSize <= 0 || req.TotalChunks <= 0 || req.ChunkSize <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Parameter tidak lengkap"})
	}
	sess, err := h.Svc.CreateSession(ownerID(c), name, req.MimeType, req.ParentID, req.TotalSize, req.TotalChunks, req.ChunkSize, req.Encrypted)
	if err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": sess})
}

// UploadChunk: terima satu potongan (index dari form "index").
func (h *CloudStorageHandler) UploadChunk(c echo.Context) error {
	sessionID := strings.TrimSpace(c.Param("id"))
	if sessionID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "ID sesi wajib diisi"})
	}
	indexStr := strings.TrimSpace(c.FormValue("index"))
	index, err := strconv.Atoi(indexStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Nomor potongan tidak valid"})
	}
	fh, err := c.FormFile("chunk")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Potongan wajib diunggah"})
	}
	src, err := fh.Open()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Gagal membuka potongan"})
	}
	defer src.Close()

	res, err := h.Svc.SaveChunk(ownerID(c), sessionID, index, src)
	if err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": res})
}

// CompleteUploadSession: gabung + kirim ke Telegram secara async.
func (h *CloudStorageHandler) CompleteUploadSession(c echo.Context) error {
	sessionID := strings.TrimSpace(c.Param("id"))
	if sessionID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "ID sesi wajib diisi"})
	}
	sess, err := h.Svc.Complete(c.Request().Context(), ownerID(c), sessionID)
	if err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": sess})
}

// GetUploadSessionStatus: polling progress penggabungan/pengiriman.
func (h *CloudStorageHandler) GetUploadSessionStatus(c echo.Context) error {
	sessionID := strings.TrimSpace(c.Param("id"))
	if sessionID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "ID sesi wajib diisi"})
	}
	sess, err := h.Svc.GetSessionStatus(ownerID(c), sessionID)
	if err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": sess})
}

// AbortUploadSession: batalkan upload + hapus potongan sementara.
func (h *CloudStorageHandler) AbortUploadSession(c echo.Context) error {
	sessionID := strings.TrimSpace(c.Param("id"))
	if sessionID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "ID sesi wajib diisi"})
	}
	if err := h.Svc.AbortSession(ownerID(c), sessionID); err != nil {
		return cloudErr(c, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// CleanupUploadSessions: hapus sesi stagnan (>24 jam tanpa aktivitas).
// Dipanggil otomatis saat list files (lazy cleanup — tidak butuh cron).
func (h *CloudStorageHandler) CleanupUploadSessions(maxAgeSeconds int64) {
	_ = h.Svc.CleanupStale(maxAgeSeconds)
}
