package repository

import (
	"database/sql"
	"strings"
	"testing"
	"time"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupFinanceTestDB(t *testing.T) *sql.DB {
	t.Helper()

	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := sql.Open("sqlite", "file:"+dbName+"?mode=memory&cache=shared")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE finance_accounts (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			account_number TEXT,
			description TEXT,
			is_system BOOLEAN DEFAULT 0,
			created_at INTEGER,
			updated_at INTEGER
		);

		CREATE TABLE finance_categories (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT,
			description TEXT,
			is_system BOOLEAN DEFAULT 0,
			created_at INTEGER,
			updated_at INTEGER
		);

		CREATE TABLE finance_transactions (
			id TEXT PRIMARY KEY,
			date INTEGER,
			type TEXT,
			account_id_source TEXT,
			account_id_dest TEXT,
			category_id TEXT,
			amount REAL,
			description TEXT,
			proof_image TEXT,
			status TEXT DEFAULT 'PENDING',
			ref_table TEXT,
			ref_id TEXT,
			created_by TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
	`)
	if err != nil {
		t.Fatalf("failed to create finance schema: %v", err)
	}

	return db
}

func TestFinanceRepositoryDefaultsAndBalances(t *testing.T) {
	db := setupFinanceTestDB(t)
	defer db.Close()
	repo := NewFinanceRepository(db)

	if err := repo.EnsureDefaults(); err != nil {
		t.Fatalf("EnsureDefaults returned error: %v", err)
	}

	accounts, err := repo.GetAccounts()
	if err != nil {
		t.Fatalf("GetAccounts returned error: %v", err)
	}
	if len(accounts) != 2 {
		t.Fatalf("expected two BOS default accounts, got %d", len(accounts))
	}

	categories, err := repo.GetCategories()
	if err != nil {
		t.Fatalf("GetCategories returned error: %v", err)
	}
	if len(categories) < 4 {
		t.Fatalf("expected BOS default categories, got %d", len(categories))
	}

	if err := repo.CreateTransaction(models.CreateFinanceTransactionRequest{
		Type:            "INCOME",
		AccountIDSource: "finance-account-bos-bank",
		CategoryID:      stringPtr("finance-category-bos-income"),
		Amount:          1_000_000,
	}); err != nil {
		t.Fatalf("income transaction returned error: %v", err)
	}
	if err := repo.CreateTransaction(models.CreateFinanceTransactionRequest{
		Type:            "EXPENSE",
		AccountIDSource: "finance-account-bos-bank",
		CategoryID:      stringPtr("finance-category-bos-goods"),
		Amount:          250_000,
	}); err != nil {
		t.Fatalf("expense transaction returned error: %v", err)
	}

	accounts, err = repo.GetAccounts()
	if err != nil {
		t.Fatalf("GetAccounts after transactions returned error: %v", err)
	}
	var bankBalance float64
	for _, acc := range accounts {
		if acc.ID == "finance-account-bos-bank" {
			bankBalance = acc.Balance
		}
	}
	if bankBalance != 750_000 {
		t.Fatalf("expected bank balance 750000, got %.0f", bankBalance)
	}
}

func TestFinanceRepositoryTransactionFiltersAndRules(t *testing.T) {
	db := setupFinanceTestDB(t)
	defer db.Close()
	repo := NewFinanceRepository(db)
	if err := repo.EnsureDefaults(); err != nil {
		t.Fatalf("EnsureDefaults returned error: %v", err)
	}

	may := time.Date(2026, time.May, 26, 0, 0, 0, 0, time.UTC)
	june := time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC)

	if err := repo.CreateTransaction(models.CreateFinanceTransactionRequest{
		Date:            &may,
		Type:            "INCOME",
		AccountIDSource: "finance-account-bos-bank",
		CategoryID:      stringPtr("finance-category-bos-income"),
		Amount:          500_000,
	}); err != nil {
		t.Fatalf("income transaction returned error: %v", err)
	}
	if err := repo.CreateTransaction(models.CreateFinanceTransactionRequest{
		Date:            &june,
		Type:            "TRANSFER",
		AccountIDSource: "finance-account-bos-bank",
		AccountIDDest:   stringPtr("finance-account-bos-cash"),
		Amount:          100_000,
	}); err != nil {
		t.Fatalf("transfer transaction returned error: %v", err)
	}

	start := time.Date(2026, time.May, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, time.May, 31, 23, 59, 59, 0, time.UTC)
	items, err := repo.GetTransactions(models.FinanceTransactionFilters{
		AccountID: "finance-account-bos-bank",
		StartDate: &start,
		EndDate:   &end,
		Status:    "APPROVED",
		Sort:      "asc",
		Limit:     100,
	})
	if err != nil {
		t.Fatalf("GetTransactions returned error: %v", err)
	}
	if len(items) != 1 || items[0].Type != "INCOME" {
		t.Fatalf("expected only May income transaction, got %#v", items)
	}

	err = repo.CreateTransaction(models.CreateFinanceTransactionRequest{
		Type:            "TRANSFER",
		AccountIDSource: "finance-account-bos-bank",
		AccountIDDest:   stringPtr("finance-account-bos-bank"),
		Amount:          10_000,
	})
	if err == nil || !strings.Contains(err.Error(), "berbeda") {
		t.Fatalf("expected same-account transfer validation error, got %v", err)
	}

	err = repo.CreateTransaction(models.CreateFinanceTransactionRequest{
		Type:            "EXPENSE",
		AccountIDSource: "finance-account-bos-cash",
		CategoryID:      stringPtr("finance-category-bos-goods"),
		Amount:          999_999_999,
	})
	if err == nil || !strings.Contains(err.Error(), "tidak mencukupi") {
		t.Fatalf("expected insufficient balance error, got %v", err)
	}
}
