-- 000079_library_catalog_indexes.up.sql
-- Pencarian ISBN & judul di katalog lokal sebelumnya scan tabel penuh.
CREATE INDEX IF NOT EXISTS idx_library_catalog_isbn ON library_catalog(isbn);
CREATE INDEX IF NOT EXISTS idx_library_assets_catalog ON library_assets(catalog_id);
CREATE INDEX IF NOT EXISTS idx_library_catalog_title_lower ON library_catalog(LOWER(TRIM(title)));
