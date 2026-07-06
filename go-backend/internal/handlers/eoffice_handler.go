package handlers

import (
	"bytes"
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
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".pdf" && ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		return "", fmt.Errorf("hanya file PDF dan Gambar (JPG, PNG) yang diperbolehkan")
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
	includeInactive := c.QueryParam("include_inactive") == "true"
	list, err := h.Repo.GetKlasifikasi(includeInactive)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list})
}

func (h *EOfficeHandler) CreateKlasifikasi(c echo.Context) error {
	var k models.KlasifikasiSurat
	if err := c.Bind(&k); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if k.Code == "" || k.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Kode dan nama klasifikasi wajib diisi"})
	}
	k.IsActive = true
	if err := h.Repo.CreateKlasifikasi(k); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": k})
}

func (h *EOfficeHandler) UpdateKlasifikasi(c echo.Context) error {
	code := c.Param("code")
	var k models.KlasifikasiSurat
	if err := c.Bind(&k); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if k.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Nama klasifikasi wajib diisi"})
	}
	if err := h.Repo.UpdateKlasifikasi(code, k); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": k})
}

func (h *EOfficeHandler) DeleteKlasifikasi(c echo.Context) error {
	code := c.Param("code")
	if err := h.Repo.DeleteKlasifikasi(code); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
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

func (h *EOfficeHandler) AIAnalyzeSuratMasuk(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "File surat wajib diupload"})
	}
	if file.Size > 10*1024*1024 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Ukuran file maksimal 10MB"})
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".pdf" && ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Hanya file PDF dan Gambar (JPG, PNG) yang diperbolehkan"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	defer src.Close()

	// Read file bytes
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, src); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	fileBytes := buf.Bytes()

	// Determine mimeType
	mimeType := file.Header.Get("Content-Type")
	if mimeType == "" || (!strings.HasPrefix(mimeType, "image/") && mimeType != "application/pdf") {
		if ext == ".png" {
			mimeType = "image/png"
		} else if ext == ".jpg" || ext == ".jpeg" {
			mimeType = "image/jpeg"
		} else {
			mimeType = "application/pdf"
		}
	}

	// Get Gemini API Key
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":    true,
			"ai_enabled": false,
			"message":    "GEMINI_API_KEY tidak disetel di server",
		})
	}

	// Call AI to extract metadata
	result, err := h.Repo.AnalyzeIncomingLetterWithAI(fileBytes, mimeType, apiKey)
	if err != nil {
		c.Logger().Error("AI Analysis of letter failed: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"ai_enabled": true,
		"data":       result,
	})
}

type GTKDetail struct {
	NIP         string `json:"nip"`
	Gender      string `json:"gender"`
	TTL         string `json:"ttl"`
	Gol         string `json:"gol"`
	Status      string `json:"status"`
	Pendidikan  string `json:"pendidikan"`
	TglMengabdi string `json:"tgl_mengabdi"`
	TmtCpns     string `json:"tmt_cpns"`
	TmtGol      string `json:"tmt_gol"`
	NRG         string `json:"nrg"`
	NUPTK       string `json:"nuptk"`
	Mengajar    string `json:"mengajar"`
	JPL         string `json:"jpl"`
}

