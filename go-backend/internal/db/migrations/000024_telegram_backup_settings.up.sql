CREATE TABLE telegram_backup_settings (
    id TEXT PRIMARY KEY,
    bot_token TEXT,
    chat_id TEXT,
    is_enabled INTEGER DEFAULT 0,
    last_backup_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER
);

INSERT INTO telegram_backup_settings (id, is_enabled, created_at, updated_at) VALUES ('default', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
