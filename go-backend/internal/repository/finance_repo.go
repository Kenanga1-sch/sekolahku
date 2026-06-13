package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
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

func (r *FinanceRepository) EnsureDefaults() error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now().UnixMilli()
	defaultAccounts := []models.FinanceAccount{
		{ID: "finance-account-bos-bank", Name: "Bank BOS", Description: stringPtr("Rekening utama dana BOS"), IsSystem: true},
		{ID: "finance-account-bos-cash", Name: "Kas Tunai BOS", Description: stringPtr("Kas tunai operasional BOS"), IsSystem: true},
	}
	for _, acc := range defaultAccounts {
		_, err := tx.Exec(`
			INSERT OR IGNORE INTO finance_accounts (id, name, account_number, description, is_system, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, acc.ID, acc.Name, acc.AccountNumber, acc.Description, boolToInt(acc.IsSystem), now, now)
		if err != nil {
			return err
		}
	}

	defaultCategories := []models.FinanceCategory{
		{ID: "finance-category-bos-income", Name: "Dana BOS", Type: "INCOME", Description: stringPtr("Penerimaan dana BOS"), IsSystem: true},
		{ID: "finance-category-bos-interest", Name: "Jasa Giro BOS", Type: "INCOME", Description: stringPtr("Pendapatan jasa giro rekening BOS"), IsSystem: true},
		{ID: "finance-category-bos-learning", Name: "Kegiatan Pembelajaran", Type: "EXPENSE", Description: stringPtr("Belanja kegiatan pembelajaran dan asesmen"), IsSystem: true},
		{ID: "finance-category-bos-maintenance", Name: "Pemeliharaan Sarpras", Type: "EXPENSE", Description: stringPtr("Pemeliharaan sarana dan prasarana"), IsSystem: true},
		{ID: "finance-category-bos-goods", Name: "Barang dan Jasa", Type: "EXPENSE", Description: stringPtr("Belanja barang dan jasa operasional sekolah"), IsSystem: true},
		{ID: "finance-category-bos-tax", Name: "Pajak", Type: "EXPENSE", Description: stringPtr("Setoran pajak terkait belanja BOS"), IsSystem: true},
	}
	for _, cat := range defaultCategories {
		_, err := tx.Exec(`
			INSERT OR IGNORE INTO finance_categories (id, name, type, description, is_system, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, cat.ID, cat.Name, cat.Type, cat.Description, boolToInt(cat.IsSystem), now, now)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func stringPtr(value string) *string {
	return &value
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func (r *FinanceRepository) accountBalance(accountID string) (float64, error) {
	var balance sql.NullFloat64
	err := r.DB.QueryRow(`
		SELECT COALESCE(SUM(CASE
			WHEN status = 'APPROVED' AND type = 'INCOME' AND account_id_source = ? THEN amount
			WHEN status = 'APPROVED' AND type = 'EXPENSE' AND account_id_source = ? THEN -amount
			WHEN status = 'APPROVED' AND type = 'TRANSFER' AND account_id_source = ? THEN -amount
			WHEN status = 'APPROVED' AND type = 'TRANSFER' AND account_id_dest = ? THEN amount
			ELSE 0
		END), 0)
		FROM finance_transactions
	`, accountID, accountID, accountID, accountID).Scan(&balance)
	if err != nil {
		return 0, err
	}
	if !balance.Valid {
		return 0, nil
	}
	return balance.Float64, nil
}

// Stats
func (r *FinanceRepository) GetFinanceStats() (*models.FinanceStats, error) {
	stats := &models.FinanceStats{}

	r.DB.QueryRow(`
		SELECT COALESCE(SUM(CASE
			WHEN type = 'INCOME' THEN amount
			WHEN type = 'EXPENSE' THEN -amount
			ELSE 0
		END), 0)
		FROM finance_transactions 
		WHERE status = 'APPROVED'
	`).Scan(&stats.TotalBalance)

	now := time.Now()
	firstDayOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).UnixMilli()

	r.DB.QueryRow(`
		SELECT COALESCE(SUM(amount), 0) FROM finance_transactions 
		WHERE type = 'INCOME' AND status = 'APPROVED' AND date >= ?
	`, firstDayOfMonth).Scan(&stats.IncomeMonth)

	r.DB.QueryRow(`
		SELECT COALESCE(SUM(amount), 0) FROM finance_transactions 
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
	if err != nil {
		return nil, err
	}
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

		if accNum.Valid {
			a.AccountNumber = &accNum.String
		}
		if descr.Valid {
			a.Description = &descr.String
		}
		a.IsSystem = (isSystem.Valid && isSystem.Int64 != 0)
		a.CreatedAt = SafeTime(createdAt)
		a.UpdatedAt = SafeTime(updatedAt)
		balance, err := r.accountBalance(a.ID)
		if err != nil {
			return nil, err
		}
		a.Balance = balance
		accounts = append(accounts, a)
	}
	if accounts == nil {
		accounts = []models.FinanceAccount{}
	}
	return accounts, nil
}

func (r *FinanceRepository) CreateAccount(req models.CreateFinanceAccountRequest) error {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return errors.New("Nama akun wajib diisi")
	}
	if req.InitialBalance < 0 {
		return errors.New("Saldo awal tidak boleh negatif")
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	accountId := cuid2.Generate()
	now := time.Now().UnixMilli()

	insertAcc := `INSERT INTO finance_accounts (id, name, account_number, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
	_, err = tx.Exec(insertAcc, accountId, req.Name, req.AccountNumber, req.Description, now, now)
	if err != nil {
		return err
	}

	if req.InitialBalance > 0 {
		txId := cuid2.Generate()
		insertTx := `
			INSERT INTO finance_transactions 
			(id, type, account_id_source, amount, description, status, date, created_at)
			VALUES (?, 'INCOME', ?, ?, 'Saldo Awal', 'APPROVED', ?, ?)
		`
		_, err = tx.Exec(insertTx, txId, accountId, req.InitialBalance, now, now)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *FinanceRepository) UpdateAccount(id string, req models.CreateFinanceAccountRequest) error {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return errors.New("Nama akun wajib diisi")
	}
	now := time.Now().UnixMilli()
	query := `UPDATE finance_accounts SET name = ?, account_number = ?, description = ?, updated_at = ? WHERE id = ?`
	res, err := r.DB.Exec(query, req.Name, req.AccountNumber, req.Description, now, id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *FinanceRepository) DeleteAccount(id string) error {
	var isSystem int
	r.DB.QueryRow(`SELECT is_system FROM finance_accounts WHERE id = ?`, id).Scan(&isSystem)
	if isSystem == 1 {
		return errors.New("Akun sistem tidak dapat dihapus")
	}

	var count int
	r.DB.QueryRow(`SELECT COUNT(*) FROM finance_transactions WHERE account_id_source = ? OR account_id_dest = ?`, id, id).Scan(&count)
	if count > 0 {
		return errors.New("Akun ini memiliki riwayat transaksi")
	}

	_, err := r.DB.Exec(`DELETE FROM finance_accounts WHERE id = ?`, id)
	return err
}

// Categories
func (r *FinanceRepository) GetCategories() ([]models.FinanceCategory, error) {
	rows, err := r.DB.Query("SELECT id, name, type, description, is_system FROM finance_categories ORDER BY type, name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.FinanceCategory
	for rows.Next() {
		var c models.FinanceCategory
		var desc sql.NullString
		var isSys int
		err := rows.Scan(&c.ID, &c.Name, &c.Type, &desc, &isSys)
		if err != nil {
			return nil, err
		}
		if desc.Valid {
			c.Description = &desc.String
		}
		c.IsSystem = isSys != 0
		results = append(results, c)
	}
	if results == nil {
		results = []models.FinanceCategory{}
	}
	return results, nil
}

func (r *FinanceRepository) CreateCategory(req models.CreateFinanceCategoryRequest) error {
	req.Name = strings.TrimSpace(req.Name)
	req.Type = strings.ToUpper(strings.TrimSpace(req.Type))
	if req.Name == "" {
		return errors.New("Nama kategori wajib diisi")
	}
	if req.Type != "INCOME" && req.Type != "EXPENSE" {
		return errors.New("Tipe kategori harus INCOME atau EXPENSE")
	}
	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec("INSERT INTO finance_categories (id, name, type, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		id, req.Name, req.Type, req.Description, now, now)
	return err
}

func (r *FinanceRepository) UpdateCategory(id string, req models.FinanceCategory) error {
	req.Name = strings.TrimSpace(req.Name)
	req.Type = strings.ToUpper(strings.TrimSpace(req.Type))
	if req.Name == "" {
		return errors.New("Nama kategori wajib diisi")
	}
	if req.Type != "INCOME" && req.Type != "EXPENSE" {
		return errors.New("Tipe kategori harus INCOME atau EXPENSE")
	}
	now := time.Now().UnixMilli()
	res, err := r.DB.Exec("UPDATE finance_categories SET name = ?, type = ?, description = ?, updated_at = ? WHERE id = ?",
		req.Name, req.Type, req.Description, now, id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *FinanceRepository) DeleteCategory(id string) error {
	var isSys int
	r.DB.QueryRow("SELECT is_system FROM finance_categories WHERE id = ?", id).Scan(&isSys)
	if isSys != 0 {
		return errors.New("Kategori sistem tidak bisa dihapus")
	}
	var count int
	r.DB.QueryRow("SELECT COUNT(*) FROM finance_transactions WHERE category_id = ?", id).Scan(&count)
	if count > 0 {
		return errors.New("Kategori ini memiliki riwayat transaksi")
	}
	_, err := r.DB.Exec("DELETE FROM finance_categories WHERE id = ?", id)
	return err
}

func normalizeFinanceLimit(limit int) int {
	if limit <= 0 {
		return 100
	}
	if limit > 2000 {
		return 2000
	}
	return limit
}

// Transactions
func (r *FinanceRepository) GetTransactions(filters models.FinanceTransactionFilters) ([]models.FinanceTransaction, error) {
	where := []string{"1=1"}
	args := []interface{}{}

	if strings.TrimSpace(filters.AccountID) != "" && filters.AccountID != "all" {
		where = append(where, "(t.account_id_source = ? OR t.account_id_dest = ?)")
		args = append(args, filters.AccountID, filters.AccountID)
	}
	if filters.StartDate != nil {
		where = append(where, "t.date >= ?")
		args = append(args, filters.StartDate.UnixMilli())
	}
	if filters.EndDate != nil {
		where = append(where, "t.date <= ?")
		args = append(args, filters.EndDate.UnixMilli())
	}
	if strings.TrimSpace(filters.Type) != "" && filters.Type != "all" {
		where = append(where, "t.type = ?")
		args = append(args, strings.ToUpper(strings.TrimSpace(filters.Type)))
	}
	if strings.TrimSpace(filters.Status) != "" && filters.Status != "all" {
		where = append(where, "t.status = ?")
		args = append(args, strings.ToUpper(strings.TrimSpace(filters.Status)))
	}

	orderDirection := "DESC"
	if strings.EqualFold(filters.Sort, "asc") {
		orderDirection = "ASC"
	}
	limit := normalizeFinanceLimit(filters.Limit)
	args = append(args, limit)

	query := fmt.Sprintf(`
		SELECT t.id, t.date, t.type, t.account_id_source, t.account_id_dest, t.category_id, 
		       t.amount, t.description, t.proof_image, t.status, t.created_at,
		       asrc.name as src_name, adest.name as dest_name, c.name as cat_name,
		       t.created_by
		FROM finance_transactions t
		LEFT JOIN finance_accounts asrc ON t.account_id_source = asrc.id
		LEFT JOIN finance_accounts adest ON t.account_id_dest = adest.id
		LEFT JOIN finance_categories c ON t.category_id = c.id
		WHERE %s
		ORDER BY t.date %s, t.created_at %s LIMIT ?
	`, strings.Join(where, " AND "), orderDirection, orderDirection)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.FinanceTransaction
	for rows.Next() {
		var t models.FinanceTransaction
		var sTime, cTime sql.NullInt64
		var srcId, destId, catId, pImg, desc, srcName, destName, catName, createdBy sql.NullString

		err := rows.Scan(
			&t.ID, &sTime, &t.Type, &srcId, &destId, &catId,
			&t.Amount, &desc, &pImg, &t.Status, &cTime,
			&srcName, &destName, &catName, &createdBy,
		)
		if err != nil {
			return nil, err
		}

		if sTime.Valid {
			st := time.UnixMilli(sTime.Int64)
			t.Date = &st
		}
		if cTime.Valid {
			ct := time.UnixMilli(cTime.Int64)
			t.CreatedAt = &ct
		}
		if srcId.Valid {
			t.AccountIDSource = &srcId.String
		}
		if destId.Valid {
			t.AccountIDDest = &destId.String
		}
		if catId.Valid {
			t.CategoryID = &catId.String
		}
		if pImg.Valid {
			t.ProofImage = &pImg.String
		}
		if desc.Valid {
			t.Description = &desc.String
		}
		if createdBy.Valid {
			t.CreatedBy = &createdBy.String
		}

		if srcName.Valid {
			t.AccountSource = &models.FinanceAccount{ID: srcId.String, Name: srcName.String}
		}
		if destName.Valid {
			t.AccountDest = &models.FinanceAccount{ID: destId.String, Name: destName.String}
		}
		if catName.Valid {
			t.Category = &models.FinanceCategory{Name: catName.String}
		}

		results = append(results, t)
	}
	if results == nil {
		results = []models.FinanceTransaction{}
	}
	return results, nil
}

func (r *FinanceRepository) CreateTransaction(req models.CreateFinanceTransactionRequest) error {
	req.Type = strings.ToUpper(strings.TrimSpace(req.Type))
	req.AccountIDSource = strings.TrimSpace(req.AccountIDSource)
	status := "APPROVED"
	if req.Status != nil {
		status = strings.ToUpper(strings.TrimSpace(*req.Status))
	}
	if status == "" {
		status = "APPROVED"
	}
	if status != "PENDING" && status != "APPROVED" && status != "REJECTED" {
		return errors.New("Status transaksi tidak valid")
	}
	if req.Type != "INCOME" && req.Type != "EXPENSE" && req.Type != "TRANSFER" {
		return errors.New("Tipe transaksi tidak valid")
	}
	if req.AccountIDSource == "" {
		return errors.New("Akun sumber wajib dipilih")
	}
	var sourceExists int
	if err := r.DB.QueryRow("SELECT COUNT(*) FROM finance_accounts WHERE id = ?", req.AccountIDSource).Scan(&sourceExists); err != nil {
		return err
	}
	if sourceExists == 0 {
		return errors.New("Akun sumber tidak ditemukan")
	}
	if req.Amount <= 0 {
		return errors.New("Nominal transaksi harus lebih dari 0")
	}
	if req.Type == "TRANSFER" {
		if req.AccountIDDest == nil || strings.TrimSpace(*req.AccountIDDest) == "" {
			return errors.New("Akun tujuan wajib dipilih untuk mutasi")
		}
		dest := strings.TrimSpace(*req.AccountIDDest)
		req.AccountIDDest = &dest
		if dest == req.AccountIDSource {
			return errors.New("Akun tujuan harus berbeda dari akun sumber")
		}
		var destExists int
		if err := r.DB.QueryRow("SELECT COUNT(*) FROM finance_accounts WHERE id = ?", dest).Scan(&destExists); err != nil {
			return err
		}
		if destExists == 0 {
			return errors.New("Akun tujuan tidak ditemukan")
		}
		req.CategoryID = nil
	} else {
		req.AccountIDDest = nil
		if req.CategoryID == nil || strings.TrimSpace(*req.CategoryID) == "" {
			return errors.New("Kategori wajib dipilih")
		}
		catID := strings.TrimSpace(*req.CategoryID)
		req.CategoryID = &catID
		var categoryType string
		if err := r.DB.QueryRow("SELECT type FROM finance_categories WHERE id = ?", catID).Scan(&categoryType); err != nil {
			if err == sql.ErrNoRows {
				return errors.New("Kategori tidak ditemukan")
			}
			return err
		}
		if strings.ToUpper(categoryType) != req.Type {
			return errors.New("Tipe kategori tidak sesuai dengan tipe transaksi")
		}
	}

	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if status == "APPROVED" && (req.Type == "EXPENSE" || req.Type == "TRANSFER") {
		balance, err := r.accountBalanceTx(tx, req.AccountIDSource)
		if err != nil {
			return err
		}
		if balance < req.Amount {
			return errors.New("Saldo akun sumber tidak mencukupi")
		}
	}

	id := cuid2.Generate()
	now := time.Now().UnixMilli()
	txDate := now
	if req.Date != nil {
		txDate = req.Date.UnixMilli()
	}

	_, err = tx.Exec(`
		INSERT INTO finance_transactions (id, date, type, account_id_source, account_id_dest, category_id, amount, description, proof_image, status, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, txDate, req.Type, req.AccountIDSource, req.AccountIDDest, req.CategoryID, req.Amount, req.Description, req.ProofImage, status, req.CreatedBy, now, now)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *FinanceRepository) accountBalanceTx(tx *sql.Tx, accountID string) (float64, error) {
	var balance sql.NullFloat64
	err := tx.QueryRow(`
		SELECT COALESCE(SUM(CASE
			WHEN status = 'APPROVED' AND type = 'INCOME' AND account_id_source = ? THEN amount
			WHEN status = 'APPROVED' AND type = 'EXPENSE' AND account_id_source = ? THEN -amount
			WHEN status = 'APPROVED' AND type = 'TRANSFER' AND account_id_source = ? THEN -amount
			WHEN status = 'APPROVED' AND type = 'TRANSFER' AND account_id_dest = ? THEN amount
			ELSE 0
		END), 0)
		FROM finance_transactions
	`, accountID, accountID, accountID, accountID).Scan(&balance)
	if err != nil {
		return 0, err
	}
	if !balance.Valid {
		return 0, nil
	}
	return balance.Float64, nil
}

func (r *FinanceRepository) UpdateTransaction(id string, req models.FinanceTransaction) error {
	var currentStatus string
	if err := r.DB.QueryRow("SELECT status FROM finance_transactions WHERE id = ?", id).Scan(&currentStatus); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("Transaksi tidak ditemukan")
		}
		return err
	}
	if currentStatus == "APPROVED" {
		return errors.New("Transaksi yang sudah di-APPROVED tidak dapat diubah. Batalkan dan buat transaksi baru")
	}
	now := time.Now().UnixMilli()
	_, err := r.DB.Exec(`
		UPDATE finance_transactions SET date = ?, type = ?, account_id_source = ?, account_id_dest = ?,
			category_id = ?, amount = ?, description = ?, proof_image = ?, status = ?, updated_at = ?
		WHERE id = ?
	`, req.Date, req.Type, req.AccountIDSource, req.AccountIDDest, req.CategoryID, req.Amount, req.Description, req.ProofImage, req.Status, now, id)
	return err
}

func (r *FinanceRepository) DeleteTransaction(id string) error {
	_, err := r.DB.Exec("DELETE FROM finance_transactions WHERE id = ?", id)
	return err
}
