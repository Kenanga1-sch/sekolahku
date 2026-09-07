package migrations

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"
)

// applyOne menjalankan hanya SATU file migrasi .up.sql, memakai parser yang
// sama dengan RunMigrations. Ini mengisolasi migrasi inventaris dari
// dependensi migrasi 1..33 (yang butuh skema dasar lengkap dari createCoreTables).
func applyOne(t *testing.T, db *sql.DB, fileName string, dir string) {
	t.Helper()
	content, err := os.ReadFile(filepath.Join(dir, fileName))
	if err != nil {
		t.Fatalf("read %s: %v", fileName, err)
	}

	var statements []string
	var current string
	for _, line := range splitLines(string(content)) {
		trimmed := trimSpace(line)
		if trimmed == "" || hasPrefix(trimmed, "--") {
			continue
		}
		current += line + "\n"
		if hasSuffix(trimmed, ";") {
			statements = append(statements, current)
			current = ""
		}
	}
	if trimSpace(current) != "" {
		statements = append(statements, current)
	}

	for _, stmt := range statements {
		stmt = trimSpace(stmt)
		if stmt == "" {
			continue
		}
		if _, err := db.Exec(stmt); err != nil {
			t.Fatalf("%s: %v\nSQL: %s", fileName, err, stmt)
		}
	}
}

