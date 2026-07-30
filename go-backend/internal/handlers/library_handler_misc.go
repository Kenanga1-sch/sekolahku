package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"os"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
)

// ============ Visits ============

func (h *LibraryHandler) RecordVisit(c echo.Context) error {
	var req struct {
		MemberID         string `json:"memberId"`
		GuestName        string `json:"guestName"`
		GuestInstitution string `json:"institution"`
		GuestPurpose     string `json:"purpose"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	var err error
	if req.MemberID != "" {
		err = h.Repo.RecordVisit(req.MemberID)
	} else if req.GuestName != "" {
		err = h.Repo.RecordGuestVisit(req.GuestName, req.GuestInstitution, req.GuestPurpose)
	} else {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "MemberID or GuestName is required"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) GetVisits(c echo.Context) error {
	date := c.QueryParam("date")
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	visits, total, err := h.Repo.GetVisits(date, page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    visits,
		"total":   total,
		"page":    page,
		"perPage": perPage,
	})
}

// ============ Kiosk ============

func (h *LibraryHandler) KioskScanComplete(c echo.Context) error {
	var req struct {
		Code string `json:"code"`
	}
	if err := c.Bind(&req); err != nil || req.Code == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"type": "error", "message": "QR code tidak valid"})
	}

	member, err := h.Repo.GetMemberByCode(req.Code)
	if err == nil {
		visited, err := h.Repo.HasVisitedToday(member.ID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"type": "error", "message": "Gagal mengecek kunjungan"})
		}
		isFirstVisit := !visited
		if isFirstVisit {
			if err := h.Repo.RecordVisit(member.ID); err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]interface{}{"type": "error", "message": "Gagal mencatat kunjungan"})
			}
		}
		activeLoans, err := h.Repo.GetActiveLoansByMemberID(member.ID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"type": "error", "message": "Gagal mengambil data pinjaman"})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{
			"type": "member",
			"data": member,
			"visitStatus": map[string]interface{}{
				"isFirstVisit": isFirstVisit,
			},
			"activeLoans": activeLoans,
		})
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"type": "error", "message": "Gagal membaca data anggota"})
	}

	item, err := h.Repo.GetAssetByCode(req.Code)
	if err == nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"type": "item",
			"data": item,
		})
	}
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusOK, map[string]interface{}{"type": "error", "message": "QR tidak ditemukan"})
	}
	return c.JSON(http.StatusInternalServerError, map[string]interface{}{"type": "error", "message": "Gagal membaca data buku"})
}

func (h *LibraryHandler) KioskScan(c echo.Context) error {
	var req struct {
		Code string `json:"code"`
		Type string `json:"type"`
	}
	if err := c.Bind(&req); err != nil || req.Code == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "QR code tidak valid"})
	}

	if req.Type == "find-loan" {
		loan, err := h.Repo.FindActiveLoanByItemID(req.Code)
		if errors.Is(err, sql.ErrNoRows) {
			return c.JSON(http.StatusOK, nil)
		}
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
		}
		return c.JSON(http.StatusOK, loan)
	}

	member, err := h.Repo.GetMemberByCode(req.Code)
	if err == nil {
		return c.JSON(http.StatusOK, map[string]interface{}{"type": "member", "data": member})
	}
	item, err := h.Repo.GetAssetByCode(req.Code)
	if err == nil {
		return c.JSON(http.StatusOK, map[string]interface{}{"type": "item", "data": item})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"type": "error", "message": "QR tidak ditemukan"})
}

func (h *LibraryHandler) KioskTransaction(c echo.Context) error {
	var req struct {
		Type     string `json:"type"`
		MemberID string `json:"memberId"`
		ItemID   string `json:"itemId"`
		LoanID   string `json:"loanId"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Payload tidak valid"})
	}

	switch req.Type {
	case "borrow":
		if req.MemberID == "" || req.ItemID == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "MemberID dan ItemID wajib diisi"})
		}
		loan, err := h.Repo.BorrowItem(req.MemberID, req.ItemID, 7)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": loan})
	case "return":
		if req.LoanID == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "LoanID wajib diisi"})
		}
		loan, err := h.Repo.ReturnItem(req.LoanID, req.MemberID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": loan})
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Tipe transaksi tidak dikenal"})
	}
}

// ============ QR Batches ============

func (h *LibraryHandler) GetQRCodeBatches(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	batches, total, err := h.Repo.GetQRBatches(c.QueryParam("search"), c.QueryParam("date"), page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": batches, "total": total, "page": page, "perPage": perPage})
}

func (h *LibraryHandler) GenerateQRCodeBatch(c echo.Context) error {
	var req struct {
		Count  int    `json:"count"`
		Prefix string `json:"prefix"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Payload tidak valid"})
	}
	codes, batch, err := h.Repo.GenerateQRBatch(req.Prefix, req.Count)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"codes":   codes,
		"batch":   batch,
	})
}

func (h *LibraryHandler) BindAsset(c echo.Context) error {
	var req struct {
		QRCode   string              `json:"qrCode"`
		Location string              `json:"location"`
		Catalog  models.CatalogInput `json:"catalog"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Payload tidak valid"})
	}
	if err := h.Repo.BindAsset(req.QRCode, req.Location, req.Catalog); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ============ AI Classify ============

func (h *LibraryHandler) AIClassify(c echo.Context) error {
	var req struct {
		Title       string   `json:"title"`
		Author      string   `json:"author"`
		Description string   `json:"description"`
		Subjects    []string `json:"subjects"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Payload tidak valid"})
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":    true,
			"ai_enabled": false,
			"message":    "GEMINI_API_KEY tidak disetel di server",
		})
	}

	result, err := h.Repo.ClassifyBookWithAI(req.Title, req.Author, req.Description, req.Subjects, apiKey)
	if err != nil {
		c.Logger().Error("AI Classification failed:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"ai_enabled": true,
		"data":       result,
	})
}
