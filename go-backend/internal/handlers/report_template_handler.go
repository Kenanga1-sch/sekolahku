package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// maxLayoutJSONBytes membatasi ukuran layout template yang disimpan. Cukup untuk
// template kerja nyata (ratusan sel) namun menolak body raksasa yang bisa
// membengkakkan DB / memori saat rendering di klien.
const maxLayoutJSONBytes = 512 * 1024

// validateLayoutJSON memastikan layout_json adalah JSON yang valid dan tidak
// kosong sebelum disimpan. Mengembalikan pesan error yang aman untuk klien.
func validateLayoutJSON(raw string) (string, bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", true // layout opsional: template boleh dibuat tanpa layout
	}
	if len(trimmed) > maxLayoutJSONBytes {
		return "layoutJson terlalu besar", false
	}
	if !json.Valid([]byte(trimmed)) {
		return "layoutJson bukan JSON yang valid", false
	}
	return "", true
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
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
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

	var req models.UpdateReportTemplateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Invalid request body",
		})
	}

	if msg, ok := validateLayoutJSON(req.LayoutJSON); !ok {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   msg,
		})
	}

	tpl, err := h.repo.Update(id, &req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
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