func splitLines(s string) []string {
	var out []string
	cur := ""
	for _, r := range s {
		if r == '\n' {
			out = append(out, cur)
			cur = ""
			continue
		}
		cur += string(r)
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}

func trimSpace(s string) string {
	i, j := 0, len(s)
	for i < j && (s[i] == ' ' || s[i] == '\t' || s[i] == '\r') {
		i++
	}
	for j > i && (s[j-1] == ' ' || s[j-1] == '\t' || s[j-1] == '\r') {
		j--
	}
	return s[i:j]
}

func hasPrefix(s, p string) bool { return len(s) >= len(p) && s[:len(p)] == p }
func hasSuffix(s, p string) bool { return len(s) >= len(p) && s[len(s)-len(p):] == p }

const invMig = "000034_inventory_schema.up.sql"

// DB KOSONG: semua tabel inventaris harus terbentuk dengan FK + soft delete.
func TestInventoryMigrationFresh(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	applyOne(t, db, invMig, ".")
	if err := MigrateInventoryData(db); err != nil {
		t.Fatalf("MigrateInventoryData: %v", err)
	}

	for _, tbl := range []string{
		"inventory_rooms", "inventory_assets", "inventory_items",
		"inventory_transactions", "inventory_opname", "inventory_opname_items",
		"inventory_audit", "inventory_borrow_requests",
	} {
		var name string
		if err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name=?", tbl).Scan(&name); err == sql.ErrNoRows {
			t.Errorf("table %s MISSING", tbl)
		}
	}

	var cnt int
	db.QueryRow(`SELECT COUNT(*) FROM pragma_foreign_key_list('inventory_assets') WHERE "table"='inventory_rooms'`).Scan(&cnt)
	if cnt == 0 {
		t.Error("FK assets.room_id -> rooms MISSING")
	}
	db.QueryRow(`SELECT COUNT(*) FROM pragma_foreign_key_list('inventory_transactions') WHERE "table"='inventory_items'`).Scan(&cnt)
	if cnt == 0 {
		t.Error("FK transactions.item_id -> items MISSING")
	}
	db.QueryRow(`SELECT COUNT(*) FROM pragma_foreign_key_list('inventory_borrow_requests') WHERE "table"='inventory_assets'`).Scan(&cnt)
	if cnt == 0 {
		t.Error("FK borrow_requests.asset_id -> assets MISSING")
	}
	db.QueryRow(`SELECT COUNT(*) FROM pragma_foreign_key_list('inventory_opname_items') WHERE "table"='inventory_assets'`).Scan(&cnt)
	if cnt == 0 {
		t.Error("FK opname_items.asset_id -> assets MISSING")
	}

	for _, col := range []struct{ tbl, col string }{
		{"inventory_assets", "deleted_at"},
		{"inventory_rooms", "deleted_at"},
		{"inventory_items", "deleted_at"},
		{"inventory_borrow_requests", "returned_at"},
		{"inventory_borrow_requests", "returned_by"},
	} {
		var n int
		db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info(?) WHERE name=?`, col.tbl, col.col).Scan(&n)
		if n == 0 {
			t.Errorf("%s.%s MISSING", col.tbl, col.col)
		}
	}

	for _, idx := range []string{
		"idx_inventory_assets_status", "idx_inventory_assets_category",
		"idx_inventory_transactions_item", "idx_inventory_items_location",
		"idx_inventory_opname_status", "idx_inventory_audit_created",
	} {
		var n string
		if err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='index' AND name=?", idx).Scan(&n); err == sql.ErrNoRows {
			t.Errorf("index %s MISSING", idx)
		}
	}

	// Idempoten
	applyOne(t, db, invMig, ".")
}

// DB LAMA: tabel bentuk lama + data harus selamat, JSON opname pindah ke tabel.
func TestInventoryMigrationLegacy(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	legacy := []string{
		`CREATE TABLE inventory_rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, description TEXT, location TEXT, pic_id TEXT, created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE inventory_assets (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, category TEXT, price INTEGER DEFAULT 0, quantity INTEGER DEFAULT 0, room_id TEXT, condition_good INTEGER DEFAULT 0, condition_light_damaged INTEGER DEFAULT 0, condition_heavy_damaged INTEGER DEFAULT 0, condition_lost INTEGER DEFAULT 0, purchase_date INTEGER, notes TEXT, status TEXT DEFAULT 'ACTIVE', created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE inventory_items (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, category TEXT, unit TEXT, min_stock INTEGER DEFAULT 0, current_stock INTEGER DEFAULT 0, location TEXT, price INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)`,
		`CREATE TABLE inventory_transactions (id TEXT PRIMARY KEY, item_id TEXT NOT NULL, type TEXT NOT NULL, quantity INTEGER NOT NULL, date INTEGER, description TEXT, recipient TEXT, proof_image TEXT, user_id TEXT, created_at INTEGER)`,
		`CREATE TABLE inventory_opname (id TEXT PRIMARY KEY, date INTEGER, room_id TEXT, auditor_id TEXT, items TEXT, status TEXT DEFAULT 'PENDING', note TEXT, created_at INTEGER)`,
		`CREATE TABLE inventory_audit (id TEXT PRIMARY KEY, action TEXT, entity TEXT, entity_id TEXT, changes TEXT, user_id TEXT, created_at INTEGER)`,
		`CREATE TABLE inventory_borrow_requests (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, room_id TEXT NOT NULL, requester_id TEXT NOT NULL, reason TEXT, quantity INTEGER DEFAULT 1 NOT NULL, status TEXT DEFAULT 'pending' NOT NULL, approved_by TEXT, approved_at INTEGER, created_at INTEGER, updated_at INTEGER)`,
	}
	for _, s := range legacy {
		if _, err := db.Exec(s); err != nil {
			t.Fatal(err)
		}
	}
	db.Exec(`INSERT INTO inventory_rooms VALUES ('r1','Lab Komputer','LC','','Lt.2',NULL,1,1)`)
	db.Exec(`INSERT INTO inventory_assets VALUES ('a1','Proyektor','P1','Elektronik',5000000,2,'r1',2,0,0,0,NULL,NULL,'ACTIVE',1,1)`)
	db.Exec(`INSERT INTO inventory_items VALUES ('i1','Kertas A4','K1','ATK','Rim',5,100,'Gudang',45000,1,1)`)
	db.Exec(`INSERT INTO inventory_transactions VALUES ('t1','i1','IN',10,1,'','',NULL,NULL,1)`)
	db.Exec(`INSERT INTO inventory_audit VALUES ('au1','CREATE','ASSET','a1','[]',NULL,1)`)
	db.Exec(`INSERT INTO inventory_opname VALUES ('o1',1,'r1',NULL,'[{"id":"a1","qtyGood":2,"qtyLightDamage":0,"qtyHeavyDamage":0,"qtyLost":0,"systemQty":2}]','PENDING',NULL,1)`)

	applyOne(t, db, invMig, ".")
	if err := MigrateInventoryData(db); err != nil {
		t.Fatalf("MigrateInventoryData: %v", err)
	}

	for label, q := range map[string]string{
		"rooms":        "SELECT COUNT(*) FROM inventory_rooms WHERE id='r1'",
		"assets":       "SELECT COUNT(*) FROM inventory_assets WHERE id='a1'",
		"items":        "SELECT COUNT(*) FROM inventory_items WHERE id='i1'",
		"transactions": "SELECT COUNT(*) FROM inventory_transactions WHERE id='t1'",
		"audit":        "SELECT COUNT(*) FROM inventory_audit WHERE id='au1'",
		"opname":       "SELECT COUNT(*) FROM inventory_opname WHERE id='o1'",
	} {
		var cnt int
		if err := db.QueryRow(q).Scan(&cnt); err != nil || cnt != 1 {
			t.Errorf("%s: data hilang setelah migrasi (cnt=%d err=%v)", label, cnt, err)
		}
	}

	var good, sysQty int
	if err := db.QueryRow(`SELECT counted_good, system_quantity FROM inventory_opname_items WHERE opname_id='o1' AND asset_id='a1'`).Scan(&good, &sysQty); err != nil {
		t.Errorf("JSON opname tidak termigrasi: %v", err)
	} else if good != 2 || sysQty != 2 {
		t.Errorf("want counted_good=2 system_quantity=2, got %d/%d", good, sysQty)
	}
}

// FK harus benar-benar ditegakkan saat PRAGMA foreign_keys ON.
func TestInventoryForeignKeysEnforced(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)

	applyOne(t, db, invMig, ".")
	if err := MigrateInventoryData(db); err != nil {
		t.Fatalf("MigrateInventoryData: %v", err)
	}
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		t.Fatal(err)
	}

	// asset dengan room_id yang tidak ada => ditolak
	if _, err := db.Exec(`INSERT INTO inventory_assets (id, name, room_id) VALUES ('a1','X','room-tidak-ada')`); err == nil {
		t.Error("FK tidak ditegakkan: aset dengan room_id palsu diterima")
	}
}
