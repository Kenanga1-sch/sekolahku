package handlers

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// maxLayoutJSONBytes membatasi ukuran layout template yang disimpan. Cukup untuk
// template kerja nyata (ratusan sel) namun menolak body raksasa yang bisa
// membengkakkan DB / memori saat rendering di klien. Dinaikkan ke 2 MiB agar
// template kompleks (multi-lembar, banyak sel) tetap bisa disimpan.
const maxLayoutJSONBytes = 2 * 1024 * 1024

// cellKeyPattern mencocokkan kunci sel sparse map format "r,c" (0-indexed).
var cellKeyPattern = regexp.MustCompile(`^(\d+),(\d+)$`)

// layoutSheetShape mendeskripsikan bentuk minimal satu lembar pada schema v3
// yang perlu divalidasi tanpa mendekode seluruh struktur sel.
type layoutSheetShape struct {
	Cols  int                        `json:"cols"`
	Cells map[string]json.RawMessage `json:"cells"`
}

// layoutShape mendeskripsikan bentuk minimal layoutJson schema v3.
type layoutShape struct {
	SchemaVersion int                `json:"schemaVersion"`
	Sheets        []layoutSheetShape `json:"sheets"`
}

// validateLayoutJSON memastikan layout_json adalah JSON yang valid, tidak
// kosong, dan berbentuk schema v3 yang konsisten sebelum disimpan. Mengembalikan
// pesan error yang aman untuk klien.
func validateLayoutJSON(raw string) (string, bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", true // layout opsional: template boleh dibuat tanpa layout
	}
	if len(trimmed) > maxLayoutJSONBytes {
		return fmt.Sprintf("layoutJson terlalu besar (maks %d byte)", maxLayoutJSONBytes), false
	}
	if !json.Valid([]byte(trimmed)) {
		return "layoutJson bukan JSON yang valid", false
	}

	var shape layoutShape
	if err := json.Unmarshal([]byte(trimmed), &shape); err != nil {
		return "layoutJson bukan objek schema v3 yang valid", false
	}
	if shape.SchemaVersion != 3 {
		return fmt.Sprintf("schemaVersion harus 3 (ditemukan %d)", shape.SchemaVersion), false
	}
	if shape.Sheets == nil {
		return "sheets harus berupa array", false
	}
	for i, sheet := range shape.Sheets {
		if sheet.Cols < 1 {
			return fmt.Sprintf("sheets[%d].cols tidak valid", i), false
		}
		for key := range sheet.Cells {
			m := cellKeyPattern.FindStringSubmatch(key)
			if m == nil {
				return fmt.Sprintf("kunci sel '%s' tidak valid (harus format 'baris,kolom')", key), false
			}
			col, _ := strconv.Atoi(m[2])
			if col < 0 || col >= sheet.Cols {
				return fmt.Sprintf("kunci sel '%s' di luar batas kolom (cols=%d)", key, sheet.Cols), false
			}
		}
	}
	return "", true
}

// respondTemplateError memetakan error repo ke respons HTTP yang sesuai:
// ErrDuplicateCode → 409 Conflict, selainnya → 500.
func respondTemplateError(c echo.Context, err error, fallback string) error {
	if errors.Is(err, repository.ErrDuplicateCode) {
		return c.JSON(http.StatusConflict, map[string]interface{}{
			"success": false,
			"error":   "Kode template sudah dipakai",
		})
	}
	return c.JSON(http.StatusInternalServerError, map[string]interface{}{
		"success": false,
		"error":   fallback,
	})
}

type ReportTemplateHandler struct {
	repo *repository.ReportTemplateRepository
}

func NewReportTemplateHandler(repo *repository.ReportTemplateRepository) *ReportTemplateHandler {
	return &ReportTemplateHandler{repo: repo}
}

func (h *ReportTemplateHandler) GetAll(c echo.Context) error {
	category := c.QueryParam("category")
	list, err := h.repo.GetAll(category)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    list,
	})
}

func (h *ReportTemplateHandler) GetByID(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Invalid template ID",
		})
	}

	tpl, err := h.repo.GetByID(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}
	if tpl == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Report template not found",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    tpl,
	})
}

// GetByModule mengembalikan daftar template untuk modul tertentu.
func (h *ReportTemplateHandler) GetByModule(c echo.Context) error {
	module := c.Param("module")
	list, err := h.repo.GetByModule(module)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    list,
	})
}

func (h *ReportTemplateHandler) GetByCode(c echo.Context) error {
	code := c.Param("code")
	tpl, err := h.repo.GetByCode(code)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}
	if tpl == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Report template not found",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    tpl,
	})
}