var gtkStaticDetails = map[string]GTKDetail{
	"197702062014081001": {
		NIP:         "197702062014081001",
		Gender:      "L",
		TTL:         "Indramayu, 06-02-1977",
		Gol:         "III/c",
		Status:      "PNS",
		Pendidikan:  "S-1",
		TglMengabdi: "7/1/2002",
		TmtCpns:     "01-08-2014",
		TmtGol:      "01-04-2022",
		NRG:         "150261115253",
		NUPTK:       "5538755657200012",
		Mengajar:    "-",
		JPL:         "-",
	},
	"196706272008012004": {
		NIP:         "196706272008012004",
		Gender:      "P",
		TTL:         "Indramayu, 27-06-1967",
		Gol:         "III/d",
		Status:      "PNS",
		Pendidikan:  "S-1",
		TglMengabdi: "6/1/2003",
		TmtCpns:     "01-01-2008",
		TmtGol:      "01-04-2023",
		NRG:         "130271973063",
		NUPTK:       "1959745648300042",
		Mengajar:    "Kelas",
		JPL:         "24",
	},
	"198406152024212001": {
		NIP:         "198406152024212001",
		Gender:      "P",
		TTL:         "Indramayu, 15-06-1984",
		Gol:         "IX",
		Status:      "PPPK",
		Pendidikan:  "S-1",
		TglMengabdi: "7/16/2006",
		TmtCpns:     "01-02-2024",
		TmtGol:      "01-02-2024",
		NRG:         "240271388303",
		NUPTK:       "394762663300092",
		Mengajar:    "Kelas",
		JPL:         "24",
	},
	"199409252024212009": {
		NIP:         "199409252024212009",
		Gender:      "P",
		TTL:         "Indramayu, 25-09-1994",
		Gol:         "IX",
		Status:      "PPPK",
		Pendidikan:  "S-1",
		TglMengabdi: "10/1/2016",
		TmtCpns:     "01-02-2024",
		TmtGol:      "01-02-2024",
		NRG:         "-",
		NUPTK:       "7257772673130023",
		Mengajar:    "Kelas",
		JPL:         "24",
	},
	"198802242024212008": {
		NIP:         "198802242024212008",
		Gender:      "P",
		TTL:         "Indramayu, 24-02-1988",
		Gol:         "IX",
		Status:      "PPPK",
		Pendidikan:  "S-1",
		TglMengabdi: "2/1/2024",
		TmtCpns:     "01-02-2024",
		TmtGol:      "01-02-2024",
		NRG:         "-",
		NUPTK:       "6556766666300012",
		Mengajar:    "Kelas",
		JPL:         "24",
	},
	"199503172025212118": {
		NIP:         "199503172025212118",
		Gender:      "L",
		TTL:         "Indramayu, 17-03-1995",
		Gol:         "IX",
		Status:      "PPPK PW",
		Pendidikan:  "S-1",
		TglMengabdi: "1/1/2021",
		TmtCpns:     "01-11-2025",
		TmtGol:      "01-11-2025",
		NRG:         "-",
		NUPTK:       "4649773674230202",
		Mengajar:    "Kelas",
		JPL:         "24",
	},
	"199809152025211065": {
		NIP:         "199809152025211065",
		Gender:      "L",
		TTL:         "Indramayu, 15-09-1998",
		Gol:         "IX",
		Status:      "PPPK PW",
		Pendidikan:  "S-1",
		TglMengabdi: "11/24/2021",
		TmtCpns:     "01-11-2025",
		TmtGol:      "01-11-2025",
		NRG:         "-",
		NUPTK:       "4247776677130063",
		Mengajar:    "PAI",
		JPL:         "24",
	},
	"199809152025211000": {
		NIP:         "199809152025211000",
		Gender:      "L",
		TTL:         "Indramayu, 15-09-1998",
		Gol:         "IX",
		Status:      "PPPK PW",
		Pendidikan:  "S-1",
		TglMengabdi: "11/24/2021",
		TmtCpns:     "01-11-2025",
		TmtGol:      "01-11-2025",
		NRG:         "-",
		NUPTK:       "4247776677130063",
		Mengajar:    "PAI",
		JPL:         "24",
	},
	"199903092025211053": {
		NIP:         "199903092025211053",
		Gender:      "L",
		TTL:         "Indramayu, 09-03-1999",
		Gol:         "-",
		Status:      "PPPK PW",
		Pendidikan:  "SMK",
		TglMengabdi: "2/22/2021",
		TmtCpns:     "01-11-2025",
		TmtGol:      "01-11-2025",
		NRG:         "-",
		NUPTK:       "9641777678130032",
		Mengajar:    "-",
		JPL:         "-",
	},
	"199210152025211110": {
		NIP:         "199210152025211110",
		Gender:      "L",
		TTL:         "Indramayu, 15-10-1992",
		Gol:         "-",
		Status:      "PPPK PW",
		Pendidikan:  "PAKET C",
		TglMengabdi: "11/1/2017",
		TmtCpns:     "01-11-2025",
		TmtGol:      "01-11-2025",
		NRG:         "-",
		NUPTK:       "6347770671130273",
		Mengajar:    "-",
		JPL:         "-",
	},
}

