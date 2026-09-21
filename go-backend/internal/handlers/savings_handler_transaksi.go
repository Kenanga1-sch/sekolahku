package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
	"github.com/sekolahku/go-backend/internal/shared"
)

// ============ Transaksi ============

func (h *SavingsHandler) GetTransactions(c echo.Context) error {
	siswaId := c.QueryParam("siswaId")
	status := c.QueryParam("status")
	if status == "pending" {
		status = "collected"
	}
	guruID := c.QueryParam("guruId")
	search := c.QueryParam("search")
	tipe := c.QueryParam("tipe")
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 {
		limit, _ = strconv.Atoi(c.QueryParam("perPage"))
	}
	fetchAll := c.QueryParam("fetchAll") == "1"
	var startMs, endMs int64
	if startDate := c.QueryParam("startDate"); startDate != "" {
		if parsed, err := time.Parse(time.RFC3339, startDate); err == nil {
			startMs = parsed.UnixMilli()
		}
	}
	if endDate := c.QueryParam("endDate"); endDate != "" {
		if parsed, err := time.Parse(time.RFC3339, endDate); err == nil {
			endMs = parsed.UnixMilli()
		}
	}

	// Siswa hanya boleh melihat transaksi dirinya sendiri.
	if role, _ := c.Get("user_role").(string); role == "siswa" {
		userID, _ := c.Get("user_id").(string)
		var sid string
		if err := h.Repo.DB.QueryRow("SELECT COALESCE(student_id,'') FROM users WHERE id = ?", userID).Scan(&sid); err != nil || sid == "" {
			return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "error": "Akun belum terhubung ke data siswa"})
		}
		siswaId = sid
	}

	list, total, err := h.Repo.GetTransactions(siswaId, status, guruID, search, tipe, startMs, endMs, limit, fetchAll)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	totalPages := 1
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "items": list, "totalPages": totalPages, "totalItems": total})
}

func (h *SavingsHandler) CreateTransaksi(c echo.Context) error {
	var req models.CreateTransaksiRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if req.Nominal < 1000 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Minimal nominal Rp1.000"})
	}
	if req.Nominal > 10000000 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Maksimal nominal Rp10.000.000"})
	}
	if err := h.Repo.CreateTransaksi(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Gagal mencatat transaksi"})
	}
	h.auditSavings(c, "create_transaksi", "savings", fmt.Sprintf("Transaksi %s siswa %s nominal %d", req.Tipe, req.SiswaID, req.Nominal))
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Transaksi berhasil dikumpulkan"})
}

