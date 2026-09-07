-- 000034: Skema inventaris yang bisa dirawat
--
-- Latar belakang: ketujuh tabel inventaris sebelumnya dibuat dengan
-- CREATE TABLE IF NOT EXISTS di cmd/api/database.go, yang dieksekusi SETELAH
-- RunMigrations (baris 74 vs 245). Akibatnya:
--   1. Tidak ada jalur migrasi — mustahil menambah kolom ke tabel inventaris,
--      karena IF NOT EXISTS itu no-op di tabel yang sudah ada.
--   2. Tidak ada foreign key, tidak ada soft delete, hampir tidak ada index.
--
-- Migrasi ini memindahkan DDL inventaris ke sistem migrasi, menambahkan
-- foreign key + soft delete + index, dan mengganti kolom JSON
-- inventory_opname.items dengan tabel relasional inventory_opname_items.
--
-- Catatan SQLite: FK tidak bisa ditambahkan ke tabel yang sudah ada.
-- Maka dipakai pola rebuild: buat tabel baru (_new) -> salin -> drop -> rename.
-- PRAGMA foreign_keys default-nya OFF di sesi ini (baris dinyalakan di
-- database.go setelah migrasi), jadi DROP TABLE aman.

-- ============================================================
-- inventory_rooms
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_rooms_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    location TEXT,
    pic_id TEXT,
    deleted_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER
);


-- Salin data + drop + rename dilakukan di Go (MigrateInventoryData).

-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_rooms_pic ON inventory_rooms(pic_id);
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_rooms_deleted ON inventory_rooms(deleted_at);

-- ============================================================
-- inventory_assets
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_assets_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    category TEXT,
    price INTEGER DEFAULT 0,
    quantity INTEGER DEFAULT 0,
    room_id TEXT REFERENCES inventory_rooms(id),
    condition_good INTEGER DEFAULT 0,
    condition_light_damaged INTEGER DEFAULT 0,
    condition_heavy_damaged INTEGER DEFAULT 0,
    condition_lost INTEGER DEFAULT 0,
    purchase_date INTEGER,
    notes TEXT,
    status TEXT DEFAULT 'ACTIVE',
    deleted_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER
);


-- Salin data + drop + rename dilakukan di Go (MigrateInventoryData).

-- Index jalur panas: filter status dipakai hampir semua agregat
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_assets_room ON inventory_assets(room_id);
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_assets_status ON inventory_assets(status);
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_assets_category ON inventory_assets(category);
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_assets_deleted ON inventory_assets(deleted_at);

-- ============================================================
-- inventory_items (barang habis pakai / ATK)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    category TEXT,
    unit TEXT,
    min_stock INTEGER DEFAULT 0,
    current_stock INTEGER DEFAULT 0,
    location TEXT,
    price INTEGER DEFAULT 0,
    deleted_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER
);


-- Salin data + drop + rename dilakukan di Go (MigrateInventoryData).

-- location dipakai oleh ItemRoomID untuk resolusi scope
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_items_location ON inventory_items(location);
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_items_deleted ON inventory_items(deleted_at);

-- ============================================================
-- inventory_transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_transactions_new (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES inventory_items(id),
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    date INTEGER,
    description TEXT,
    recipient TEXT,
    proof_image TEXT,
    user_id TEXT,
    deleted_at INTEGER,
    created_at INTEGER
);


-- Salin data + drop + rename dilakukan di Go (MigrateInventoryData).

-- GetTransactions memfilter item_id; GetItemByID memanggilnya per item
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id);
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(date);
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_transactions_deleted ON inventory_transactions(deleted_at);

-- ============================================================
-- inventory_opname (sesi stock take)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_opname_new (
    id TEXT PRIMARY KEY,
    date INTEGER,
    room_id TEXT REFERENCES inventory_rooms(id),
    auditor_id TEXT,
    status TEXT DEFAULT 'PENDING',
    note TEXT,
    deleted_at INTEGER,
    created_at INTEGER
);


-- Salin data + drop + rename dilakukan di Go (MigrateInventoryData).

-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_opname_room ON inventory_opname(room_id);
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_opname_status ON inventory_opname(status);
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_opname_created ON inventory_opname(created_at DESC);
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_opname_deleted ON inventory_opname(deleted_at);

-- ============================================================
-- inventory_opname_items (baris hasil hitung — pengganti kolom JSON)
--
-- system_* = angka menurut sistem saat opname dibuat
-- counted_* = angka hasil hitung fisik
-- Selisih (counted - system) kini tersimpan permanen. Sebelumnya kolom JSON
-- hanya berisi angka hasil hitung, jadi bukti selisih hilang setelah apply.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_opname_items (
    id TEXT PRIMARY KEY,
    opname_id TEXT NOT NULL REFERENCES inventory_opname(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES inventory_assets(id),
    system_quantity INTEGER DEFAULT 0,
    system_good INTEGER DEFAULT 0,
    system_light_damaged INTEGER DEFAULT 0,
    system_heavy_damaged INTEGER DEFAULT 0,
    system_lost INTEGER DEFAULT 0,
    counted_good INTEGER DEFAULT 0,
    counted_light_damaged INTEGER DEFAULT 0,
    counted_heavy_damaged INTEGER DEFAULT 0,
    counted_lost INTEGER DEFAULT 0,
    note TEXT,
    created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_opname_items_opname ON inventory_opname_items(opname_id);
CREATE INDEX IF NOT EXISTS idx_opname_items_asset ON inventory_opname_items(asset_id);

-- Migrasi DATA (bukan DDL) ditangani di kode Go:
-- internal/db/migrations/inventory_migrate.go -> migrateInventoryData().
-- Alasan: SQLite harus bisa me-resolve nama tabel saat parse, sehingga
-- INSERT ... SELECT dari tabel lama yang belum tentu ada tidak bisa ditulis
-- aman di SQL statis (klausa WHERE EXISTS tidak menolong).

-- ============================================================
-- inventory_audit
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_audit_new (
    id TEXT PRIMARY KEY,
    action TEXT,
    entity TEXT,
    entity_id TEXT,
    changes TEXT,
    user_id TEXT,
    created_at INTEGER
);


-- Salin data + drop + rename dilakukan di Go (MigrateInventoryData).

-- GetRecentAudit dan GetAuditLogs mengurutkan berdasarkan created_at
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_audit_created ON inventory_audit(created_at DESC);
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_inventory_audit_entity ON inventory_audit(entity, entity_id);

-- ============================================================
-- inventory_borrow_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_borrow_requests_new (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES inventory_assets(id),
    room_id TEXT NOT NULL REFERENCES inventory_rooms(id),
    requester_id TEXT NOT NULL,
    reason TEXT,
    quantity INTEGER DEFAULT 1 NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    approved_by TEXT,
    approved_at INTEGER,
    returned_at INTEGER,
    returned_by TEXT,
    created_at INTEGER,
    updated_at INTEGER
);


-- Salin data + drop + rename dilakukan di Go (MigrateInventoryData).

-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_borrow_requests_status ON inventory_borrow_requests(status);
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_borrow_requests_asset ON inventory_borrow_requests(asset_id);
-- [dipindah ke Go] CREATE INDEX IF NOT EXISTS idx_borrow_requests_requester ON inventory_borrow_requests(requester_id);
