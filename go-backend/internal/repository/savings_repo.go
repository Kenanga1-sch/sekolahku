package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type SavingsRepository struct {
	DB *sql.DB
}

func NewSavingsRepository(db *sql.DB) *SavingsRepository {
	return &SavingsRepository{DB: db}
}

// Stats
func (r *SavingsRepository) GetSavingsStats() (*models.SavingsStats, error) {
	stats := &models.SavingsStats{}
	startOfDay := time.Now().Truncate(24 * time.Hour).UnixMilli()

	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_siswa WHERE is_active = 1").Scan(&stats.TotalSiswa)
	r.DB.QueryRow("SELECT COALESCE(SUM(saldo_terakhir), 0) FROM tabungan_siswa WHERE is_active = 1").Scan(&stats.TotalSaldo)
	r.DB.QueryRow("SELECT COALESCE(SUM(saldo), 0) FROM tabungan_brankas").Scan(&stats.TotalBrankas)
	r.DB.QueryRow("SELECT COALESCE(SUM(nominal * jumlah), 0) FROM tabungan_hutang WHERE status = 'aktif'").Scan(&stats.TotalPiutang)
	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_setoran WHERE status = 'pending'").Scan(&stats.PendingSetoran)
	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_transaksi WHERE status = 'collected'").Scan(&stats.PendingTransactions)
	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_transaksi WHERE status = 'verified' AND created_at >= ?", startOfDay).Scan(&stats.TodayTransactions)
	r.DB.QueryRow("SELECT COALESCE(SUM(nominal), 0) FROM tabungan_transaksi WHERE status = 'verified' AND tipe = 'setor' AND created_at >= ?", startOfDay).Scan(&stats.TodayDeposit)
	r.DB.QueryRow("SELECT COALESCE(SUM(nominal), 0) FROM tabungan_transaksi WHERE status = 'verified' AND tipe = 'tarik' AND created_at >= ?", startOfDay).Scan(&stats.TodayWithdraw)
	stats.TotalSaldoSiswa = stats.TotalSaldo
	return stats, nil
}

func (r *SavingsRepository) GetTopSavers(limit int) ([]models.TopSaverItem, error) {
	if limit < 1 {
		limit = 5
	}
	rows, err := r.DB.Query(`
		SELECT s.id, s.nama, k.nama, s.saldo_terakhir
		FROM tabungan_siswa s
		JOIN tabungan_kelas k ON s.kelas_id = k.id
		WHERE s.is_active = 1
		ORDER BY s.saldo_terakhir DESC, s.nama ASC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.TopSaverItem, 0)
	for rows.Next() {
		var id, nama, kelas string
		var saldo int
		if err := rows.Scan(&id, &nama, &kelas, &saldo); err != nil {
			return nil, err
		}
		items = append(items, models.TopSaverItem{
			ID:    id,
			Name:  nama,
			Kelas: kelas,
			Saldo: saldo,
		})
	}
	return items, nil
}

func (r *SavingsRepository) GetRecentTransactions(limit int) ([]models.RecentTransactionItem, error) {
	if limit < 1 {
		limit = 8
	}
	rows, err := r.DB.Query(`
		SELECT t.id, t.tipe, t.nominal, t.created_at, s.nama, k.nama
		FROM tabungan_transaksi t
		JOIN tabungan_siswa s ON t.siswa_id = s.id
		JOIN tabungan_kelas k ON s.kelas_id = k.id
		WHERE t.status = 'verified'
		ORDER BY t.created_at DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.RecentTransactionItem, 0)
	for rows.Next() {
		var id, tipe, siswaName, kelasName string
		var nominal int
		var createdAt sql.NullInt64
		if err := rows.Scan(&id, &tipe, &nominal, &createdAt, &siswaName, &kelasName); err != nil {
			return nil, err
		}
		timeValue := ""
		if createdAt.Valid {
			timeValue = ToTime(createdAt).Format(time.RFC3339)
		}
		items = append(items, models.RecentTransactionItem{
			ID:        id,
			Tipe:      tipe,
			Nominal:   nominal,
			SiswaName: siswaName,
			KelasName: kelasName,
			Time:      timeValue,
		})
	}
	return items, nil
}

func (r *SavingsRepository) GetTransactionTrend() ([]models.TransactionTrendItem, error) {
	items := make([]models.TransactionTrendItem, 0, 7)
	now := time.Now()
	for i := 6; i >= 0; i-- {
		day := now.AddDate(0, 0, -i)
		start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location()).UnixMilli()
		end := time.Date(day.Year(), day.Month(), day.Day(), 23, 59, 59, int(time.Millisecond-time.Nanosecond), day.Location()).UnixMilli()
		var setor, tarik int
		r.DB.QueryRow("SELECT COALESCE(SUM(nominal), 0) FROM tabungan_transaksi WHERE status = 'verified' AND tipe = 'setor' AND created_at BETWEEN ? AND ?", start, end).Scan(&setor)
		r.DB.QueryRow("SELECT COALESCE(SUM(nominal), 0) FROM tabungan_transaksi WHERE status = 'verified' AND tipe = 'tarik' AND created_at BETWEEN ? AND ?", start, end).Scan(&tarik)
		items = append(items, models.TransactionTrendItem{
			Date:  day.Format("02/01"),
			Setor: setor,
			Tarik: tarik,
		})
	}
	return items, nil
}

