package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type DocumentHandler struct {
	Repo *repository.DocumentRepository
}

func NewDocumentHandler(repo *repository.DocumentRepository) *DocumentHandler {
	return &DocumentHandler{Repo: repo}
}

func (h *DocumentHandler) Create(c echo.Context) error {
	var req struct {
		DocumentType string  `json:"documentType"`
		Title        string  `json:"title"`
		Recipient    string  `json:"recipient"`
		ReferenceID  *string `json:"referenceId"`
		FilePath     string  `json:"filePath"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}
	if req.DocumentType == "" || req.Title == "" || req.FilePath == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Tipe, Judul, dan File Path wajib diisi"})
	}
	if req.Recipient == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Penerima wajib diisi"})
	}

	uid := currentUserID(c)
	now := time.Now().UnixMilli()

	doc := models.SchoolDocument{
		ID:           cuid2.Generate(),
		DocumentType: req.DocumentType,
		Title:        req.Title,
		Recipient:    req.Recipient,
		ReferenceID:  req.ReferenceID,
		FilePath:     req.FilePath,
		CreatedBy:    &uid,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := h.Repo.Create(doc); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "data": doc})
}

func (h *DocumentHandler) GetByID(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "ID wajib diisi"})
	}

	doc, err := h.Repo.GetByID(id)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Dokumen tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": doc})
}

func (h *DocumentHandler) List(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit = 20
	}
	search := c.QueryParam("search")
	docType := c.QueryParam("documentType")

	docs, total, err := h.Repo.List(page, limit, search, docType)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    docs,
		"total":   total,
		"page":    page,
		"limit":   limit,
	})
}

func (h *DocumentHandler) Update(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "ID wajib diisi"})
	}

	// Verify document exists
	existing, err := h.Repo.GetByID(id)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Dokumen tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Verify ownership
	uid := currentUserID(c)
	if existing.CreatedBy != nil && *existing.CreatedBy != "" && *existing.CreatedBy != uid {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Anda tidak memiliki izin untuk mengubah dokumen ini"})
	}

	var req struct {
		DocumentType string `json:"documentType"`
		Title        string `json:"title"`
		Recipient    string `json:"recipient"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}

	// Apply updates (keep existing values if not provided)
	if req.DocumentType != "" {
		existing.DocumentType = req.DocumentType
	}
	if req.Title != "" {
		existing.Title = req.Title
	}
	if req.Recipient != "" {
		existing.Recipient = req.Recipient
	}
	existing.UpdatedAt = time.Now().UnixMilli()

	if err := h.Repo.Update(*existing); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": existing})
}

func (h *DocumentHandler) Delete(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "ID wajib diisi"})
	}

	// Fetch existing document for ownership check and file cleanup
	existing, err := h.Repo.GetByID(id)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Dokumen tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Verify ownership
	uid := currentUserID(c)
	if existing.CreatedBy != nil && *existing.CreatedBy != "" && *existing.CreatedBy != uid {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Anda tidak memiliki izin untuk menghapus dokumen ini"})
	}

	// Delete from database
	affected, err := h.Repo.Delete(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if affected == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Dokumen tidak ditemukan"})
	}

	// Clean up physical file
	if existing.FilePath != "" {
		diskPath := filepath.Join("public", existing.FilePath)
		if err := os.Remove(diskPath); err != nil && !os.IsNotExist(err) {
			log.Printf("[WARN] document_handler.Delete: failed to remove file %s: %v", diskPath, err)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
