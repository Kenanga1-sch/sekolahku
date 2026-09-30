-- 000070_report_templates_module.up.sql
-- Menambahkan kolom `module` pada report_templates: menandai modul peruntukan
-- format laporan (mis. 'inventaris', 'tabungan'). Bernilai 'umum' bila format
-- generik / dipakai lintas modul. Dipakai halaman "Laporan & Format" dan
-- runner untuk memfilter variabel yang relevan.

ALTER TABLE report_templates ADD COLUMN module TEXT NOT NULL DEFAULT 'umum';
CREATE INDEX IF NOT EXISTS idx_report_templates_module ON report_templates(module);

UPDATE report_templates SET module = 'tabungan' WHERE code = 'RPT_TABUNGAN_REKAP';
UPDATE report_templates SET module = 'inventaris' WHERE code LIKE 'RPT_INVENTARIS%';
