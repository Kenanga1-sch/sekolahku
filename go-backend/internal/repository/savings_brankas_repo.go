package repository

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

// GetBrankas returns vault/safe cash box records
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

// GetBrankasTransactions returns all vault transactions
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

// TransferBrankas moves funds between vaults
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

// GetSavingsTreasurer returns the currently active treasurer/bendahara
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

// UpdateSavingsTreasurer sets a user as treasurer
func (r *SavingsRepository) UpdateSavingsTreasurer(userId string) error {
	_, err := r.DB.Exec("UPDATE school_settings SET savings_treasurer_id = ?, updated_at = ?", userId, UnixMilli())
	return err
}

// CreateBrankas creates a new cash vault record
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

// UpdateBrankas updates a vault's name and type
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
