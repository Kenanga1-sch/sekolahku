package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// FinanceHandler melayani modul Keuangan (buku besar generik multi-unit).
type FinanceHandler struct {
	Repo *repository.FinanceRepository
	DB   *sql.DB
}

func NewFinanceHandler(repo *repository.FinanceRepository, db *sql.DB) *FinanceHandler {
	return &FinanceHandler{Repo: repo, DB: db}
}

// actorFromCtx mengambil id & nama user yang sedang login untuk audit trail.
func actorFromCtx(c echo.Context) (string, string) {
	id, _ := c.Get("user_id").(string)
	name, _ := c.Get("user_name").(string)
	if strings.TrimSpace(name) == "" {
		name, _ = c.Get("user_email").(string)
	}
	return id, name
}

func parseIntOr(s string, def int) int {
	if v, err := strconv.Atoi(strings.TrimSpace(s)); err == nil {
		return v
	}
	return def
}

func parseDateToMillis(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	if n, err := strconv.ParseInt(s, 10, 64); err == nil && n > 0 {
		return n
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t.UnixMilli()
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t.UnixMilli()
	}
	return 0
}

// ================= Unit Usaha =================

func (h *FinanceHandler) ListUnits(c echo.Context) error {
	includeInactive := c.QueryParam("includeInactive") == "1" || c.QueryParam("includeInactive") == "true"
	units, err := h.Repo.ListUnits(includeInactive)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat unit usaha"})
	}
	// Sertakan ringkasan saldo supaya UI bisa langsung menampilkan total.
	type unitView struct {
		models.FinanceUnit
	}
	out := make([]unitView, 0, len(units))
	for _, u := range units {
		if s, _ := h.Repo.SummaryByUnit(u.ID); s != nil {
			u.TotalIn = s.TotalIn
			u.TotalOut = s.TotalOut
			u.Balance = s.Balance
		}
		out = append(out, unitView{FinanceUnit: u})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": out})
}

func (h *FinanceHandler) GetUnit(c echo.Context) error {
	// Terima id atau code.
	u, err := h.Repo.GetUnitByID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat unit"})
	}
	if u == nil {
		u, _ = h.Repo.GetUnitByCode(c.Param("id"))
	}
	if u == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Unit tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": u})
}

func (h *FinanceHandler) CreateUnit(c echo.Context) error {
	var req models.CreateFinanceUnitRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "Data tidak valid")
	}
	aid, aname := actorFromCtx(c)
	u, err := h.Repo.CreateUnit(req, aid, aname)
	if err != nil {
		return badRequest(c, err.Error())
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "data": u})
}

func (h *FinanceHandler) UpdateUnit(c echo.Context) error {
	var req models.CreateFinanceUnitRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "Data tidak valid")
	}
	aid, aname := actorFromCtx(c)
	if err := h.Repo.UpdateUnit(c.Param("id"), req, aid, aname); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Unit tidak ditemukan"})
		}
		return badRequest(c, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *FinanceHandler) DeleteUnit(c echo.Context) error {
	aid, aname := actorFromCtx(c)
	if err := h.Repo.DeleteUnit(c.Param("id"), aid, aname); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menghapus unit"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ================= Kategori =================

func (h *FinanceHandler) ListCategories(c echo.Context) error {
	includeInactive := c.QueryParam("includeInactive") == "1" || c.QueryParam("includeInactive") == "true"
	items, err := h.Repo.ListCategories(c.QueryParam("unitId"), includeInactive)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat kategori"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": items})
}

func (h *FinanceHandler) CreateCategory(c echo.Context) error {
	var req models.CreateFinanceCategoryRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "Data tidak valid")
	}
	aid, aname := actorFromCtx(c)
	cat, err := h.Repo.CreateCategory(req, aid, aname)
	if err != nil {
		return badRequest(c, err.Error())
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "data": cat})
}

