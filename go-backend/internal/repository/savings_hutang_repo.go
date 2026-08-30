package repository

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// GetHutang returns loans (hutang) for a student or all active loans
func (r *SavingsRepository) GetHutang(siswaId string) ([]models.TabunganHutang, error) {
	query := `
		SELECT h.id, h.siswa_id, h.nama_barang, h.kategori, h.nominal, h.jumlah, h.terbayar, h.dicatat_oleh, h.status, h.created_at,
		       st.full_name as s_nama
		FROM tabungan_hutang h
		JOIN students st ON h.siswa_id = st.id
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

// CreateHutang creates a new loan for a student
func (r *SavingsRepository) CreateHutang(h models.TabunganHutang) error {
	if h.ID == "" {
		h.ID = cuid2.Generate()
	}
	if h.SiswaID == "" {
		return errors.New("siswa wajib diisi")
	}
	var exists int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM students WHERE id = ?", h.SiswaID).Scan(&exists); err != nil {
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

// UpdateHutang modifies an existing loan's details
func (r *SavingsRepository) UpdateHutang(id string, input models.UpdateHutangRequest) error {
	_, err := r.DB.Exec(`
		UPDATE tabungan_hutang SET nama_barang = ?, nominal = ?, jumlah = ?, updated_at = ?
		WHERE id = ?
	`, input.NamaBarang, input.Nominal, input.Jumlah, UnixMilli(), id)
	return err
}

// DeleteHutang cancels a loan with refund logic
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

	var tabunganRefund int
	tx.QueryRow("SELECT COALESCE(SUM(nominal), 0) FROM tabungan_hutang_pembayaran WHERE hutang_id = ? AND metode = 'tabungan'", id).Scan(&tabunganRefund)
	if tabunganRefund > 0 && sid != "" {
		if _, err := tx.Exec("UPDATE tabungan_siswa SET saldo_terakhir = saldo_terakhir + ?, updated_at = ? WHERE student_id = ?", tabunganRefund, now, sid); err != nil {
			return err
		}
		if _, err := tx.Exec("INSERT INTO tabungan_transaksi (id, siswa_id, tipe, nominal, status, catatan, created_at, updated_at) VALUES (?, ?, 'setor', ?, 'verified', ?, ?, ?)",
			cuid2.Generate(), sid, tabunganRefund, fmt.Sprintf("Refund pembatalan hutang (ID Hutang: %s)", id), now, now); err != nil {
			return err
		}
	}

	var cashDeduction int
	tx.QueryRow("SELECT COALESCE(SUM(nominal), 0) FROM tabungan_hutang_pembayaran WHERE hutang_id = ? AND metode = 'cash'", id).Scan(&cashDeduction)
	if cashDeduction > 0 {
		var bId string
		err := tx.QueryRow("SELECT id FROM tabungan_brankas WHERE tipe = 'cash' LIMIT 1").Scan(&bId)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if bId == "" {
			return errors.New("brankas kas tunai tidak ditemukan untuk memproses refund cash")
		}
		if _, err := tx.Exec("UPDATE tabungan_brankas SET saldo = saldo - ?, updated_at = ? WHERE id = ?", cashDeduction, now, bId); err != nil {
			return err
		}
		if _, err := tx.Exec("INSERT INTO tabungan_brankas_transaksi (id, tipe, nominal, catatan, created_at) VALUES (?, 'pengeluaran_refund', ?, ?, ?)",
			cuid2.Generate(), cashDeduction, fmt.Sprintf("Refund pembatalan hutang tunai (ID Hutang: %s)", id), now); err != nil {
			return err
		}
	}

	if _, err = tx.Exec("UPDATE tabungan_hutang SET status = 'batal', updated_at = ? WHERE id = ?", now, id); err != nil {
		return err
	}

	return tx.Commit()
}

// PayHutangCash records a cash payment toward a loan
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

	if _, err := tx.Exec("UPDATE tabungan_hutang SET terbayar = ?, status = ?, updated_at = ? WHERE id = ?", newTerbayar, newStatus, now, id); err != nil {
		return err
	}

	paymentID := cuid2.Generate()
	if _, err := tx.Exec(`
		INSERT INTO tabungan_hutang_pembayaran (id, hutang_id, nominal, metode, dicatat_oleh, created_at)
		VALUES (?, ?, ?, 'cash', ?, ?)
	`, paymentID, id, amount, operatorID, now); err != nil {
		return err
	}

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

// SettleHutangFromSavings pays a loan by deducting from the student's savings
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

	var saldo int
	if err := tx.QueryRow("SELECT saldo_terakhir FROM tabungan_siswa WHERE student_id = ?", sid).Scan(&saldo); err != nil {
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

	if _, err := tx.Exec("UPDATE tabungan_hutang SET terbayar = ?, status = ?, updated_at = ? WHERE id = ?", newTerbayar, newStatus, now, id); err != nil {
		return err
	}

	if _, err := tx.Exec("UPDATE tabungan_siswa SET saldo_terakhir = saldo_terakhir - ?, updated_at = ? WHERE student_id = ?", amount, now, sid); err != nil {
		return err
	}

	txID := cuid2.Generate()
	if _, err := tx.Exec("INSERT INTO tabungan_transaksi (id, siswa_id, tipe, nominal, status, catatan, created_at, updated_at) VALUES (?, ?, 'tarik', ?, 'verified', ?, ?, ?)",
		txID, sid, amount, fmt.Sprintf("Pembayaran cicilan hutang via tabungan (ID Hutang: %s)", id), now, now); err != nil {
		return err
	}

	paymentID := cuid2.Generate()
	if _, err := tx.Exec(`
		INSERT INTO tabungan_hutang_pembayaran (id, hutang_id, nominal, metode, transaksi_id, dicatat_oleh, created_at)
		VALUES (?, ?, ?, 'tabungan', ?, ?, ?)
	`, paymentID, id, amount, txID, operatorID, now); err != nil {
		return err
	}

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

// GetHutangPayments returns payment history for a loan
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

// CreateHutangBatch creates multiple loans at once
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
