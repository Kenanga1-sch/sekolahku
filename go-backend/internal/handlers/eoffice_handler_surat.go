package handlers

import (
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/shared"
)

// ============ Surat Masuk ============

func (h *EOfficeHandler) GetSuratMasuk(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("perPage"))
	if limit < 1 {
		limit = 20
	}
	search := c.QueryParam("search")

	items, total, err := h.Repo.GetSuratMasuk(page, limit, search)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      items,
		"data":       items,
		"totalItems": total,
		"page":       page,
		"limit":      limit,
		"totalPages": (total + limit - 1) / limit,
	})
}

func (h *EOfficeHandler) GetSuratMasukDetail(c echo.Context) error {
	id := c.QueryParam("id")
	s, err := h.Repo.GetSuratMasukByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Surat tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": s})
}

func (h *EOfficeHandler) CreateSuratMasuk(c echo.Context) error {
	filePath, err := saveArsipPDF(c, "surat-masuk", true)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}

	s := models.SuratMasuk{
		OriginalNumber:     strings.TrimSpace(c.FormValue("originalNumber")),
		Sender:             strings.TrimSpace(c.FormValue("sender")),
		Subject:            strings.TrimSpace(c.FormValue("subject")),
		DateOfLetter:       strings.TrimSpace(c.FormValue("dateOfLetter")),
		ReceivedAt:         shared.ParseDateOnly(c.FormValue("receivedAt")),
		ClassificationCode: stringPtrIfNotEmpty(c.FormValue("classificationCode")),
		FilePath:           filePath,
		Notes:              stringPtrIfNotEmpty(c.FormValue("notes")),
	}
	if s.OriginalNumber == "" || s.Sender == "" || s.Subject == "" || s.DateOfLetter == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Nomor asli, pengirim, perihal, dan tanggal surat wajib diisi"})
	}
	id, err := h.Repo.CreateSuratMasuk(s)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"id": id, "success": true})
}

// ============ Surat Keluar ============

func (h *EOfficeHandler) GetSuratKeluar(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("perPage"))
	if limit < 1 {
		limit = 20
	}
	search := c.QueryParam("search")
	statusFilter := c.QueryParam("status")

	items, total, err := h.Repo.GetSuratKeluar(page, limit, search, statusFilter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      items,
		"data":       items,
		"totalItems": total,
		"page":       page,
		"limit":      limit,
		"totalPages": (total + limit - 1) / limit,
	})
}

func (h *EOfficeHandler) GetSuratKeluarDetail(c echo.Context) error {
	id := c.QueryParam("id")
	s, err := h.Repo.GetSuratKeluarByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Surat tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": s})
}

func (h *EOfficeHandler) CreateSuratKeluar(c echo.Context) error {
	var s models.SuratKeluar
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	s.Recipient = strings.TrimSpace(s.Recipient)
	s.Subject = strings.TrimSpace(s.Subject)
	s.DateOfLetter = strings.TrimSpace(s.DateOfLetter)
	if s.Recipient == "" || s.Subject == "" || s.DateOfLetter == "" || s.ClassificationCode == nil || strings.TrimSpace(*s.ClassificationCode) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tujuan, perihal, tanggal, dan klasifikasi wajib diisi"})
	}
	if uid := shared.CurrentUserID(c); uid != "" {
		s.CreatedBy = &uid
	}
	id, mailNumber, err := h.Repo.CreateSuratKeluar(s)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"id": id, "mailNumber": mailNumber, "success": true})
}

func (h *EOfficeHandler) UpdateSuratKeluar(c echo.Context) error {
	id := c.QueryParam("id")
	if strings.TrimSpace(id) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "ID surat wajib diisi"})
	}
	if strings.HasPrefix(c.Request().Header.Get("Content-Type"), "multipart/form-data") {
		filePath, err := saveArsipPDF(c, "surat-keluar", true)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
		}
		if err := h.Repo.UpdateSuratKeluarFinalFile(id, filePath); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "finalFilePath": filePath})
	}

	var s models.SuratKeluar
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if s.ArchiveLocation != nil {
		if err := h.Repo.UpdateSuratKeluarArchiveLocation(id, strings.TrimSpace(*s.ArchiveLocation)); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
		}
	}
	if err := h.Repo.UpdateSuratKeluar(id, s); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ============ Disposisi ============

func (h *EOfficeHandler) CreateDisposisi(c echo.Context) error {
	var d models.Disposisi
	if err := c.Bind(&d); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	d.FromUserID = shared.CurrentUserID(c)
	if d.SuratMasukID == "" || d.FromUserID == "" || d.ToUserID == "" || strings.TrimSpace(d.Instruction) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Surat, pengirim, tujuan, dan instruksi wajib diisi"})
	}
	surat, err := h.Repo.GetSuratMasukByID(d.SuratMasukID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Surat masuk tidak ditemukan"})
	}
	id, err := h.Repo.CreateDisposisi(d)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	// Notifikasi ke penerima disposisi
	uid := d.ToUserID
	targetURL := "/arsip/surat-masuk/detail?id=" + d.SuratMasukID
	_ = h.Notifications.CreateNotification(models.Notification{
		UserID:    &uid,
		Type:      "info",
		Category:  "eoffice",
		Title:     "Disposisi Surat Baru",
		Message:   "Anda menerima disposisi surat \"" + surat.Subject + "\" dari " + surat.Sender + ". Perihal: " + surat.Subject,
		TargetURL: &targetURL,
	})
	return c.JSON(http.StatusCreated, map[string]interface{}{"id": id, "success": true})
}

