-- Subscription Web Push (PWA). Satu baris = satu perangkat/browser yang
-- mengizinkan notifikasi. endpoint unik dari browser push service; p256dh
-- dan auth adalah kunci enkripsi payload. last_used_at dipakai untuk
-- membersihkan subscription yang sudah mati (410/404 dari push service).
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    last_used_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
