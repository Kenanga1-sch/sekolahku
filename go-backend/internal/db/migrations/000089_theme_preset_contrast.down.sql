-- Kembalikan nilai lama (kontras rendah) bila migrasi dibatalkan.
UPDATE saved_themes
SET brand_theme = '{"primary":"#0A3D4A","secondary":"#98D8D0","accent":"#4FB8B4","background":"#E2F4F0","public_bg":"#E2F4F0","foreground":"#04222B","muted_foreground":"#1D8B94","border":"#10606F","radius":"0.75rem"}',
    updated_at = strftime('%s','now')*1000
WHERE id = 'preset-teal-classic';

UPDATE school_settings
SET brand_theme = '{"primary":"#0A3D4A","secondary":"#98D8D0","accent":"#4FB8B4","background":"#E2F4F0","public_bg":"#E2F4F0","foreground":"#04222B","muted_foreground":"#1D8B94","border":"#10606F","radius":"0.75rem"}',
    updated_at = strftime('%s','now')*1000
WHERE brand_theme = '{"primary":"#0A3D4A","secondary":"#98D8D0","accent":"#4FB8B4","background":"#E2F4F0","public_bg":"#E2F4F0","foreground":"#04222B","muted_foreground":"#0F6B72","border":"#10606F","radius":"0.75rem"}';
