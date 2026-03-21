package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/nrednav/cuid2"
	"github.com/sekolahku/go-backend/internal/models"
)

type FinanceRepository struct {
	DB *sql.DB
}

func NewFinanceRepository(db *sql.DB) *FinanceRepository {
	return &FinanceRepository{DB: db}
}

func (r *FinanceRepository) GetAccounts() ([]models.FinanceAccount, error) {
	query := `
		SELECT id, name, account_number, description, is_system, created_at, updated_at
		FROM finance_accounts
		ORDER BY is_system DESC, name DESC
	`
	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []models.FinanceAccount
	for rows.Next() {
		var a models.FinanceAccount
		var accNum, descr sql.NullString
		var isSystem sql.NullInt64
		var createdAt, updatedAt sql.NullTime

		if err := rows.Scan(&a.ID, &a.Name, &accNum, &descr, &isSystem, &createdAt, &updatedAt); err != nil {
			return nil, err
		}

		if accNum.Valid { a.AccountNumber = &accNum.String }
		if descr.Valid { a.Description = &descr.String }
		if isSystem.Valid { a.IsSystem = isSystem.Int64 != 0 } else { a.IsSystem = false }
		if createdAt.Valid { a.CreatedAt = &createdAt.Time }
		if updatedAt.Valid { a.UpdatedAt = &updatedAt.Time }

		accounts = append(accounts, a)
	}
	
	// Return empty slice instead of nil for clean JSON
	if accounts == nil {
		accounts = []models.FinanceAccount{}
	}
	
	return accounts, nil
}

func (r *FinanceRepository) CreateAccount(req models.CreateFinanceAccountRequest) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	accountId := cuid2.Generate()
	
	insertAcc := `INSERT INTO finance_accounts (id, name, account_number, description) VALUES (?, ?, ?, ?)`
	_, err = tx.Exec(insertAcc, accountId, req.Name, req.AccountNumber, req.Description)
	if err != nil {
		return err
	}

	if req.InitialBalance > 0 {
		txId := cuid2.Generate()
		now := time.Now()
		insertTx := `
			INSERT INTO finance_transactions 
			(id, type, account_id_source, amount, description, status, date, created_by)
			VALUES (?, 'INCOME', ?, ?, 'Saldo Awal', 'APPROVED', ?, ?)
		`
		_, err = tx.Exec(insertTx, txId, accountId, req.InitialBalance, now, req.CreatedBy)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *FinanceRepository) UpdateAccount(id string, req models.CreateFinanceAccountRequest) error {
	query := `UPDATE finance_accounts SET name = ?, account_number = ?, description = ? WHERE id = ?`
	_, err := r.DB.Exec(query, req.Name, req.AccountNumber, req.Description, id)
	return err
}

func (r *FinanceRepository) DeleteAccount(id string) error {
	var isSystem sql.NullInt64
	err := r.DB.QueryRow(`SELECT is_system FROM finance_accounts WHERE id = ?`, id).Scan(&isSystem)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("Akun tidak ditemukan")
		}
		return err
	}
	if isSystem.Valid && isSystem.Int64 == 1 {
		return errors.New("Akun sistem tidak dapat dihapus")
	}

	var count int
	err = r.DB.QueryRow(`
		SELECT COUNT(*) FROM finance_transactions 
		WHERE account_id_source = ? OR account_id_dest = ?
	`, id, id).Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return errors.New("Akun ini memiliki riwayat transaksi, tidak dapat dihapus")
	}

	_, err = r.DB.Exec(`DELETE FROM finance_accounts WHERE id = ?`, id)
	return err
}
