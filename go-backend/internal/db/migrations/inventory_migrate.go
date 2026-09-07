package migrations

import (
	"database/sql"
	"encoding/json"
	"log"

	"github.com/nrednav/cuid2"
	_ "modernc.org/sqlite"
)

// newInventoryID menghasilkan ID baru dengan pola yang sama dipakai repository
// inventaris (cuid2), supaya ID baris hasil migrasi seragam dengan yang lain.
func newInventoryID() string {
	return cuid2.Generate()
}

// inventoryTableCopy mendeskripsikan pemindahan data dari tabel lama ke tabel
// "_new" yang dibuat migrasi 000034, lalu mengganti namanya.
//
// Kenapa tidak dilakukan di SQL saja: SQLite harus bisa me-resolve nama tabel
// pada saat parse. Jadi `INSERT INTO x_new SELECT ... FROM x WHERE EXISTS
// (SELECT 1 FROM sqlite_master ...)` tetap gagal ketika x belum ada — klausa
// EXISTS baru dievaluasi setelah parse berhasil. Maka pengecekan dilakukan di
// Go, dan pernyataan SQL-nya baru disusun setelah kita tahu tabelnya ada.
type inventoryTableCopy struct {
	table    string
	oldCols  string
	scanCols string
	// nama kolom lama yang dipakai untuk INSERT; urutan harus sama dengan oldCols
	insertCols string
}

var inventoryCopies = []inventoryTableCopy{
	{
		table:      "inventory_rooms",
		insertCols: "id, name, code, description, location, pic_id, created_at, updated_at",
		oldCols:    "id, name, code, description, location, pic_id, created_at, updated_at",
		scanCols:   "id, name, code, description, location, pic_id, created_at, updated_at",
	},
	{
		table:      "inventory_assets",
		insertCols: "id, name, code, category, price, quantity, room_id, condition_good, condition_light_damaged, condition_heavy_damaged, condition_lost, purchase_date, notes, status, created_at, updated_at",
		oldCols:    "id, name, code, category, price, quantity, room_id, condition_good, condition_light_damaged, condition_heavy_damaged, condition_lost, purchase_date, notes, status, created_at, updated_at",
		scanCols:   "id, name, code, category, price, quantity, room_id, condition_good, condition_light_damaged, condition_heavy_damaged, condition_lost, purchase_date, notes, status, created_at, updated_at",
	},
	{
		table:      "inventory_items",
		insertCols: "id, name, code, category, unit, min_stock, current_stock, location, price, created_at, updated_at",
		oldCols:    "id, name, code, category, unit, min_stock, current_stock, location, price, created_at, updated_at",
		scanCols:   "id, name, code, category, unit, min_stock, current_stock, location, price, created_at, updated_at",
	},
	{
		table:      "inventory_transactions",
		insertCols: "id, item_id, type, quantity, date, description, recipient, proof_image, user_id, created_at",
		oldCols:    "id, item_id, type, quantity, date, description, recipient, proof_image, user_id, created_at",
		scanCols:   "id, item_id, type, quantity, date, description, recipient, proof_image, user_id, created_at",
	},
	{
		table:      "inventory_opname",
		insertCols: "id, date, room_id, auditor_id, status, note, created_at",
		oldCols:    "id, date, room_id, auditor_id, status, note, created_at",
		scanCols:   "id, date, room_id, auditor_id, status, note, created_at",
	},
	{
		table:      "inventory_audit",
		insertCols: "id, action, entity, entity_id, changes, user_id, created_at",
		oldCols:    "id, action, entity, entity_id, changes, user_id, created_at",
		scanCols:   "id, action, entity, entity_id, changes, user_id, created_at",
	},
	{
		table:      "inventory_borrow_requests",
		insertCols: "id, asset_id, room_id, requester_id, reason, quantity, status, approved_by, approved_at, created_at, updated_at",
		oldCols:    "id, asset_id, room_id, requester_id, reason, quantity, status, approved_by, approved_at, created_at, updated_at",
		scanCols:   "id, asset_id, room_id, requester_id, reason, quantity, status, approved_by, approved_at, created_at, updated_at",
	},
}

