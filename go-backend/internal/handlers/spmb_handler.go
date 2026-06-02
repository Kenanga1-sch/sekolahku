package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
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

func rawString(raw map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := raw[key]; ok {
			switch v := value.(type) {
			case string:
				return v
			case float64:
				return strconv.FormatFloat(v, 'f', -1, 64)
			case bool:
				if v {
					return "true"
				}
				return "false"
			}
		}
	}
	return ""
}

func rawFloat(raw map[string]interface{}, keys ...string) float64 {
	for _, key := range keys {
		if value, ok := raw[key]; ok {
			switch v := value.(type) {
			case float64:
				return v
			case string:
				parsed, _ := strconv.ParseFloat(v, 64)
				return parsed
			}
		}
	}
	return 0
}

func rawInt(raw map[string]interface{}, keys ...string) int {
	for _, key := range keys {
		if value, ok := raw[key]; ok {
			switch v := value.(type) {
			case float64:
				return int(v)
			case string:
				parsed, _ := strconv.Atoi(v)
				return parsed
			}
		}
	}
	return 0
}

func rawBool(raw map[string]interface{}, keys ...string) bool {
	for _, key := range keys {
		if value, ok := raw[key]; ok {
			switch v := value.(type) {
			case bool:
				return v
			case float64:
				return v != 0
			case string:
				parsed, _ := strconv.ParseBool(v)
				return parsed
			}
		}
	}
	return false
}

func normalizeSPMBRegistrantPayload(reg *models.SPMBRegistrant, raw map[string]interface{}) {
	if reg.FullName == "" {
		reg.FullName = rawString(raw, "full_name", "student_name", "name")
	}
	if reg.StudentNIK == "" {
		reg.StudentNIK = rawString(raw, "student_nik", "nik")
	}
	if reg.KKNumber == "" {
		reg.KKNumber = rawString(raw, "kk_number")
	}
	if reg.BirthCertificateNo == "" {
		reg.BirthCertificateNo = rawString(raw, "birth_certificate_no")
	}
	if reg.BirthPlace == "" {
		reg.BirthPlace = rawString(raw, "birth_place")
	}
	if reg.BirthDate == "" {
		reg.BirthDate = rawString(raw, "birth_date")
	}
	if reg.SpecialNeeds == "" {
		reg.SpecialNeeds = rawString(raw, "special_needs")
	}
	if reg.LivingArrangement == "" {
		reg.LivingArrangement = rawString(raw, "living_arrangement")
	}
	if reg.TransportMode == "" {
		reg.TransportMode = rawString(raw, "transport_mode")
	}
	if reg.ChildOrder == 0 {
		reg.ChildOrder = rawInt(raw, "child_order")
	}
	if !reg.HasKPS {
		reg.HasKPS = rawBool(raw, "has_kps_pkh", "hasKpsPkh")
	}
	if !reg.HasKIP {
		reg.HasKIP = rawBool(raw, "has_kip", "hasKip")
	}
	if reg.PreviousSchool == "" {
		reg.PreviousSchool = rawString(raw, "previous_school")
	}
	if reg.HeadCircumference == 0 {
		reg.HeadCircumference = rawInt(raw, "head_circumference")
	}
	if reg.SiblingCount == 0 {
		reg.SiblingCount = rawInt(raw, "sibling_count")
	}
	if reg.TravelTime == "" {
		reg.TravelTime = rawString(raw, "travel_time")
	}
	if reg.AddressStreet == "" {
		reg.AddressStreet = rawString(raw, "address_street")
	}
	if reg.AddressRT == "" {
		reg.AddressRT = rawString(raw, "address_rt")
	}
	if reg.AddressRW == "" {
		reg.AddressRW = rawString(raw, "address_rw")
	}
	if reg.AddressVillage == "" {
		reg.AddressVillage = rawString(raw, "address_village")
	}
	if reg.PostalCode == "" {
		reg.PostalCode = rawString(raw, "postal_code")
	}
	if reg.HomeAddress == "" {
		reg.HomeAddress = rawString(raw, "home_address", "address")
	}
	if reg.HomeAddress == "" {
		parts := []string{}
		for _, part := range []string{reg.AddressStreet, reg.AddressRT, reg.AddressRW, reg.AddressVillage, reg.PostalCode} {
			if part != "" {
				parts = append(parts, part)
			}
		}
		reg.HomeAddress = strings.Join(parts, ", ")
	}
	if reg.HomeLat == 0 {
		reg.HomeLat = rawFloat(raw, "home_lat")
	}
	if reg.HomeLng == 0 {
		reg.HomeLng = rawFloat(raw, "home_lng")
	}
	if reg.DistanceKM == 0 {
		reg.DistanceKM = rawFloat(raw, "distance_to_school", "distance_km")
	}
	if reg.ParentPhone == "" {
		reg.ParentPhone = rawString(raw, "parent_phone")
	}
	if reg.ParentEmail == "" {
		reg.ParentEmail = rawString(raw, "parent_email")
	}
	if reg.FatherName == "" {
		reg.FatherName = rawString(raw, "father_name")
	}
	if reg.FatherNIK == "" {
		reg.FatherNIK = rawString(raw, "father_nik")
	}
	if reg.FatherBirth == "" {
		reg.FatherBirth = rawString(raw, "father_birth_year")
	}
	if reg.FatherEdu == "" {
		reg.FatherEdu = rawString(raw, "father_education")
	}
	if reg.FatherJob == "" {
		reg.FatherJob = rawString(raw, "father_job")
	}
	if reg.FatherIncome == "" {
		reg.FatherIncome = rawString(raw, "father_income")
	}
	if reg.MotherName == "" {
		reg.MotherName = rawString(raw, "mother_name")
	}
	if reg.MotherNIK == "" {
		reg.MotherNIK = rawString(raw, "mother_nik")
	}
	if reg.MotherBirth == "" {
		reg.MotherBirth = rawString(raw, "mother_birth_year")
	}
	if reg.MotherEdu == "" {
		reg.MotherEdu = rawString(raw, "mother_education")
	}
	if reg.MotherJob == "" {
		reg.MotherJob = rawString(raw, "mother_job")
	}
	if reg.MotherIncome == "" {
		reg.MotherIncome = rawString(raw, "mother_income")
	}
	if reg.GuardianName == "" {
		reg.GuardianName = rawString(raw, "guardian_name")
	}
	if reg.GuardianNIK == "" {
		reg.GuardianNIK = rawString(raw, "guardian_nik")
	}
	if reg.GuardianBirth == "" {
		reg.GuardianBirth = rawString(raw, "guardian_birth_year")
	}
	if reg.GuardianEdu == "" {
		reg.GuardianEdu = rawString(raw, "guardian_education")
	}
	if reg.GuardianJob == "" {
		reg.GuardianJob = rawString(raw, "guardian_job")
	}
	if reg.GuardianIncome == "" {
		reg.GuardianIncome = rawString(raw, "guardian_income")
	}
}

