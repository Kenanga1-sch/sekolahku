package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

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
