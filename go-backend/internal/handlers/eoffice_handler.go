package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type EOfficeHandler struct {
	Repo *repository.EOfficeRepository
	Notifications *repository.NotificationRepository
}

func NewEOfficeHandler(repo *repository.EOfficeRepository, notifications *repository.NotificationRepository) *EOfficeHandler {
	return &EOfficeHandler{Repo: repo, Notifications: notifications}
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

// ============ Helpers ============

func stringPtrIfNotEmpty(v string) *string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return &v
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

// ============ Arsip Stats ============

func (h *EOfficeHandler) GetArsipStats(c echo.Context) error {
	stats, err := h.Repo.GetArsipStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": stats})
}

// ============ Klasifikasi ============

func (h *EOfficeHandler) GetKlasifikasi(c echo.Context) error {
	includeInactive := c.QueryParam("include_inactive") == "true"
	list, err := h.Repo.GetKlasifikasi(includeInactive)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
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
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
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
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": k})
}

func (h *EOfficeHandler) DeleteKlasifikasi(c echo.Context) error {
	code := c.Param("code")
	if err := h.Repo.DeleteKlasifikasi(code); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ============ Numbering ============

func (h *EOfficeHandler) Numbering(c echo.Context) error {
	var req models.NumberingRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	nextSeq, err := h.Repo.CalculateNextLetterSequence(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": nextSeq})
}

func (h *EOfficeHandler) Increment(c echo.Context) error {
	var req models.IncrementRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}
	if err := h.Repo.IncrementLetterSequence(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "newSequence": req.SequenceNumber})
}