// Index inventaris. Sengaja dibuat di Go, bukan di file .up.sql, karena
// pembuatannya harus terjadi setelah tabel selesai di-rename.
var inventoryIndexes = []string{
	"CREATE INDEX IF NOT EXISTS idx_inventory_rooms_pic ON inventory_rooms(pic_id)",
	"CREATE INDEX IF NOT EXISTS idx_inventory_rooms_deleted ON inventory_rooms(deleted_at)",

	"CREATE INDEX IF NOT EXISTS idx_inventory_assets_room ON inventory_assets(room_id)",
	"CREATE INDEX IF NOT EXISTS idx_inventory_assets_status ON inventory_assets(status)",
	"CREATE INDEX IF NOT EXISTS idx_inventory_assets_category ON inventory_assets(category)",
	"CREATE INDEX IF NOT EXISTS idx_inventory_assets_deleted ON inventory_assets(deleted_at)",

	"CREATE INDEX IF NOT EXISTS idx_inventory_items_location ON inventory_items(location)",
	"CREATE INDEX IF NOT EXISTS idx_inventory_items_deleted ON inventory_items(deleted_at)",

	"CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id)",
	"CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(date)",
	"CREATE INDEX IF NOT EXISTS idx_inventory_transactions_deleted ON inventory_transactions(deleted_at)",

	"CREATE INDEX IF NOT EXISTS idx_inventory_opname_room ON inventory_opname(room_id)",
	"CREATE INDEX IF NOT EXISTS idx_inventory_opname_status ON inventory_opname(status)",
	"CREATE INDEX IF NOT EXISTS idx_inventory_opname_created ON inventory_opname(created_at DESC)",
	"CREATE INDEX IF NOT EXISTS idx_inventory_opname_deleted ON inventory_opname(deleted_at)",

	"CREATE INDEX IF NOT EXISTS idx_inventory_audit_created ON inventory_audit(created_at DESC)",
	"CREATE INDEX IF NOT EXISTS idx_inventory_audit_entity ON inventory_audit(entity, entity_id)",

	"CREATE INDEX IF NOT EXISTS idx_borrow_requests_status ON inventory_borrow_requests(status)",
	"CREATE INDEX IF NOT EXISTS idx_borrow_requests_asset ON inventory_borrow_requests(asset_id)",
	"CREATE INDEX IF NOT EXISTS idx_borrow_requests_requester ON inventory_borrow_requests(requester_id)",
}

