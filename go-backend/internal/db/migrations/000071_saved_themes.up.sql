CREATE TABLE IF NOT EXISTS saved_themes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    brand_theme TEXT NOT NULL, -- JSON {primary, secondary, accent, background, public_bg, foreground, muted_foreground, border, radius}
    is_default BOOLEAN NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Seed preset bawaan (nilai JSON harus sama persis dengan lib/theme-presets.ts)
INSERT OR IGNORE INTO saved_themes (id, name, description, brand_theme, is_default, created_at, updated_at) VALUES
('preset-teal-classic', 'Teal Classic', 'Palet teal resmi sekolah — tenang, modern, kontras tinggi.',
 '{"primary":"#0A3D4A","secondary":"#98D8D0","accent":"#4FB8B4","background":"#E2F4F0","public_bg":"#E2F4F0","foreground":"#04222B","muted_foreground":"#0F6B72","border":"#10606F","radius":"0.75rem"}',
 1, strftime('%s','now')*1000, strftime('%s','now')*1000),
('preset-green-classic', 'Green Classic', 'Hijau daun klasik — hangat dan ramah untuk sekolah dasar.',
 '{"primary":"#065F46","secondary":"#A7F3D0","accent":"#A7F3D0","background":"#FFF8E7","public_bg":"#F7EBD5","foreground":"#1a2e1a","muted_foreground":"#4b6b4b","border":"#d1e7dd","radius":"0.75rem"}',
 0, strftime('%s','now')*1000, strftime('%s','now')*1000),
('preset-blue-fresh', 'Blue Fresh', 'Biru segar dan profesional — cocok untuk institusi formal.',
 '{"primary":"#1E40AF","secondary":"#BFDBFE","accent":"#60A5FA","background":"#EFF6FF","public_bg":"#EFF6FF","foreground":"#0F172A","muted_foreground":"#475569","border":"#93C5FD","radius":"0.75rem"}',
 0, strftime('%s','now')*1000, strftime('%s','now')*1000);
