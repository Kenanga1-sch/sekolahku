package repository

import (
	"database/sql"
	_ "modernc.org/sqlite"
	"testing"
)

func setupInventoryScopeTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db := setupInventorySchemaFromMigrations(t)

	if _, err := db.Exec(`
		INSERT INTO users (id, name, role) VALUES ('u-guru', 'Guru A', 'guru'), ('u-admin', 'Admin', 'admin');
		INSERT INTO inventory_rooms (id, name, pic_id) VALUES ('r-1', 'Kelas 1', 'u-guru'), ('r-2', 'Perpustakaan', 'u-guru-lain');
		INSERT INTO inventory_assets (id, name, room_id) VALUES ('a-1', 'Proyektor', 'r-1'), ('a-2', 'Laptop', 'r-2');
		INSERT INTO inventory_items (id, name, location, room_id) VALUES ('i-1', 'Spidol', 'Kelas 1', 'r-1'), ('i-2', 'Kertas A4', 'Gudang', NULL);
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	return db
}

// Guru PIC hanya scope ruangannya; admin bebas.
func TestResolveInventoryScope(t *testing.T) {
	db := setupInventoryScopeTestDB(t)
	defer db.Close()

	// Guru PIC Kelas 1
	scope, err := ResolveInventoryScope(db, "u-guru", "guru")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if scope.IsAdmin {
		t.Fatal("guru tidak boleh dianggap admin")
	}
	if !scope.IsPICOf("r-1") {
		t.Fatal("guru harus PIC r-1")
	}
	if scope.IsPICOf("r-2") {
		t.Fatal("guru bukan PIC r-2")
	}

	// Admin
	adminScope, err := ResolveInventoryScope(db, "u-admin", "admin")
	if err != nil {
		t.Fatalf("resolve admin: %v", err)
	}
	if !adminScope.IsAdmin || !adminScope.IsPICOf("r-1") || !adminScope.IsPICOf("r-2") {
		t.Fatal("admin harus punya akses semua ruangan")
	}
}

// Item di lokasi "Gudang" (bukan nama ruangan) = stok umum, semua PIC boleh.
func TestItemRoomID(t *testing.T) {
	db := setupInventoryScopeTestDB(t)
	defer db.Close()

	// item i-1 di "Kelas 1" -> room r-1
	roomID, err := ItemRoomID(db, "i-1")
	if err != nil || roomID != "r-1" {
		t.Fatalf("i-1 harus terikat r-1, got %q err=%v", roomID, err)
	}

	// item i-2 di "Gudang" -> tidak terikat ruangan
	roomID2, err := ItemRoomID(db, "i-2")
	if err != nil || roomID2 != "" {
		t.Fatalf("i-2 harus stok umum (\"\"), got %q err=%v", roomID2, err)
	}
}

// Aset ruangan lain tidak bisa diakses PIC.
func TestAssetRoomID(t *testing.T) {
	db := setupInventoryScopeTestDB(t)
	defer db.Close()

	roomID, err := AssetRoomID(db, "a-2")
	if err != nil || roomID != "r-2" {
		t.Fatalf("a-2 harus di r-2, got %q err=%v", roomID, err)
	}

	if _, err := AssetRoomID(db, "tidak-ada"); err == nil {
		t.Fatal("aset tidak ditemukan harus error")
	}
}
