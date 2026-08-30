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
	"github.com/sekolahku/go-backend/internal/middleware"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
	"github.com/sekolahku/go-backend/internal/shared"
)

type SPMBHandler struct {
	Repo *repository.SPMBRepository
}

func NewSPMBHandler(repo *repository.SPMBRepository) *SPMBHandler {
	return &SPMBHandler{Repo: repo}
}

// normalizeSPMBRegistrantPayload normalizes raw JSON fields into the SPMBRegistrant model.
func normalizeSPMBRegistrantPayload(reg *models.SPMBRegistrant, raw map[string]interface{}) {
	if reg.FullName == "" {
		reg.FullName = shared.RawString(raw, "full_name", "student_name", "name")
	}
	if reg.StudentNIK == "" {
		reg.StudentNIK = shared.RawString(raw, "student_nik", "nik")
	}
	if reg.KKNumber == "" {
		reg.KKNumber = shared.RawString(raw, "kk_number")
	}
	if reg.BirthCertificateNo == "" {
		reg.BirthCertificateNo = shared.RawString(raw, "birth_certificate_no")
	}
	if reg.BirthPlace == "" {
		reg.BirthPlace = shared.RawString(raw, "birth_place")
	}
	if reg.BirthDate == "" {
		reg.BirthDate = shared.RawString(raw, "birth_date")
	}
	if reg.SpecialNeeds == "" {
		reg.SpecialNeeds = shared.RawString(raw, "special_needs")
	}
	if reg.LivingArrangement == "" {
		reg.LivingArrangement = shared.RawString(raw, "living_arrangement")
	}
	if reg.TransportMode == "" {
		reg.TransportMode = shared.RawString(raw, "transport_mode")
	}
	if reg.ChildOrder == 0 {
		reg.ChildOrder = shared.RawInt(raw, "child_order")
	}
	if !reg.HasKPS {
		reg.HasKPS = shared.RawBool(raw, "has_kps_pkh", "hasKpsPkh")
	}
	if !reg.HasKIP {
		reg.HasKIP = shared.RawBool(raw, "has_kip", "hasKip")
	}
	if reg.PreviousSchool == "" {
		reg.PreviousSchool = shared.RawString(raw, "previous_school")
	}
	if reg.HeadCircumference == 0 {
		reg.HeadCircumference = shared.RawInt(raw, "head_circumference")
	}
	if reg.SiblingCount == 0 {
		reg.SiblingCount = shared.RawInt(raw, "sibling_count")
	}
	if reg.TravelTime == "" {
		reg.TravelTime = shared.RawString(raw, "travel_time")
	}
	if reg.AddressStreet == "" {
		reg.AddressStreet = shared.RawString(raw, "address_street")
	}
	if reg.AddressRT == "" {
		reg.AddressRT = shared.RawString(raw, "address_rt")
	}
	if reg.AddressRW == "" {
		reg.AddressRW = shared.RawString(raw, "address_rw")
	}
	if reg.AddressVillage == "" {
		reg.AddressVillage = shared.RawString(raw, "address_village")
	}
	if reg.PostalCode == "" {
		reg.PostalCode = shared.RawString(raw, "postal_code")
	}
	if reg.HomeAddress == "" {
		reg.HomeAddress = shared.RawString(raw, "home_address", "address")
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
		reg.HomeLat = shared.RawFloat(raw, "home_lat")
	}
	if reg.HomeLng == 0 {
		reg.HomeLng = shared.RawFloat(raw, "home_lng")
	}
	if reg.DistanceKM == 0 {
		reg.DistanceKM = shared.RawFloat(raw, "distance_to_school", "distance_km")
	}
	if reg.ParentPhone == "" {
		reg.ParentPhone = shared.RawString(raw, "parent_phone")
	}
	if reg.ParentEmail == "" {
		reg.ParentEmail = shared.RawString(raw, "parent_email")
	}
	if reg.FatherName == "" {
		reg.FatherName = shared.RawString(raw, "father_name")
	}
	if reg.FatherNIK == "" {
		reg.FatherNIK = shared.RawString(raw, "father_nik")
	}
	if reg.FatherBirth == "" {
		reg.FatherBirth = shared.RawString(raw, "father_birth_year")
	}
	if reg.FatherEdu == "" {
		reg.FatherEdu = shared.RawString(raw, "father_education")
	}
	if reg.FatherJob == "" {
		reg.FatherJob = shared.RawString(raw, "father_job")
	}
	if reg.FatherIncome == "" {
		reg.FatherIncome = shared.RawString(raw, "father_income")
	}
	if reg.MotherName == "" {
		reg.MotherName = shared.RawString(raw, "mother_name")
	}
	if reg.MotherNIK == "" {
		reg.MotherNIK = shared.RawString(raw, "mother_nik")
	}
	if reg.MotherBirth == "" {
		reg.MotherBirth = shared.RawString(raw, "mother_birth_year")
	}
	if reg.MotherEdu == "" {
		reg.MotherEdu = shared.RawString(raw, "mother_education")
	}
	if reg.MotherJob == "" {
		reg.MotherJob = shared.RawString(raw, "mother_job")
	}
	if reg.MotherIncome == "" {
		reg.MotherIncome = shared.RawString(raw, "mother_income")
	}
	if reg.GuardianName == "" {
		reg.GuardianName = shared.RawString(raw, "guardian_name")
	}
	if reg.GuardianNIK == "" {
		reg.GuardianNIK = shared.RawString(raw, "guardian_nik")
	}
	if reg.GuardianBirth == "" {
		reg.GuardianBirth = shared.RawString(raw, "guardian_birth_year")
	}
	if reg.GuardianEdu == "" {
		reg.GuardianEdu = shared.RawString(raw, "guardian_education")
	}
	if reg.GuardianJob == "" {
		reg.GuardianJob = shared.RawString(raw, "guardian_job")
	}
	if reg.GuardianIncome == "" {
		reg.GuardianIncome = shared.RawString(raw, "guardian_income")
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
					"id":                   duplicate.ID,
					"registration_number":  duplicate.RegistrationNumber,
				},
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menyimpan data pendaftaran. Silakan coba lagi.",
		})
	}

	middleware.CacheInvalidate("/api/public/spmb/landing")
	middleware.CacheInvalidate("/api/public/spmb/registrants")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"id":                   id,
			"registration_number":   regNum,
		},
	})
}

