-- 000069_report_templates_inventaris_atk.down.sql
-- Hapus seed template laporan stok barang habis pakai.

DELETE FROM report_templates WHERE code = 'RPT_INVENTARIS_HABIS_PAKAI';