func createInventoryIndexes(db *sql.DB) error {
	for _, stmt := range inventoryIndexes {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

func tableExists(db *sql.DB, name string) bool {
	var n string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name=?", name).Scan(&n)
	return err == nil
}

func columnExists(db *sql.DB, table, column string) bool {
	var n string
	err := db.QueryRow("SELECT name FROM pragma_table_info(?) WHERE name=?", table, column).Scan(&n)
	return err == nil
}

// MigrateInventoryData menyalin data dari tabel inventaris bentuk lama ke tabel
// "_new" hasil migrasi 000034, mengganti namanya, lalu memindahkan baris
// opname yang masih berupa kolom JSON ke tabel inventory_opname_items.
//
// Aman dijalankan berulang: bila tabel "_new" tidak ada (migrasi sudah pernah
// selesai), fungsi langsung kembali.
func MigrateInventoryData(db *sql.DB) error {
	// Kolom items dihapus oleh rebuild, jadi catat dulu apakah tabel opname
	// bentuk lama (yang masih menyimpan baris sebagai JSON) pernah ada.
	// Ambil baris JSON lebih dulu, karena rebuild akan menghapus kolom items.
	legacyOpnameRows, err := collectLegacyOpnameJSON(db)
	if err != nil {
		return err
	}

	for _, c := range inventoryCopies {
		newTable := c.table + "_new"
		if !tableExists(db, newTable) {
			// Migrasi 000034 belum jalan atau sudah selesai.
			continue
		}

		// Salin hanya bila tabel lama ada (bukan DB baru yang kosong).
		if tableExists(db, c.table) {
			stmt := "INSERT OR IGNORE INTO " + newTable + " (" + c.insertCols + ") SELECT " + c.oldCols + " FROM " + c.table
			if _, err := db.Exec(stmt); err != nil {
				return err
			}
		}

		if _, err := db.Exec("DROP TABLE IF EXISTS " + c.table); err != nil {
			return err
		}
		if _, err := db.Exec("ALTER TABLE " + newTable + " RENAME TO " + c.table); err != nil {
			return err
		}
	}

	// Index dibuat SETELAH rename, karena sebelumnya merujuk nama tabel lama.
	if err := createInventoryIndexes(db); err != nil {
		return err
	}

	if len(legacyOpnameRows) > 0 {
		if err := insertOpnameItems(db, legacyOpnameRows); err != nil {
			return err
		}
	}
	return nil
}

// legacyOpnameItem meniru bentuk lama baris opname di kolom JSON:
// {id|assetId, qtyGood, qtyLightDamage, qtyHeavyDamage, qtyLost, systemQty}
type legacyOpnameItem struct {
	ID             string `json:"id"`
	AssetID        string `json:"assetId"`
	QtyGood        int    `json:"qtyGood"`
	QtyLightDamage int    `json:"qtyLightDamage"`
	QtyHeavyDamage int    `json:"qtyHeavyDamage"`
	QtyLost        int    `json:"qtyLost"`
	SystemQty      int    `json:"systemQty"`
}

// opnameJSONRow adalah baris opname bentuk lama: baris hasil hitung tersimpan
// sebagai JSON di kolom `items`.
type opnameJSONRow struct {
	id       string
	items    string
	createAt sql.NullInt64
}

// collectLegacyOpnameJSON membaca baris opname lama SEBELUM rebuild menghapus
// kolom items. Mengembalikan slice kosong bila tabel/kolomnya tidak ada.
func collectLegacyOpnameJSON(db *sql.DB) ([]opnameJSONRow, error) {
	if !tableExists(db, "inventory_opname") || !columnExists(db, "inventory_opname", "items") {
		return nil, nil
	}

	rows, err := db.Query("SELECT id, items, created_at FROM inventory_opname WHERE items IS NOT NULL AND items != '' AND items != 'null'")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []opnameJSONRow
	for rows.Next() {
		var r opnameJSONRow
		if err := rows.Scan(&r.id, &r.items, &r.createAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// insertOpnameItems memindahkan baris hasil hitung dari JSON ke tabel relasional.
func insertOpnameItems(db *sql.DB, rows []opnameJSONRow) error {
	if !tableExists(db, "inventory_opname_items") {
		return nil
	}
	for _, r := range rows {
		var parsed []legacyOpnameItem
		if err := json.Unmarshal([]byte(r.items), &parsed); err != nil {
			log.Printf("Warning: opname %s punya items JSON rusak, dilewati: %v", r.id, err)
			continue
		}
		for _, it := range parsed {
			assetID := it.ID
			if assetID == "" {
				assetID = it.AssetID
			}
			if assetID == "" {
				continue
			}
			_, err := db.Exec(`
				INSERT INTO inventory_opname_items (
					id, opname_id, asset_id,
					system_quantity, system_good,
					counted_good, counted_light_damaged, counted_heavy_damaged, counted_lost,
					created_at
				) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
			`, newInventoryID(), r.id, assetID,
				it.SystemQty,
				it.QtyGood, it.QtyLightDamage, it.QtyHeavyDamage, it.QtyLost,
				r.createAt)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
