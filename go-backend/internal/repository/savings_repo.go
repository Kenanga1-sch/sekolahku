package repository

import (
	"database/sql"
	"errors"
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

func (r *SavingsRepository) CreateTransaksi(req models.CreateTransaksiRequest) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Get Student Balance
	var saldoTerakhir int
	err = tx.QueryRow("SELECT saldo_terakhir FROM tabungan_siswa WHERE id = ?", req.SiswaID).Scan(&saldoTerakhir)
	if err != nil {
		if err == sql.ErrNoRows {
			return errors.New("siswa not found")
		}
		return err
	}

	// 2. Withdraw Validation
	if req.Tipe == "tarik" && saldoTerakhir < req.Nominal {
		return errors.New("saldo tidak cukup untuk penarikan")
	}

	// 3. Insert Transaction
	id := cuid2.Generate()
	now := time.Now()
	_, err = tx.Exec(`
		INSERT INTO tabungan_transaksi (id, siswa_id, user_id, tipe, nominal, status, catatan, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.SiswaID, req.UserID, req.Tipe, req.Nominal, "collected", req.Catatan, now, now)

	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *SavingsRepository) CreateSetoran(req models.CreateSetoranRequest) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Get Open Transactions
	rows, err := tx.Query(`
		SELECT id, tipe, nominal 
		FROM tabungan_transaksi 
		WHERE user_id = ? AND setoran_id IS NULL AND status = 'collected'
	`, req.GuruID)
	if err != nil {
		return err
	}

	var openTxIds []string
	var deposits, withdrawals int

	for rows.Next() {
		var id, tipe string
		var nominal int
		if err := rows.Scan(&id, &tipe, &nominal); err != nil {
			rows.Close()
			return err
		}
		openTxIds = append(openTxIds, id)
		if tipe == "setor" {
			deposits += nominal
		} else if tipe == "tarik" {
			withdrawals += nominal
		}
	}
	rows.Close() // Safely closed before executing updates

	if len(openTxIds) == 0 {
		return errors.New("tidak ada transaksi untuk disetor")
	}

	netAmount := deposits - withdrawals
	tipe := "setor_ke_bendahara"
	total := netAmount
	if netAmount < 0 {
		tipe = "tarik_dari_bendahara"
		total = -netAmount
	}

	// 2. Create Setoran
	setoranId := cuid2.Generate()
	now := time.Now()
	_, err = tx.Exec(`
		INSERT INTO tabungan_setoran (id, guru_id, tipe, total_nominal, status, catatan, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, setoranId, req.GuruID, tipe, total, "pending", req.Catatan, now, now)
	if err != nil {
		return err
	}

	// 3. Link Transactions
	for _, txId := range openTxIds {
		_, err = tx.Exec(`
			UPDATE tabungan_transaksi 
			SET setoran_id = ?, updated_at = ?
			WHERE id = ?
		`, setoranId, now, txId)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *SavingsRepository) VerifySetoran(req models.VerifySetoranRequest) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Get Setoran Original Amount
	var totalNominal int
	var setoranTipe string
	var currentCatatan sql.NullString
	err = tx.QueryRow(`
		SELECT total_nominal, tipe, catatan 
		FROM tabungan_setoran 
		WHERE id = ?
	`, req.SetoranID).Scan(&totalNominal, &setoranTipe, &currentCatatan)
	if err != nil {
		return errors.New("setoran not found")
	}

	fisik := totalNominal
	if req.NominalFisik != nil {
		fisik = *req.NominalFisik
	}
	selisih := totalNominal - fisik
	now := time.Now()

	catatan := req.Catatan
	if catatan == nil && currentCatatan.Valid {
		catatan = &currentCatatan.String
	}

	// 2. Update Setoran Log
	_, err = tx.Exec(`
		UPDATE tabungan_setoran 
		SET status = ?, bendahara_id = ?, nominal_fisik = ?, selisih = ?, catatan = ?, updated_at = ?
		WHERE id = ?
	`, req.Status, req.BendaharaID, fisik, selisih, catatan, now, req.SetoranID)
	if err != nil {
		return err
	}

	if req.Status == "verified" {
		// 3. Load all chained Transactions
		rows, err := tx.Query(`
			SELECT id, siswa_id, tipe, nominal 
			FROM tabungan_transaksi 
			WHERE setoran_id = ?
		`, req.SetoranID)
		if err != nil {
			return err
		}

		type TxnData struct {
			ID      string
			SiswaID string
			Tipe    string
			Nominal int
		}
		var txns []TxnData

		for rows.Next() {
			var d TxnData
			if err := rows.Scan(&d.ID, &d.SiswaID, &d.Tipe, &d.Nominal); err != nil {
				rows.Close()
				return err
			}
			txns = append(txns, d)
		}
		rows.Close()

		for _, txn := range txns {
			// Update individual transaction statuses
			_, err = tx.Exec("UPDATE tabungan_transaksi SET status = 'verified', updated_at = ? WHERE id = ?", now, txn.ID)
			if err != nil {
				return err
			}

			// Atomic update to respective student balance
			if txn.Tipe == "setor" {
				_, err = tx.Exec("UPDATE tabungan_siswa SET saldo_terakhir = saldo_terakhir + ?, updated_at = ? WHERE id = ?", txn.Nominal, now, txn.SiswaID)
			} else {
				_, err = tx.Exec("UPDATE tabungan_siswa SET saldo_terakhir = saldo_terakhir - ?, updated_at = ? WHERE id = ?", txn.Nominal, now, txn.SiswaID)
			}
			if err != nil {
				return err
			}
		}

		// 4. Resolve Brankas (Ledger Vault)
		var brankasId string
		err = tx.QueryRow("SELECT id FROM tabungan_brankas WHERE tipe = 'cash' LIMIT 1").Scan(&brankasId)
		if err == sql.ErrNoRows {
			brankasId = cuid2.Generate()
			_, err = tx.Exec("INSERT INTO tabungan_brankas (id, nama, tipe, saldo, updated_at) VALUES (?, 'Kas Bendahara (Tunai)', 'cash', 0, ?)", brankasId, now)
			if err != nil {
				return err
			}
		} else if err != nil {
			return err
		}

		brankasOpSign := "+"
		brankasTxTipe := "setor_ke_koperasi"
		if setoranTipe == "tarik_dari_bendahara" {
			brankasOpSign = "-"
			brankasTxTipe = "tarik_dari_koperasi"
		}

		// Directly mutating Vault
		_, err = tx.Exec("UPDATE tabungan_brankas SET saldo = saldo "+brankasOpSign+" ?, updated_at = ? WHERE id = ?", fisik, now, brankasId)
		if err != nil {
			return err
		}

		// 5. Brankas Audit Log
		bTxId := cuid2.Generate()
		var vaultNote string
		if catatan != nil {
			vaultNote = "Setoran Harian verified: " + *catatan
		} else {
			vaultNote = "Setoran Harian verified: -"
		}

		_, err = tx.Exec(`
			INSERT INTO tabungan_brankas_transaksi (id, tipe, nominal, user_id, catatan, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, bTxId, brankasTxTipe, fisik, req.BendaharaID, vaultNote, now)
		if err != nil {
			return err
		}

	} else if req.Status == "rejected" {
		_, err = tx.Exec("UPDATE tabungan_transaksi SET status = 'rejected', updated_at = ? WHERE setoran_id = ?", now, req.SetoranID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}
