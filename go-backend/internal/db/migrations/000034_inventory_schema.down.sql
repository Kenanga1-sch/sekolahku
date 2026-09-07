-- 000034: rollback skema inventaris
--
-- Mengembalikan ke bentuk tanpa FK / soft delete.
-- Data pada kolom soft delete (deleted_at) dan inventory_opname_items
-- akan hilang; ini sudah sepadan karena migrasi turun bersifat darurat.

DROP INDEX IF EXISTS idx_borrow_requests_requester;
DROP INDEX IF EXISTS idx_borrow_requests_asset;
DROP INDEX IF EXISTS idx_borrow_requests_status;
DROP TABLE IF EXISTS inventory_borrow_requests;
-- Dibuat ulang tanpa FK/returned_* (bentuk lama)
CREATE TABLE IF NOT EXISTS inventory_borrow_requests (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    requester_id TEXT NOT NULL,
    reason TEXT,
    quantity INTEGER DEFAULT 1 NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    approved_by TEXT,
    approved_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_inventory_borrow_status ON inventory_borrow_requests(status);

DROP INDEX IF EXISTS idx_inventory_audit_created;
DROP INDEX IF EXISTS idx_inventory_audit_entity;
DROP TABLE IF EXISTS inventory_audit;
CREATE TABLE IF NOT EXISTS inventory_audit (
    id TEXT PRIMARY KEY,
    action TEXT,
    entity TEXT,
    entity_id TEXT,
    changes TEXT,
    user_id TEXT,
    created_at INTEGER
);

DROP INDEX IF EXISTS idx_opname_items_asset;
DROP INDEX IF EXISTS idx_opname_items_opname;
DROP TABLE IF EXISTS inventory_opname_items;

DROP INDEX IF EXISTS idx_inventory_opname_deleted;
DROP INDEX IF EXISTS idx_inventory_opname_created;
DROP INDEX IF EXISTS idx_inventory_opname_status;
DROP INDEX IF EXISTS idx_inventory_opname_room;
DROP TABLE IF EXISTS inventory_opname;
CREATE TABLE IF NOT EXISTS inventory_opname (
    id TEXT PRIMARY KEY,
    date INTEGER,
    room_id TEXT,
    auditor_id TEXT,
    items TEXT,
    status TEXT DEFAULT 'PENDING',
    note TEXT,
    created_at INTEGER
);

DROP INDEX IF EXISTS idx_inventory_transactions_deleted;
DROP INDEX IF EXISTS idx_inventory_transactions_date;
DROP INDEX IF EXISTS idx_inventory_transactions_item;
DROP TABLE IF EXISTS inventory_transactions;
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    date INTEGER,
    description TEXT,
    recipient TEXT,
    proof_image TEXT,
    user_id TEXT,
    created_at INTEGER
);

DROP INDEX IF EXISTS idx_inventory_items_deleted;
DROP INDEX IF EXISTS idx_inventory_items_location;
DROP TABLE IF EXISTS inventory_items;
CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    category TEXT,
    unit TEXT,
    min_stock INTEGER DEFAULT 0,
    current_stock INTEGER DEFAULT 0,
    location TEXT,
    price INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
);

DROP INDEX IF EXISTS idx_inventory_assets_deleted;
DROP INDEX IF EXISTS idx_inventory_assets_category;
DROP INDEX IF EXISTS idx_inventory_assets_status;
DROP INDEX IF EXISTS idx_inventory_assets_room;
DROP TABLE IF EXISTS inventory_assets;
CREATE TABLE IF NOT EXISTS inventory_assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    category TEXT,
    price INTEGER DEFAULT 0,
    quantity INTEGER DEFAULT 0,
    room_id TEXT,
    condition_good INTEGER DEFAULT 0,
    condition_light_damaged INTEGER DEFAULT 0,
    condition_heavy_damaged INTEGER DEFAULT 0,
    condition_lost INTEGER DEFAULT 0,
    purchase_date INTEGER,
    notes TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at INTEGER,
    updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_inventory_assets_room ON inventory_assets(room_id);

DROP INDEX IF EXISTS idx_inventory_rooms_deleted;
DROP INDEX IF EXISTS idx_inventory_rooms_pic;
DROP TABLE IF EXISTS inventory_rooms;
CREATE TABLE IF NOT EXISTS inventory_rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    location TEXT,
    pic_id TEXT,
    created_at INTEGER,
    updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_inventory_rooms_pic ON inventory_rooms(pic_id);
