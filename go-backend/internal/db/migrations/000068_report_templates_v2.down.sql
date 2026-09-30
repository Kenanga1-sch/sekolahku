-- 000068_report_templates_v2.down.sql
-- Kembalikan template bawaan ke bentuk seed awal (schema v1).
-- CATATAN: seed awal berisi literal JSON_ARRAY(...) yang memang tidak valid,
-- namun kita kembalikan agar struktur migrasi tetap simetris.

UPDATE report_templates
SET layout_json = '{"schemaVersion":1,"paperSize":"A4","orientation":"portrait","showFooter":true,"pages":[{"id":"p1","name":"Laporan Tabungan","blocks":[]}]}'
WHERE code = 'RPT_TABUNGAN_REKAP';

UPDATE report_templates
SET layout_json = '{"schemaVersion":1,"paperSize":"A4","orientation":"landscape","showFooter":true,"pages":[{"id":"p1","name":"Laporan Inventaris","blocks":[]}]}'
WHERE code = 'RPT_INVENTARIS_ASET';
