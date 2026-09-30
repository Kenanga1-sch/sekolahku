-- 000070_report_templates_module.down.sql
-- SQLite tidak mendukung DROP COLUMN pada versi lama; index cukup dihapus di
-- sini (kolom dibiarkan, tidak berbahaya bila migrasi di-rollback manual).

DROP INDEX IF EXISTS idx_report_templates_module;
