-- 000073_report_templates_kind.down.sql

UPDATE report_templates SET kind = '' WHERE kind IN ('xlsx', 'docx');
DROP INDEX IF EXISTS idx_report_templates_kind;
-- Kolom kind dibiarkan (SQLite tidak mendukung DROP COLUMN di semua versi;
-- nilai kosong diperlakukan sebagai template grid lama).
