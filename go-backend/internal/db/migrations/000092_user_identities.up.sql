-- Identitas OAuth (Google) yang ditautkan ke akun users.
-- Login Google hanya dipakai sebagai bukti kepemilikan email; hak akses tetap
-- ditentukan role di tabel users (portal orang tua tetap wajib verifikasi NISN).
CREATE TABLE IF NOT EXISTS user_identities (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    email            TEXT,
    email_verified   INTEGER NOT NULL DEFAULT 0,
    created_at       INTEGER NOT NULL DEFAULT 0,
    updated_at       INTEGER NOT NULL DEFAULT 0,
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities(user_id);