func (r *SavingsRepository) GetSaldoByKelas() ([]models.SaldoByKelasItem, error) {
	rows, err := r.DB.Query(`
		SELECT k.nama, COALESCE(SUM(s.saldo_terakhir), 0) AS saldo
		FROM tabungan_kelas k
		LEFT JOIN tabungan_siswa s ON s.kelas_id = k.id AND s.is_active = 1
		GROUP BY k.id, k.nama
		HAVING saldo > 0
		ORDER BY k.nama ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	colors := []string{"#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1", "#84cc16", "#06b6d4"}
	items := make([]models.SaldoByKelasItem, 0)
	i := 0
	for rows.Next() {
		var nama string
		var saldo int
		if err := rows.Scan(&nama, &saldo); err != nil {
			return nil, err
		}
		items = append(items, models.SaldoByKelasItem{
			Name:  nama,
			Value: saldo,
			Color: colors[i%len(colors)],
		})
		i++
	}
	return items, nil
}

// Students
func (r *SavingsRepository) GetSiswa(page, limit int, search, classId string) ([]models.TabunganSiswa, int, error) {
	offset := (page - 1) * limit
	// BUG-7 FIX: Default to only active students
	query := `
		SELECT s.id, s.nisn, s.nama, s.kelas_id, s.saldo_terakhir, s.qr_code, s.foto, s.is_active, s.created_at,
		       k.id as k_id, k.nama as k_nama
		FROM tabungan_siswa s
		JOIN tabungan_kelas k ON s.kelas_id = k.id
		WHERE s.is_active = 1
	`
	var args []interface{}
	if search != "" {
		query += " AND (s.nama LIKE ? OR s.nisn LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern)
	}
	if classId != "" {
		query += " AND s.kelas_id = ?"
		args = append(args, classId)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM ("+query+")", args...).Scan(&total)

	query += " ORDER BY k.nama ASC, s.nama ASC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.TabunganSiswa
	for rows.Next() {
		var s models.TabunganSiswa
		var kId, kNama, foto sql.NullString
		var crAt sql.NullInt64
		err := rows.Scan(&s.ID, &s.NISN, &s.Nama, &s.KelasID, &s.SaldoTerakhir, &s.QRCode, &foto, &s.IsActive, &crAt, &kId, &kNama)
		if err != nil {
			return nil, 0, err
		}
		if foto.Valid {
			s.Foto = &foto.String
		}
		cTime := ToTime(crAt)
		s.CreatedAt = &cTime
		if kId.Valid {
			s.Kelas = &models.TabunganKelas{ID: kId.String, Nama: kNama.String}
		}
		results = append(results, s)
	}
	if results == nil {
		results = []models.TabunganSiswa{}
	}
	return results, total, nil
}

func (r *SavingsRepository) GetSiswaByQR(qrCode string) (*models.TabunganSiswa, error) {
	var s models.TabunganSiswa
	var kId, kNama, foto sql.NullString
	var crAt sql.NullInt64
	err := r.DB.QueryRow(`
		SELECT s.id, s.nisn, s.nama, s.kelas_id, s.saldo_terakhir, s.qr_code, s.foto, s.is_active, s.created_at,
		       k.id as k_id, k.nama as k_nama
		FROM tabungan_siswa s
		JOIN tabungan_kelas k ON s.kelas_id = k.id
		WHERE s.qr_code = ? OR s.id = ? OR s.nisn = ?
	`, qrCode, qrCode, qrCode).Scan(&s.ID, &s.NISN, &s.Nama, &s.KelasID, &s.SaldoTerakhir, &s.QRCode, &foto, &s.IsActive, &crAt, &kId, &kNama)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if foto.Valid {
		s.Foto = &foto.String
	}
	cTime := ToTime(crAt)
	s.CreatedAt = &cTime
	if kId.Valid {
		s.Kelas = &models.TabunganKelas{ID: kId.String, Nama: kNama.String}
	}
	return &s, nil
}

func (r *SavingsRepository) CreateSiswa(req models.CreateSiswaRequest) error {
	req.NISN = strings.TrimSpace(req.NISN)
	req.Nama = strings.TrimSpace(req.Nama)
	req.KelasID = strings.TrimSpace(req.KelasID)
	if req.NISN == "" || req.Nama == "" || req.KelasID == "" {
		return errors.New("NISN, nama, dan kelas wajib diisi")
	}

	id := cuid2.Generate()
	qrCode := "TAB-" + id
	if req.QRCode != nil && strings.TrimSpace(*req.QRCode) != "" {
		qrCode = strings.TrimSpace(*req.QRCode)
	}
	now := UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO tabungan_siswa (id, nisn, nama, kelas_id, saldo_terakhir, qr_code, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, 0, ?, 1, ?, ?)
	`, id, req.NISN, req.Nama, req.KelasID, qrCode, now, now)
	return err
}

func (r *SavingsRepository) UpdateSiswa(id string, req models.CreateSiswaRequest) error {
	req.NISN = strings.TrimSpace(req.NISN)
	req.Nama = strings.TrimSpace(req.Nama)
	req.KelasID = strings.TrimSpace(req.KelasID)
	if id == "" || req.NISN == "" || req.Nama == "" || req.KelasID == "" {
		return errors.New("Data siswa tidak lengkap")
	}

	query := "UPDATE tabungan_siswa SET nisn = ?, nama = ?, kelas_id = ?, updated_at = ?"
	args := []interface{}{req.NISN, req.Nama, req.KelasID, UnixMilli()}
	if req.QRCode != nil && strings.TrimSpace(*req.QRCode) != "" {
		query += ", qr_code = ?"
		args = append(args, strings.TrimSpace(*req.QRCode))
	}
	query += " WHERE id = ?"
	args = append(args, id)

	res, err := r.DB.Exec(query, args...)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return errors.New("Siswa tidak ditemukan")
	}
	return nil
}

func (r *SavingsRepository) DeleteSiswa(id string) error {
	res, err := r.DB.Exec("UPDATE tabungan_siswa SET is_active = 0, updated_at = ? WHERE id = ?", UnixMilli(), id)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return errors.New("Siswa tidak ditemukan")
	}
	return nil
}