// CompleteDisposisi menandai disposisi sebagai selesai dikerjakan
func (h *EOfficeHandler) CompleteDisposisi(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "ID disposisi wajib diisi"})
	}
	var req struct {
		CompletedNote string `json:"completedNote"`
	}
	_ = c.Bind(&req)
	if err := h.Repo.CompleteDisposisi(id, req.CompletedNote); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Disposisi tidak ditemukan atau sudah selesai"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Disposisi ditandai selesai"})
}

// ============ Surat Masuk Status / Lokasi Arsip ============

// UpdateSuratMasukStatus mengubah status surat masuk (Selesai/Arsip) dan lokasi arsip fisik
func (h *EOfficeHandler) UpdateSuratMasukStatus(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "ID surat wajib diisi"})
	}
	var req struct {
		Status           *string `json:"status"`
		ArchiveLocation  *string `json:"archiveLocation"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if req.Status != nil {
		switch *req.Status {
		case "Selesai", "Arsip", "Menunggu Disposisi", "Terdisposisi":
		default:
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Status tidak valid"})
		}
	}
	if err := h.Repo.UpdateSuratMasukStatus(id, req.Status, req.ArchiveLocation); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Surat tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ResubmitSuratKeluar mengembalikan surat dari Revisi/Draft ke verifikasi
func (h *EOfficeHandler) ResubmitSuratKeluar(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "ID surat wajib diisi"})
	}
	if err := h.Repo.ResubmitSuratKeluar(id); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Surat tidak ditemukan atau tidak dalam status Draft/Revisi"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Surat dikirim kembali ke verifikasi"})
}

// ============ Verify / Revision ============

func (h *EOfficeHandler) VerifySuratKeluar(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "ID surat wajib diisi"})
	}
	var req struct {
		DigitalSignature string `json:"digitalSignature"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if req.DigitalSignature == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Tanda tangan elektronik wajib diisi"})
	}
	uid := shared.CurrentUserID(c)
	if err := h.Repo.VerifySuratKeluar(id, uid, req.DigitalSignature); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Surat tidak ditemukan atau sudah diverifikasi"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Surat berhasil diverifikasi"})
}

func (h *EOfficeHandler) SetSuratKeluarRevision(c echo.Context) error {
	id := c.QueryParam("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "ID surat wajib diisi"})
	}
	var req struct {
		RevisionNote string `json:"revisionNote"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if req.RevisionNote == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Catatan revisi wajib diisi"})
	}
	if err := h.Repo.SetSuratKeluarRevision(id, req.RevisionNote); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Surat tidak ditemukan atau sudah diverifikasi"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Surat dikembalikan untuk revisi"})
}

// ============ Upload DOCX / Generate ============

func (h *EOfficeHandler) UploadDocx(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "File tidak ditemukan"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	defer src.Close()

	outDir := filepath.Join("public", "uploads", "eoffice", "docx")
	if err := os.MkdirAll(outDir, 0755); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), file.Filename)
	outPath := filepath.Join(outDir, filename)

	dst, err := os.Create(outPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	relativePath := filepath.Join("uploads", "eoffice", "docx", filename)
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"filePath": relativePath,
		"path":     relativePath,
	})
}

func (h *EOfficeHandler) GenerateAndSubmit(c echo.Context) error {
	var req struct {
		TemplateID         string `json:"templateId"`
		ClassificationCode string `json:"classificationCode"`
		Recipient          string `json:"recipient"`
		Subject            string `json:"subject"`
		MailNumber         string `json:"mailNumber"`
		DateOfLetter       string `json:"dateOfLetter"`
		FilePath           string `json:"filePath"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if req.Recipient == "" || req.Subject == "" || req.TemplateID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Penerima, perihal, dan template wajib diisi"})
	}

	uid := shared.CurrentUserID(c)
	dateLetter := req.DateOfLetter
	if dateLetter == "" {
		dateLetter = time.Now().Format("2006-01-02")
	}

	sk := models.SuratKeluar{
		MailNumber:         req.MailNumber,
		Recipient:          req.Recipient,
		Subject:            req.Subject,
		DateOfLetter:       dateLetter,
		ClassificationCode: stringPtrIfNotEmpty(req.ClassificationCode),
		FilePath:           stringPtrIfNotEmpty(req.FilePath),
		TemplateID:         stringPtrIfNotEmpty(req.TemplateID),
		Status:             "Menunggu Verifikasi",
		CreatedBy:          &uid,
	}
	id, err := h.Repo.CreateSuratKeluarFromTemplate(sk)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id, "status": "Menunggu Verifikasi"})
}
