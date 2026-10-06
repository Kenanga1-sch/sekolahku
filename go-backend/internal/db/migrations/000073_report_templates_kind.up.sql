-- 000073_report_templates_kind.up.sql
-- Jenis template file: 'xlsx' (rekap/tabel, diisi exceljs) atau 'docx'
-- (naratif/surat, diisi docxtemplater). Template grid lama (layout_json)
-- memakai kind='' dan tetap dirender engine v3 sampai modulnya migrasi.

ALTER TABLE report_templates ADD COLUMN kind TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_report_templates_kind ON report_templates(kind);

UPDATE report_templates SET kind = 'xlsx' WHERE code = 'RPT_PRESENSI_BULANAN_XLSX';
