-- 000083_keuangan_units.up.sql
-- Modul "Keuangan" (buku besar generik multi-unit usaha).
-- Dirancang untuk mencatat SEGALA jenis keuangan sekolah: unit sampah plastik,
-- koperasi, kantin, dan lain-lain. Inti generiknya: Unit Usaha → Kategori →
-- Transaksi → Saldo. Kasus pertama (sampah plastik) hanyalah sebuah unit usaha
-- dengan kategori bawaan, BUKAN tabel terpisah.
--
-- Modul ini BERDIRI SENDIRI: tidak menyentuh brankas/kas pada modul tabungan.
-- Saldo tiap unit = SUM(amount direction='in') - SUM(amount direction='out').
-- Uang disimpan sebagai INTEGER Rupiah (tanpa desimal), konsisten dgn tabungan.

-- 1) Unit usaha. code dipakai di URL (/keuangan/unit/:code).
CREATE TABLE IF NOT EXISTS unit_finance_units (
    id          TEXT PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,            -- slug unik, mis. 'sampah-plastik'
    name        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'generic', -- generic|sampah|koperasi|kantin|lainnya
    description TEXT NOT NULL DEFAULT '',
    icon        TEXT NOT NULL DEFAULT 'wallet',  -- nama ikon lucide (untuk UI)
    color       TEXT NOT NULL DEFAULT '',        -- hex opsional untuk penanda UI
    is_active   INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_unit_finance_units_active ON unit_finance_units(is_active, sort_order);

-- 2) Kategori pemasukan/pengeluaran. Satu kategori milik satu unit.
CREATE TABLE IF NOT EXISTS unit_finance_categories (
    id         TEXT PRIMARY KEY,
    unit_id    TEXT NOT NULL REFERENCES unit_finance_units(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    direction  TEXT NOT NULL DEFAULT 'in',       -- in|out
    is_active  INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_unit_finance_categories_unit ON unit_finance_categories(unit_id, direction, sort_order);

-- 3) Buku besar transaksi. Satu transaksi = satu baris.
--    Field sampah (kg, harga/kg, jenis sampah) disimpan sebagai kolom opsional
--    + metadata JSON, sehingga skema yang sama melayani semua jenis unit.
CREATE TABLE IF NOT EXISTS unit_finance_transactions (
    id              TEXT PRIMARY KEY,
    unit_id         TEXT NOT NULL REFERENCES unit_finance_units(id) ON DELETE CASCADE,
    category_id     TEXT REFERENCES unit_finance_categories(id) ON DELETE SET NULL,
    direction       TEXT NOT NULL,               -- in|out
    amount          INTEGER NOT NULL DEFAULT 0,  -- Rupiah (total)
    description     TEXT NOT NULL DEFAULT '',
    tx_date         INTEGER NOT NULL,            -- epoch ms tanggal transaksi
    party           TEXT NOT NULL DEFAULT '',    -- pengepul/pembeli/vendor
    quantity        REAL,                        -- mis. berat kg (nullable)
    unit_price      INTEGER,                     -- mis. harga per kg (nullable)
    reference       TEXT NOT NULL DEFAULT '',    -- no. nota opsional
    metadata        TEXT NOT NULL DEFAULT '',    -- JSON bebas (mis. {jenisSampah:"Sampah Plastik"})
    created_by      TEXT,
    created_by_name TEXT NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_unit_finance_tx_unit_date ON unit_finance_transactions(unit_id, tx_date);
CREATE INDEX IF NOT EXISTS idx_unit_finance_tx_category ON unit_finance_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_unit_finance_tx_direction ON unit_finance_transactions(direction, tx_date);

-- 4) Audit trail (append-only): siapa melakukan apa, kapan, nilai sebelum/sesudah.
CREATE TABLE IF NOT EXISTS unit_finance_audit_log (
    id         TEXT PRIMARY KEY,
    entity     TEXT NOT NULL,                    -- unit|category|transaction
    entity_id  TEXT NOT NULL,
    action     TEXT NOT NULL,                    -- create|update|delete
    actor_id   TEXT,
    actor_name TEXT NOT NULL DEFAULT '',
    before     TEXT NOT NULL DEFAULT '',         -- JSON snapshot
    after      TEXT NOT NULL DEFAULT '',         -- JSON snapshot
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_unit_finance_audit_entity ON unit_finance_audit_log(entity, entity_id, created_at);

-- 5) Seed unit usaha pertama: Sampah Plastik beserta kategorinya.
--    Saat dijual ke pengepul, seluruh sampah plastik dinyatakan sebagai satu
--    jenis "Sampah Plastik" (bukan dipecah per jenis plastik).
INSERT INTO unit_finance_units (id, code, name, type, description, icon, color, sort_order)
SELECT 'unit_sampah_plastik', 'sampah-plastik', 'Sampah Plastik', 'sampah',
       'Pengelolaan sampah plastik yang dijual ke pengepul', 'recycle', '#16a34a', 1
WHERE NOT EXISTS (SELECT 1 FROM unit_finance_units WHERE code = 'sampah-plastik');

INSERT INTO unit_finance_categories (id, unit_id, name, direction, sort_order)
SELECT 'cat_sampah_jual', 'unit_sampah_plastik', 'Penjualan Sampah Plastik', 'in', 1
WHERE NOT EXISTS (SELECT 1 FROM unit_finance_categories WHERE id = 'cat_sampah_jual');

INSERT INTO unit_finance_categories (id, unit_id, name, direction, sort_order)
SELECT 'cat_sampah_beli_alat', 'unit_sampah_plastik', 'Pembelian Alat & Perlengkapan', 'out', 2
WHERE NOT EXISTS (SELECT 1 FROM unit_finance_categories WHERE id = 'cat_sampah_beli_alat');

INSERT INTO unit_finance_categories (id, unit_id, name, direction, sort_order)
SELECT 'cat_sampah_operasional', 'unit_sampah_plastik', 'Biaya Operasional', 'out', 3
WHERE NOT EXISTS (SELECT 1 FROM unit_finance_categories WHERE id = 'cat_sampah_operasional');
