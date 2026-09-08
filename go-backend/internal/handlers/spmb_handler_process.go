package handlers

import (
	"net/http"
	"sort"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/middleware"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// Age calculation helpers

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
	// Referensi umur = 1 Juli tahun ajaran berjalan, dihitung menurut WIB
	ref := time.Date(year, 7, 1, 0, 0, 0, 0, repository.JakartaLoc())
	if now.Month() < 7 {
		ref = time.Date(year-1, 7, 1, 0, 0, 0, 0, repository.JakartaLoc())
	}
	return ref
}

func computeSPMBRankings(registrants []models.SPMBRegistrant, quota int) models.SPMBProcessResponse {
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

	sort.SliceStable(ranked, func(i, j int) bool {
		a, b := ranked[i], ranked[j]
		if a.priorityGroup != b.priorityGroup {
			return a.priorityGroup < b.priorityGroup
		}
		if a.reg.IsInZone != b.reg.IsInZone {
			return a.reg.IsInZone && !b.reg.IsInZone
		}
		aMonths := a.ageYears*12 + a.ageMonths
		bMonths := b.ageYears*12 + b.ageMonths
		if aMonths != bMonths {
			return aMonths > bMonths
		}
		if a.reg.DistanceKM != b.reg.DistanceKM {
			return a.reg.DistanceKM < b.reg.DistanceKM
		}
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

func (h *SPMBHandler) GetStats(c echo.Context) error {
	periodID := c.QueryParam("periodId")
	stats, err := h.Repo.GetSPMBStats(periodID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    stats,
	})
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

	result := computeSPMBRankings(registrants, period.Quota)
	_ = maxDistance // reserved for future distance-based filtering
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

	result := computeSPMBRankings(registrants, period.Quota)
	result.PeriodID = req.PeriodID
	result.DryRun = false

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