// Classes
func (r *SavingsRepository) GetAllKelas() ([]models.TabunganKelas, error) {
	rows, err := r.DB.Query(`
		SELECT k.id, k.nama, k.wali_kelas, u.name
		FROM tabungan_kelas k
		LEFT JOIN users u ON k.wali_kelas = u.id
		ORDER BY k.nama ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []models.TabunganKelas
	for rows.Next() {
		var k models.TabunganKelas
		var wId, wName sql.NullString
		rows.Scan(&k.ID, &k.Nama, &wId, &wName)
		if wId.Valid {
			k.WaliKelas = &wId.String
		}
		res = append(res, k)
	}
	return res, nil
}

func (r *SavingsRepository) CreateKelas(nama string, waliKelas *string) error {
	id := cuid2.Generate()
	now := UnixMilli()
	_, err := r.DB.Exec("INSERT INTO tabungan_kelas (id, nama, wali_kelas, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
		id, nama, waliKelas, now, now)
	return err
}

func (r *SavingsRepository) UpdateKelas(id string, nama string, waliKelas *string) error {
	_, err := r.DB.Exec("UPDATE tabungan_kelas SET nama = ?, wali_kelas = ?, updated_at = ? WHERE id = ?",
		nama, waliKelas, UnixMilli(), id)
	return err
}

func (r *SavingsRepository) DeleteKelas(id string) error {
	// BUG-8 FIX: Check if there are active students in this class before deleting
	var count int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_siswa WHERE kelas_id = ? AND is_active = 1", id).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return errors.New("Tidak dapat menghapus kelas yang masih memiliki " + strconv.Itoa(count) + " siswa aktif")
	}
	_, err := r.DB.Exec("DELETE FROM tabungan_kelas WHERE id = ?", id)
	return err
}

func (r *SavingsRepository) UpdateClassRep(classId, userId string) error {
	_, err := r.DB.Exec("UPDATE tabungan_kelas SET wali_kelas = ?, updated_at = ? WHERE id = ?", userId, UnixMilli(), classId)
	return err
}

func (r *SavingsRepository) GetClassesWithReps() ([]models.TabunganKelas, error) {
	return r.GetAllKelas()
}

// Transactions
func (r *SavingsRepository) CreateTransaksi(req models.CreateTransaksiRequest) error {
	if req.Tipe == "" {
		req.Tipe = req.Type
	}
	req.Tipe = strings.ToLower(strings.TrimSpace(req.Tipe))
	req.SiswaID = strings.TrimSpace(req.SiswaID)
	req.UserID = strings.TrimSpace(req.UserID)
	if req.SiswaID == "" || req.UserID == "" {
		return errors.New("Siswa dan petugas wajib diisi")
	}
	if req.Tipe != "setor" && req.Tipe != "tarik" {
		return errors.New("Tipe transaksi tidak valid")
	}
	if req.Nominal < 1000 {
		return errors.New("Nominal minimal Rp 1.000")
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var saldo int
	err = tx.QueryRow("SELECT saldo_terakhir FROM tabungan_siswa WHERE id = ?", req.SiswaID).Scan(&saldo)
	if err != nil {
		return errors.New("Siswa tidak ditemukan")
	}

	var pendingNet int
	err = tx.QueryRow(`
		SELECT COALESCE(SUM(CASE WHEN tipe = 'setor' THEN nominal ELSE -nominal END), 0)
		FROM tabungan_transaksi
		WHERE siswa_id = ? AND status = 'collected'
	`, req.SiswaID).Scan(&pendingNet)
	if err != nil {
		return err
	}

	if req.Tipe == "tarik" && saldo+pendingNet < req.Nominal {
		return errors.New("Saldo tidak cukup")
	}

	id := cuid2.Generate()
	now := UnixMilli()
	_, err = tx.Exec(`
		INSERT INTO tabungan_transaksi (id, siswa_id, user_id, tipe, nominal, status, catatan, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.SiswaID, req.UserID, req.Tipe, req.Nominal, "collected", req.Catatan, now, now)

	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *SavingsRepository) GetTransactions(siswaId, status, guruId, search, tipe string, startDate, endDate int64, limit int) ([]models.TabunganTransaksi, error) {
	if limit < 1 || limit > 200 {
		limit = 100
	}
	query := `
		SELECT t.id, t.siswa_id, t.user_id, t.setoran_id, t.tipe, t.nominal, t.status, t.catatan, t.created_at,
		       s.nama as s_nama, k.nama as k_nama, u.name as u_name
		FROM tabungan_transaksi t
		JOIN tabungan_siswa s ON t.siswa_id = s.id
		JOIN tabungan_kelas k ON s.kelas_id = k.id
		LEFT JOIN users u ON t.user_id = u.id
		WHERE 1=1
	`
	var args []interface{}
	if siswaId != "" {
		query += " AND t.siswa_id = ?"
		args = append(args, siswaId)
	}
	if status != "" {
		query += " AND t.status = ?"
		args = append(args, status)
	}
	if guruId != "" {
		query += " AND t.user_id = ?"
		args = append(args, guruId)
	}
	if search != "" {
		query += " AND (s.nama LIKE ? OR s.nisn LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern)
	}
	if tipe != "" {
		query += " AND t.tipe = ?"
		args = append(args, tipe)
	}
	if startDate > 0 {
		query += " AND t.created_at >= ?"
		args = append(args, startDate)
	}
	if endDate > 0 {
		query += " AND t.created_at <= ?"
		args = append(args, endDate)
	}
	query += " ORDER BY t.created_at DESC LIMIT ?"
	args = append(args, limit)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.TabunganTransaksi
	for rows.Next() {
		var t models.TabunganTransaksi
		var sId, uId, setId, cat sql.NullString
		var crAt sql.NullInt64
		var sName, kName, uName sql.NullString
		err := rows.Scan(&t.ID, &sId, &uId, &setId, &t.Tipe, &t.Nominal, &t.Status, &cat, &crAt, &sName, &kName, &uName)
		if err != nil {
			return nil, err
		}
		if sId.Valid {
			t.SiswaID = sId.String
		}
		if uId.Valid {
			t.UserID = uId.String
		}
		if setId.Valid {
			t.SetoranID = &setId.String
		}
		if cat.Valid {
			t.Catatan = &cat.String
		}
		cTime := ToTime(crAt)
		t.CreatedAt = &cTime
		t.Siswa = &models.TabunganSiswa{Nama: sName.String}
		if kName.Valid {
			t.Siswa.Kelas = &models.TabunganKelas{Nama: kName.String}
		}
		if uName.Valid {
			t.User = &models.User{Name: Ptr(uName.String)}
		}
		results = append(results, t)
	}
	if results == nil {
		results = []models.TabunganTransaksi{}
	}
	return results, nil
}

// Settlements (Setoran)
func (r *SavingsRepository) GetSetoranList(status, guruID string, page, perPage int) ([]models.TabunganSetoran, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	where := "1=1"
	var args []interface{}
	if status != "" {
		where += " AND s.status = ?"
		args = append(args, status)
	}
	if guruID != "" {
		where += " AND s.guru_id = ?"
		args = append(args, guruID)
	}

	var total int
	r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_setoran s WHERE "+where, args...).Scan(&total)

	listArgs := append(args, perPage, offset)
	query := `
		SELECT s.id, s.guru_id, s.bendahara_id, s.tipe, s.total_nominal, s.nominal_fisik, s.selisih, s.status, s.catatan, s.created_at,
		       g.name as g_name, b.name as b_name
		FROM tabungan_setoran s
		JOIN users g ON s.guru_id = g.id
		LEFT JOIN users b ON s.bendahara_id = b.id
		WHERE ` + where + ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`

	rows, err := r.DB.Query(query, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []models.TabunganSetoran
	for rows.Next() {
		var s models.TabunganSetoran
		var bId, cat, gName, bName sql.NullString
		var crAt sql.NullInt64
		err := rows.Scan(&s.ID, &s.GuruID, &bId, &s.Tipe, &s.TotalNominal, &s.NominalFisik, &s.Selisih, &s.Status, &cat, &crAt, &gName, &bName)
		if err != nil {
			return nil, 0, err
		}
		if bId.Valid {
			s.BendaharaID = &bId.String
		}
		if cat.Valid {
			s.Catatan = &cat.String
		}
		cTime := ToTime(crAt)
		s.CreatedAt = &cTime
		s.Guru = &models.User{Name: Ptr(gName.String)}
		results = append(results, s)
	}
	if results == nil {
		results = []models.TabunganSetoran{}
	}
	return results, total, nil
}

func (r *SavingsRepository) CreateSetoran(req models.CreateSetoranRequest) error {
	req.GuruID = strings.TrimSpace(req.GuruID)
	if req.GuruID == "" {
		return errors.New("Petugas/guru wajib diisi")
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	rows, err := tx.Query(`
		SELECT id, tipe, nominal FROM tabungan_transaksi 
		WHERE user_id = ? AND setoran_id IS NULL AND status = 'collected'
	`, req.GuruID)
	if err != nil {
		return err
	}

	var txIds []string
	total := 0
	for rows.Next() {
		var id, t string
		var n int
		if err := rows.Scan(&id, &t, &n); err != nil {
			rows.Close()
			return err
		}
		txIds = append(txIds, id)
		if t == "setor" {
			total += n
		} else {
			total -= n
		}
	}
	rows.Close()

	if len(txIds) == 0 {
		return errors.New("Tidak ada transaksi untuk disetor")
	}

	sId := cuid2.Generate()
	now := UnixMilli()
	tipe := "setor_ke_bendahara"
	if total < 0 {
		tipe = "tarik_dari_bendahara"
		total = -total
	}

	_, err = tx.Exec("INSERT INTO tabungan_setoran (id, guru_id, tipe, total_nominal, status, catatan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		sId, req.GuruID, tipe, total, "pending", req.Catatan, now, now)
	if err != nil {
		return err
	}

	for _, tid := range txIds {
		if _, err := tx.Exec("UPDATE tabungan_transaksi SET setoran_id = ?, updated_at = ? WHERE id = ?", sId, now, tid); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *SavingsRepository) VerifySetoran(req models.VerifySetoranRequest) error {
	if req.Status != "verified" && req.Status != "rejected" {
		return errors.New("Status verifikasi tidak valid")
	}
	if strings.TrimSpace(req.SetoranID) == "" || strings.TrimSpace(req.BendaharaID) == "" {
		return errors.New("Setoran dan bendahara wajib diisi")
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var total int
	var t, currentStatus string
	err = tx.QueryRow("SELECT total_nominal, tipe, status FROM tabungan_setoran WHERE id = ?", req.SetoranID).Scan(&total, &t, &currentStatus)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("Setoran tidak ditemukan")
		}
		return err
	}
	if currentStatus != "pending" {
		return errors.New("Setoran sudah diproses")
	}

	fisik := total
	if req.NominalFisik != nil {
		fisik = *req.NominalFisik
	}
	if fisik < 0 {
		return errors.New("Nominal fisik tidak valid")
	}
	selisih := total - fisik
	now := UnixMilli()

	if _, err := tx.Exec("UPDATE tabungan_setoran SET status = ?, bendahara_id = ?, nominal_fisik = ?, selisih = ?, catatan = ?, updated_at = ? WHERE id = ?",
		req.Status, req.BendaharaID, fisik, selisih, req.Catatan, now, req.SetoranID); err != nil {
		return err
	}

	if req.Status == "verified" {
		rows, err := tx.Query("SELECT id, siswa_id, tipe, nominal FROM tabungan_transaksi WHERE setoran_id = ?", req.SetoranID)
		if err != nil {
			return err
		}

		// BUG-5 FIX: Collect all transactions first, then validate total withdrawals per student
		type txItem struct {
			ID, SiswaID, Tipe string
			Nominal           int
		}
		var items []txItem
		for rows.Next() {
			var item txItem
			if err := rows.Scan(&item.ID, &item.SiswaID, &item.Tipe, &item.Nominal); err != nil {
				rows.Close()
				return err
			}
			items = append(items, item)
		}
		rows.Close()

		// Calculate net change per student to validate withdrawals won't cause negative balance
		netPerSiswa := make(map[string]int)
		for _, item := range items {
			if item.Tipe == "setor" {
				netPerSiswa[item.SiswaID] += item.Nominal
			} else {
				netPerSiswa[item.SiswaID] -= item.Nominal
			}
		}

		// Validate: for students with net withdrawal, check balance
		for sid, net := range netPerSiswa {
			if net < 0 {
				var saldo int
				if err := tx.QueryRow("SELECT saldo_terakhir FROM tabungan_siswa WHERE id = ?", sid).Scan(&saldo); err != nil {
					return err
				}
				if saldo+net < 0 {
					var nama string
					tx.QueryRow("SELECT nama FROM tabungan_siswa WHERE id = ?", sid).Scan(&nama)
					return errors.New("Saldo siswa " + nama + " tidak cukup untuk verifikasi penarikan")
				}
			}
		}

		// All validations passed, now apply
		for _, item := range items {
			if _, err := tx.Exec("UPDATE tabungan_transaksi SET status = 'verified', verified_by = ?, verified_at = ?, updated_at = ? WHERE id = ?", req.BendaharaID, now, now, item.ID); err != nil {
				return err
			}
			if item.Tipe == "setor" {
				if _, err := tx.Exec("UPDATE tabungan_siswa SET saldo_terakhir = saldo_terakhir + ?, updated_at = ? WHERE id = ?", item.Nominal, now, item.SiswaID); err != nil {
					return err
				}
			} else {
				if _, err := tx.Exec("UPDATE tabungan_siswa SET saldo_terakhir = saldo_terakhir - ?, updated_at = ? WHERE id = ?", item.Nominal, now, item.SiswaID); err != nil {
					return err
				}
			}
		}

		// Vault update
		var bId string
		tx.QueryRow("SELECT id FROM tabungan_brankas WHERE tipe = 'cash' LIMIT 1").Scan(&bId)
		if bId == "" {
			bId = cuid2.Generate()
			if _, err := tx.Exec("INSERT INTO tabungan_brankas (id, nama, tipe, saldo, updated_at) VALUES (?, 'Kas Utama', 'cash', 0, ?)", bId, now); err != nil {
				return err
			}
		}
		if t == "tarik_dari_bendahara" {
			var cashSaldo int
			if err := tx.QueryRow("SELECT saldo FROM tabungan_brankas WHERE id = ?", bId).Scan(&cashSaldo); err != nil {
				return err
			}
			if cashSaldo < fisik {
				return errors.New("Saldo kas tidak mencukupi untuk penarikan")
			}
			if _, err := tx.Exec("UPDATE tabungan_brankas SET saldo = saldo - ?, updated_at = ? WHERE id = ?", fisik, now, bId); err != nil {
				return err
			}
		} else {
			if _, err := tx.Exec("UPDATE tabungan_brankas SET saldo = saldo + ?, updated_at = ? WHERE id = ?", fisik, now, bId); err != nil {
				return err
			}
		}

		if _, err := tx.Exec("INSERT INTO tabungan_brankas_transaksi (id, tipe, nominal, user_id, catatan, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			cuid2.Generate(), t, fisik, req.BendaharaID, "Verifikasi setoran harian", now); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// Brankas & Admin
func (r *SavingsRepository) GetBrankas() ([]models.TabunganBrankas, error) {
	rows, err := r.DB.Query(`
		SELECT b.id, b.nama, b.tipe, b.saldo, b.pic_id, b.updated_at, u.name
		FROM tabungan_brankas b
		LEFT JOIN users u ON b.pic_id = u.id
		ORDER BY b.tipe DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []models.TabunganBrankas
	for rows.Next() {
		var b models.TabunganBrankas
		var upAt sql.NullInt64
		var picID, picName sql.NullString
		if err := rows.Scan(&b.ID, &b.Nama, &b.Tipe, &b.Saldo, &picID, &upAt, &picName); err != nil {
			return nil, err
		}
		if picID.Valid {
			b.PicID = &picID.String
		}
		if picName.Valid {
			b.Pic = &models.User{Name: Ptr(picName.String)}
		}
		uTime := ToTime(upAt)
		b.UpdatedAt = &uTime
		res = append(res, b)
	}
	if res == nil {
		res = []models.TabunganBrankas{}
	}
	return res, nil
}

func (r *SavingsRepository) GetBrankasTransactions() ([]models.TabunganBrankasTransaksi, error) {
	rows, err := r.DB.Query(`
		SELECT bt.id, bt.tipe, bt.nominal, bt.user_id, bt.catatan, bt.created_at, u.name
		FROM tabungan_brankas_transaksi bt
		LEFT JOIN users u ON bt.user_id = u.id
		ORDER BY bt.created_at DESC LIMIT 20
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []models.TabunganBrankasTransaksi
	for rows.Next() {
		var t models.TabunganBrankasTransaksi
		var uId, cat, uName sql.NullString
		var crAt sql.NullInt64
		rows.Scan(&t.ID, &t.Tipe, &t.Nominal, &uId, &cat, &crAt, &uName)
		if uId.Valid {
			t.UserID = &uId.String
		}
		if cat.Valid {
			t.Catatan = &cat.String
		}
		cTime := ToTime(crAt)
		t.CreatedAt = &cTime
		if uName.Valid {
			t.User = &models.User{Name: Ptr(uName.String)}
		}
		res = append(res, t)
	}
	if res == nil {
		res = []models.TabunganBrankasTransaksi{}
	}
	return res, nil
}

func (r *SavingsRepository) TransferBrankas(req models.TransferBrankasRequest) error {
	if req.Nominal == 0 {
		req.Nominal = req.Amount
	}
	if req.Nominal <= 0 {
		return errors.New("Nominal transfer harus lebih dari 0")
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	fromID := strings.TrimSpace(req.FromID)
	toID := strings.TrimSpace(req.ToID)
	if fromID == "" || toID == "" {
		var cashId, bankId string
		tx.QueryRow("SELECT id FROM tabungan_brankas WHERE tipe = 'cash' LIMIT 1").Scan(&cashId)
		tx.QueryRow("SELECT id FROM tabungan_brankas WHERE tipe = 'bank' LIMIT 1").Scan(&bankId)
		if cashId == "" || bankId == "" {
			return errors.New("Brankas tunai atau bank tidak ditemukan")
		}
		if req.Tipe == "tarik_dari_bank" {
			fromID, toID = bankId, cashId
		} else {
			fromID, toID = cashId, bankId
		}
	}
	if fromID == toID {
		return errors.New("Akun asal dan tujuan tidak boleh sama")
	}

	var fromSaldo int
	err = tx.QueryRow("SELECT saldo FROM tabungan_brankas WHERE id = ?", fromID).Scan(&fromSaldo)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("Akun asal tidak ditemukan")
		}
		return err
	}
	if fromSaldo < req.Nominal {
		return errors.New("Saldo akun asal tidak mencukupi")
	}
	var toExists string
	err = tx.QueryRow("SELECT id FROM tabungan_brankas WHERE id = ?", toID).Scan(&toExists)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("Akun tujuan tidak ditemukan")
		}
		return err
	}

	now := UnixMilli()
	if _, err := tx.Exec("UPDATE tabungan_brankas SET saldo = saldo - ?, updated_at = ? WHERE id = ?", req.Nominal, now, fromID); err != nil {
		return err
	}
	if _, err := tx.Exec("UPDATE tabungan_brankas SET saldo = saldo + ?, updated_at = ? WHERE id = ?", req.Nominal, now, toID); err != nil {
		return err
	}

	tipe := req.Tipe
	if tipe == "" {
		tipe = "transfer_internal"
	}
	catatan := "Transfer internal brankas"
	if req.Catatan != nil && strings.TrimSpace(*req.Catatan) != "" {
		catatan = strings.TrimSpace(*req.Catatan)
	}
	if _, err := tx.Exec("INSERT INTO tabungan_brankas_transaksi (id, tipe, nominal, user_id, catatan, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		cuid2.Generate(), tipe, req.Nominal, req.UserID, catatan, now); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *SavingsRepository) GetSavingsTreasurer() (*models.User, error) {
	var u models.User
	err := r.DB.QueryRow(`
		SELECT u.id, u.name, u.email, u.role
		FROM school_settings s
		JOIN users u ON s.savings_treasurer_id = u.id
		LIMIT 1
	`).Scan(&u.ID, &u.Name, &u.Email, &u.Role)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *SavingsRepository) UpdateSavingsTreasurer(userId string) error {
	_, err := r.DB.Exec("UPDATE school_settings SET savings_treasurer_id = ?, updated_at = ?", userId, UnixMilli())
	return err
}

// Hutang
func (r *SavingsRepository) GetHutang(siswaId string) ([]models.TabunganHutang, error) {
	query := `
		SELECT h.id, h.siswa_id, h.nama_barang, h.kategori, h.nominal, h.jumlah, h.terbayar, h.dicatat_oleh, h.status, h.created_at,
		       s.nama as s_nama
		FROM tabungan_hutang h
		JOIN tabungan_siswa s ON h.siswa_id = s.id
		WHERE 1=1
	`
	var args []interface{}
	if siswaId != "" {
		query += " AND h.siswa_id = ?"
		args = append(args, siswaId)
	}
	query += " ORDER BY h.created_at DESC"

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []models.TabunganHutang
	for rows.Next() {
		var h models.TabunganHutang
		var crAt sql.NullInt64
		var sName string
		rows.Scan(&h.ID, &h.SiswaID, &h.NamaBarang, &h.Kategori, &h.Nominal, &h.Jumlah, &h.Terbayar, &h.DicatatOleh, &h.Status, &crAt, &sName)
		h.Siswa = &models.TabunganSiswa{Nama: sName}
		cTime := ToTime(crAt)
		h.CreatedAt = &cTime
		res = append(res, h)
	}
	if res == nil {
		res = []models.TabunganHutang{}
	}
	return res, nil
}

func (r *SavingsRepository) CreateHutang(h models.TabunganHutang) error {
	if h.ID == "" {
		h.ID = cuid2.Generate()
	}
	if h.SiswaID == "" {
		return errors.New("siswa wajib diisi")
	}
	var exists int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM tabungan_siswa WHERE id = ?", h.SiswaID).Scan(&exists); err != nil {
		return err
	}
	if exists == 0 {
		return errors.New("siswa tidak ditemukan")
	}
	now := UnixMilli()
	_, err := r.DB.Exec(`
		INSERT INTO tabungan_hutang (id, siswa_id, nama_barang, kategori, nominal, jumlah, terbayar, dicatat_oleh, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
	`, h.ID, h.SiswaID, h.NamaBarang, h.Kategori, h.Nominal, h.Jumlah, h.DicatatOleh, "aktif", now, now)
	return err
}

func (r *SavingsRepository) UpdateHutang(id string, input models.UpdateHutangRequest) error {
	_, err := r.DB.Exec(`
		UPDATE tabungan_hutang SET nama_barang = ?, nominal = ?, jumlah = ?, updated_at = ?
		WHERE id = ?
	`, input.NamaBarang, input.Nominal, input.Jumlah, UnixMilli(), id)
	return err
}

func (r *SavingsRepository) DeleteHutang(id string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var status, sid string
	var nominal, jumlah int
	err = tx.QueryRow("SELECT status, siswa_id, nominal, jumlah FROM tabungan_hutang WHERE id = ?", id).Scan(&status, &sid, &nominal, &jumlah)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("hutang tidak ditemukan")
		}
		return err
	}

	if status == "batal" {
		return errors.New("hutang sudah dibatalkan sebelumnya")
	}

	now := UnixMilli()

	// 1. Calculate and refund savings payments
	var tabunganRefund int
	tx.QueryRow("SELECT COALESCE(SUM(nominal), 0) FROM tabungan_hutang_pembayaran WHERE hutang_id = ? AND metode = 'tabungan'", id).Scan(&tabunganRefund)
	if tabunganRefund > 0 && sid != "" {
		if _, err := tx.Exec("UPDATE tabungan_siswa SET saldo_terakhir = saldo_terakhir + ?, updated_at = ? WHERE id = ?", tabunganRefund, now, sid); err != nil {
			return err
		}
		// Insert refund transaction in tabungan_transaksi
		if _, err := tx.Exec("INSERT INTO tabungan_transaksi (id, siswa_id, tipe, nominal, status, catatan, created_at, updated_at) VALUES (?, ?, 'setor', ?, 'verified', ?, ?, ?)",
			cuid2.Generate(), sid, tabunganRefund, fmt.Sprintf("Refund pembatalan hutang (ID Hutang: %s)", id), now, now); err != nil {
			return err
		}
	}

	// 2. Calculate and deduct cash payments from brankas
	var cashDeduction int
	tx.QueryRow("SELECT COALESCE(SUM(nominal), 0) FROM tabungan_hutang_pembayaran WHERE hutang_id = ? AND metode = 'cash'", id).Scan(&cashDeduction)
	if cashDeduction > 0 {
		var bId string
		tx.QueryRow("SELECT id FROM tabungan_brankas WHERE tipe = 'cash' LIMIT 1").Scan(&bId)
		if bId != "" {
			if _, err := tx.Exec("UPDATE tabungan_brankas SET saldo = saldo - ?, updated_at = ? WHERE id = ?", cashDeduction, now, bId); err != nil {
				return err
			}
			if _, err := tx.Exec("INSERT INTO tabungan_brankas_transaksi (id, tipe, nominal, catatan, created_at) VALUES (?, 'pengeluaran_refund', ?, ?, ?)",
				cuid2.Generate(), cashDeduction, fmt.Sprintf("Refund pembatalan hutang tunai (ID Hutang: %s)", id), now); err != nil {
				return err
			}
		}
	}

	// 3. Mark debt as cancelled
	if _, err = tx.Exec("UPDATE tabungan_hutang SET status = 'batal', updated_at = ? WHERE id = ?", now, id); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *SavingsRepository) PayHutangCash(id string, amount int, operatorID string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var nominal, jumlah, terbayar int
	var hutangStatus string
	err = tx.QueryRow("SELECT nominal, jumlah, terbayar, status FROM tabungan_hutang WHERE id = ?", id).Scan(&nominal, &jumlah, &terbayar, &hutangStatus)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("hutang tidak ditemukan")
		}
		return err
	}

	if hutangStatus == "lunas" || hutangStatus == "batal" {
		return errors.New("hutang sudah diselesaikan atau dibatalkan")
	}

	total := nominal * jumlah
	sisa := total - terbayar
	if amount <= 0 {
		return errors.New("nominal pembayaran harus lebih dari 0")
	}
	if amount > sisa {
		return fmt.Errorf("nominal pembayaran melebihi sisa hutang (sisa: Rp%d)", sisa)
	}

	now := UnixMilli()
	newTerbayar := terbayar + amount
	newStatus := "cicilan"
	if newTerbayar >= total {
		newStatus = "lunas"
	}

	// 1. Update tabungan_hutang
	if _, err := tx.Exec("UPDATE tabungan_hutang SET terbayar = ?, status = ?, updated_at = ? WHERE id = ?", newTerbayar, newStatus, now, id); err != nil {
		return err
	}

	// 2. Record payment history
	paymentID := cuid2.Generate()
	if _, err := tx.Exec(`
		INSERT INTO tabungan_hutang_pembayaran (id, hutang_id, nominal, metode, dicatat_oleh, created_at)
		VALUES (?, ?, ?, 'cash', ?, ?)
	`, paymentID, id, amount, operatorID, now); err != nil {
		return err
	}

	// 3. Add to Cash Vault
	var bId string
	tx.QueryRow("SELECT id FROM tabungan_brankas WHERE tipe = 'cash' LIMIT 1").Scan(&bId)
	if bId != "" {
		if _, err := tx.Exec("UPDATE tabungan_brankas SET saldo = saldo + ?, updated_at = ? WHERE id = ?", amount, now, bId); err != nil {
			return err
		}
		if _, err := tx.Exec("INSERT INTO tabungan_brankas_transaksi (id, tipe, nominal, catatan, created_at) VALUES (?, 'penerimaan_hutang', ?, ?, ?)",
			cuid2.Generate(), amount, fmt.Sprintf("Pembayaran cicilan hutang tunai (ID Hutang: %s)", id), now); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *SavingsRepository) SettleHutangFromSavings(id string, amount int, operatorID string) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var sid, hutangStatus string
	var nominal, jumlah, terbayar int
	err = tx.QueryRow("SELECT siswa_id, nominal, jumlah, terbayar, status FROM tabungan_hutang WHERE id = ?", id).Scan(&sid, &nominal, &jumlah, &terbayar, &hutangStatus)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("hutang tidak ditemukan")
		}
		return err
	}

	if hutangStatus == "lunas" || hutangStatus == "batal" {
		return errors.New("hutang sudah diselesaikan atau dibatalkan")
	}

	total := nominal * jumlah
	sisa := total - terbayar
	if amount <= 0 {
		return errors.New("nominal pembayaran harus lebih dari 0")
	}
	if amount > sisa {
		return fmt.Errorf("nominal pembayaran melebihi sisa hutang (sisa: Rp%d)", sisa)
	}

	// Check savings balance
	var saldo int
	if err := tx.QueryRow("SELECT saldo_terakhir FROM tabungan_siswa WHERE id = ?", sid).Scan(&saldo); err != nil {
		return errors.New("siswa tabungan tidak ditemukan")
	}
	if saldo < amount {
		return errors.New("saldo tabungan tidak mencukupi")
	}

	now := UnixMilli()
	newTerbayar := terbayar + amount
	newStatus := "cicilan"
	if newTerbayar >= total {
		newStatus = "lunas"
	}

	// 1. Update tabungan_hutang
	if _, err := tx.Exec("UPDATE tabungan_hutang SET terbayar = ?, status = ?, updated_at = ? WHERE id = ?", newTerbayar, newStatus, now, id); err != nil {
		return err
	}

	// 2. Deduct savings
	if _, err := tx.Exec("UPDATE tabungan_siswa SET saldo_terakhir = saldo_terakhir - ?, updated_at = ? WHERE id = ?", amount, now, sid); err != nil {
		return err
	}

	// 3. Add savings transaction record
	txID := cuid2.Generate()
	if _, err := tx.Exec("INSERT INTO tabungan_transaksi (id, siswa_id, tipe, nominal, status, catatan, created_at, updated_at) VALUES (?, ?, 'tarik', ?, 'verified', ?, ?, ?)",
		txID, sid, amount, fmt.Sprintf("Pembayaran cicilan hutang via tabungan (ID Hutang: %s)", id), now, now); err != nil {
		return err
	}

	// 4. Record payment history
	paymentID := cuid2.Generate()
	if _, err := tx.Exec(`
		INSERT INTO tabungan_hutang_pembayaran (id, hutang_id, nominal, metode, transaksi_id, dicatat_oleh, created_at)
		VALUES (?, ?, ?, 'tabungan', ?, ?, ?)
	`, paymentID, id, amount, txID, operatorID, now); err != nil {
		return err
	}

	// 5. Add to Vault
	var bId string
	tx.QueryRow("SELECT id FROM tabungan_brankas WHERE tipe = 'cash' LIMIT 1").Scan(&bId)
	if bId != "" {
		if _, err := tx.Exec("UPDATE tabungan_brankas SET saldo = saldo + ?, updated_at = ? WHERE id = ?", amount, now, bId); err != nil {
			return err
		}
		if _, err := tx.Exec("INSERT INTO tabungan_brankas_transaksi (id, tipe, nominal, catatan, created_at) VALUES (?, 'penerimaan_hutang', ?, ?, ?)",
			cuid2.Generate(), amount, fmt.Sprintf("Pelunasan cicilan hutang via tabungan (ID Hutang: %s)", id), now); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *SavingsRepository) GetHutangPayments(hutangID string) ([]models.TabunganHutangPembayaran, error) {
	query := `
		SELECT id, hutang_id, nominal, metode, transaksi_id, COALESCE(dicatat_oleh, ''), created_at
		FROM tabungan_hutang_pembayaran
		WHERE hutang_id = ?
		ORDER BY created_at DESC
	`
	rows, err := r.DB.Query(query, hutangID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []models.TabunganHutangPembayaran
	for rows.Next() {
		var p models.TabunganHutangPembayaran
		var crAt int64
		var txID sql.NullString
		err := rows.Scan(&p.ID, &p.HutangID, &p.Nominal, &p.Metode, &txID, &p.DicatatOleh, &crAt)
		if err != nil {
			return nil, err
		}
		if txID.Valid {
			p.TransaksiID = &txID.String
		}
		cTime := ToTime(sql.NullInt64{Int64: crAt, Valid: true})
		p.CreatedAt = &cTime
		res = append(res, p)
	}
	if res == nil {
		res = []models.TabunganHutangPembayaran{}
	}
	return res, nil
}

func (r *SavingsRepository) GetStudentFinancialClearance(studentID string) (int, int, error) {
	var balance int
	var debt int
	var savingsID string

	// Get Balance and savings account ID
	err := r.DB.QueryRow("SELECT id, saldo_terakhir FROM tabungan_siswa WHERE student_id = ?", studentID).Scan(&savingsID, &balance)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, 0, nil
		}
		return 0, 0, err
	}

	// Get Total Active Debt using savingsID
	var nullDebt sql.NullInt64
	err = r.DB.QueryRow("SELECT SUM(nominal * jumlah) FROM tabungan_hutang WHERE siswa_id = ? AND status = 'aktif'", savingsID).Scan(&nullDebt)
	if err == nil && nullDebt.Valid {
		debt = int(nullDebt.Int64)
	}

	return balance, debt, nil
}

// GetSetoranPending returns pending settlements, optionally filtered by guru
func (r *SavingsRepository) GetSetoranPending(guruID string) ([]models.TabunganSetoran, error) {
	query := `
		SELECT s.id, s.guru_id, s.bendahara_id, s.tipe, s.total_nominal, s.nominal_fisik, s.selisih, s.status, s.catatan, s.created_at,
		       g.name as g_name, b.name as b_name
		FROM tabungan_setoran s
		JOIN users g ON s.guru_id = g.id
		LEFT JOIN users b ON s.bendahara_id = b.id
		WHERE s.status = 'pending'
	`
	var args []interface{}
	if guruID != "" {
		query += " AND s.guru_id = ?"
		args = append(args, guruID)
	}
	query += " ORDER BY s.created_at DESC"

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.TabunganSetoran
	for rows.Next() {
		var s models.TabunganSetoran
		var bId, cat, gName, bName sql.NullString
		var crAt sql.NullInt64
		err := rows.Scan(&s.ID, &s.GuruID, &bId, &s.Tipe, &s.TotalNominal, &s.NominalFisik, &s.Selisih, &s.Status, &cat, &crAt, &gName, &bName)
		if err != nil {
			return nil, err
		}
		if bId.Valid {
			s.BendaharaID = &bId.String
		}
		if cat.Valid {
			s.Catatan = &cat.String
		}
		cTime := ToTime(crAt)
		s.CreatedAt = &cTime
		s.Guru = &models.User{Name: Ptr(gName.String)}
		results = append(results, s)
	}
	if results == nil {
		results = []models.TabunganSetoran{}
	}
	return results, nil
}

// GetSetoranByGuru returns settlement history for a specific guru
func (r *SavingsRepository) GetSetoranByGuru(guruID string) ([]models.TabunganSetoran, error) {
	query := `
		SELECT s.id, s.guru_id, s.bendahara_id, s.tipe, s.total_nominal, s.nominal_fisik, s.selisih, s.status, s.catatan, s.created_at,
		       g.name as g_name, b.name as b_name
		FROM tabungan_setoran s
		JOIN users g ON s.guru_id = g.id
		LEFT JOIN users b ON s.bendahara_id = b.id
		WHERE 1=1
	`
	var args []interface{}
	if guruID != "" {
		query += " AND s.guru_id = ?"
		args = append(args, guruID)
	}
	query += " ORDER BY s.created_at DESC LIMIT 50"

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.TabunganSetoran
	for rows.Next() {
		var s models.TabunganSetoran
		var bId, cat, gName, bName sql.NullString
		var crAt sql.NullInt64
		err := rows.Scan(&s.ID, &s.GuruID, &bId, &s.Tipe, &s.TotalNominal, &s.NominalFisik, &s.Selisih, &s.Status, &cat, &crAt, &gName, &bName)
		if err != nil {
			return nil, err
		}
		if bId.Valid {
			s.BendaharaID = &bId.String
		}
		if cat.Valid {
			s.Catatan = &cat.String
		}
		cTime := ToTime(crAt)
		s.CreatedAt = &cTime
		s.Guru = &models.User{Name: Ptr(gName.String)}
		results = append(results, s)
	}
	if results == nil {
		results = []models.TabunganSetoran{}
	}
	return results, nil
}

// GetSetoranDetail returns a single settlement with its transactions
func (r *SavingsRepository) GetSetoranDetail(id string) (*models.TabunganSetoranDetail, error) {
	var s models.TabunganSetoranDetail
	var bId, cat, gName, bName sql.NullString
	var crAt sql.NullInt64

	err := r.DB.QueryRow(`
		SELECT s.id, s.guru_id, s.bendahara_id, s.tipe, s.total_nominal, s.nominal_fisik, s.selisih, s.status, s.catatan, s.created_at,
		       g.name as g_name, b.name as b_name
		FROM tabungan_setoran s
		JOIN users g ON s.guru_id = g.id
		LEFT JOIN users b ON s.bendahara_id = b.id
		WHERE s.id = ?
	`, id).Scan(&s.ID, &s.GuruID, &bId, &s.Tipe, &s.TotalNominal, &s.NominalFisik, &s.Selisih, &s.Status, &cat, &crAt, &gName, &bName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if bId.Valid {
		s.BendaharaID = &bId.String
	}
	if cat.Valid {
		s.Catatan = &cat.String
	}
	cTime := ToTime(crAt)
	s.CreatedAt = &cTime
	s.Guru = &models.User{Name: Ptr(gName.String)}
	if bName.Valid {
		s.BendaharaName = &bName.String
	}

	// Load transactions
	txRows, err := r.DB.Query(`
		SELECT t.id, t.siswa_id, t.tipe, t.nominal, t.catatan, ss.nama as s_nama
		FROM tabungan_transaksi t
		JOIN tabungan_siswa ss ON t.siswa_id = ss.id
		WHERE t.setoran_id = ?
	`, id)
	if err == nil {
		defer txRows.Close()
		for txRows.Next() {
			var tx models.SetoranTransaction
			var cat2, sName sql.NullString
			txRows.Scan(&tx.ID, &tx.SiswaID, &tx.Tipe, &tx.Nominal, &cat2, &sName)
			if cat2.Valid {
				tx.Catatan = &cat2.String
			}
			if sName.Valid {
				tx.SiswaName = sName.String
			}
			s.Transactions = append(s.Transactions, tx)
		}
	}
	return &s, nil
}

// ResubmitSetoran resets a settlement back to pending
func (r *SavingsRepository) ResubmitSetoran(id string, catatan string) error {
	_, err := r.DB.Exec("UPDATE tabungan_setoran SET status = 'pending', catatan = ?, updated_at = ? WHERE id = ?",
		catatan, UnixMilli(), id)
	return err
}

// CreateBrankas creates a new treasury vault
func (r *SavingsRepository) CreateBrankas(req models.CreateBrankasRequest) error {
	req.Nama = strings.TrimSpace(req.Nama)
	req.Tipe = strings.TrimSpace(req.Tipe)
	if req.Nama == "" {
		return errors.New("Nama akun wajib diisi")
	}
	if req.Tipe == "" {
		req.Tipe = "cash"
		if strings.Contains(strings.ToLower(req.Nama), "bank") || strings.Contains(strings.ToLower(req.Nama), "koperasi") {
			req.Tipe = "bank"
		}
	}
	if req.Saldo < 0 {
		return errors.New("Saldo awal tidak valid")
	}
	id := cuid2.Generate()
	now := UnixMilli()
	_, err := r.DB.Exec("INSERT INTO tabungan_brankas (id, nama, tipe, saldo, pic_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		id, req.Nama, req.Tipe, req.Saldo, req.PicID, now)
	return err
}

// UpdateBrankas updates an existing treasury vault
func (r *SavingsRepository) UpdateBrankas(id string, req models.CreateBrankasRequest) error {
	req.Nama = strings.TrimSpace(req.Nama)
	req.Tipe = strings.TrimSpace(req.Tipe)
	if id == "" || req.Nama == "" {
		return errors.New("Data akun tidak lengkap")
	}
	if req.Tipe == "" {
		req.Tipe = "cash"
		if strings.Contains(strings.ToLower(req.Nama), "bank") || strings.Contains(strings.ToLower(req.Nama), "koperasi") {
			req.Tipe = "bank"
		}
	}
	res, err := r.DB.Exec("UPDATE tabungan_brankas SET nama = ?, tipe = ?, pic_id = ?, updated_at = ? WHERE id = ?",
		req.Nama, req.Tipe, req.PicID, UnixMilli(), id)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return errors.New("Akun brankas tidak ditemukan")
	}
	return err
}

// CreateHutangBatch creates multiple debts in a single transaction
func (r *SavingsRepository) CreateHutangBatch(entries []models.TabunganHutang) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := UnixMilli()
	for _, h := range entries {
		if h.ID == "" {
			h.ID = cuid2.Generate()
		}
		_, err := tx.Exec(`
			INSERT INTO tabungan_hutang (id, siswa_id, nama_barang, kategori, nominal, jumlah, dicatat_oleh, status, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, h.ID, h.SiswaID, h.NamaBarang, h.Kategori, h.Nominal, h.Jumlah, h.DicatatOleh, "aktif", now, now)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

// GetFinalReport returns end-of-year financial report for a student
func (r *SavingsRepository) GetFinalReport(studentID string, year string) (*models.FinalReport, error) {
	var s models.TabunganSiswa
	var kNama sql.NullString
	err := r.DB.QueryRow(`
		SELECT ts.id, ts.nisn, ts.nama, ts.saldo_terakhir, k.nama as k_nama
		FROM tabungan_siswa ts
		JOIN tabungan_kelas k ON ts.kelas_id = k.id
		WHERE ts.id = ?
	`, studentID).Scan(&s.ID, &s.NISN, &s.Nama, &s.SaldoTerakhir, &kNama)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	rows, err := r.DB.Query(`
		SELECT t.tipe, t.nominal, t.catatan, t.created_at
		FROM tabungan_transaksi t
		WHERE t.siswa_id = ? AND t.status = 'verified'
		ORDER BY t.created_at ASC
	`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transactions []models.FinalReportTransaction
	totalSetor := 0
	totalTarik := 0
	for rows.Next() {
		var tipe string
		var nominal int
		var cat sql.NullString
		var crAt sql.NullInt64
		rows.Scan(&tipe, &nominal, &cat, &crAt)
		item := models.FinalReportTransaction{
			Tipe:    tipe,
			Nominal: nominal,
		}
		if cat.Valid {
			item.Catatan = cat.String
		}
		if crAt.Valid {
			item.Tanggal = ToTime(crAt).Format("2006-01-02")
		}
		transactions = append(transactions, item)
		if tipe == "setor" {
			totalSetor += nominal
		} else {
			totalTarik += nominal
		}
	}
	if transactions == nil {
		transactions = []models.FinalReportTransaction{}
	}

	return &models.FinalReport{
		Siswa: models.FinalReportSiswa{
			Nama:  s.Nama,
			NISN:  s.NISN,
			Kelas: kNama.String,
			Saldo: s.SaldoTerakhir,
		},
		Transactions: transactions,
		TotalSetor:   totalSetor,
		TotalTarik:   totalTarik,
		SaldoAkhir:   s.SaldoTerakhir,
	}, nil
}

// GetStatement returns a list of statement records for rekening koran
func (r *SavingsRepository) GetStatement(siswaID string) ([]models.StatementItem, error) {
	rows, err := r.DB.Query(`
		SELECT t.id, t.tipe, t.nominal, t.status, t.catatan, t.created_at, ts.nama as s_nama
		FROM tabungan_transaksi t
		JOIN tabungan_siswa ts ON t.siswa_id = ts.id
		WHERE t.siswa_id = ?
		ORDER BY t.created_at DESC
	`, siswaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.StatementItem
	for rows.Next() {
		var tipe, status string
		var nominal int
		var cat, sName sql.NullString
		var crAt sql.NullInt64
		var id string
		rows.Scan(&id, &tipe, &nominal, &status, &cat, &crAt, &sName)
		item := models.StatementItem{
			ID:      id,
			Tipe:    tipe,
			Nominal: nominal,
			Status:  status,
		}
		if cat.Valid {
			item.Catatan = cat.String
		}
		if crAt.Valid {
			item.Tanggal = ToTime(crAt).Format("2006-01-02")
		}
		if sName.Valid {
			item.NamaSiswa = sName.String
		}
		results = append(results, item)
	}
	if results == nil {
		results = []models.StatementItem{}
	}
	return results, nil
}

// VerifyStatement checks if a statement hash is still valid
func (r *SavingsRepository) VerifyStatement(hash string) error {
	return r.DB.QueryRow("SELECT id FROM tabungan_transaksi WHERE id = ? LIMIT 1", hash).Scan(new(string))
}

func (r *SavingsRepository) GetPublicBalance(identifier, birthDate string) (*models.TabunganSiswa, error) {
	var s models.TabunganSiswa
	var kNama sql.NullString
	var upAt sql.NullInt64

	query := `
		SELECT ts.id, ts.nisn, ts.nama, ts.saldo_terakhir, ts.updated_at, k.nama as k_nama
		FROM tabungan_siswa ts
		JOIN students st ON ts.student_id = st.id
		JOIN tabungan_kelas k ON ts.kelas_id = k.id
		WHERE (ts.nisn = ? OR ts.qr_code = ? OR ts.id = ?) AND st.birth_date = ? AND ts.is_active = 1
	`
	err := r.DB.QueryRow(query, identifier, identifier, identifier, birthDate).Scan(
		&s.ID, &s.NISN, &s.Nama, &s.SaldoTerakhir, &upAt, &kNama,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	uTime := ToTime(upAt)
	s.UpdatedAt = &uTime
	if kNama.Valid {
		s.Kelas = &models.TabunganKelas{Nama: kNama.String}
	}

	return &s, nil
}

// SyncFromStudents links existing tabungan_siswa to students and inserts missing ones
func (r *SavingsRepository) SyncFromStudents() (int, error) {
	tx, err := r.DB.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	// 1. Link existing tabungan_siswa that have NULL or empty student_id by matching NISN or Nama
	_, err = tx.Exec(`
		UPDATE tabungan_siswa
		SET student_id = (
			SELECT s.id FROM students s 
			WHERE s.nisn = tabungan_siswa.nisn AND s.nisn IS NOT NULL AND s.nisn != ''
			LIMIT 1
		)
		WHERE student_id IS NULL OR student_id = ''
	`)
	if err != nil {
		return 0, err
	}

	// 2. Find active students who do not have a record in tabungan_siswa
	rows, err := tx.Query(`
		SELECT id, nisn, full_name, COALESCE(class_name, ''), 
		       CASE WHEN qr_code IS NOT NULL AND TRIM(qr_code) != '' THEN qr_code ELSE id END
		FROM students
		WHERE (is_active = 1 OR status = 'active' OR status = 'aktif')
			AND id NOT IN (SELECT student_id FROM tabungan_siswa WHERE student_id IS NOT NULL)
			AND (nisn IS NOT NULL AND nisn != '' AND nisn NOT IN (SELECT nisn FROM tabungan_siswa WHERE nisn IS NOT NULL))
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type stubStudent struct {
		ID        string
		NISN      string
		FullName  string
		ClassName string
		QRCode    string
	}
	var toAdd []stubStudent
	for rows.Next() {
		var s stubStudent
		if err := rows.Scan(&s.ID, &s.NISN, &s.FullName, &s.ClassName, &s.QRCode); err == nil {
			toAdd = append(toAdd, s)
		}
	}
	rows.Close()

	now := time.Now().UnixMilli()
	count := 0

	for _, s := range toAdd {
		// Try to find matching tabungan_kelas ID by class name
		var tabunganKelasID string
		err := tx.QueryRow("SELECT id FROM tabungan_kelas WHERE nama = ?", s.ClassName).Scan(&tabunganKelasID)
		if err != nil && err != sql.ErrNoRows {
			continue
		}

		// If not found, create a new tabungan_kelas record
		if tabunganKelasID == "" {
			tabunganKelasID = cuid2.Generate()
			_, err = tx.Exec(`
				INSERT INTO tabungan_kelas (id, nama, wali_kelas, created_at, updated_at)
				VALUES (?, ?, '', ?, ?)
			`, tabunganKelasID, s.ClassName, now, now)
			if err != nil {
				continue
			}
		}

		// Insert new tabungan_siswa record
		id := cuid2.Generate()
		qrCode := "TAB-" + id
		if s.QRCode != "" {
			qrCode = s.QRCode
		}
		_, err = tx.Exec(`
			INSERT INTO tabungan_siswa (id, student_id, nisn, nama, kelas_id, saldo_terakhir, qr_code, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?, ?)
		`, id, s.ID, s.NISN, s.FullName, tabunganKelasID, qrCode, now, now)
		if err == nil {
			count++
		}
	}

	return count, tx.Commit()
}
