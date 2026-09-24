-- ============================================================
-- 000062: Cloud Storage — fitur lanjutan.
--   is_starred   : penanda favorit per user.
--   accessed_at  : waktu akses terakhir (dipakai view "Terbaru"/"Sering diakses").
--   sort_order   : urutan manual dalam satu folder (drag untuk menyusun).
--   share_kind   : jenis item yang dibagikan ("file" | "folder").
-- ============================================================

ALTER TABLE cloud_files ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cloud_files ADD COLUMN accessed_at INTEGER;
ALTER TABLE cloud_files ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cloud_files ADD COLUMN share_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_cloud_files_owner_starred ON cloud_files(owner_id, is_starred);
CREATE INDEX IF NOT EXISTS idx_cloud_files_owner_accessed ON cloud_files(owner_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_files_owner_parent_order ON cloud_files(owner_id, parent_id, sort_order);
