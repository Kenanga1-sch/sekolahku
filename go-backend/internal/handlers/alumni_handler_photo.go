package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/shared"
)

func (h *AlumniHandler) UploadPhoto(c echo.Context) error {
	alumniID := c.Param("id")
	file, err := c.FormFile("photo")
	if err != nil {
		return shared.BadRequest(c, "Foto wajib dipilih")
	}

	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	buf := make([]byte, 512)
	n, _ := src.Read(buf)
	ct := http.DetectContentType(buf[:n])
	src.Seek(0, io.SeekStart)

	if ct != "image/jpeg" && ct != "image/png" && ct != "image/webp" {
		return shared.BadRequest(c, "Format foto harus JPG, PNG, atau WebP")
	}

	uploadDir := filepath.Join("uploads", "alumni", alumniID)
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return err
	}

	filename := fmt.Sprintf("photo_%d_%s", time.Now().Unix(), filepath.Base(file.Filename))
	dstPath := filepath.Join(uploadDir, filename)
	dst, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer dst.Close()
	if _, err := io.Copy(dst, src); err != nil {
		return err
	}

	photoPath := "/" + filepath.ToSlash(dstPath)
	if err := h.Repo.UpdatePhoto(alumniID, photoPath); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return shared.NotFound(c, "Alumni tidak ditemukan")
		}
		return shared.InternalError(c)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "photo": photoPath})
}

func (h *AlumniHandler) RemovePhoto(c echo.Context) error {
	alumniID := c.Param("id")
	photoPath, err := h.Repo.RemovePhoto(alumniID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return shared.NotFound(c, "Alumni tidak ditemukan")
		}
		return shared.InternalError(c)
	}
	if diskPath, _ := resolveStoredFilePath(photoPath); diskPath != "" {
		os.Remove(diskPath)
	}
	return shared.SuccessResponse(c, nil)
}
