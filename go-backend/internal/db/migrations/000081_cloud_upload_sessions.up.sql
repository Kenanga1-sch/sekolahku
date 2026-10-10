-- 000081_cloud_upload_sessions.up.sql
-- Sesi upload bertahap (chunked) untuk file besar yang melebihi batas
-- Cloudflare Tunnel (~100MB per request). File dipotong di klien, tiap
-- potongan diupload terpisah, lalu digabung & dikirim ke Telegram sebagai
-- satu file utuh. Baris dihapus setelah complete; barang ditinggal user
-- dibersihkan oleh cleanup harian.
CREATE TABLE IF NOT EXISTS cloud_upload_sessions (
    id              TEXT PRIMARY KEY,
    owner_id        TEXT NOT NULL,
    file_name       TEXT NOT NULL,
    mime_type       TEXT NOT NULL DEFAULT '',
    parent_id       TEXT,
    total_size      INTEGER NOT NULL,
    total_chunks    INTEGER NOT NULL,
    chunk_size      INTEGER NOT NULL,
    uploaded_chunks INTEGER NOT NULL DEFAULT 0,
    encrypted       INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'uploading',  -- uploading|merging|done|failed
    error           TEXT NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cloud_upload_sessions_owner ON cloud_upload_sessions(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_cloud_upload_sessions_created ON cloud_upload_sessions(created_at);
