-- 000037: pelacakan per unit untuk barang habis pakai
--
-- Latar belakang: penomoran label barang habis pakai sebelumnya dihitung dari
-- inventory_items.current_stock. Itu keliru, karena current_stock naik-turun:
--   beli 50 rim   -> cetak 1..50
--   beli lagi 20  -> current_stock 70, cetak ulang jadi 1..70 (1..50 sudah terlanjur ditempel)
--   terpakai 15   -> label "50/55" merujuk ke bungkus yang sudah tidak ada
-- Alhasil nomor tidak bisa dipakai untuk memeriksa kelengkapan fisik.
--
-- Kini setiap penerimaan barang (transaksi IN) membentuk satu batch, dan
-- setiap bungkus/unit fisik punya satu baris sendiri dengan nomor serta
-- statusnya. Nomor karena itu stabil selamanya: ia merujuk ke bungkus yang
-- sama, berapa pun stok berjalan.
--
-- Penomoran: lanjut terus antar batch dalam satu tahun, lalu mulai dari 1 lagi
-- saat tahun berganti (mengikuti tahun transaksi). Karena nomor berulang tiap
-- tahun, label wajib mencantumkan tahun.

CREATE TABLE IF NOT EXISTS inventory_item_batches (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES inventory_items(id),
    batch_code TEXT,
    year INTEGER NOT NULL,
    start_no INTEGER NOT NULL,
    end_no INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    funding_source TEXT,
    fiscal_year INTEGER,
    received_at INTEGER,
    description TEXT,
    transaction_id TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS inventory_item_units (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES inventory_items(id),
    batch_id TEXT REFERENCES inventory_item_batches(id),
    unit_no INTEGER NOT NULL,
    year INTEGER NOT NULL,
    -- AVAILABLE: masih di gudang. ISSUED: sudah keluar, issued_to mencatat
    -- ke mana. Barang yang keluar bisa dikembalikan menjadi AVAILABLE lagi
    -- lewat endpoint pengembalian.
    status TEXT NOT NULL DEFAULT 'AVAILABLE',
    issued_to TEXT,
    issued_at INTEGER,
    transaction_id TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

-- Kunci penomoran: satu nomor hanya boleh dipakai sekali per item per tahun.
-- Inilah yang mencegah nomor kembar bila dua staf mencatat penerimaan bersamaan.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_item_units_year_no
    ON inventory_item_units(item_id, year, unit_no)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_item_units_item_status
    ON inventory_item_units(item_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_item_units_batch
    ON inventory_item_units(batch_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_item_batches_item
    ON inventory_item_batches(item_id, year)
    WHERE deleted_at IS NULL;