func (h *SPMBHandler) Register(c echo.Context) error {
	var m models.SPMBRegistrant
	body, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Format data pendaftaran tidak valid",
		})
	}
	if err := json.Unmarshal(body, &m); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Format data pendaftaran tidak valid",
		})
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err == nil {
		normalizeSPMBRegistrantPayload(&m, raw)
	}

	settings, err := h.Repo.GetSchoolSettings()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal membaca pengaturan SPMB"})
	}
	if settings == nil || !settings.SPMBIsOpen {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Pendaftaran SPMB sedang ditutup"})
	}

	period, err := h.Repo.GetActivePeriod()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal membaca periode SPMB"})
	}
	if period == nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Belum ada periode SPMB aktif"})
	}
	now := time.Now()
	if period.StartDate == nil || period.EndDate == nil || now.Before(*period.StartDate) || now.After(*period.EndDate) {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Periode SPMB belum dibuka atau sudah ditutup"})
	}
	if period.Quota > 0 {
		count, err := h.Repo.GetPeriodRegistrantCount(period.ID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memeriksa kuota SPMB"})
		}
		if count >= period.Quota {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Kuota periode SPMB sudah terpenuhi"})
		}
	}
	m.PeriodID = period.ID

	// Create registrant
	id, regNum, err := h.Repo.CreateRegistrant(m)
	if err != nil {
		var duplicate *repository.DuplicateSPMBRegistrantError
		if errors.As(err, &duplicate) {
			return c.JSON(http.StatusConflict, map[string]interface{}{
				"success": false,
				"error": map[string]interface{}{
					"code":                "duplicate_student_nik",
					"message":             "NIK calon siswa ini sudah pernah terdaftar. Silakan cek status pendaftaran atau hubungi panitia jika membutuhkan bantuan.",
					"registration_number": duplicate.RegistrationNumber,
				},
				"data": map[string]interface{}{
					"id":                  duplicate.ID,
					"registration_number": duplicate.RegistrationNumber,
				},
			})
		}
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
	if settings != nil && settings.SPMBIsOpen && period != nil {
		isOpen = settings.SPMBIsOpen
		now := time.Now()
		if period.StartDate != nil && period.EndDate != nil {
			if now.Before(*period.StartDate) || now.After(*period.EndDate) {
				isOpen = false
			}
		} else {
			isOpen = false
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
	registrants, err := h.Repo.GetPublicRegistrants()
	if err != nil {
		c.Logger().Error("Failed to fetch public registrants:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    registrants,
	})
}

func (h *SPMBHandler) GetRegistrantsAdmin(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if perPage < 1 {
		perPage = 10
	}

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
	if totalPages < 1 {
		totalPages = 1
	}

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
		Status string  `json:"status"`
		Notes  *string `json:"notes"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}

	verifiedBy, _ := c.Get("user_id").(string)
	if err := h.Repo.UpdateRegistrantStatus(id, req.Status, req.Notes, verifiedBy); err != nil {
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