func (h *SavingsHandler) KioskDeposit(c echo.Context) error {
	var req struct {
		QRCode  string `json:"qrCode"`
		Nominal int    `json:"nominal"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Input tidak valid"})
	}
	if req.QRCode == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "QR Code diperlukan"})
	}
	if req.Nominal < 1000 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Minimal setoran Rp1.000"})
	}
	if req.Nominal > 10000000 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Maksimal setoran Rp10.000.000"})
	}

	s, err := h.Repo.GetSiswaByQR(req.QRCode)
	if err != nil || s == nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Siswa tidak ditemukan"})
	}

	var kioskUserID string
	_ = h.Repo.DB.QueryRow("SELECT id FROM users WHERE role = 'kiosk' OR username = 'kiosk' LIMIT 1").Scan(&kioskUserID)
	if kioskUserID == "" {
		_ = h.Repo.DB.QueryRow("SELECT id FROM users WHERE role IN ('admin','superadmin') ORDER BY id LIMIT 1").Scan(&kioskUserID)
	}
	if kioskUserID == "" {
		kioskUserID = "system-kiosk"
	}

	txReq := models.CreateTransaksiRequest{
		SiswaID: s.ID,
		UserID:  kioskUserID,
		Tipe:    "setor",
		Nominal: req.Nominal,
		Catatan: shared.StringPtr("Setoran via kiosk"),
	}
	if err := h.Repo.CreateTransaksi(txReq); err != nil {
		// Endpoint keuangan: detail error SQLite (skema/constraint) tidak boleh
		// bocor ke client — log saja di server.
		c.Logger().Errorf("gagal mencatat setoran kiosk: %v", err)
		return shared.InternalError(c)
	}

	// Setoran kiosk = kas tunai langsung; saldo anak berubah. Kabari orang tua.
	if h.ParentNotify != nil {
		studentName, className, _ := h.ParentNotify.Parents.GetStudentBrief(s.ID)
		h.ParentNotify.NotifyParentsOfStudent(
			s.ID, "tabungan", "finance",
			"Setoran kiosk " + studentName,
			studentName + " (" + className + ") menyetorkan Rp" +
				strconv.FormatInt(int64(req.Nominal), 10) + " melalui kiosk sekolah.",
			"/parent", "kiosk-deposit-"+s.ID+"-"+repository.TodayJakarta(),
		)
	}

	// Setoran kiosk menunggu verifikasi bendahara — beri tahu.
	if h.Notifications != nil {
		_ = h.Notifications.NotifyRoles(models.Notification{
			Type:      "info",
			Category:  "finance",
			Title:     "Setoran kiosk menunggu verifikasi",
			Message:   s.Nama + " — Rp" + strconv.FormatInt(int64(req.Nominal), 10) + " menunggu diverifikasi bendahara.",
			TargetURL: StrPtr("/tabungan/verifikasi"),
		}, "bendahara", "admin", "superadmin")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":        true,
		"message":        "Setoran berhasil dicatat dan menunggu verifikasi bendahara",
		"balance":        s.SaldoTerakhir,
		"pendingDeposit": req.Nominal,
	})
}

// ============ Setoran (Settlement) ============

func (h *SavingsHandler) CreateSetoran(c echo.Context) error {
	var req models.CreateSetoranRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.CreateSetoran(req); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}

	// Setoran baru diajukan guru — bendahara perlu memverifikasi.
	if h.Notifications != nil {
		guruName := ""
		_ = h.Repo.DB.QueryRow("SELECT name FROM users WHERE id = ?", req.GuruID).Scan(&guruName)
		if guruName == "" {
			guruName = "Guru"
		}
		_ = h.Notifications.NotifyRoles(models.Notification{
			Type:      "info",
			Category:  "finance",
			Title:     "Setoran baru menunggu verifikasi",
			Message:   guruName + " mengajukan setoran untuk diverifikasi.",
			TargetURL: StrPtr("/tabungan/verifikasi"),
		}, "bendahara", "admin", "superadmin")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Setoran berhasil diajukan"})
}

func (h *SavingsHandler) VerifySetoran(c echo.Context) error {
	var req models.VerifySetoranRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "error": "Invalid payload"})
	}
	if err := h.Repo.VerifySetoran(req); err != nil {
		c.Logger().Errorf("gagal verifikasi setoran: %v", err)
		return shared.InternalError(c)
	}

	h.auditSavings(c, "verify_setoran", "savings", fmt.Sprintf("Verifikasi setoran ID %s status=%s", req.SetoranID, req.Status))

	// Kabari guru penyetor: hasil verifikasi setorannya.
	if h.Notifications != nil {
		guruID := ""
		_ = h.Repo.DB.QueryRow("SELECT guru_id FROM tabungan_setoran WHERE id = ?", req.SetoranID).Scan(&guruID)
		if guruID != "" {
			label := "diverifikasi"
			nType := "success"
			if req.Status == "rejected" {
				label = "ditolak"
				nType = "warning"
			}
			_ = h.Notifications.CreateNotification(models.Notification{
				UserID:    &guruID,
				Type:      nType,
				Category:  "finance",
				Title:     "Setoran " + label,
				Message:   "Setoran Anda telah " + label + " oleh bendahara.",
				TargetURL: StrPtr("/tabungan/setoran"),
			})
		}
	}

	// Saat verifikasi sukses, saldo tabungan siswa berubah — kabari ortu.
	if req.Status == "verified" && h.ParentNotify != nil {
		h.notifySavingsParents(req.SetoranID)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Setoran telah diproses"})
}

// notifySavingsParents mengabari orang tua per siswa yang saldonya
// berubah lewat verifikasi setoran (tipe setor/tarik).
func (h *SavingsHandler) notifySavingsParents(setoranID string) {
	rows, err := h.Repo.DB.Query(`
		SELECT t.siswa_id, SUM(CASE WHEN t.tipe = 'setor' THEN t.nominal ELSE -t.nominal END)
		FROM tabungan_transaksi t
		WHERE t.setoran_id = ?
		GROUP BY t.siswa_id
	`, setoranID)
	if err != nil {
		return
	}
	type change struct {
		SiswaID string
		Net     int
	}
	changes := make([]change, 0, 8)
	for rows.Next() {
		var ch change
		if err := rows.Scan(&ch.SiswaID, &ch.Net); err == nil {
			changes = append(changes, ch)
		}
	}
	rows.Close()

	for _, ch := range changes {
		studentName, _, _ := h.ParentNotify.Parents.GetStudentBrief(ch.SiswaID)
		if studentName == "" {
			continue
		}
		action := "disetorkan"
		if ch.Net < 0 {
			action = "ditarik"
		}
		title := "Tabungan " + studentName
		body := "Tabungan " + studentName + " " + action + " sebesar Rp" +
			strconv.FormatInt(int64(abs(ch.Net)), 10) + " dan telah diverifikasi."
		h.ParentNotify.NotifyParentsOfStudent(
			ch.SiswaID, "tabungan", "finance", title, body,
			"/parent", "savings-"+ch.SiswaID,
		)
	}
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

func (h *SavingsHandler) GetSetoranList(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	perPage, _ := strconv.Atoi(c.QueryParam("perPage"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	list, total, err := h.Repo.GetSetoranList(c.QueryParam("status"), c.QueryParam("guruId"), page, perPage)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "total": total, "page": page, "perPage": perPage})
}

func (h *SavingsHandler) GetSetoranPending(c echo.Context) error {
	guruID := c.QueryParam("guruId")
	list, err := h.Repo.GetSetoranPending(guruID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "items": list})
}

func (h *SavingsHandler) GetSetoranByGuru(c echo.Context) error {
	guruID := c.QueryParam("guruId")
	list, err := h.Repo.GetSetoranByGuru(guruID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": list, "items": list})
}

func (h *SavingsHandler) GetSetoranDetail(c echo.Context) error {
	id := c.QueryParam("id")
	s, err := h.Repo.GetSetoranDetail(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{"success": false, "error": "Setoran tidak ditemukan"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "data": s})
}

func (h *SavingsHandler) ResubmitSetoran(c echo.Context) error {
	id := c.QueryParam("id")
	var req struct {
		Catatan string `json:"catatan"`
	}
	c.Bind(&req)
	if err := h.Repo.ResubmitSetoran(id, req.Catatan); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false, "error": "Terjadi kesalahan internal"})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Setoran dikirim ulang"})
}