func (h *SPMBHandler) UploadDocuments(c echo.Context) error {
	registrantId := c.QueryParam("id")
	if registrantId == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "ID pendaftar diperlukan"})
	}
	if strings.Contains(registrantId, "..") || strings.ContainsAny(registrantId, "\\/:*?\"<>|") {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "ID pendaftar tidak valid"})
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
	var totalSize int64
	const maxTotalSize = 50 * 1024 * 1024

	for _, fh := range files {
		totalSize += fh.Size
	}
	if totalSize > maxTotalSize {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("Total ukuran file melebihi 50MB (%.1fMB)", float64(totalSize)/(1024*1024))})
	}

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

	if len(savedFiles) == 0 && len(uploadErrors) > 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Semua dokumen gagal diunggah",
			"details": uploadErrors,
		})
	}

	if len(savedFiles) > 0 {
		docsJSON, _ := json.Marshal(savedFiles)
		if err := h.Repo.UpdateRegistrantDocuments(registrantId, string(docsJSON)); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memperbarui data dokumen di database"})
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"count":  len(savedFiles),
			"files":  savedFiles,
			"errors": uploadErrors,
		},
	})
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
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
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	middleware.CacheInvalidate("/api/public/spmb/landing")
	middleware.CacheInvalidate("/api/public/spmb/registrants")

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SPMBHandler) DeleteRegistrant(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteRegistrant(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	uploadDir := filepath.Join("public", "uploads", "spmb", id)
	if err := os.RemoveAll(uploadDir); err != nil {
		c.Logger().Warnf("Failed to clean up upload dir %s: %v", uploadDir, err)
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
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	middleware.CacheInvalidate("/api/public/spmb/landing")
	middleware.CacheInvalidate("/api/public/spmb/registrants")

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *SPMBHandler) GetReferenceDate(c echo.Context) error {
	now := time.Now()
	year := now.Year()
	month := now.Month()
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
