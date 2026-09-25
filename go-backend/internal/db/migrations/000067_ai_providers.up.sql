CREATE TABLE IF NOT EXISTS ai_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider_type TEXT NOT NULL DEFAULT 'openai', -- 'gemini', 'openai', '9router', 'openrouter', 'custom'
    base_url TEXT NOT NULL DEFAULT '',
    model_name TEXT NOT NULL DEFAULT '',
    api_key_env_var TEXT NOT NULL DEFAULT '',
    api_key_value TEXT NOT NULL DEFAULT '', -- Enkripsi/Direct Plain Key opsional
    is_enabled BOOLEAN NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Seed initial providers
INSERT OR IGNORE INTO ai_providers (id, name, provider_type, base_url, model_name, api_key_env_var, api_key_value, is_enabled, priority, created_at, updated_at)
VALUES 
('google_gemini', 'Google Gemini', 'gemini', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', 'gemini-2.5-flash', 'GEMINI_API_KEY', '', 1, 1, strftime('%s', 'now')*1000, strftime('%s', 'now')*1000),
('openai_default', 'OpenAI / 9Router', 'openai', 'https://api.openai.com/v1', 'gpt-4o-mini', 'OPENAI_API_KEY', '', 1, 2, strftime('%s', 'now')*1000, strftime('%s', 'now')*1000);
