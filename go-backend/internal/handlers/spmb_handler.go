package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
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

type SPMBHandler struct {
	Repo *repository.SPMBRepository
}

func NewSPMBHandler(repo *repository.SPMBRepository) *SPMBHandler {
	return &SPMBHandler{Repo: repo}
}

func (h *SPMBHandler) Register(c echo.Context) error {
	var m models.SPMBRegistrant
	if err := c.Bind(&m); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Format data pendaftaran tidak valid",
		})
	}

	// Create registrant
	id, regNum, err := h.Repo.CreateRegistrant(m)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menyimpan data pendaftaran: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"id":                  id,
			"registration_number": regNum,
		},
	})
}

func (h *SPMBHandler) UploadDocuments(c echo.Context) error {
	registrantId := c.QueryParam("id")
	if registrantId == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "ID pendaftar diperlukan"})
	}

	form, err := c.MultipartForm()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Format formulir tidak valid"})
	}

	files := form.File["documents"]
	types := form.Value["types"]

	if len(files) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Tidak ada file yang diunggah"})
	}

	allowed := map[string]string{
		"application/pdf": "pdf",
		"image/jpeg":      "jpg",
		"image/png":       "png",
	}

	type DocumentFile struct {
		Path         string `json:"path"`
		Type         string `json:"type"`
		OriginalName string `json:"originalName"`
	}

	var savedFiles []DocumentFile
	uploadDir := filepath.Join("public", "uploads", "spmb", registrantId)
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuat direktori penyimpanan"})
	}

	for i, fh := range files {
		if fh.Size > 2*1024*1024 {
			continue // Skip files > 2MB
		}

		src, err := fh.Open()
		if err != nil {
			continue
		}

		buf := make([]byte, 512)
		n, _ := src.Read(buf)
		ct := http.DetectContentType(buf[:n])
		src.Seek(0, io.SeekStart)

		ext, ok := allowed[ct]
		if !ok {
			ext, ok = allowed[fh.Header.Get("Content-Type")]
		}
		if !ok {
			src.Close()
			continue
		}

		// Generate random filename
		b := make([]byte, 8)
		rand.Read(b)
		filename := fmt.Sprintf("%d-%s.%s", time.Now().UnixMilli(), hex.EncodeToString(b), ext)
		dstPath := filepath.Join(uploadDir, filename)

		dst, err := os.Create(dstPath)
		if err != nil {
			src.Close()
			continue
		}

		io.Copy(dst, src)
		src.Close()
		dst.Close()

		docType := "other"
		if i < len(types) {
			docType = types[i]
		}

		savedFiles = append(savedFiles, DocumentFile{
			Path:         fmt.Sprintf("/uploads/spmb/%s/%s", registrantId, filename),
			Type:         docType,
			OriginalName: fh.Filename,
		})
	}

	if len(savedFiles) > 0 {
		// Update DB
		docsJSON, _ := json.Marshal(savedFiles)
		if err := h.Repo.UpdateRegistrantDocuments(registrantId, string(docsJSON)); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal memperbarui data dokumen di database"})
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"count": len(savedFiles),
		},
	})
}

func (h *SPMBHandler) GetPeriods(c echo.Context) error {
	periods, err := h.Repo.GetPeriods()
	if err != nil {
		c.Logger().Error("Failed to get periods:", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal mengambil data periode",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    periods,
	})
}

func (h *SPMBHandler) GetActivePeriod(c echo.Context) error {
	period, err := h.Repo.GetActivePeriod()
	if err != nil {
		c.Logger().Error("Failed to get active period:", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal mengambil data periode aktif",
		})
	}

	isOpen := false
	if period != nil {
		now := time.Now()
		if period.StartDate != nil && period.EndDate != nil {
			if now.After(*period.StartDate) && now.Before(*period.EndDate) {
				isOpen = true
			}
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"period":  period,
		"isOpen":  isOpen,
	})
}

func (h *SPMBHandler) CreatePeriod(c echo.Context) error {
	var req models.CreateSPMBPeriodRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Format data tidak valid",
		})
	}

	period, err := h.Repo.CreatePeriod(req)
	if err != nil {
		c.Logger().Error("Failed to create period:", err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal membuat periode",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    period,
	})
}

func (h *SPMBHandler) UpdatePeriod(c echo.Context) error {
	id := c.Param("id")
	var req models.UpdateSPMBPeriodRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	if err := h.Repo.UpdatePeriod(id, req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SPMBHandler) DeletePeriod(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeletePeriod(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SPMBHandler) GetLandingData(c echo.Context) error {
	period, err := h.Repo.GetActivePeriod()
	if err != nil {
		c.Logger().Error("Failed to get active period:", err)
	}

	settings, err := h.Repo.GetSchoolSettings()
	if err != nil {
		c.Logger().Error("Failed to get school settings:", err)
	}

	isOpen := false
	if settings != nil {
		isOpen = settings.SPMBIsOpen
	}
	// Also check period dates if settings allow automated opening
	if period != nil && !isOpen {
		now := time.Now()
		if period.StartDate != nil && period.EndDate != nil {
			if now.After(*period.StartDate) && now.Before(*period.EndDate) {
				isOpen = true
			}
		}
	}

	if settings == nil {
		settings = &models.PublicLandingData{
			SchoolName:    "Sekolahku",
			SchoolAddress: "Jl. Pendidikan No. 123",
			SchoolEmail:   "info@sekolahku.sch.id",
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"period":   period,
		"settings": settings,
		"isOpen":   isOpen,
	})
}

func (h *SPMBHandler) GetRegistrant(c echo.Context) error {
	regNum := c.Param("number")
	if regNum == "" {
		regNum = c.QueryParam("id")
	}

	registrant, err := h.Repo.GetRegistrantByNumber(regNum)
	if err != nil {
		c.Logger().Error("Failed to fetch registrant:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if registrant == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Registrant not found"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    registrant,
	})
}

func (h *SPMBHandler) GetPublicRegistrants(c echo.Context) error {
	count, err := h.Repo.GetPublicRegistrants()
	if err != nil {
		c.Logger().Error("Failed to fetch public registrants:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    count,
	})
}

func (h *SPMBHandler) GetRegistrantsAdmin(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 { page = 1 }
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if perPage < 1 { perPage = 10 }
	
	if c.QueryParam("perPage") == "-1" {
		perPage = 10000 
	}

	status := c.QueryParam("status")
	search := c.QueryParam("search")

	registrants, total, err := h.Repo.GetRegistrantsAdmin(page, perPage, status, search)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	totalPages := (total + perPage - 1) / perPage

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      registrants,
		"total":      total,
		"totalPages": totalPages,
	})
}

func (h *SPMBHandler) GetStats(c echo.Context) error {
	stats, err := h.Repo.GetSPMBStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    stats,
	})
}

func (h *SPMBHandler) UpdateStatus(c echo.Context) error {
	id := c.Param("id")
	var req struct {
		Status string `json:"status"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	if err := h.Repo.UpdateRegistrantStatus(id, req.Status); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SPMBHandler) DeleteRegistrant(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteRegistrant(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SPMBHandler) PromoteRegistrant(c echo.Context) error {
	id := c.Param("id")
	var req models.SPMBPromoteRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	if err := h.Repo.PromoteToStudent(id, req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}
