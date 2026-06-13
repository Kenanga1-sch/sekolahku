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
	"github.com/sekolahku/go-backend/internal/repository"
)

type EOfficeHandler struct {
	Repo *repository.EOfficeRepository
}

func NewEOfficeHandler(repo *repository.EOfficeRepository) *EOfficeHandler {
	return &EOfficeHandler{Repo: repo}
}

func currentUserID(c echo.Context) string {
	if v, ok := c.Get("user_id").(string); ok {
		return v
	}
	if v, ok := c.Get("userId").(string); ok {
		return v
	}
	return ""
}

func stringPtrIfNotEmpty(v string) *string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return &v
}

func parseDateOnly(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	if t, err := time.Parse("2006-01-02", value); err == nil {
		return &t
	}
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return &t
	}
	return nil
}

func cleanUploadName(name string) string {
	name = filepath.Base(name)
	name = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '.' || r == '-' || r == '_' {
			return r
		}
		return '-'
	}, name)
	name = strings.Trim(name, ".-")
	if name == "" {
		return "dokumen.pdf"
	}
	return name
}

func saveArsipPDF(c echo.Context, category string, required bool) (string, error) {
	file, err := c.FormFile("file")
	if err != nil {
		if required {
			return "", fmt.Errorf("file PDF wajib diupload")
		}
		return "", nil
	}
	if file.Size > 10*1024*1024 {
		return "", fmt.Errorf("ukuran file maksimal 10MB")
	}
	if strings.ToLower(filepath.Ext(file.Filename)) != ".pdf" {
		return "", fmt.Errorf("hanya file PDF yang diperbolehkan")
	}

	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	now := time.Now()
	uploadDir := filepath.Join("uploads", "arsip", category, now.Format("2006"), now.Format("01"))
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return "", err
	}

	filename := fmt.Sprintf("%d-%s", now.UnixNano(), cleanUploadName(file.Filename))
	fullPath := filepath.Join(uploadDir, filename)
	dst, err := os.Create(fullPath)
	if err != nil {
		return "", err
	}
	defer dst.Close()
	if _, err := io.Copy(dst, src); err != nil {
		return "", err
	}

	return "/" + filepath.ToSlash(fullPath), nil
}

func saveLetterTemplateDOCX(c echo.Context, required bool) (*string, error) {
	file, err := c.FormFile("file")
	if err != nil {
		if required {
			return nil, fmt.Errorf("file DOCX wajib diupload")
		}
		return nil, nil
	}
	if file.Size > 15*1024*1024 {
		return nil, fmt.Errorf("ukuran file maksimal 15MB")
	}
	if strings.ToLower(filepath.Ext(file.Filename)) != ".docx" {
		return nil, fmt.Errorf("hanya file .docx yang diperbolehkan")
	}

	src, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer src.Close()

	uploadDir := filepath.Join("uploads", "templates")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return nil, err
	}
	filename := fmt.Sprintf("%d-%s", time.Now().UnixNano(), cleanUploadName(file.Filename))
	fullPath := filepath.Join(uploadDir, filename)
	dst, err := os.Create(fullPath)
	if err != nil {
		return nil, err
	}
	defer dst.Close()
	if _, err := io.Copy(dst, src); err != nil {
		return nil, err
	}
	publicPath := "/uploads/templates/" + filename
	return &publicPath, nil
}

func normalizeLetterTemplate(t *models.LetterTemplate) {
	t.Name = strings.TrimSpace(t.Name)
	t.Category = strings.TrimSpace(t.Category)
	t.Type = strings.TrimSpace(t.Type)
	t.PaperSize = strings.TrimSpace(t.PaperSize)
	t.Orientation = strings.TrimSpace(t.Orientation)
	if t.Category == "" {
		t.Category = "GENERAL"
	}
	if t.Type == "" {
		t.Type = "EDITOR"
	}
	if t.PaperSize == "" {
		t.PaperSize = "A4"
	}
	if t.Orientation == "" {
		t.Orientation = "portrait"
	}
	t.IsActive = true
}

