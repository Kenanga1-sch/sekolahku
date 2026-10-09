package repository

import (
	"database/sql"
	"testing"

	"github.com/sekolahku/go-backend/internal/models"
	_ "modernc.org/sqlite"
)

func setupGtkSavingsTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`
		CREATE TABLE employee_details (
			id TEXT PRIMARY KEY, name TEXT, nip TEXT, nuptk TEXT,
			qr_code TEXT, category TEXT, user_id TEXT, photo_url TEXT
		);
		CREATE TABLE tabungan_gtk (
			id TEXT PRIMARY KEY, employee_id TEXT UNIQUE NOT NULL,
			saldo_terakhir INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER
		);
		CREATE TABLE tabungan_gtk_transaksi (
			id TEXT PRIMARY KEY, gtk_id TEXT NOT NULL, user_id TEXT,
			tipe TEXT NOT NULL, nominal INTEGER NOT NULL,
			status TEXT DEFAULT 'posted', catatan TEXT, created_at INTEGER
		);
		INSERT INTO employee_details (id, name, nip, qr_code, category)
		VALUES ('emp-1', 'Budi', '197001011990031001', 'GTK-197001011990031001', 'guru');
	`)
	if err != nil {
		t.Fatalf("create schema: %v", err)
	}
	return db
}

func TestSavingsGTKEnsureAndGetByQR(t *testing.T) {
	db := setupGtkSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsGTKRepository(db)

	g, err := repo.GetGtkByQR("GTK-197001011990031001")
	if err != nil || g == nil {
		t.Fatalf("GetGtkByQR: %v %#v", err, g)
	}
	if g.EmployeeID != "emp-1" || g.Nama != "Budi" || g.SaldoTerakhir != 0 {
		t.Fatalf("unexpected: %#v", g)
	}
	// Via NIP juga bisa & tidak dobel.
	if _, err := repo.GetGtkByQR("197001011990031001"); err != nil {
		t.Fatal(err)
	}
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM tabungan_gtk`).Scan(&count)
	if count != 1 {
		t.Fatalf("expected 1 account, got %d", count)
	}
	// Bukan GTK → (nil, nil).
	if g, err := repo.GetGtkByQR("BUKAN-GTK"); err != nil || g != nil {
		t.Fatalf("expected nil for unknown, got %#v err=%v", g, err)
	}
}

func TestSavingsGTKSetorTarikAndSaldoGuard(t *testing.T) {
	db := setupGtkSavingsTestDB(t)
	defer db.Close()
	repo := NewSavingsGTKRepository(db)

	// Setor 5000.
	g, err := repo.CreateGtkTransaksi(models.CreateGtkTransaksiRequest{Code: "GTK-197001011990031001", Tipe: "setor", Nominal: 5000, UserID: "u1"})
	if err != nil || g.SaldoTerakhir != 5000 {
		t.Fatalf("setor: %v saldo=%d", err, g.SaldoTerakhir)
	}
	// Tarik 2000.
	g, err = repo.CreateGtkTransaksi(models.CreateGtkTransaksiRequest{EmployeeID: "emp-1", Tipe: "tarik", Nominal: 2000, UserID: "u1"})
	if err != nil || g.SaldoTerakhir != 3000 {
		t.Fatalf("tarik: %v saldo=%d", err, g.SaldoTerakhir)
	}
	// Tarik melebihi saldo → ditolak.
	if _, err := repo.CreateGtkTransaksi(models.CreateGtkTransaksiRequest{EmployeeID: "emp-1", Tipe: "tarik", Nominal: 99999, UserID: "u1"}); err == nil {
		t.Fatal("expected over-withdraw to fail")
	}
	// Detail + transaksi.
	g2, tx, err := repo.GetGtkDetail(g.ID)
	if err != nil || g2.SaldoTerakhir != 3000 || len(tx) != 2 {
		t.Fatalf("detail: %v saldo=%d tx=%d", err, g2.SaldoTerakhir, len(tx))
	}
	// Nominal di bawah 1000 ditolak.
	if _, err := repo.CreateGtkTransaksi(models.CreateGtkTransaksiRequest{EmployeeID: "emp-1", Tipe: "setor", Nominal: 500, UserID: "u1"}); err == nil {
		t.Fatal("expected below-minimum to fail")
	}
}
