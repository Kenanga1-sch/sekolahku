package repository

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"

	_ "modernc.org/sqlite"
)

func TestFinanceSmoke(t *testing.T) {
	db, err := sql.Open("sqlite", filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, stmt := range []string{
		`CREATE TABLE unit_finance_units (id TEXT PRIMARY KEY, code TEXT UNIQUE, name TEXT, type TEXT, description TEXT DEFAULT '', icon TEXT DEFAULT 'wallet', color TEXT DEFAULT '', is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE unit_finance_categories (id TEXT PRIMARY KEY, unit_id TEXT, name TEXT, direction TEXT DEFAULT 'in', is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE unit_finance_transactions (id TEXT PRIMARY KEY, unit_id TEXT, category_id TEXT, direction TEXT, amount INTEGER DEFAULT 0, description TEXT DEFAULT '', tx_date INTEGER, party TEXT DEFAULT '', quantity REAL, unit_price INTEGER, reference TEXT DEFAULT '', metadata TEXT DEFAULT '', created_by TEXT, created_by_name TEXT DEFAULT '', created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE unit_finance_audit_log (id TEXT PRIMARY KEY, entity TEXT, entity_id TEXT, action TEXT, actor_id TEXT, actor_name TEXT DEFAULT '', before TEXT DEFAULT '', after TEXT DEFAULT '', created_at INTEGER)`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatalf("schema: %v", err)
		}
	}
	repo := NewFinanceRepository(db)

	u, err := repo.CreateUnit(models.CreateFinanceUnitRequest{Code: "sampah-plastik", Name: "Sampah Plastik", Type: "sampah"}, "u1", "Admin")
	if err != nil {
		t.Fatalf("create unit: %v", err)
	}
	cat, err := repo.CreateCategory(models.CreateFinanceCategoryRequest{UnitID: u.ID, Name: "Penjualan Sampah Plastik", Direction: "in"}, "u1", "Admin")
	if err != nil {
		t.Fatalf("create category: %v", err)
	}

	qty := 12.5
	up := 4000
	_, err = repo.CreateTransaction(models.CreateFinanceTransactionRequest{
		UnitID: u.ID, CategoryID: cat.ID, Direction: "in", Amount: 50000,
		Description: "Jual sampah plastik", Party: "Pengepul Jaya", Quantity: &qty, UnitPrice: &up,
	}, "u1", "Admin")
	if err != nil {
		t.Fatalf("create tx in: %v", err)
	}
	_, err = repo.CreateTransaction(models.CreateFinanceTransactionRequest{
		UnitID: u.ID, CategoryID: cat.ID, Direction: "in", Amount: 20000, Description: "Jual lagi",
	}, "u2", "Guru")
	if err != nil {
		t.Fatalf("create tx in2: %v", err)
	}
	_, err = repo.CreateTransaction(models.CreateFinanceTransactionRequest{
		UnitID: u.ID, Direction: "out", Amount: 15000, Description: "Beli karung",
	}, "u1", "Admin")
	if err != nil {
		t.Fatalf("create tx out: %v", err)
	}

	s, err := repo.SummaryByUnit(u.ID)
	if err != nil {
		t.Fatalf("summary: %v", err)
	}
	if s.TotalIn != 70000 || s.TotalOut != 15000 || s.Balance != 55000 || s.TxCount != 3 {
		t.Fatalf("summary salah: %+v", s)
	}

	recapCat, err := repo.RecapByCategory(u.ID, 0, 0)
	if err != nil || len(recapCat) == 0 {
		t.Fatalf("recap kategori gagal: %v len=%d", err, len(recapCat))
	}
	recapMon, err := repo.RecapMonthly(u.ID, 24)
	if err != nil || len(recapMon) == 0 {
		t.Fatalf("recap bulanan gagal: %v len=%d", err, len(recapMon))
	}
	audit, err := repo.ListAuditLog(100)
	if err != nil {
		t.Fatalf("audit: %v", err)
	}
	if len(audit) != 5 { // 1 unit + 1 kategori + 3 transaksi
		t.Fatalf("audit count=%d want 5", len(audit))
	}

	// Update + delete transaksi.
	txns, _ := repo.ListTransactions(FinanceTransactionFilter{UnitID: u.ID})
	if len(txns) != 3 {
		t.Fatalf("list tx=%d want 3", len(txns))
	}
	if err := repo.DeleteTransaction(txns[0].ID, "u1", "Admin"); err != nil {
		t.Fatalf("delete tx: %v", err)
	}
	s2, _ := repo.SummaryByUnit(u.ID)
	if s2.TxCount != 2 {
		t.Fatalf("setelah hapus count=%d want 2", s2.TxCount)
	}
	t.Logf("OK: in=%d out=%d balance=%d recat=%d remon=%d audit=%d", s.TotalIn, s.TotalOut, s.Balance, len(recapCat), len(recapMon), len(audit))
}