func bindLetterTemplate(c echo.Context, existingFileOptional bool) (models.LetterTemplate, error) {
	var t models.LetterTemplate
	contentType := c.Request().Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		content := strings.TrimSpace(c.FormValue("content"))
		if content != "" {
			t.Content = &content
		}
		t.Name = c.FormValue("name")
		t.Category = c.FormValue("category")
		t.Type = c.FormValue("type")
		t.PaperSize = c.FormValue("paperSize")
		t.Orientation = c.FormValue("orientation")
		filePath, err := saveLetterTemplateDOCX(c, !existingFileOptional && strings.EqualFold(t.Type, "UPLOAD"))
		if err != nil {
			return t, err
		}
		t.FilePath = filePath
	} else {
		if err := c.Bind(&t); err != nil {
			return t, fmt.Errorf("input tidak valid")
		}
	}
	normalizeLetterTemplate(&t)
	if t.Name == "" {
		return t, fmt.Errorf("nama template wajib diisi")
	}
	if strings.EqualFold(t.Type, "UPLOAD") && t.FilePath == nil && !existingFileOptional {
		return t, fmt.Errorf("file DOCX wajib diupload")
	}
	return t, nil
}

func (h *EOfficeHandler) GetArsipStats(c echo.Context) error {
	stats, err := h.Repo.GetArsipStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": stats})
}

func (h *EOfficeHandler) GetKlasifikasi(c echo.Context) error {
	list, err := h.Repo.GetKlasifikasi()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

func (h *EOfficeHandler) Numbering(c echo.Context) error {
	var req models.NumberingRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	nextSeq, err := h.Repo.CalculateNextLetterSequence(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": nextSeq})
}

func (h *EOfficeHandler) Increment(c echo.Context) error {
	var req models.IncrementRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}
	if err := h.Repo.IncrementLetterSequence(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "newSequence": req.SequenceNumber})
}

// Surat Masuk
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
		ReceivedAt:         parseDateOnly(c.FormValue("receivedAt")),
		ClassificationCode: stringPtrIfNotEmpty(c.FormValue("classificationCode")),
		FilePath:           filePath,
		Notes:              stringPtrIfNotEmpty(c.FormValue("notes")),
	}
	if s.OriginalNumber == "" || s.Sender == "" || s.Subject == "" || s.DateOfLetter == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Nomor asli, pengirim, perihal, dan tanggal surat wajib diisi"})
	}
	id, err := h.Repo.CreateSuratMasuk(s)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"id": id, "success": true})
}

// Surat Keluar
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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

// GetPublicAnnouncements moved to AnnouncementHandler

func (h *EOfficeHandler) GetLetterTemplates(c echo.Context) error {
	q := c.QueryParam("q")
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))

	list, total, err := h.Repo.GetLetterTemplates(q, page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "total": total, "page": page, "perPage": perPage})
}

func (h *EOfficeHandler) GetLetterTemplateByID(c echo.Context) error {
	id := c.Param("id")
	t, err := h.Repo.GetLetterTemplateByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Template tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, t)
}

func (h *EOfficeHandler) CreateLetterTemplate(c echo.Context) error {
	t, err := bindLetterTemplate(c, false)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	id, err := h.Repo.CreateLetterTemplate(t)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *EOfficeHandler) UpdateLetterTemplate(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "ID template wajib diisi"})
	}
	t, err := bindLetterTemplate(c, true)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": err.Error()})
	}
	if err := h.Repo.UpdateLetterTemplate(id, t); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Template tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *EOfficeHandler) DeleteLetterTemplate(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteLetterTemplate(id); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Template tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *EOfficeHandler) GetTemplateVariables(c echo.Context) error {
	id := c.Param("id")
	vars, err := h.Repo.GetTemplateVariables(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, models.TemplateVariablesResponse{Variables: vars})
}

// CreateSuratKeluar creates a new outgoing letter
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
	if uid := currentUserID(c); uid != "" {
		s.CreatedBy = &uid
	}
	id, mailNumber, err := h.Repo.CreateSuratKeluar(s)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"id": id, "mailNumber": mailNumber, "success": true})
}

// GetSuratMasukDetail returns a single incoming letter by ID
func (h *EOfficeHandler) GetSuratMasukDetail(c echo.Context) error {
	id := c.QueryParam("id")
	s, err := h.Repo.GetSuratMasukByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Surat tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": s})
}

// GetSuratKeluarDetail returns a single outgoing letter by ID
func (h *EOfficeHandler) GetSuratKeluarDetail(c echo.Context) error {
	id := c.QueryParam("id")
	s, err := h.Repo.GetSuratKeluarByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Surat tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": s})
}

