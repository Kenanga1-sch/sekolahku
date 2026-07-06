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
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/middleware"
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
	m.PeriodID = period.ID

	// Server-side coordinate validation
	if m.HomeLat != 0 || m.HomeLng != 0 {
		if m.HomeLat < -90 || m.HomeLat > 90 || m.HomeLng < -180 || m.HomeLng > 180 {
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"success": false,
				"error":   "Koordinat lokasi tidak valid",
			})
		}
	}
	if m.DistanceKM < 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Jarak ke sekolah tidak valid",
		})
	}

	// Create registrant (quota check + reg number generation inside transaction)
	id, regNum, err := h.Repo.CreateRegistrant(m, period.ID, period.Quota)
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
			"error":   "Gagal menyimpan data pendaftaran. Silakan coba lagi.",
		})
	}

	// Invalidate public cache so landing page stats and announcement list refresh
	middleware.CacheInvalidate("/api/public/spmb/landing")
	middleware.CacheInvalidate("/api/public/spmb/registrants")

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

	var uploadErrors []string
	for i, fh := range files {
		if fh.Size > 2*1024*1024 {
			uploadErrors = append(uploadErrors, fh.Filename+": file melebihi 2MB")
			continue
		}

		src, err := fh.Open()
		if err != nil {
			uploadErrors = append(uploadErrors, fh.Filename+": gagal dibaca")
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
			uploadErrors = append(uploadErrors, fh.Filename+": format file tidak didukung (hanya PDF/JPG/PNG)")
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
			uploadErrors = append(uploadErrors, fh.Filename+": gagal disimpan")
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
			"count":  len(savedFiles),
			"errors": uploadErrors,
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

	middleware.CacheInvalidate("/api/public/spmb/landing")
	middleware.CacheInvalidate("/api/public/spmb/registrants")

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

	middleware.CacheInvalidate("/api/public/spmb/landing")
	middleware.CacheInvalidate("/api/public/spmb/registrants")

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SPMBHandler) DeletePeriod(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeletePeriod(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}

	middleware.CacheInvalidate("/api/public/spmb/landing")
	middleware.CacheInvalidate("/api/public/spmb/registrants")

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SPMBHandler) GetLandingData(c echo.Context) error {
	settings, err := h.Repo.GetSchoolSettings()
	if err != nil {
		c.Logger().Error("Failed to get school settings:", err)
	}

	isOpen := false
	var period *models.SPMBPeriod
	if settings != nil && settings.SPMBIsOpen {
		period, _ = h.Repo.GetActivePeriod()
		if period != nil {
			now := time.Now()
			if period.StartDate != nil && period.EndDate != nil {
				if !now.Before(*period.StartDate) && !now.After(*period.EndDate) {
					isOpen = true
				}
			}
		}
	}

	// Don't return period details if SPMB is closed
	if !isOpen {
		period = nil
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal mengambil data pendaftar"})
	}

	if registrant == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Pendaftar tidak ditemukan"})
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
	periodID := c.QueryParam("periodId")

	registrants, total, err := h.Repo.GetRegistrantsAdmin(page, perPage, status, search, periodID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal mengambil data pendaftar"})
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
	periodID := c.QueryParam("periodId")
	stats, err := h.Repo.GetSPMBStats(periodID)
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

	middleware.CacheInvalidate("/api/public/spmb/landing")
	middleware.CacheInvalidate("/api/public/spmb/registrants")

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SPMBHandler) DeleteRegistrant(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteRegistrant(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": err.Error()})
	}
	// Clean up uploaded files
	uploadDir := filepath.Join("public", "uploads", "spmb", id)
	if err := os.RemoveAll(uploadDir); err != nil {
		c.Logger().Warnf("Failed to clean up upload dir %s: %v", uploadDir, err)
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SPMBHandler) GetReferenceDate(c echo.Context) error {
	now := time.Now()
	year := now.Year()
	month := now.Month()
	// Academic year reference: July 1st
	academicStart := time.Date(year, 7, 1, 0, 0, 0, 0, now.Location())
	if month < 7 {
		academicStart = time.Date(year-1, 7, 1, 0, 0, 0, 0, now.Location())
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":         true,
		"serverTimestamp": now.UnixMilli(),
		"serverDate":      now.Format("2006-01-02"),
		"academicYearRef": academicStart.Format("2006-01-02"),
		"timezone":        now.Location().String(),
	})
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

	middleware.CacheInvalidate("/api/public/spmb/landing")
	middleware.CacheInvalidate("/api/public/spmb/registrants")

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func calculateAge(birthDateStr string, referenceDate time.Time) (int, int, int) {
	if birthDateStr == "" {
		return 0, 0, 3
	}
	t, err := time.Parse("2006-01-02", birthDateStr)
	if err != nil {
		return 0, 0, 3
	}
	years := referenceDate.Year() - t.Year()
	months := int(referenceDate.Month() - t.Month())
	days := referenceDate.Day() - t.Day()
	if days < 0 {
		months--
		days += 32
	}
	if months < 0 {
		years--
		months += 12
	}
	totalMonths := years*12 + months
	if years < 0 || totalMonths < 60 {
		return years, months, 4 // ineligible (<5 years)
	}
	if years < 6 || (years == 6 && months < 0) {
		return years, months, 3 // <6 tahun
	}
	if years < 7 || (years == 7 && months < 0) {
		return years, months, 2 // 6 tahun
	}
	if years <= 12 {
		return years, months, 1 // 7-12 tahun
	}
	return years, months, 4 // >12 tahun
}

func getAgeReferenceDate() time.Time {
	now := time.Now()
	year := now.Year()
	ref := time.Date(year, 7, 1, 0, 0, 0, 0, now.Location())
	if now.Month() < 7 {
		ref = time.Date(year-1, 7, 1, 0, 0, 0, 0, now.Location())
	}
	return ref
}

func computeSPMBRankings(registrants []models.SPMBRegistrant, quota int, maxDistanceKm float64) models.SPMBProcessResponse {
	if len(registrants) == 0 {
		return models.SPMBProcessResponse{}
	}
	refDate := getAgeReferenceDate()

	type rankedReg struct {
		reg           models.SPMBRegistrant
		ageYears      int
		ageMonths     int
		priorityGroup int
	}

	ranked := make([]rankedReg, len(registrants))
	for i, reg := range registrants {
		years, months, group := calculateAge(reg.BirthDate, refDate)
		ranked[i] = rankedReg{reg: reg, ageYears: years, ageMonths: months, priorityGroup: group}
	}

	// Sort: priorityGroup ASC > isInZone DESC > age DESC (totalMonths) > distance ASC > createdAt ASC
	sort.SliceStable(ranked, func(i, j int) bool {
		a, b := ranked[i], ranked[j]

		// Ineligible last
		if a.priorityGroup != b.priorityGroup {
			return a.priorityGroup < b.priorityGroup
		}
		// In zone first
		if a.reg.IsInZone != b.reg.IsInZone {
			return a.reg.IsInZone && !b.reg.IsInZone
		}
		// Older first (total months)
		aMonths := a.ageYears*12 + a.ageMonths
		bMonths := b.ageYears*12 + b.ageMonths
		if aMonths != bMonths {
			return aMonths > bMonths
		}
		// Closer first
		if a.reg.DistanceKM != b.reg.DistanceKM {
			return a.reg.DistanceKM < b.reg.DistanceKM
		}
		// Earlier registration first
		return a.reg.CreatedAt < b.reg.CreatedAt
	})

	acceptedCount := 0
	waitlistCount := 0
	rankings := make([]models.SPMBProcessRanking, len(ranked))

	for i, r := range ranked {
		recommendation := "rejected"
		if r.priorityGroup != 4 {
			if acceptedCount < quota {
				recommendation = "accepted"
				acceptedCount++
			} else {
				recommendation = "waitlist"
				waitlistCount++
			}
		}

		rankings[i] = models.SPMBProcessRanking{
			Rank:               i + 1,
			ID:                 r.reg.ID,
			RegistrationNumber: r.reg.RegistrationNumber,
			FullName:           r.reg.FullName,
			Gender:             r.reg.Gender,
			BirthDate:          r.reg.BirthDate,
			DistanceKM:         r.reg.DistanceKM,
			IsInZone:           r.reg.IsInZone,
			PriorityGroup:      r.priorityGroup,
			AgeYears:           r.ageYears,
			AgeMonths:          r.ageMonths,
			Recommendation:     recommendation,
		}
	}

	return models.SPMBProcessResponse{
		Quota:    quota,
		Accepted: acceptedCount,
		Waitlist: waitlistCount,
		Total:    len(ranked),
		Rankings: rankings,
		DryRun:   true,
	}
}

func (h *SPMBHandler) ProcessAcceptancePreview(c echo.Context) error {
	periodID := c.QueryParam("periodId")
	if periodID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "periodId diperlukan"})
	}

	period, err := h.Repo.GetPeriodByID(periodID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Periode tidak ditemukan"})
	}

	registrants, err := h.Repo.GetRegistrantsForPeriod(periodID)
	if err != nil {
		c.Logger().Errorf("Failed to fetch registrants for period %s: %v", periodID, err)
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal mengambil data pendaftar"})
	}

	maxDistance := 5.0
	settings, _ := h.Repo.GetSchoolSettings()
	if settings != nil && settings.MaxDistanceKM > 0 {
		maxDistance = settings.MaxDistanceKM
	}

	result := computeSPMBRankings(registrants, period.Quota, maxDistance)
	result.PeriodID = periodID
	result.DryRun = true

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

func (h *SPMBHandler) ProcessAcceptanceExecute(c echo.Context) error {
	var req struct {
		PeriodID string `json:"periodId"`
	}
	if err := c.Bind(&req); err != nil || req.PeriodID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "periodId diperlukan"})
	}

	period, err := h.Repo.GetPeriodByID(req.PeriodID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Periode tidak ditemukan"})
	}

	registrants, err := h.Repo.GetRegistrantsForPeriod(req.PeriodID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal mengambil data pendaftar"})
	}

	maxDistance := 5.0
	settings, _ := h.Repo.GetSchoolSettings()
	if settings != nil && settings.MaxDistanceKM > 0 {
		maxDistance = settings.MaxDistanceKM
	}

	result := computeSPMBRankings(registrants, period.Quota, maxDistance)
	result.PeriodID = req.PeriodID
	result.DryRun = false

	// Execute: update statuses in DB
	tx, err := h.Repo.DB.Begin()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memulai transaksi"})
	}
	defer tx.Rollback()

	var acceptedIDs, rejectedIDs []string
	for _, r := range result.Rankings {
		switch r.Recommendation {
		case "accepted":
			acceptedIDs = append(acceptedIDs, r.ID)
		case "rejected":
			rejectedIDs = append(rejectedIDs, r.ID)
		}
	}

	if err := h.Repo.BatchUpdateStatus(tx, acceptedIDs, "accepted"); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memperbarui status"})
	}
	if err := h.Repo.BatchUpdateStatus(tx, rejectedIDs, "rejected"); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memperbarui status"})
	}

	if err := tx.Commit(); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menyimpan perubahan"})
	}

	middleware.CacheInvalidate("/api/public/spmb/landing")
	middleware.CacheInvalidate("/api/public/spmb/registrants")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}
