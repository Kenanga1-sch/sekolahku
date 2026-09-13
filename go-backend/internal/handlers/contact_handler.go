package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type ContactHandler struct {
	Repo *repository.ContactRepository
}

func NewContactHandler(repo *repository.ContactRepository) *ContactHandler {
	return &ContactHandler{Repo: repo}
}

var contactCategories = map[string]bool{
	"kritik":    true,
	"saran":     true,
	"pengaduan": true,
	"lainnya":   true,
}

var contactStatuses = map[string]bool{
	"baru":      true,
	"diproses":  true,
	"selesai":   true,
}

// SubmitMessage menerima kritik/saran/pengaduan dari warga publik.
// Nama, email, dan HP opsional (pengaduan boleh anonim); pesan wajib.
// Respons menyertakan kode tiket untuk mengecek status laporan.
func (h *ContactHandler) SubmitMessage(c echo.Context) error {
	var req models.SubmitContactRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Format data tidak valid",
		})
	}

	req.Message = strings.TrimSpace(req.Message)
	if len(req.Message) < 10 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Pesan minimal 10 karakter",
		})
	}
	if len(req.Message) > 5000 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Pesan maksimal 5000 karakter",
		})
	}
	req.Category = strings.ToLower(strings.TrimSpace(req.Category))
	if req.Category == "" {
		req.Category = "lainnya"
	}
	if !contactCategories[req.Category] {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Kategori tidak dikenal",
		})
	}

	id, ticket, err := h.Repo.CreateMessage(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal mengirim pesan: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]string{
			"id":     id,
			"ticket": ticket,
		},
	})
}

// GetPublicStatus memeriksa progres laporan menurut kode tiket.
// Hanya menampilkan kategori, status, dan tanggal — bukan isi pesan —
// supaya kode yang bocor tidak membuka isi laporan pelapor.
func (h *ContactHandler) GetPublicStatus(c echo.Context) error {
	ticket := strings.TrimSpace(c.Param("ticket"))
	if len(ticket) < 4 || len(ticket) > 12 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format kode tiket tidak valid"})
	}
	v, err := h.Repo.GetStatusByTicket(ticket)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if v == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Kode tiket tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": v})
}

func (h *ContactHandler) ListMessages(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if perPage < 1 {
		perPage, _ = strconv.Atoi(c.QueryParam("limit"))
	}
	if perPage < 1 {
		perPage = 20
	}
	category := strings.ToLower(strings.TrimSpace(c.QueryParam("category")))

	messages, total, err := h.Repo.GetMessages(page, perPage, category)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"items":      messages,
			"total":      total,
			"page":       page,
			"perPage":     perPage,
			"totalPages": (total + perPage - 1) / perPage,
		},
	})
}

// UpdateStatus menandai penindaklanjutan admin: baru -> diproses -> selesai.
func (h *ContactHandler) UpdateStatus(c echo.Context) error {
	var req struct {
		Status string `json:"status"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format data tidak valid"})
	}
	status := strings.ToLower(strings.TrimSpace(req.Status))
	if !contactStatuses[status] {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Status tidak dikenal (baru/diproses/selesai)"})
	}
	if err := h.Repo.UpdateStatus(c.Param("id"), status); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Pesan tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *ContactHandler) MarkAsRead(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.MarkAsRead(id); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Pesan tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *ContactHandler) DeleteMessage(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteMessage(id); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Pesan tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
