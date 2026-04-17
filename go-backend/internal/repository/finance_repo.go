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

// Stats
func (r *FinanceRepository) GetFinanceStats() (*models.FinanceStats, error) {
	stats := &models.FinanceStats{}
	
	// Total Balance logic (Sum INCOME - Sum EXPENSE per account)
	// Simple sum from transactions
	r.DB.QueryRow(`
		SELECT 
			SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) - 
			SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END)
		FROM finance_transactions 
		WHERE status = 'APPROVED'
	`).Scan(&stats.TotalBalance)

	now := time.Now()
	firstDayOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).UnixMilli()

	r.DB.QueryRow(`
		SELECT SUM(amount) FROM finance_transactions 
		WHERE type = 'INCOME' AND status = 'APPROVED' AND date >= ?
	`, firstDayOfMonth).Scan(&stats.IncomeMonth)

	r.DB.QueryRow(`
		SELECT SUM(amount) FROM finance_transactions 
		WHERE type = 'EXPENSE' AND status = 'APPROVED' AND date >= ?
	`, firstDayOfMonth).Scan(&stats.ExpenseMonth)

	r.DB.QueryRow(`SELECT COUNT(*) FROM finance_transactions WHERE status = 'PENDING'`).Scan(&stats.PendingCount)

	return stats, nil
}

// Accounts
func (r *FinanceRepository) GetAccounts() ([]models.FinanceAccount, error) {
	query := `
		SELECT id, name, account_number, description, is_system, created_at, updated_at
		FROM finance_accounts
		ORDER BY is_system DESC, name ASC
	`
	rows, err := r.DB.Query(query)
	if err != nil { return nil, err }
	defer rows.Close()

	var accounts []models.FinanceAccount
	for rows.Next() {
		var a models.FinanceAccount
		var accNum, descr sql.NullString
		var isSystem sql.NullInt64
		var createdAt, updatedAt sql.NullInt64

		if err := rows.Scan(&a.ID, &a.Name, &accNum, &descr, &isSystem, &createdAt, &updatedAt); err != nil {
			return nil, err
		}

		if accNum.Valid { a.AccountNumber = &accNum.String }
		if descr.Valid { a.Description = &descr.String }
		a.IsSystem = (isSystem.Valid && isSystem.Int64 != 0)
		a.CreatedAt = SafeTime(createdAt)
		a.UpdatedAt = SafeTime(updatedAt)
		accounts = append(accounts, a)
	}
	if accounts == nil { accounts = []models.FinanceAccount{} }
	return accounts, nil
}

