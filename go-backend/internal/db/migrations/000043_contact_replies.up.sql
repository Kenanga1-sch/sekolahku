-- Balasan tindak lanjut pesan masuk: percakapan admin -> pelapor.
-- Pelapor membacanya lewat halaman cek status tiket. author_name disimpan
-- untuk audit internal; tampilan publik menampilkannya sebagai "Tim
-- Sekolah" (nama asli tidak diekspos).
CREATE TABLE IF NOT EXISTS contact_replies (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    body TEXT NOT NULL,
    author_id TEXT,
    author_name TEXT,
    created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_contact_replies_message ON contact_replies(message_id);
