-- ============================================================
-- 000061: Cloud Storage — metadata file/folder per-user.
-- Backend penyimpanan sebenarnya: Telegram Bot API lokal (file_id/message_id).
-- ============================================================

CREATE TABLE IF NOT EXISTS cloud_files (
    id                TEXT PRIMARY KEY,
    owner_id          TEXT NOT NULL,
    name              TEXT NOT NULL,
    parent_id         TEXT,                      -- NULL = root milik owner
    is_folder         INTEGER NOT NULL DEFAULT 0,
    file_id           TEXT,                      -- Telegram file_id (NULL utk folder)
    message_id        INTEGER,                   -- Telegram message_id
    mime_type         TEXT,
    size              INTEGER NOT NULL DEFAULT 0,
    encrypted         INTEGER NOT NULL DEFAULT 0,
    created_at        INTEGER NOT NULL DEFAULT 0,
    updated_at        INTEGER NOT NULL DEFAULT 0,
    deleted_at        INTEGER,                   -- soft delete / trash
    share_token       TEXT,
    share_expires_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cloud_files_owner_parent ON cloud_files(owner_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_cloud_files_owner_deleted ON cloud_files(owner_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_cloud_files_share_token ON cloud_files(share_token);

-- Nama unik per-owner per-folder (hanya untuk item aktif, bukan trash).
CREATE UNIQUE INDEX IF NOT EXISTS idx_cloud_files_unique_name
    ON cloud_files(owner_id, name, COALESCE(parent_id, ''))
    WHERE deleted_at IS NULL;

-- Pengaturan umum cloud storage (mis. timestamp akses terakhir).
CREATE TABLE IF NOT EXISTS cloud_settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);
