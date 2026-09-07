package migrations

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

// TestNoOpenTransactionAfterMigrations memastikan RunMigrations tidak pernah
// meninggalkan transaksi terbuka.
//
// Latar belakang: 000022 berisi "BEGIN TRANSACTION;" dan "COMMIT;" tertulis di
// dalam file. Karena parser memecahnya jadi statement terpisah, BEGIN tereksekusi
// membuka transaksi. Bila migrasi itu gagal di tengah (tabel inti belum ada),
// COMMIT tidak pernah tercapai -> transaksi menggantung. Akibatnya seluruh DDL
// migrasi sesudahnya (termasuk 000034/000036 pembuat tabel inventaris) ikut
// ter rollback saat koneksi ditutup, dan modul inventaris hilang di DB baru.
func TestNoOpenTransactionAfterMigrations(t *testing.T) {
	db, err := sql.Open("sqlite", t.TempDir()+"/m.db")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)

	if err := RunMigrations(db); err != nil {
		t.Fatalf("RunMigrations: %v", err)
	}

	// Bila tidak ada transaksi aktif, COMMIT harus gagal.
	if err := execRaw(db, "COMMIT"); err == nil {
		t.Fatal("RunMigrations meninggalkan transaksi terbuka (COMMIT berhasil)")
	}
}

// TestFreshDBMigrationsPersist memastikan tabel yang dibuat migrasi benar-benar
// bertahan setelah koneksi ditutup (simulasi restart server).
func TestFreshDBMigrationsPersist(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/m.db"

	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	if err := RunMigrations(db); err != nil {
		t.Fatalf("RunMigrations: %v", err)
	}
	db.Close() // seperti restart server

	db2, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	defer db2.Close()
	db2.SetMaxOpenConns(1)

	for _, tbl := range []string{"inventory_assets", "inventory_items", "inventory_rooms"} {
		var n int
		if err := db2.QueryRow(
			`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?`, tbl,
		).Scan(&n); err != nil {
			t.Fatalf("cek %s: %v", tbl, err)
		}
		if n == 0 {
			t.Errorf("setelah restart tabel %s hilang (ter-rollback)", tbl)
		}
	}

	for _, col := range []string{"funding_source", "fiscal_year", "photo_url"} {
		var n int
		if err := db2.QueryRow(
			`SELECT COUNT(*) FROM pragma_table_info('inventory_assets') WHERE name=?`, col,
		).Scan(&n); err != nil {
			t.Fatalf("cek kolom %s: %v", col, err)
		}
		if n == 0 {
			t.Errorf("setelah restart kolom %s hilang", col)
		}
	}
}

// TestFailedMigrationRetriedOnNextStart memastikan migrasi yang gagal karena
// tabel inti belum ada tidak menghentikan rantai, dan tetap dicoba ulang pada
// start berikutnya.
func TestFailedMigrationRetriedOnNextStart(t *testing.T) {
	db, err := sql.Open("sqlite", t.TempDir()+"/m.db")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)

	// Start 1: tabel alumni belum ada (createCoreTables belum jalan).
	if err := RunMigrations(db); err != nil {
		t.Fatalf("start 1 seharusnya tidak mengembalikan error: %v", err)
	}

	// Migrasi inventaris harus sudah tercatat meski 000007 gagal.
	for _, v := range []int{34, 35, 36} {
		var n int
		if err := db.QueryRow(`SELECT COUNT(*) FROM _migrations WHERE version=?`, v).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n == 0 {
			t.Errorf("migrasi %d seharusnya sudah applied di start 1", v)
		}
	}

	// Simulasikan createCoreTables lalu start 2.
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS alumni (id TEXT PRIMARY KEY, nama TEXT)`); err != nil {
		t.Fatal(err)
	}
	if err := RunMigrations(db); err != nil {
		t.Fatalf("start 2: %v", err)
	}

	// 000007 kini harus berhasil.
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM _migrations WHERE version=7`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n == 0 {
		t.Error("migrasi 7 seharusnya berhasil di start 2 setelah tabel alumni ada")
	}
}

func execRaw(db *sql.DB, q string) error {
	_, err := db.Exec(q)
	return err
}
