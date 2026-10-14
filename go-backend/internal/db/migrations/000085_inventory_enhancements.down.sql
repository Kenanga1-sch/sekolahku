-- 000085: rollback peningkatan modul inventaris.
--
-- SQLite mendukung DROP COLUMN sejak 3.35; bila tidak, runner migrasi sudah
-- menoleransi error "no such column".

DROP INDEX IF EXISTS idx_inventory_categories_deleted;
DROP INDEX IF EXISTS idx_inventory_categories_kind;
DROP TABLE IF EXISTS inventory_categories;

ALTER TABLE inventory_transactions DROP COLUMN invoice_no;
ALTER TABLE inventory_transactions DROP COLUMN supplier;

ALTER TABLE inventory_items DROP COLUMN acquisition_type;
ALTER TABLE inventory_items DROP COLUMN model;
ALTER TABLE inventory_items DROP COLUMN brand;
ALTER TABLE inventory_items DROP COLUMN serial_number;
ALTER TABLE inventory_items DROP COLUMN invoice_no;
ALTER TABLE inventory_items DROP COLUMN supplier;

ALTER TABLE inventory_assets DROP COLUMN acquisition_type;
ALTER TABLE inventory_assets DROP COLUMN model;
ALTER TABLE inventory_assets DROP COLUMN brand;
ALTER TABLE inventory_assets DROP COLUMN serial_number;
ALTER TABLE inventory_assets DROP COLUMN invoice_no;
ALTER TABLE inventory_assets DROP COLUMN supplier;
