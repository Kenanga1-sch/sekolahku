-- 000072_report_templates_file.down.sql

DELETE FROM report_templates WHERE code = 'RPT_PRESENSI_BULANAN_XLSX';
DROP INDEX IF EXISTS idx_report_templates_file_path;
-- Kolom file_path dibiarkan (SQLite tidak mendukung DROP COLUMN di semua
-- versi; kolom kosong tidak mengganggu template grid yang sudah ada).
