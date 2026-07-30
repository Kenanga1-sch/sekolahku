package repository

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// CreateTransaksi creates a new savings transaction (deposit/withdrawal)
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

// GetTransactions retrieves transactions with optional filters
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
		if sId.Valid { t.SiswaID = sId.String }
		if uId.Valid { t.UserID = uId.String }
		if setId.Valid { t.SetoranID = &setId.String }
		if cat.Valid { t.Catatan = &cat.String }
		cTime := ToTime(crAt)
		t.CreatedAt = &cTime
		t.Siswa = &models.TabunganSiswa{Nama: sName.String}
		if kName.Valid { t.Siswa.Kelas = &models.TabunganKelas{Nama: kName.String} }
		if uName.Valid { t.User = &models.User{Name: Ptr(uName.String)} }
		results = append(results, t)
	}
	if results == nil {
		results = []models.TabunganTransaksi{}
	}
	return results, nil
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
			ID: id, Tipe: tipe, Nominal: nominal, Status: status,
		}
		if cat.Valid { item.Catatan = cat.String }
		if crAt.Valid { item.Tanggal = ToTime(crAt).Format("2006-01-02") }
		if sName.Valid { item.NamaSiswa = sName.String }
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
