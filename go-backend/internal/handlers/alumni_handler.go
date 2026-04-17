package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type AlumniHandler struct {
	Repo *repository.AlumniRepository
}

func NewAlumniHandler(repo *repository.AlumniRepository) *AlumniHandler {
	return &AlumniHandler{Repo: repo}
}

func (h *AlumniHandler) GetAlumni(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 { page = 1 }
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 { limit = 20 }
	search := c.QueryParam("search")
	year := c.QueryParam("graduationYear")

	items, total, err := h.Repo.GetAlumni(page, limit, search, year)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": items,
		"pagination": map[string]interface{}{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"totalPages": (total + limit - 1) / limit,
		},
	})
}

func (h *AlumniHandler) GetAlumniByID(c echo.Context) error {
	id := c.Param("id")
	alumni, err := h.Repo.GetAlumniByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Alumni not found"})
	}
	return c.JSON(http.StatusOK, alumni)
}

func (h *AlumniHandler) CreateAlumni(c echo.Context) error {
	var a models.Alumni
	if err := c.Bind(&a); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	id, err := h.Repo.CreateAlumni(a)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"id": id, "success": true})
}

func (h *AlumniHandler) UpdateAlumni(c echo.Context) error {
	id := c.Param("id")
	var a models.Alumni
	if err := c.Bind(&a); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	if err := h.Repo.UpdateAlumni(id, a); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AlumniHandler) DeleteAlumni(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteAlumni(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AlumniHandler) GetAlumniStats(c echo.Context) error {
	stats, err := h.Repo.GetAlumniStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, stats)
}

func (h *AlumniHandler) GetDocumentTypes(c echo.Context) error {
	list, err := h.Repo.GetDocumentTypes()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, list)
}

func (h *AlumniHandler) CreateDocument(c echo.Context) error {
	alumniID := c.Param("id")
	
	// Handle Multipart Form
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "File is required"})
	}

	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	// Destination
	uploadDir := filepath.Join("uploads", "alumni", alumniID)
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return err
	}

	filename := fmt.Sprintf("%d_%s", time.Now().Unix(), file.Filename)
	dstPath := filepath.Join(uploadDir, filename)
	
	dst, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return err
	}

	// Save to DB
	docNumber := c.FormValue("documentNumber")
	issueDate := c.FormValue("issueDate")
	notes := c.FormValue("notes")
	docTypeID := c.FormValue("documentTypeId")

	doc := models.AlumniDocument{
		AlumniID:       alumniID,
		DocumentTypeID: docTypeID,
		FileName:       file.Filename,
		FilePath:       filepath.ToSlash(dstPath),
		FileSize:       int(file.Size),
		MimeType:       file.Header.Get("Content-Type"),
	}
	if docNumber != "" { doc.DocumentNumber = &docNumber }
	if issueDate != "" { doc.IssueDate = &issueDate }
	if notes != "" { doc.Notes = &notes }

	if err := h.Repo.CreateDocument(doc); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]bool{"success": true})
}

func (h *AlumniHandler) CreatePickup(c echo.Context) error {
	alumniID := c.Param("id")
	var p models.DocumentPickup
	if err := c.Bind(&p); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}
	p.AlumniID = alumniID
	
	if err := h.Repo.CreatePickup(p); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	
	return c.JSON(http.StatusCreated, map[string]bool{"success": true})
}
