-- 000036: Kolom pendukung label cetak inventaris
--
-- Label fisik memuat "Inventaris <sumber dana> <tahun>", urutan unit "21/30",
-- dan QR ke halaman detail publik. Ketiganya butuh data yang belum ada:
--
--   funding_source : sumber dana (BOSP Reguler, BOSP Kinerja, APBD, ...)
--                    Tidak ada padanannya di seluruh kode sebelum migrasi ini.
--   fiscal_year    : tahun anggaran (tahun KALENDER), bukan tahun ajaran.
--                    purchase_date tidak bisa dipakai sebagai pengganti:
--                    kolomnya opsional (banyak aset kosong) dan tanggal beli
--                    tidak selalu sama dengan tahun penganggaran.
--   photo_url      : foto opsional untuk halaman detail publik.
--
-- Ketiganya nullable, sehingga data lama tetap valid dan pengisian bisa
-- bertahap. Ditambahkan ke DUA tabel karena label berlaku untuk aset tetap
-- maupun barang habis pakai.

ALTER TABLE inventory_assets ADD COLUMN funding_source TEXT;
ALTER TABLE inventory_assets ADD COLUMN fiscal_year    INTEGER;
ALTER TABLE inventory_assets ADD COLUMN photo_url      TEXT;

ALTER TABLE inventory_items ADD COLUMN funding_source TEXT;
ALTER TABLE inventory_items ADD COLUMN fiscal_year    INTEGER;
ALTER TABLE inventory_items ADD COLUMN photo_url      TEXT;

-- Halaman cetak dan laporan menyaring per kelompok sumber dana + tahun.
CREATE INDEX IF NOT EXISTS idx_inventory_assets_funding ON inventory_assets(funding_source, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_inventory_items_funding  ON inventory_items(funding_source, fiscal_year);