func (r *FinanceRepository) CreateAccount(req models.CreateFinanceAccountRequest) error {
	tx, err := r.DB.Begin()
	if err != nil { return err }
	defer tx.Rollback()

	accountId := cuid2.Generate()
	now := time.Now().UnixMilli()
	
	insertAcc := `INSERT INTO finance_accounts (id, name, account_number, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
	_, err = tx.Exec(insertAcc, accountId, req.Name, req.AccountNumber, req.Description, now, now)
	if err != nil { return err }

	if req.InitialBalance > 0 {
		txId := cuid2.Generate()
		insertTx := `
			INSERT INTO finance_transactions 
			(id, type, account_id_source, amount, description, status, date, created_at)
			VALUES (?, 'INCOME', ?, ?, 'Saldo Awal', 'APPROVED', ?, ?)
		`
		_, err = tx.Exec(insertTx, txId, accountId, req.InitialBalance, now, now)
		if err != nil { return err }
	}
	return tx.Commit()
}

func (r *FinanceRepository) UpdateAccount(id string, req models.CreateFinanceAccountRequest) error {
	now := time.Now().UnixMilli()
	query := `UPDATE finance_accounts SET name = ?, account_number = ?, description = ?, updated_at = ? WHERE id = ?`
	_, err := r.DB.Exec(query, req.Name, req.AccountNumber, req.Description, now, id)
	return err
}

func (r *FinanceRepository) DeleteAccount(id string) error {
	var isSystem int
	r.DB.QueryRow(`SELECT is_system FROM finance_accounts WHERE id = ?`, id).Scan(&isSystem)
	if isSystem == 1 { return errors.New("Akun sistem tidak dapat dihapus") }

	var count int
	r.DB.QueryRow(`SELECT COUNT(*) FROM finance_transactions WHERE account_id_source = ? OR account_id_dest = ?`, id, id).Scan(&count)
	if count > 0 { return errors.New("Akun ini memiliki riwayat transaksi") }

	_, err := r.DB.Exec(`DELETE FROM finance_accounts WHERE id = ?`, id)
	return err
}

// Categories
func (r *FinanceRepository) GetCategories() ([]models.FinanceCategory, error) {
	rows, err := r.DB.Query("SELECT id, name, type, description, is_system FROM finance_categories ORDER BY type, name")
	if err != nil { return nil, err }
	defer rows.Close()

	var results []models.FinanceCategory
	for rows.Next() {
		var c models.FinanceCategory
		var desc sql.NullString
		var isSys int
		err := rows.Scan(&c.ID, &c.Name, &c.Type, &desc, &isSys)
		if err != nil { return nil, err }
		if desc.Valid { c.Description = &desc.String }
		c.IsSystem = isSys != 0
		results = append(results, c)
	}
	if results == nil { results = []models.FinanceCategory{} }
	return results, nil
}

func (r *FinanceRepository) CreateCategory(req models.CreateFinanceCategoryRequest) error {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec("INSERT INTO finance_categories (id, name, type, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		id, req.Name, req.Type, req.Description, now, now)
	return err
}

func (r *FinanceRepository) DeleteCategory(id string) error {
	var isSys int
	r.DB.QueryRow("SELECT is_system FROM finance_categories WHERE id = ?", id).Scan(&isSys)
	if isSys != 0 { return errors.New("Kategori sistem tidak bisa dihapus") }
	_, err := r.DB.Exec("DELETE FROM finance_categories WHERE id = ?", id)
	return err
}

// Transactions
func (r *FinanceRepository) GetTransactions() ([]models.FinanceTransaction, error) {
	query := `
		SELECT t.id, t.date, t.type, t.account_id_source, t.account_id_dest, t.category_id, 
		       t.amount, t.description, t.proof_image, t.status, t.created_at,
		       asrc.name as src_name, adest.name as dest_name, c.name as cat_name
		FROM finance_transactions t
		LEFT JOIN finance_accounts asrc ON t.account_id_source = asrc.id
		LEFT JOIN finance_accounts adest ON t.account_id_dest = adest.id
		LEFT JOIN finance_categories c ON t.category_id = c.id
		ORDER BY t.date DESC, t.created_at DESC LIMIT 100
	`
	rows, err := r.DB.Query(query)
	if err != nil { return nil, err }
	defer rows.Close()

	var results []models.FinanceTransaction
	for rows.Next() {
		var t models.FinanceTransaction
		var sTime, cTime sql.NullInt64
		var srcId, destId, catId, pImg, desc, srcName, destName, catName sql.NullString
		
		err := rows.Scan(
			&t.ID, &sTime, &t.Type, &srcId, &destId, &catId, 
			&t.Amount, &desc, &pImg, &t.Status, &cTime,
			&srcName, &destName, &catName,
		)
		if err != nil { return nil, err }

		if sTime.Valid { st := time.UnixMilli(sTime.Int64); t.Date = &st }
		if cTime.Valid { ct := time.UnixMilli(cTime.Int64); t.CreatedAt = &ct }
		if srcId.Valid { t.AccountIDSource = &srcId.String }
		if destId.Valid { t.AccountIDDest = &destId.String }
		if catId.Valid { t.CategoryID = &catId.String }
		if pImg.Valid { t.ProofImage = &pImg.String }
		if desc.Valid { t.Description = &desc.String }

		if srcName.Valid { t.AccountSource = &models.FinanceAccount{Name: srcName.String} }
		if destName.Valid { t.AccountDest = &models.FinanceAccount{Name: destName.String} }
		if catName.Valid { t.Category = &models.FinanceCategory{Name: catName.String} }

		results = append(results, t)
	}
	if results == nil { results = []models.FinanceTransaction{} }
	return results, nil
}

func (r *FinanceRepository) CreateTransaction(req models.CreateFinanceTransactionRequest) error {
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	txDate := now
	if req.Date != nil { txDate = req.Date.UnixMilli() }
	status := "APPROVED"
	if req.Status != nil { status = *req.Status }

	query := `
		INSERT INTO finance_transactions (id, date, type, account_id_source, account_id_dest, category_id, amount, description, proof_image, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.DB.Exec(query, id, txDate, req.Type, req.AccountIDSource, req.AccountIDDest, req.CategoryID, req.Amount, req.Description, req.ProofImage, status, now, now)
	return err
}

func (r *FinanceRepository) DeleteTransaction(id string) error {
	_, err := r.DB.Exec("DELETE FROM finance_transactions WHERE id = ?", id)
	return err
}