func (h *FinanceHandler) UpdateCategory(c echo.Context) error {
	var req models.CreateFinanceCategoryRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "Data tidak valid")
	}
	aid, aname := actorFromCtx(c)
	if err := h.Repo.UpdateCategory(c.Param("id"), req, aid, aname); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Kategori tidak ditemukan"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memperbarui kategori"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *FinanceHandler) DeleteCategory(c echo.Context) error {
	aid, aname := actorFromCtx(c)
	if err := h.Repo.DeleteCategory(c.Param("id"), aid, aname); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menghapus kategori"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ================= Transaksi =================

func (h *FinanceHandler) ListTransactions(c echo.Context) error {
	f := repository.FinanceTransactionFilter{
		UnitID:     c.QueryParam("unitId"),
		CategoryID: c.QueryParam("categoryId"),
		Direction:  c.QueryParam("direction"),
		Search:     c.QueryParam("search"),
		Limit:      parseIntOr(c.QueryParam("limit"), 200),
		Offset:     parseIntOr(c.QueryParam("offset"), 0),
	}
	f.DateFrom = parseDateToMillis(c.QueryParam("dateFrom"))
	f.DateTo = parseDateToMillis(c.QueryParam("dateTo"))

	items, err := h.Repo.ListTransactions(f)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat transaksi"})
	}
	total, _ := h.Repo.CountTransactions(f)
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": items, "total": total})
}

func (h *FinanceHandler) GetTransaction(c echo.Context) error {
	t, err := h.Repo.GetTransactionByID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat transaksi"})
	}
	if t == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Transaksi tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": t})
}

func (h *FinanceHandler) CreateTransaction(c echo.Context) error {
	var req models.CreateFinanceTransactionRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "Data tidak valid")
	}
	aid, aname := actorFromCtx(c)
	t, err := h.Repo.CreateTransaction(req, aid, aname)
	if err != nil {
		return badRequest(c, err.Error())
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"success": true, "data": t})
}

func (h *FinanceHandler) UpdateTransaction(c echo.Context) error {
	var req models.CreateFinanceTransactionRequest
	if err := c.Bind(&req); err != nil {
		return badRequest(c, "Data tidak valid")
	}
	aid, aname := actorFromCtx(c)
	if err := h.Repo.UpdateTransaction(c.Param("id"), req, aid, aname); err != nil {
		if err == sql.ErrNoRows {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Transaksi tidak ditemukan"})
		}
		return badRequest(c, err.Error())
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

func (h *FinanceHandler) DeleteTransaction(c echo.Context) error {
	aid, aname := actorFromCtx(c)
	if err := h.Repo.DeleteTransaction(c.Param("id"), aid, aname); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal menghapus transaksi"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true})
}

// ================= Ringkasan & Rekap =================

func (h *FinanceHandler) Summary(c echo.Context) error {
	if unitID := c.QueryParam("unitId"); strings.TrimSpace(unitID) != "" {
		s, err := h.Repo.SummaryByUnit(unitID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat ringkasan"})
		}
		if s == nil {
			return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Unit tidak ditemukan"})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": s})
	}
	items, err := h.Repo.SummaryAllUnits()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat ringkasan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": items})
}

func (h *FinanceHandler) RecapByCategory(c echo.Context) error {
	unitID := c.QueryParam("unitId")
	if strings.TrimSpace(unitID) == "" {
		return badRequest(c, "unitId wajib diisi")
	}
	items, err := h.Repo.RecapByCategory(unitID, parseDateToMillis(c.QueryParam("dateFrom")), parseDateToMillis(c.QueryParam("dateTo")))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat rekap kategori"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": items})
}

func (h *FinanceHandler) RecapMonthly(c echo.Context) error {
	items, err := h.Repo.RecapMonthly(c.QueryParam("unitId"), parseIntOr(c.QueryParam("limit"), 24))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat rekap bulanan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": items})
}

func (h *FinanceHandler) ListAuditLog(c echo.Context) error {
	items, err := h.Repo.ListAuditLog(parseIntOr(c.QueryParam("limit"), 100))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal memuat riwayat"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "items": items})
}
