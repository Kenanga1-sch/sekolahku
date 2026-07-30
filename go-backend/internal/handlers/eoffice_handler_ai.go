package handlers

import (
	"bytes"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v4"
)

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

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, src); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	fileBytes := buf.Bytes()

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

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":    true,
			"ai_enabled": false,
			"message":    "GEMINI_API_KEY tidak disetel di server",
		})
	}

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
