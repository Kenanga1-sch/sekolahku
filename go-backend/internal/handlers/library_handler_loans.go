package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
)

// ============ Loans ============

func (h *LibraryHandler) GetLoans(c echo.Context) error {
	loanType := c.QueryParam("type")
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if perPage < 1 {
		perPage = 20
	}
	loans, total, err := h.Repo.GetLoans(loanType, page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	totalPages := (total + perPage - 1) / perPage
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"items":      loans,
		"totalItems": total,
		"totalPages": totalPages,
		"page":       page,
	})
}

func (h *LibraryHandler) BorrowBook(c echo.Context) error {
	var req struct {
		MemberID string `json:"memberId"`
		ItemID   string `json:"itemId"`
		LoanDays int    `json:"loanDays"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid payload"})
	}
	if req.MemberID == "" || req.ItemID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "MemberID and ItemID are required"})
	}
	loan, err := h.Repo.BorrowItem(req.MemberID, req.ItemID, req.LoanDays)
	if err != nil {
		c.Logger().Error("Failed to borrow library asset:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    loan,
	})
}

func (h *LibraryHandler) ReturnBook(c echo.Context) error {
	loanID := c.Param("id")
	if loanID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Loan ID is required"})
	}
	memberID := c.QueryParam("memberId")
	loan, err := h.Repo.ReturnItem(loanID, memberID)
	if err != nil {
		c.Logger().Error("Failed to return library asset:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    loan,
	})
}

func (h *LibraryHandler) GetMemberLoanHistory(c echo.Context) error {
	memberID := c.Param("id")
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	loans, err := h.Repo.GetMemberLoanHistory(memberID, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"items":   loans,
	})
}

func (h *LibraryHandler) PayFine(c echo.Context) error {
	loanID := c.Param("id")
	var req struct {
		Amount int `json:"amount"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Payload tidak valid"})
	}
	if err := h.Repo.PayFine(loanID, req.Amount); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Denda berhasil dibayar"})
}

func (h *LibraryHandler) RenewLoan(c echo.Context) error {
	loanID := c.Param("id")
	var req struct {
		ExtraDays int `json:"extraDays"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Payload tidak valid"})
	}
	loan, err := h.Repo.RenewLoan(loanID, req.ExtraDays)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": loan})
}

// ============ Reports ============

func (h *LibraryHandler) GetReports(c echo.Context) error {
	reportType := c.QueryParam("type")
	var (
		data interface{}
		err  error
	)
	// totalItems ikut dikembalikan agar klien tahu bila data terpotong.
	// Bentuk lamanya (array mentah) tidak bisa menyampaikan itu, sehingga
	// ringkasan menulis "Total: 1000" seolah itu seluruh data.
	totalItems := -1

	switch reportType {
	case "loan", "loans", "":
		limit, _ := strconv.Atoi(c.QueryParam("limit"))
		var res *models.LoanReportResult
		res, err = h.Repo.GetLoanReport(c.QueryParam("startDate"), c.QueryParam("endDate"), limit)
		if res != nil {
			data, totalItems = res.Items, res.TotalItems
		}
	case "visit", "visits":
		limit, _ := strconv.Atoi(c.QueryParam("limit"))
		var res *models.VisitReportResult
		res, err = h.Repo.GetVisitReport(c.QueryParam("startDate"), c.QueryParam("endDate"), limit)
		if res != nil {
			data, totalItems = res.Items, res.TotalItems
		}
	case "overdue":
		var res *models.OverdueReportResult
		res, err = h.Repo.GetOverdueReport()
		if res != nil {
			data, totalItems = res.Items, res.TotalItems
		}
	case "inventory":
		data, err = h.Repo.GetInventoryReport()
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Tipe laporan tidak dikenal"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}

	// Respons dibungkus seragam. `data` tetap disertakan agar pemanggil lama
	// yang membaca array tidak langsung rusak.
	if totalItems >= 0 {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"success":    true,
			"items":      data,
			"data":       data,
			"totalItems": totalItems,
		})
	}
	return c.JSON(http.StatusOK, data)
}
