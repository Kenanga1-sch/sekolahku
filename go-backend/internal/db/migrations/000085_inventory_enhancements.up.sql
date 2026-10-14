-- 000085: Peningkatan modul inventaris (data perolehan, kategori terkelola,
-- kode inventaris otomatis).
--
-- Latar belakang: form "Tambah Aset" & "Tambah Barang" sebelumnya tidak bisa
-- mencatat siapa penyedia, nomor nota/faktur, nomor seri, maupun merk/tipe
-- barang — padahal administrasi inventaris sekolah (KIB) membutuhkannya untuk
-- jejak audit pembelian. Selain itu kategori masih konstanta hardcoded di
-- frontend, sehingga admin tidak bisa menambah/mengubah kategori sendiri.
-- Terakhir, kode inventaris diisi manual sehingga rawan salah tulis/duplikat.
--
-- Perubahan:
--   1. inventory_assets  → kolom data perolehan (semua nullable)
--   2. inventory_items   → kolom data perolehan (semua nullable)
--   3. inventory_transactions → kolom penyedia & nomor nota
--   4. inventory_categories   → tabel kategori terkelola (punya code_prefix)
--   5. Seed kategori awal dari konstanta lama, agar UI langsung berfungsi
--
-- Semua kolom baru nullable sehingga baris lama tetap valid tanpa backfill.

-- ============================================================
-- 1. inventory_assets: data perolehan
-- ============================================================
ALTER TABLE inventory_assets ADD COLUMN supplier         TEXT; -- nama penyedia/toko
ALTER TABLE inventory_assets ADD COLUMN invoice_no       TEXT; -- nomor nota/faktur/bukti
ALTER TABLE inventory_assets ADD COLUMN serial_number    TEXT; -- nomor seri/rangka/IMEI
ALTER TABLE inventory_assets ADD COLUMN brand            TEXT; -- merk
ALTER TABLE inventory_assets ADD COLUMN model            TEXT; -- tipe/model
ALTER TABLE inventory_assets ADD COLUMN acquisition_type TEXT; -- cara perolehan (enum teks)

-- ============================================================
-- 2. inventory_items: data perolehan
-- ============================================================
ALTER TABLE inventory_items ADD COLUMN supplier         TEXT;
ALTER TABLE inventory_items ADD COLUMN invoice_no       TEXT;
ALTER TABLE inventory_items ADD COLUMN serial_number    TEXT;
ALTER TABLE inventory_items ADD COLUMN brand            TEXT;
ALTER TABLE inventory_items ADD COLUMN model            TEXT;
ALTER TABLE inventory_items ADD COLUMN acquisition_type TEXT;

-- ============================================================
-- 3. inventory_transactions: penyedia & nota pada mutasi masuk
-- ============================================================
ALTER TABLE inventory_transactions ADD COLUMN supplier   TEXT;
ALTER TABLE inventory_transactions ADD COLUMN invoice_no TEXT;

-- ============================================================
-- 4. Tabel kategori terkelola
--
-- kind        : 'ASSET' (aset tetap) | 'ITEM' (habis pakai) | 'BOTH'
-- code_prefix : awalan kode inventaris otomatis, mis. "BK" untuk Buku.
--               Boleh kosong; penomoran otomatis memakai fallback bila kosong.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    code_prefix TEXT,
    kind        TEXT NOT NULL DEFAULT 'ASSET',
    sort_order  INTEGER DEFAULT 0,
    deleted_at  INTEGER,
    created_at  INTEGER,
    updated_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_inventory_categories_kind ON inventory_categories(kind);
CREATE INDEX IF NOT EXISTS idx_inventory_categories_deleted ON inventory_categories(deleted_at);

-- ============================================================
-- 5. Seed kategori awal (dari konstanta lama frontend).
--
-- Dipakai id tetap supaya idempoten; WHERE NOT EXISTS mencegah duplikat bila
-- migrasi ini terulang. code_prefix disusun dari singkatan nama.
-- ============================================================
-- Kategori aset tetap (kind ASSET)
INSERT INTO inventory_categories (id, name, code_prefix, kind, sort_order, created_at, updated_at)
SELECT 'cat_asset_elektronik', 'Elektronik', 'EL', 'ASSET', 10, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE id = 'cat_asset_elektronik');

INSERT INTO inventory_categories (id, name, code_prefix, kind, sort_order, created_at, updated_at)
SELECT 'cat_asset_furniture', 'Furniture', 'FR', 'ASSET', 20, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE id = 'cat_asset_furniture');

INSERT INTO inventory_categories (id, name, code_prefix, kind, sort_order, created_at, updated_at)
SELECT 'cat_asset_alat_tulis', 'Alat Tulis', 'AT', 'ASSET', 30, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE id = 'cat_asset_alat_tulis');

INSERT INTO inventory_categories (id, name, code_prefix, kind, sort_order, created_at, updated_at)
SELECT 'cat_asset_buku', 'Buku', 'BK', 'ASSET', 40, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE id = 'cat_asset_buku');

INSERT INTO inventory_categories (id, name, code_prefix, kind, sort_order, created_at, updated_at)
SELECT 'cat_asset_kendaraan', 'Kendaraan', 'KD', 'ASSET', 50, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE id = 'cat_asset_kendaraan');

INSERT INTO inventory_categories (id, name, code_prefix, kind, sort_order, created_at, updated_at)
SELECT 'cat_asset_lainnya', 'Lainnya', 'LN', 'ASSET', 90, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE id = 'cat_asset_lainnya');

-- Kategori barang habis pakai (kind ITEM)
INSERT INTO inventory_categories (id, name, code_prefix, kind, sort_order, created_at, updated_at)
SELECT 'cat_item_atk', 'Alat Tulis Kantor', 'ATK', 'ITEM', 10, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE id = 'cat_item_atk');

INSERT INTO inventory_categories (id, name, code_prefix, kind, sort_order, created_at, updated_at)
SELECT 'cat_item_art', 'Rumah Tangga', 'ART', 'ITEM', 20, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE id = 'cat_item_art');

INSERT INTO inventory_categories (id, name, code_prefix, kind, sort_order, created_at, updated_at)
SELECT 'cat_item_kebersihan', 'Alat Kebersihan', 'KB', 'ITEM', 30, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE id = 'cat_item_kebersihan');

INSERT INTO inventory_categories (id, name, code_prefix, kind, sort_order, created_at, updated_at)
SELECT 'cat_item_elektronik', 'Elektronik (Habis Pakai)', 'ELH', 'ITEM', 40, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE id = 'cat_item_elektronik');

INSERT INTO inventory_categories (id, name, code_prefix, kind, sort_order, created_at, updated_at)
SELECT 'cat_item_lainnya', 'Lainnya', 'LN', 'ITEM', 90, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE id = 'cat_item_lainnya');