// UpdateSuratKeluar updates an outgoing letter
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
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "finalFilePath": filePath})
	}

	var s models.SuratKeluar
	if err := c.Bind(&s); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	if err := h.Repo.UpdateSuratKeluar(id, s); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// CreateDisposisi creates a new disposition for an incoming letter
func (h *EOfficeHandler) CreateDisposisi(c echo.Context) error {
	var d models.Disposisi
	if err := c.Bind(&d); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid input"})
	}
	d.FromUserID = currentUserID(c)
	if d.SuratMasukID == "" || d.FromUserID == "" || d.ToUserID == "" || strings.TrimSpace(d.Instruction) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Surat, pengirim, tujuan, dan instruksi wajib diisi"})
	}
	id, err := h.Repo.CreateDisposisi(d)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"id": id, "success": true})
}

// GenerateAndSubmit creates surat_keluar from letter generator and saves the generated DOCX
func (h *EOfficeHandler) UploadDocx(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "File tidak ditemukan"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer src.Close()

	outDir := filepath.Join("public", "uploads", "eoffice", "docx")
	if err := os.MkdirAll(outDir, 0755); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), file.Filename)
	outPath := filepath.Join(outDir, filename)
	dst, err := os.Create(outPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
		TemplateID         string            `json:"templateId"`
		ClassificationCode string            `json:"classificationCode"`
		Recipient          string            `json:"recipient"`
		Subject            string            `json:"subject"`
		MailNumber         string            `json:"mailNumber"`
		DateOfLetter       string            `json:"dateOfLetter"`
		FilePath           string            `json:"filePath"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if req.Recipient == "" || req.Subject == "" || req.TemplateID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Penerima, perihal, dan template wajib diisi"})
	}

	uid := currentUserID(c)
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
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id, "status": "Menunggu Verifikasi"})
}

// VerifySuratKeluar approves a surat_keluar with digital signature
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
	uid := currentUserID(c)
	if err := h.Repo.VerifySuratKeluar(id, uid, req.DigitalSignature); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Surat tidak ditemukan atau sudah diverifikasi"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Surat berhasil diverifikasi"})
}

// SetSuratKeluarRevision rejects a surat_keluar with revision note
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
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Surat dikembalikan untuk revisi"})
}

func (h *EOfficeHandler) ImportLetterTemplate(c echo.Context) error {
	var payload struct {
		Config struct {
			Name        string `json:"name"`
			Category    string `json:"category"`
			PaperSize   string `json:"paperSize"`
			Orientation string `json:"orientation"`
		} `json:"config"`
		Content string `json:"content"`
	}
	if err := c.Bind(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Format JSON tidak valid"})
	}
	if strings.TrimSpace(payload.Config.Name) == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Nama template wajib diisi"})
	}

	t := models.LetterTemplate{
		Name:        payload.Config.Name,
		Category:    payload.Config.Category,
		Type:        "EDITOR",
		PaperSize:   payload.Config.PaperSize,
		Orientation: payload.Config.Orientation,
	}
	normalizeLetterTemplate(&t)
	if payload.Content != "" {
		t.Content = &payload.Content
	}

	id, err := h.Repo.CreateLetterTemplate(t)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "id": id})
}

func (h *EOfficeHandler) GenerateBatch(c echo.Context) error {
	var req models.BatchGenerateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	if len(req.Recipients) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Minimal satu penerima"})
	}

	results := make([]map[string]interface{}, 0, len(req.Recipients))
	for i, rec := range req.Recipients {
		sequenceNumber := req.NextSequence + i
		recipientName := rec.Name
		if recipientName == "" {
			recipientName = fmt.Sprintf("Penerima %d", i+1)
		}

		incReq := models.IncrementRequest{
			LetterNumber:       req.LetterNumber,
			SequenceNumber:     sequenceNumber,
			TemplateID:         &req.TemplateID,
			Recipient:          &recipientName,
			ClassificationCode: req.ClassificationCode,
		}
		if err := h.Repo.IncrementLetterSequence(incReq); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
		}

		results = append(results, map[string]interface{}{
			"recipient":      recipientName,
			"sequenceNumber": sequenceNumber,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Batch letter numbers logged. DOCX generation handled client-side.",
		"count":   len(req.Recipients),
		"results": results,
	})
}