func (h *EOfficeHandler) GetDaftar1Stats(c echo.Context) error {
	monthStr := c.QueryParam("month")
	yearStr := c.QueryParam("year")

	now := time.Now()
	reportMonth := int(now.Month())
	reportYear := now.Year()

	if monthStr != "" {
		if m, err := strconv.Atoi(monthStr); err == nil && m >= 1 && m <= 12 {
			reportMonth = m
		}
	}
	if yearStr != "" {
		if y, err := strconv.Atoi(yearStr); err == nil && y > 1900 {
			reportYear = y
		}
	}

	// 1. Fetch School Settings
	var schoolName, schoolNpsn, schoolAddress, principalName, principalNip, academicYear string
	err := h.Repo.DB.QueryRow(`
		SELECT COALESCE(school_name, ''), COALESCE(school_npsn, ''), COALESCE(school_address, ''),
		       COALESCE(principal_name, ''), COALESCE(principal_nip, ''), COALESCE(current_academic_year, '')
		FROM school_settings LIMIT 1
	`).Scan(&schoolName, &schoolNpsn, &schoolAddress, &principalName, &principalNip, &academicYear)
	if err != nil && err != sql.ErrNoRows {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	// Format Month name in Indonesian
	monthNames := []string{"", "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"}
	bulanIndo := monthNames[reportMonth] + " " + strconv.Itoa(reportYear)

	// We calculate date ranges or formats
	monthStrFormatted := fmt.Sprintf("%02d", reportMonth)
	yearStrFormatted := fmt.Sprintf("%d", reportYear)

	// 2. Fetch student statistics
	type countKey struct {
		Grade  int
		Gender string
	}

	activeCounts := make(map[countKey]int)
	rows, err := h.Repo.DB.Query(`
		SELECT c.grade, s.gender, COUNT(*)
		FROM students s
		JOIN student_classes c ON s.class_id = c.id
		WHERE s.status = 'active'
		GROUP BY c.grade, s.gender
	`)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	for rows.Next() {
		var grade int
		var gender string
		var count int
		if err := rows.Scan(&grade, &gender, &count); err == nil {
			activeCounts[countKey{Grade: grade, Gender: strings.ToUpper(gender)}] = count
		}
	}
	rows.Close()

	// Masuk mutations
	masukCounts := make(map[countKey]int)
	rows, err = h.Repo.DB.Query(`
		SELECT target_grade, gender, COUNT(*)
		FROM mutasi_requests
		WHERE status_approval = 'approved'
		  AND strftime('%m', datetime(updated_at/1000, 'unixepoch')) = ?
		  AND strftime('%Y', datetime(updated_at/1000, 'unixepoch')) = ?
		GROUP BY target_grade, gender
	`, monthStrFormatted, yearStrFormatted)
	if err == nil {
		for rows.Next() {
			var grade int
			var gender string
			var count int
			if err := rows.Scan(&grade, &gender, &count); err == nil {
				masukCounts[countKey{Grade: grade, Gender: strings.ToUpper(gender)}] = count
			}
		}
		rows.Close()
	}

	// Keluar mutations
	keluarCounts := make(map[countKey]int)
	rows, err = h.Repo.DB.Query(`
		SELECT c.grade, s.gender, COUNT(*)
		FROM mutasi_out_requests m
		JOIN students s ON m.student_id = s.id
		JOIN student_classes c ON s.class_id = c.id
		WHERE m.status = 'completed'
		  AND strftime('%m', datetime(COALESCE(m.completed_at, m.updated_at)/1000, 'unixepoch')) = ?
		  AND strftime('%Y', datetime(COALESCE(m.completed_at, m.updated_at)/1000, 'unixepoch')) = ?
		GROUP BY c.grade, s.gender
	`, monthStrFormatted, yearStrFormatted)
	if err == nil {
		for rows.Next() {
			var grade int
			var gender string
			var count int
			if err := rows.Scan(&grade, &gender, &count); err == nil {
				keluarCounts[countKey{Grade: grade, Gender: strings.ToUpper(gender)}] = count
			}
		}
		rows.Close()
	}

	// Now compile student table
	templateData := make(map[string]interface{})
	templateData["bulan"] = bulanIndo
	templateData["tahun_pelajaran"] = academicYear
	templateData["sekolah_nama"] = schoolName
	templateData["sekolah_npsn"] = schoolNpsn
	templateData["sekolah_alamat"] = schoolAddress
	templateData["kepala_sekolah_nama"] = principalName
	templateData["kepala_sekolah_nip"] = principalNip
	templateData["pengawas_nama"] = "H. Taryani, S.Pd., M.MP.d"
	templateData["pengawas_nip"] = "197004141992031005"

	lastDay := 31
	if reportMonth == 4 || reportMonth == 6 || reportMonth == 9 || reportMonth == 11 {
		lastDay = 30
	} else if reportMonth == 2 {
		lastDay = 28
		if reportYear%4 == 0 && (reportYear%100 != 0 || reportYear%400 == 0) {
			lastDay = 29
		}
	}
	templateData["tanggal_laporan"] = "Indramayu, " + strconv.Itoa(lastDay) + " " + monthNames[reportMonth] + " " + strconv.Itoa(reportYear)

	genders := []string{"L", "P"}
	var totLaluL, totLaluP, totMasukL, totMasukP, totKeluarL, totKeluarP, totAkhirL, totAkhirP int

	for g := 1; g <= 6; g++ {
		gradeRoman := ""
		switch g {
		case 1:
			gradeRoman = "i"
		case 2:
			gradeRoman = "ii"
		case 3:
			gradeRoman = "iii"
		case 4:
			gradeRoman = "iv"
		case 5:
			gradeRoman = "v"
		case 6:
			gradeRoman = "vi"
		}

		var classLaluL, classLaluP, classMasukL, classMasukP, classKeluarL, classKeluarP, classAkhirL, classAkhirP int

		for _, gen := range genders {
			key := countKey{Grade: g, Gender: gen}
			akhir := activeCounts[key]
			masuk := masukCounts[key]
			keluar := keluarCounts[key]

			lalu := akhir - masuk + keluar
			if lalu < 0 {
				lalu = 0
			}
			akhir = lalu + masuk - keluar
			if akhir < 0 {
				akhir = 0
			}

			if gen == "L" {
				classLaluL = lalu
				classMasukL = masuk
				classKeluarL = keluar
				classAkhirL = akhir

				totLaluL += lalu
				totMasukL += masuk
				totKeluarL += keluar
				totAkhirL += akhir
			} else {
				classLaluP = lalu
				classMasukP = masuk
				classKeluarP = keluar
				classAkhirP = akhir

				totLaluP += lalu
				totMasukP += masuk
				totKeluarP += keluar
				totAkhirP += akhir
			}
		}

		templateData["m_"+gradeRoman+"_l_lalu"] = classLaluL
		templateData["m_"+gradeRoman+"_p_lalu"] = classLaluP
		templateData["m_"+gradeRoman+"_t_lalu"] = classLaluL + classLaluP

		templateData["m_"+gradeRoman+"_l_masuk"] = classMasukL
		templateData["m_"+gradeRoman+"_p_masuk"] = classMasukP
		templateData["m_"+gradeRoman+"_t_masuk"] = classMasukL + classMasukP

		templateData["m_"+gradeRoman+"_l_keluar"] = classKeluarL
		templateData["m_"+gradeRoman+"_p_keluar"] = classKeluarP
		templateData["m_"+gradeRoman+"_t_keluar"] = classKeluarL + classKeluarP

		templateData["m_"+gradeRoman+"_l_akhir"] = classAkhirL
		templateData["m_"+gradeRoman+"_p_akhir"] = classAkhirP
		templateData["m_"+gradeRoman+"_t_akhir"] = classAkhirL + classAkhirP
	}

	templateData["m_t_l_lalu"] = totLaluL
	templateData["m_t_p_lalu"] = totLaluP
	templateData["m_t_t_lalu"] = totLaluL + totLaluP

	templateData["m_t_l_masuk"] = totMasukL
	templateData["m_t_p_masuk"] = totMasukP
	templateData["m_t_t_masuk"] = totMasukL + totMasukP

	templateData["m_t_l_keluar"] = totKeluarL
	templateData["m_t_p_keluar"] = totKeluarP
	templateData["m_t_t_keluar"] = totKeluarL + totKeluarP

	templateData["m_t_l_akhir"] = totAkhirL
	templateData["m_t_p_akhir"] = totAkhirP
	templateData["m_t_t_akhir"] = totAkhirL + totAkhirP

	// 3. Ages stats
	ageKeys := []string{"under5", "6", "7", "8", "9", "10", "11", "12", "over13"}
	for _, ak := range ageKeys {
		for g := 1; g <= 6; g++ {
			gradeRoman := ""
			switch g {
			case 1:
				gradeRoman = "1"
			case 2:
				gradeRoman = "2"
			case 3:
				gradeRoman = "3"
			case 4:
				gradeRoman = "4"
			case 5:
				gradeRoman = "5"
			case 6:
				gradeRoman = "6"
			}
			templateData["u_"+ak+"_"+gradeRoman+"_l"] = 0
			templateData["u_"+ak+"_"+gradeRoman+"_p"] = 0
			templateData["u_"+ak+"_"+gradeRoman+"_t"] = 0
		}
		templateData["u_"+ak+"_t_l"] = 0
		templateData["u_"+ak+"_t_p"] = 0
		templateData["u_"+ak+"_t_t"] = 0
	}

	rows, err = h.Repo.DB.Query(`
		SELECT c.grade, s.gender, s.birth_date
		FROM students s
		JOIN student_classes c ON s.class_id = c.id
		WHERE s.status = 'active' AND s.birth_date IS NOT NULL AND s.birth_date != ''
	`)
	if err == nil {
		reportDate := time.Date(reportYear, time.Month(reportMonth), lastDay, 23, 59, 59, 0, time.Local)
		for rows.Next() {
			var grade int
			var gender string
			var bdateStr string
			if err := rows.Scan(&grade, &gender, &bdateStr); err == nil {
				if bdate, err := time.Parse("2006-01-02", bdateStr); err == nil {
					age := reportDate.Year() - bdate.Year()
					if reportDate.Month() < bdate.Month() || (reportDate.Month() == bdate.Month() && reportDate.Day() < bdate.Day()) {
						age--
					}

					ageKey := ""
					if age < 6 {
						ageKey = "under5"
					} else if age > 12 {
						ageKey = "over13"
					} else {
						ageKey = strconv.Itoa(age)
					}

					gradeStr := strconv.Itoa(grade)
					gender = strings.ToLower(gender)

					varKey := "u_" + ageKey + "_" + gradeStr + "_" + gender
					templateData[varKey] = templateData[varKey].(int) + 1

					varKeyTot := "u_" + ageKey + "_" + gradeStr + "_t"
					templateData[varKeyTot] = templateData[varKeyTot].(int) + 1

					varKeyGenderTot := "u_" + ageKey + "_t_" + gender
					templateData[varKeyGenderTot] = templateData[varKeyGenderTot].(int) + 1

					varKeyGrandTot := "u_" + ageKey + "_t_t"
					templateData[varKeyGrandTot] = templateData[varKeyGrandTot].(int) + 1
				}
			}
		}
		rows.Close()
	}

	// 4. Religions stats
	religionKeys := []string{"islam", "katolik", "protestan", "hindu", "budha"}
	for _, rk := range religionKeys {
		for g := 1; g <= 6; g++ {
			gradeRoman := ""
			switch g {
			case 1:
				gradeRoman = "1"
			case 2:
				gradeRoman = "2"
			case 3:
				gradeRoman = "3"
			case 4:
				gradeRoman = "4"
			case 5:
				gradeRoman = "5"
			case 6:
				gradeRoman = "6"
			}
			templateData["r_"+rk+"_"+gradeRoman+"_l"] = 0
			templateData["r_"+rk+"_"+gradeRoman+"_p"] = 0
			templateData["r_"+rk+"_"+gradeRoman+"_t"] = 0
		}
		templateData["r_"+rk+"_t_l"] = 0
		templateData["r_"+rk+"_t_p"] = 0
		templateData["r_"+rk+"_t_t"] = 0
	}

	rows, err = h.Repo.DB.Query(`
		SELECT c.grade, s.gender, COALESCE(s.religion, 'Islam')
		FROM students s
		JOIN student_classes c ON s.class_id = c.id
		WHERE s.status = 'active'
	`)
	if err == nil {
		for rows.Next() {
			var grade int
			var gender string
			var religion string
			if err := rows.Scan(&grade, &gender, &religion); err == nil {
				religion = strings.ToLower(strings.TrimSpace(religion))
				if religion == "" {
					religion = "islam"
				}
				if religion != "islam" && religion != "katolik" && religion != "protestan" && religion != "hindu" && religion != "budha" {
					religion = "islam"
				}

				gradeStr := strconv.Itoa(grade)
				gender = strings.ToLower(gender)

				varKey := "r_" + religion + "_" + gradeStr + "_" + gender
				templateData[varKey] = templateData[varKey].(int) + 1

				varKeyTot := "r_" + religion + "_" + gradeStr + "_t"
				templateData[varKeyTot] = templateData[varKeyTot].(int) + 1

				varKeyGenderTot := "r_" + religion + "_t_" + gender
				templateData[varKeyGenderTot] = templateData[varKeyGenderTot].(int) + 1

				varKeyGrandTot := "r_" + religion + "_t_t"
				templateData[varKeyGrandTot] = templateData[varKeyGrandTot].(int) + 1
			}
		}
		rows.Close()
	}

	// 5. Mebeler / Inventory stats
	type invItem struct {
		Baik   int
		Sedang int
		Rusak  int
	}
	invDefaults := map[string]invItem{
		"bangku":         {Baik: 0, Sedang: 0, Rusak: 0},
		"meja murid":     {Baik: 65, Sedang: 37, Rusak: 8},
		"kursi murid":     {Baik: 178, Sedang: 24, Rusak: 16},
		"lemari":          {Baik: 0, Sedang: 12, Rusak: 0},
		"meja guru":      {Baik: 10, Sedang: 1, Rusak: 3},
		"kursi guru":      {Baik: 10, Sedang: 10, Rusak: 2},
		"papan tulis":     {Baik: 5, Sedang: 2, Rusak: 0},
		"kursi tamu":      {Baik: 0, Sedang: 1, Rusak: 0},
		"rak buku/loker":  {Baik: 4, Sedang: 1, Rusak: 0},
		"sound system":    {Baik: 7, Sedang: 1, Rusak: 0},
		"komputer":        {Baik: 2, Sedang: 7, Rusak: 2},
	}

	dbInventory := make(map[string]invItem)
	rows, err = h.Repo.DB.Query(`
		SELECT name, SUM(condition_good), SUM(condition_light_damaged), SUM(condition_heavy_damaged)
		FROM inventory_assets
		WHERE status = 'ACTIVE'
		GROUP BY name
	`)
	if err == nil {
		for rows.Next() {
			var name string
			var good, light, heavy int
			if err := rows.Scan(&name, &good, &light, &heavy); err == nil {
				nameClean := strings.ToLower(strings.TrimSpace(name))
				dbInventory[nameClean] = invItem{Baik: good, Sedang: light, Rusak: heavy}
			}
		}
		rows.Close()
	}

	for key, def := range invDefaults {
		baik := def.Baik
		sedang := def.Sedang
		rusak := def.Rusak

		if dbVal, ok := dbInventory[key]; ok {
			baik = dbVal.Baik
			sedang = dbVal.Sedang
			rusak = dbVal.Rusak
		}

		varKey := strings.ReplaceAll(key, " ", "_")
		varKey = strings.ReplaceAll(varKey, "/", "_")

		templateData["i_"+varKey+"_baik"] = baik
		templateData["i_"+varKey+"_sedang"] = sedang
		templateData["i_"+varKey+"_rusak"] = rusak
		templateData["i_"+varKey+"_jumlah"] = baik + sedang + rusak
	}

	// 6. Land, Building, etc. (Static / Fallbacks)
	templateData["t_luas"] = "3.000"
	templateData["t_persil"] = "-"
	templateData["t_tahun"] = "2013"
	templateData["t_harga"] = "Wakaf"

	templateData["b_baik"] = 3
	templateData["b_rusak"] = 11
	templateData["b_jumlah"] = 14

	templateData["b_sewa"] = "-"

	templateData["rd_sd_p"] = "1"
	templateData["rd_sd_sp"] = "-"
	templateData["rd_sd_dr"] = "-"
	templateData["rd_sd_tahun"] = "1998"
	templateData["rd_sd_harga"] = "-"

	templateData["rd_guru_p"] = "2"
	templateData["rd_guru_sp"] = "-"
	templateData["rd_guru_dr"] = "-"
	templateData["rd_guru_tahun"] = "-"
	templateData["rd_guru_harga"] = "-"

	templateData["rd_penjaga_p"] = "-"
	templateData["rd_penjaga_sp"] = "-"
	templateData["rd_penjaga_dr"] = "-"
	templateData["rd_penjaga_tahun"] = "-"
	templateData["rd_penjaga_harga"] = "-"

	templateData["rd_lain_p"] = "-"
	templateData["rd_lain_sp"] = "-"
	templateData["rd_lain_dr"] = "-"
	templateData["rd_lain_tahun"] = "-"
	templateData["rd_lain_harga"] = "-"

	templateData["air_bersih"] = "Ledeng"
	templateData["hari_efektif"] = 20

	// 7. GTK list & counts
	type GTKRow struct {
		No         int    `json:"no"`
		Nama       string `json:"nama"`
		Nip        string `json:"nip"`
		Gender     string `json:"gender"`
		TTL        string `json:"ttl"`
		Gol        string `json:"gol"`
		Status     string `json:"status"`
		Pendidikan string `json:"pendidikan"`
		TglMengabdi string `json:"tgl_mengabdi"`
		TmtCpns    string `json:"tmt_cpns"`
		TmtGol     string `json:"tmt_gol"`
		NRG        string `json:"nrg"`
		NUPTK      string `json:"nuptk"`
		Mengajar   string `json:"mengajar"`
		JPL        string `json:"jpl"`
	}

	var gtkList []GTKRow
	var numKepsek, numGuruKelas, numInggris, numPenjas, numAgama, numOperator, numPenjaga int

	rows, err = h.Repo.DB.Query(`
		SELECT name, nip, position, category, COALESCE(degree, '')
		FROM staff_profiles
		WHERE is_active = 1
		ORDER BY display_order ASC
	`)
	if err == nil {
		idx := 1
		for rows.Next() {
			var name, nip, position, category, degree string
			if err := rows.Scan(&name, &nip, &position, &category, &degree); err == nil {
				gender := "L"
				ttl := "-"
				gol := "-"
				status := "Honorer"
				pendidikan := degree
				if pendidikan == "" {
					pendidikan = "S-1"
				}
				tglMengabdi := "-"
				tmtCpns := "-"
				tmtGol := "-"
				nrg := "-"
				nuptk := "-"
				mengajar := "-"
				jpl := "-"

				if static, ok := gtkStaticDetails[nip]; ok {
					gender = static.Gender
					ttl = static.TTL
					gol = static.Gol
					status = static.Status
					pendidikan = static.Pendidikan
					tglMengabdi = static.TglMengabdi
					tmtCpns = static.TmtCpns
					tmtGol = static.TmtGol
					nrg = static.NRG
					nuptk = static.NUPTK
					mengajar = static.Mengajar
					jpl = static.JPL
				}

				posLower := strings.ToLower(position)
				catLower := strings.ToLower(category)

				if catLower == "kepsek" || strings.Contains(posLower, "kepala sekolah") {
					numKepsek++
				} else if strings.Contains(posLower, "guru kelas") || strings.Contains(posLower, "kelas") {
					numGuruKelas++
				} else if strings.Contains(posLower, "inggris") {
					numInggris++
				} else if strings.Contains(posLower, "penjas") || strings.Contains(posLower, "pjok") || strings.Contains(posLower, "olahraga") {
					numPenjas++
				} else if strings.Contains(posLower, "agama") || strings.Contains(posLower, "pai") {
					numAgama++
				} else if strings.Contains(posLower, "operator") {
					numOperator++
				} else if strings.Contains(posLower, "penjaga") || catLower == "support" {
					numPenjaga++
				}

				fullName := name
				if degree != "" {
					fullName = name + ", " + degree
				}

				gtkList = append(gtkList, GTKRow{
					No:         idx,
					Nama:       fullName,
					Nip:        nip,
					Gender:     gender,
					TTL:        ttl,
					Gol:        gol,
					Status:     status,
					Pendidikan: pendidikan,
					TglMengabdi: tglMengabdi,
					TmtCpns:    tmtCpns,
					TmtGol:     tmtGol,
					NRG:        nrg,
					NUPTK:      nuptk,
					Mengajar:   mengajar,
					JPL:        jpl,
				})
				idx++
			}
		}
		rows.Close()
	}

	templateData["g_kepsek"] = numKepsek
	templateData["g_guru_kelas"] = numGuruKelas
	templateData["g_inggris"] = numInggris
	templateData["g_penjas"] = numPenjas
	templateData["g_agama"] = numAgama
	templateData["g_operator"] = numOperator
	templateData["g_penjaga"] = numPenjaga
	templateData["g_jumlah"] = numKepsek + numGuruKelas + numInggris + numPenjas + numAgama + numOperator + numPenjaga

	templateData["gtk_list"] = gtkList

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    templateData,
	})
}
