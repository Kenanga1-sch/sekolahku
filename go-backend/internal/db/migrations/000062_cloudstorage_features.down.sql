DROP INDEX IF EXISTS idx_cloud_files_owner_parent_order;
DROP INDEX IF EXISTS idx_cloud_files_owner_accessed;
DROP INDEX IF EXISTS idx_cloud_files_owner_starred;

-- SQLite mendukung DROP COLUMN sejak 3.35 (modernc/sqlite & go-sqlite3 modern).
ALTER TABLE cloud_files DROP COLUMN share_kind;
ALTER TABLE cloud_files DROP COLUMN sort_order;
ALTER TABLE cloud_files DROP COLUMN accessed_at;
ALTER TABLE cloud_files DROP COLUMN is_starred;
