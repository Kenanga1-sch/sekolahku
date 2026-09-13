-- Preferensi notifikasi orang tua per kategori. Kategori: absensi,
-- tabungan, pengumuman, pr, umum. Baris tidak ada = aktif default.
CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, category)
);
