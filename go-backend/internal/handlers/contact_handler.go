package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type ContactHandler struct {
	Repo         *repository.ContactRepository
	Notifications *repository.NotificationRepository
}

func NewContactHandler(repo *repository.ContactRepository, notifications *repository.NotificationRepository) *ContactHandler {
	return &ContactHandler{Repo: repo, Notifications: notifications}
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
//
// Menerima DUA bentuk permintaan:
//   - JSON murni (tanpa lampiran) — kompatibel dengan klien lama.
//   - multipart/form-data: field "payload" berisi JSON string + field
//     "files" berisi 0..3 lampiran bukti.
//
// Lampiran bersifat atomic: file hanya tersimpan di disk BILA pesan valid
// dan insert DB berhasil — tidak ada file yatim dari endpoint ini, dan
// tidak ada endpoint upload publik terpisah yang bisa di-spam.
func (h *ContactHandler) SubmitMessage(c echo.Context) error {
	var req models.SubmitContactRequest
	var files []*multipart.FileHeader

	contentType := c.Request().Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		form, err := c.MultipartForm()
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format data tidak valid"})
		}
		payload := c.FormValue("payload")
		if payload == "" {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Payload wajib diisi"})
		}
		if err := json.Unmarshal([]byte(payload), &req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Payload tidak valid"})
		}
		files = form.File["files"]
	} else {
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"success": false,
				"error":   "Format data tidak valid",
			})
		}
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
	if len(files) > contactAttachmentMaxCount {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Maksimal %d lampiran", contactAttachmentMaxCount),
		})
	}

	// Validasi seluruh lampiran SEBELUM menyimpan apa pun.
	type validatedAttachment struct {
		fh       *multipart.FileHeader
		fileKind string
		mimeType string
		ext      string
	}
	validated := make([]validatedAttachment, 0, len(files))
	for _, fh := range files {
		fileKind, mimeType, ext, err := validateContactAttachment(fh)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
		}
		validated = append(validated, validatedAttachment{fh: fh, fileKind: fileKind, mimeType: mimeType, ext: ext})
	}

	id, ticket, err := h.Repo.CreateMessage(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal mengirim pesan: " + err.Error(),
		})
	}

	// Pesan tersimpan — sekarang simpan lampiran. Gagal simpan satu file
	// tidak membatalkan pesan; lampiran lain tetap dicoba.
	attachmentCount := 0
	for _, va := range validated {
		filePath, size, err := saveContactAttachment(va.fh, va.ext)
		if err != nil {
			c.Logger().Error("gagal menyimpan lampiran:", err)
			continue
		}
		originalName := filepath.Base(va.fh.Filename)
		if _, err := h.Repo.AddAttachment(models.ContactAttachment{
			MessageID:    id,
			Kind:         "evidence",
			FileKind:     va.fileKind,
			FilePath:     filePath,
			OriginalName: originalName,
			FileSize:     size,
			MimeType:     va.mimeType,
		}); err != nil {
			c.Logger().Error("gagal mencatat lampiran:", err)
			continue
		}
		attachmentCount++
	}

	// Notifikasi ke admin/superadmin saja — pengaduan sensitif (mis.
	// perundungan) tidak boleh bocor ke guru/staff lain via broadcast.
	if h.Notifications != nil {
		categoryLabel := req.Category
		preview := req.Message
		if len(preview) > 80 {
			preview = preview[:80] + "…"
		}
		_ = h.Notifications.NotifyRoles(models.Notification{
			Type:     "info",
			Category: "kontak",
			Title:    "Pesan masuk baru: " + categoryLabel,
			Message:  preview,
			TargetURL: StrPtr("/admin/konten-informasi/pesan-detail?id=" + id),
		}, "admin", "superadmin")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]string{
			"id":     id,
			"ticket": ticket,
		},
	})
}

// GetMessage mengambil satu pesan lengkap untuk halaman detail admin.
// Membuka detail otomatis menandai pesan sudah dibaca.
func (h *ContactHandler) GetMessage(c echo.Context) error {
	id := c.Param("id")
	msg, err := h.Repo.GetMessageByID(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if msg == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Pesan tidak ditemukan"})
	}
	if !msg.IsRead {
		_ = h.Repo.MarkAsRead(id)
		msg.IsRead = true
	}
	replies, err := h.Repo.GetReplies(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	attachments, err := h.Repo.GetAttachments(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"message":     msg,
			"replies":     replies,
			"attachments": attachments,
		},
	})
}

// CreateReply mencatat balasan tindak lanjut admin yang bisa dibaca
// pelapor lewat halaman cek status tiket ("Tim Sekolah").
func (h *ContactHandler) CreateReply(c echo.Context) error {
	messageID := c.Param("id")
	var req struct {
		Body string `json:"body"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format data tidak valid"})
	}
	req.Body = strings.TrimSpace(req.Body)
	if len(req.Body) < 2 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Isi balasan minimal 2 karakter"})
	}
	if len(req.Body) > 2000 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Isi balasan maksimal 2000 karakter"})
	}
	msg, err := h.Repo.GetMessageByID(messageID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if msg == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Pesan tidak ditemukan"})
	}

	userID, _ := c.Get("user_id").(string)
	userName, _ := c.Get("user_name").(string)
	if _, err := h.Repo.AddReply(messageID, req.Body, userID, userName); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan balasan"})
	}
	// Menjawab pelapor = pesan sedang diproses.
	if msg.Status == "baru" {
		_ = h.Repo.UpdateStatus(messageID, "diproses")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
func (h *ContactHandler) GetAttachments(c echo.Context) error {
	list, err := h.Repo.GetAttachments(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

// AddResolutionAttachment menerima bukti tindak lanjut dari admin
// (gambar/video) untuk satu pesan. Validasi sama ketatnya dengan bukti
// pelapor; rute ini hanya untuk admin terautentikasi.
func (h *ContactHandler) AddResolutionAttachment(c echo.Context) error {
	messageID := c.Param("id")

	fh, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "File wajib diisi"})
	}
	existing, err := h.Repo.GetAttachments(messageID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	if len(existing) >= contactAttachmentMaxCount*2 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Batas lampiran tercapai"})
	}

	fileKind, mimeType, ext, err := validateContactAttachment(fh)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	filePath, size, err := saveContactAttachment(fh, ext)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan file"})
	}
	userID, _ := c.Get("user_id").(string)
	attID, err := h.Repo.AddAttachment(models.ContactAttachment{
		MessageID:    messageID,
		Kind:         "resolution",
		FileKind:     fileKind,
		FilePath:     filePath,
		OriginalName: filepath.Base(fh.Filename),
		FileSize:     size,
		MimeType:     mimeType,
		UploadedBy:   &userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal mencatat lampiran"})
	}
	// Bukti tindak lanjut menandai pesan diproses.
	_ = h.Repo.UpdateStatus(messageID, "diproses")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    map[string]string{"id": attID, "filePath": filePath},
	})
}

// StrPtr helper sederhana untuk pointer string (diekspor karena dipakai
// lintas paket, mis. scheduler).
func StrPtr(s string) *string { return &s }

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
