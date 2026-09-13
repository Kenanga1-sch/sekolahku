-- Lampiran pesan masuk: bukti dari pelapor (evidence) dan bukti tindak
-- lanjut dari admin (resolution). kind membedakan keduanya; file_kind
-- membedakan gambar/video untuk ikon tampilan. Path menunjuk file di
-- bawah public/uploads/contact/ yang dibuat dengan nama acak.
CREATE TABLE IF NOT EXISTS contact_attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'evidence',
    file_kind TEXT NOT NULL DEFAULT 'image',
    file_path TEXT NOT NULL,
    original_name TEXT,
    file_size INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT,
    uploaded_by TEXT,
    created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_contact_attachments_message ON contact_attachments(message_id);
