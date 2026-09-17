-- ============================================================
-- 000052: Chat (DM 1-1) — percakapan, peserta, pesan
-- ============================================================

-- Percakapan. type 'direct' = 1-1; 'group' sengaja disiapkan supaya
-- fitur grup nanti tidak perlu migrasi ulang struktur tabel.
CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'direct',
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);

-- Peserta percakapan. last_read_at = cap waktu pesan terakhir yang
-- dibaca user ini; dipakai untuk hitung belum-baca & read receipts.
CREATE TABLE IF NOT EXISTS chat_participants (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    last_read_at INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    joined_at INTEGER NOT NULL DEFAULT 0,
    UNIQUE(conversation_id, user_id)
);

-- Pesan. content wajib ada (pesan teks); attachment_* opsional.
-- content disimpan sudah disanitasi (plain text, tanpa HTML).
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    attachment_url TEXT,
    attachment_kind TEXT,
    attachment_name TEXT,
    created_at INTEGER NOT NULL DEFAULT 0,
    edited_at INTEGER,
    deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
    ON chat_messages(conversation_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user
    ON chat_participants(user_id, archived);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
    ON chat_messages(sender_id);