// GetDefaultModule mengembalikan template default sebuah modul
// (dipakai klien untuk mengambil file template dinamis).
func (h *ReportTemplateHandler) GetDefaultModule(c echo.Context) error {
	module := c.Param("module")
	tpl, err := h.repo.GetDefaultModule(module)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}
	if tpl == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Belum ada template default untuk modul ini",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    tpl,
	})
}

// SetDefault menjadikan satu template sebagai default modulnya.
func (h *ReportTemplateHandler) SetDefault(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Invalid template ID",
		})
	}
	tpl, err := h.repo.SetDefault(id)
	if err != nil {
		return respondTemplateError(c, err, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    tpl,
	})
}

func (h *ReportTemplateHandler) Create(c echo.Context) error {
	var req models.CreateReportTemplateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Invalid request body",
		})
	}

	if req.Code == "" || req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Code and Name are required",
		})
	}

	if msg, ok := validateLayoutJSON(req.LayoutJSON); !ok {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   msg,
		})
	}

	tpl, err := h.repo.Create(&req)
	if err != nil {
		return respondTemplateError(c, err, err.Error())
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    tpl,
	})
}

func (h *ReportTemplateHandler) Update(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Invalid template ID",
		})
	}

	// `code` tidak ada pada UpdateReportTemplateRequest; gunakan struct lokal
	// yang menambahkan field code agar perubahan kode persisten sekaligus
	// menghindari binding body dua kali (body hanya bisa dibaca sekali).
	var body struct {
		models.UpdateReportTemplateRequest
		Code string `json:"code"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Invalid request body",
		})
	}
	req := body.UpdateReportTemplateRequest

	if msg, ok := validateLayoutJSON(req.LayoutJSON); !ok {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   msg,
		})
	}

	tpl, err := h.repo.Update(id, &req, body.Code)
	if err != nil {
		return respondTemplateError(c, err, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    tpl,
	})
}

func (h *ReportTemplateHandler) Delete(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Invalid template ID",
		})
	}

	if err := h.repo.Delete(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Report template deleted successfully",
	})
}

// Batas berkas template Excel yang diunggah admin.
const (
	templateXLSXMaxBytes = int64(5 << 20) // 5 MB
	templateXLSXDir      = "templates"
)

// templateFileRoots kandidat direktori penyimpanan berkas template,
// mengikuti pola resolvePublicUploadsDir (dist hot-swap diutamakan).
func templateFileRoots() []string {
	return []string{
		filepath.Join("public", templateXLSXDir),
		filepath.Join("..", "public", templateXLSXDir),
	}
}

// resolveTemplateFile memastikan file_path aman (relatif, di dalam
// direktori templates, berekstensi .xlsx) lalu mengembalikan path absolut
// kandidat pertama yang ada (untuk baca) — sibling-nya untuk tulis.
func resolveTemplateFile(rel string) (string, error) {
	clean := filepath.Clean("/" + strings.TrimSpace(rel))
	clean = strings.TrimPrefix(clean, "/")
	if clean == "" || clean == "." {
		return "", fmt.Errorf("file_path kosong")
	}
	if !strings.HasPrefix(clean, templateXLSXDir+"/") {
		return "", fmt.Errorf("file_path harus di dalam direktori templates/")
	}
	if strings.ToLower(filepath.Ext(clean)) != ".xlsx" {
		return "", fmt.Errorf("hanya berkas .xlsx yang didukung")
	}
	base := strings.TrimPrefix(clean, templateXLSXDir+"/")
	if base == "" || strings.Contains(base, "/") || strings.Contains(base, `\`) || strings.HasPrefix(base, ".") {
		return "", fmt.Errorf("nama berkas tidak valid")
	}
	roots := templateFileRoots()
	for _, r := range roots {
		p := filepath.Join(r, base)
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}
	return filepath.Join(roots[0], base), nil
}

// sniffXLSX memastikan isi berkas benar-benar arsip ZIP OOXML (.xlsx),
// bukan HTML/JS yang diganti ekstensi (stored XSS via unduhan).
func sniffXLSX(data []byte) bool {
	if len(data) < 4 {
		return false
	}
	return data[0] == 'P' && data[1] == 'K' && data[2] == 0x03 && data[3] == 0x04
}

// hasRowVariable memindai teks sel worksheet pertama untuk memastikan
// template memiliki baris contoh bervariabel ({{no}}/{{nama}}/{{tgl_N}}).
// Berkas dibuka sebagai arsip ZIP dan isi sheet + sharedStrings dibaca
// (tanpa library tambahan) — teks di ZIP terkompresi sehingga pemindaian
// mentah tidak bisa dipakai.
func hasRowVariable(data []byte) bool {
	zr, err := zipOpen(data)
	if err != nil {
		return false
	}
	markers := []string{"{{no}}", "{{nama}}", "{{tgl_"}
	hits := 0
	for _, m := range markers {
		if strings.Contains(zr, m) {
			hits++
		}
		if hits >= 2 {
			return true
		}
	}
	return false
}

// zipOpen menggabungkan teks dari semua entri XML arsip OOXML
// (sheet + sharedStrings) untuk pemindaian marker.
func zipOpen(data []byte) (string, error) {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", err
	}
	var sb strings.Builder
	for _, f := range r.File {
		name := strings.ToLower(f.Name)
		if !(strings.HasSuffix(name, ".xml") || strings.HasSuffix(name, ".xml.rels")) {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			continue
		}
		content, err := io.ReadAll(io.LimitReader(rc, 5<<20))
		rc.Close()
		if err != nil {
			continue
		}
		sb.Write(content)
		sb.WriteByte('\n')
	}
	if sb.Len() == 0 {
		return "", fmt.Errorf("arsip kosong")
	}
	return sb.String(), nil
}

func readUploadFile(fh *multipart.FileHeader, maxBytes int64) ([]byte, error) {
	if fh == nil {
		return nil, fmt.Errorf("file tidak ditemukan")
	}
	if fh.Size > maxBytes {
		return nil, fmt.Errorf("ukuran berkas melebihi %d MB", maxBytes>>20)
	}
	f, err := fh.Open()
	if err != nil {
		return nil, fmt.Errorf("gagal membuka berkas")
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxBytes+1))
	if err != nil {
		return nil, fmt.Errorf("gagal membaca berkas")
	}
	if int64(len(data)) > maxBytes {
		return nil, fmt.Errorf("ukuran berkas melebihi %d MB", maxBytes>>20)
	}
	return data, nil
}

// UploadXLSX menerima berkas .xlsx dari admin, memvalidasinya (ZIP OOXML +
// minimal 2 marker baris {{no}}/{{nama}}/{{tgl_}}), menyimpannya ke
// public/templates/<slug>-<timestamp>.xlsx, lalu memperbarui file_path
// template yang dimaksud.
func (h *ReportTemplateHandler) UploadXLSX(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Invalid template ID",
		})
	}
	tpl, err := h.repo.GetByID(id)
	if err != nil {
		return respondTemplateError(c, err, err.Error())
	}
	if tpl == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Report template not found",
		})
	}

	fh, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Field file wajib diisi (.xlsx)",
		})
	}
	if strings.ToLower(filepath.Ext(fh.Filename)) != ".xlsx" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Hanya berkas .xlsx yang didukung",
		})
	}
	data, err := readUploadFile(fh, templateXLSXMaxBytes)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}
	if !sniffXLSX(data) {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Berkas bukan Excel valid (harus .xlsx asli)",
		})
	}
	if !hasRowVariable(data) {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Template tidak memiliki baris contoh bervariabel (perlu {{no}}, {{nama}}, {{tgl_1}}…)",
		})
	}

	slug := strings.ToLower(strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			return r
		}
		return '-'
	}, tpl.Code))
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = "template"
	}
	filename := fmt.Sprintf("%s-%d.xlsx", slug, time.Now().Unix())
	rel := templateXLSXDir + "/" + filename
	abs, err := resolveTemplateFile(rel)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0755); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menyiapkan direktori template",
		})
	}
	if err := os.WriteFile(abs, data, 0644); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menyimpan berkas template",
		})
	}

	updated, err := h.repo.UpdateFilePath(id, rel)
	if err != nil {
		_ = os.Remove(abs)
		return respondTemplateError(c, err, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    updated,
	})
}

// DownloadFile menyajikan berkas template .xlsx agar admin bisa mengunduh,
// mengedit di Excel, lalu mengunggah ulang.
func (h *ReportTemplateHandler) DownloadFile(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Invalid template ID",
		})
	}
	tpl, err := h.repo.GetByID(id)
	if err != nil {
		return respondTemplateError(c, err, err.Error())
	}
	if tpl == nil || tpl.FilePath == "" {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Template tidak memiliki berkas",
		})
	}
	abs, err := resolveTemplateFile(tpl.FilePath)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
	}
	if _, err := os.Stat(abs); err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Berkas template tidak ditemukan di server",
		})
	}
	return c.File(abs)
}
