-- 000036: rollback kolom label cetak inventaris
--
-- SQLite mendukung DROP COLUMN sejak 3.35. Bila tidak, error "duplicate/no
-- such column" sudah ditoleransi runner migrasi.

DROP INDEX IF EXISTS idx_inventory_items_funding;
DROP INDEX IF EXISTS idx_inventory_assets_funding;

ALTER TABLE inventory_items DROP COLUMN photo_url;
ALTER TABLE inventory_items DROP COLUMN fiscal_year;
ALTER TABLE inventory_items DROP COLUMN funding_source;

ALTER TABLE inventory_assets DROP COLUMN photo_url;
ALTER TABLE inventory_assets DROP COLUMN fiscal_year;
ALTER TABLE inventory_assets DROP COLUMN funding_source;
