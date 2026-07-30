package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/shared"
)

func (h *AlumniHandler) GetDocumentTypes(c echo.Context) error {
	list, err := h.Repo.GetDocumentTypes()
	if err != nil {
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, list)
}

func (h *AlumniHandler) CreateDocument(c echo.Context) error {
	alumniID := c.Param("id")
	docTypeID := c.FormValue("documentTypeId")
	if strings.TrimSpace(docTypeID) == "" {
		return shared.BadRequest(c, "Jenis dokumen wajib dipilih")
	}

	file, err := c.FormFile("file")
	if err != nil {
		return shared.BadRequest(c, "File wajib diupload")
	}

	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	uploadDir := filepath.Join("uploads", "alumni", alumniID)
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return err
	}

	filename := fmt.Sprintf("%d_%s", time.Now().Unix(), filepath.Base(file.Filename))
	dstPath := filepath.Join(uploadDir, filename)
	dst, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer dst.Close()
	if _, err = io.Copy(dst, src); err != nil {
		return err
	}

	doc := models.AlumniDocument{
		AlumniID:       alumniID,
		DocumentTypeID: docTypeID,
		FileName:       file.Filename,
		FilePath:       "/" + filepath.ToSlash(dstPath),
		FileSize:       int(file.Size),
		MimeType:       file.Header.Get("Content-Type"),
	}
	if dn := c.FormValue("documentNumber"); dn != "" {
		doc.DocumentNumber = &dn
	}
	if id := c.FormValue("issueDate"); id != "" {
		doc.IssueDate = &id
	}
	if notes := c.FormValue("notes"); notes != "" {
		doc.Notes = &notes
	}

	if err := h.Repo.CreateDocument(doc); err != nil {
		return shared.InternalError(c)
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *AlumniHandler) VerifyDocument(c echo.Context) error {
	var req struct {
		Status string `json:"status"`
		Notes  string `json:"notes"`
	}
	if err := c.Bind(&req); err != nil {
		return shared.BadRequest(c, "Input tidak valid")
	}
	req.Status = strings.TrimSpace(req.Status)
	if req.Status != "verified" && req.Status != "rejected" && req.Status != "pending" {
		return shared.BadRequest(c, "Status dokumen tidak valid")
	}
	if err := h.Repo.VerifyDocument(c.Param("docId"), req.Status, shared.StringPtr(req.Notes)); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return shared.NotFound(c, "Dokumen tidak ditemukan")
		}
		return shared.InternalError(c)
	}
	return shared.SuccessResponse(c, nil)
}

func (h *AlumniHandler) DeleteDocument(c echo.Context) error {
	doc, err := h.Repo.DeleteDocument(c.Param("docId"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return shared.NotFound(c, "Dokumen tidak ditemukan")
		}
		return shared.InternalError(c)
	}
	if diskPath, _ := resolveStoredFilePath(doc.FilePath); diskPath != "" {
		os.Remove(diskPath)
	}
	return shared.SuccessResponse(c, nil)
}

func (h *AlumniHandler) DownloadDocument(c echo.Context) error {
	doc, err := h.Repo.GetDocumentByID(c.Param("docId"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return shared.NotFound(c, "Dokumen tidak ditemukan")
		}
		return shared.InternalError(c)
	}
	diskPath, _ := resolveStoredFilePath(doc.FilePath)
	if diskPath == "" {
		return shared.NotFound(c, "File dokumen tidak ditemukan")
	}
	return c.Attachment(diskPath, doc.FileName)
}
