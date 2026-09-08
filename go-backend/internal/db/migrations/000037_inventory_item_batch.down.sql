-- 000037_inventory_item_batch.down.sql

DROP INDEX IF EXISTS idx_inventory_item_batches_item;
DROP INDEX IF EXISTS idx_inventory_item_units_batch;
DROP INDEX IF EXISTS idx_inventory_item_units_item_status;
DROP INDEX IF EXISTS idx_inventory_item_units_year_no;
DROP TABLE IF EXISTS inventory_item_units;
DROP TABLE IF EXISTS inventory_item_batches;
