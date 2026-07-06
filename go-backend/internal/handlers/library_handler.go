package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"os"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type LibraryHandler struct {
	Repo *repository.LibraryRepository
}

func NewLibraryHandler(repo *repository.LibraryRepository) *LibraryHandler {
	return &LibraryHandler{Repo: repo}
}

func (h *LibraryHandler) GetStats(c echo.Context) error {
	stats, err := h.Repo.GetStats()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    stats,
	})
}

func (h *LibraryHandler) GetBooks(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if perPage < 1 {
		perPage = 20
	}
	search := c.QueryParam("search")
	category := c.QueryParam("category")
	statusFilter := c.QueryParam("status")

	items, total, err := h.Repo.GetBooks(page, perPage, search, category, statusFilter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	totalPages := (total + perPage - 1) / perPage

	return c.JSON(http.StatusOK, map[string]interface{}{
		"items":      items,
		"totalItems": total,
		"totalPages": totalPages,
		"page":       page,
	})
}

func (h *LibraryHandler) CreateBook(c echo.Context) error {
	var input models.CreateBookRequest
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	if err := h.Repo.CreateBook(input); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) UpdateBook(c echo.Context) error {
	id := c.Param("id")
	var input models.UpdateBookRequest
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	if err := h.Repo.UpdateBook(id, input); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) DeleteBook(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteBook(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) SwapQR(c echo.Context) error {
	var req struct {
		OldQr string `json:"oldQr"`
		NewQr string `json:"newQr"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	if err := h.Repo.SwapQR(req.OldQr, req.NewQr); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) GetMembers(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if perPage < 1 {
		perPage = 20
	}
	search := c.QueryParam("search")

	if search != "" {
		// Check if there is an active student with this ID, NISN, or QR Code who does not have a library member record yet
		var studentID string
		var isActive int
		var status string
		err := h.Repo.DB.QueryRow(`
			SELECT id, is_active, COALESCE(status, '') 
			FROM students 
			WHERE (id = ? OR nisn = ? OR qr_code = ?)
			  AND id NOT IN (SELECT student_id FROM library_members WHERE student_id IS NOT NULL)
		`, search, search, search).Scan(&studentID, &isActive, &status)
		if err == nil && (isActive == 1 || status == "active" || status == "aktif") {
			// Auto sync!
			_ = repository.AutoSyncStudentToSavingsAndLibrary(h.Repo.DB, studentID)
		}
	}

	items, total, err := h.Repo.GetMembers(page, perPage, search)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	totalPages := (total + perPage - 1) / perPage

	return c.JSON(http.StatusOK, map[string]interface{}{
		"items":      items,
		"totalItems": total,
		"totalPages": totalPages,
		"page":       page,
	})
}

func (h *LibraryHandler) CreateMember(c echo.Context) error {
	var m models.LibraryMember
	if err := c.Bind(&m); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	if err := h.Repo.CreateMember(m); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) UpdateMember(c echo.Context) error {
	id := c.Param("id")
	var input models.UpdateMemberRequest
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid input"})
	}

	if err := h.Repo.UpdateMember(id, input); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) DeleteMember(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteMember(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) SyncLibrary(c echo.Context) error {
	count, err := h.Repo.SyncFromStudents()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": strconv.Itoa(count) + " anggota berhasil disinkronisasi",
	})
}

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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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

	// Optional member verification from query param
	memberID := c.QueryParam("memberId")

	loan, err := h.Repo.ReturnItem(loanID, memberID)
	if err != nil {
		c.Logger().Error("Failed to return library asset:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    loan,
	})
}

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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *LibraryHandler) GetVisits(c echo.Context) error {
	date := c.QueryParam("date")
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))

	visits, total, err := h.Repo.GetVisits(date, page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":   true,
		"data":      visits,
		"total":     total,
		"page":      page,
		"perPage":   perPage,
	})
}

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
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": loan})
	case "return":
		if req.LoanID == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "LoanID wajib diisi"})
		}
		loan, err := h.Repo.ReturnItem(req.LoanID, req.MemberID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": loan})
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Tipe transaksi tidak dikenal"})
	}
}

func (h *LibraryHandler) GetMemberLoanHistory(c echo.Context) error {
	memberID := c.Param("id")
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	loans, err := h.Repo.GetMemberLoanHistory(memberID, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"items":   loans,
	})
}

func (h *LibraryHandler) GetReports(c echo.Context) error {
	reportType := c.QueryParam("type")
	var (
		data interface{}
		err  error
	)

	switch reportType {
	case "loan", "loans", "":
		limit, _ := strconv.Atoi(c.QueryParam("limit"))
		data, err = h.Repo.GetLoanReport(c.QueryParam("startDate"), c.QueryParam("endDate"), limit)
	case "visit", "visits":
		limit, _ := strconv.Atoi(c.QueryParam("limit"))
		data, err = h.Repo.GetVisitReport(c.QueryParam("startDate"), c.QueryParam("endDate"), limit)
	case "overdue":
		data, err = h.Repo.GetOverdueReport()
	case "inventory":
		data, err = h.Repo.GetInventoryReport()
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Tipe laporan tidak dikenal"})
	}

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, data)
}

func (h *LibraryHandler) LookupISBN(c echo.Context) error {
	data, err := h.Repo.LookupISBN(c.Param("isbn"))
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusOK, map[string]string{"error": "not_found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    data,
	})
}

func (h *LibraryHandler) GetQRCodeBatches(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))

	batches, total, err := h.Repo.GetQRBatches(c.QueryParam("search"), c.QueryParam("date"), page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
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

func (h *LibraryHandler) GetMemberByQRCode(c echo.Context) error {
	code := c.Param("code")
	member, err := h.Repo.GetMemberByCode(code)
	if errors.Is(err, sql.ErrNoRows) {
		// Try to auto-create if the code is actually student ID, NISN, or student QR Code!
		var studentID string
		var isActive int
		var status string
		err = h.Repo.DB.QueryRow(`
			SELECT id, is_active, COALESCE(status, '') 
			FROM students 
			WHERE id = ? OR nisn = ? OR qr_code = ?
		`, code, code, code).Scan(&studentID, &isActive, &status)
		if err == nil && (isActive == 1 || status == "active" || status == "aktif") {
			// Auto sync!
			_ = repository.AutoSyncStudentToSavingsAndLibrary(h.Repo.DB, studentID)
			// Re-query
			member, err = h.Repo.GetMemberByCode(code)
		}
	}
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Anggota tidak ditemukan"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, member)
}

func (h *LibraryHandler) GetBookByQRCode(c echo.Context) error {
	item, err := h.Repo.GetAssetByCode(c.Param("code"))
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Buku tidak ditemukan"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, item)
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
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":    true,
		"ai_enabled": true,
		"data":       result,
	})
}
