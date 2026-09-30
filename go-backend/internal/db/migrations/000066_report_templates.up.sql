-- 000066_report_templates.up.sql
-- Tabel template format laporan generik (Report Builder)

CREATE TABLE IF NOT EXISTS report_templates (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    code          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL DEFAULT 'Umum',
    description   TEXT NOT NULL DEFAULT '',
    paper_size    TEXT NOT NULL DEFAULT 'A4',
    orientation   TEXT NOT NULL DEFAULT 'portrait',
    layout_json   TEXT NOT NULL DEFAULT '{}',
    is_default    INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_report_templates_category ON report_templates(category);
CREATE INDEX IF NOT EXISTS idx_report_templates_code ON report_templates(code);

-- Seed Template Bawaan Modul Utama (layout JSON valid).
INSERT OR IGNORE INTO report_templates (code, name, category, description, paper_size, orientation, layout_json, is_default, created_at, updated_at) VALUES
('RPT_TABUNGAN_REKAP', 'Laporan Rekapitulasi Tabungan Siswa', 'Tabungan', 'Laporan ringkasan setoran, penarikan, dan saldo akhir per kelas/periode.', 'A4', 'portrait', '{"schemaVersion":1,"paperSize":"A4","orientation":"portrait","showFooter":true,"pages":[{"id":"p1","name":"Laporan Tabungan","blocks":[{"instanceId":"b-kop","blockId":"kop_laporan","enabled":true,"data":{"variant":"pemerintah"}},{"instanceId":"b-judul","blockId":"judul_laporan","enabled":true,"data":{"judul":"LAPORAN REKAPITULASI TABUNGAN SISWA","subjudul":"Periode Cetak Laporan Tabungan"}},{"instanceId":"b-summary","blockId":"ringkasan_kpi","enabled":true,"data":{"items":[{"label":"Total Setoran","key":"total_setoran","format":"rupiah"},{"label":"Total Penarikan","key":"total_penarikan","format":"rupiah"},{"label":"Saldo Akhir","key":"saldo_akhir","format":"rupiah"}]}},{"instanceId":"b-table","blockId":"tabel_laporan","enabled":true,"data":{"columns":[{"key":"no","label":"No","width":30,"align":"center"},{"key":"nisn","label":"NISN","width":80,"align":"center"},{"key":"nama","label":"Nama Siswa","width":160,"align":"left"},{"key":"kelas","label":"Kelas","width":60,"align":"center"},{"key":"total_setoran","label":"Total Setoran","width":110,"align":"right","format":"rupiah","autoSum":true},{"key":"total_penarikan","label":"Total Penarikan","width":110,"align":"right","format":"rupiah","autoSum":true},{"key":"saldo_akhir","label":"Saldo Akhir","width":110,"align":"right","format":"rupiah","autoSum":true}]}},{"instanceId":"b-ttd","blockId":"tanda_tangan","enabled":true,"data":{"jabatan":"Kepala Sekolah","show_stamp":"true"}}]}]}', 1, unixepoch(), unixepoch()),
('RPT_INVENTARIS_ASET', 'Laporan Rekapitulasi Aset & Inventaris', 'Inventaris', 'Laporan rincian aset sekolah, kondisi, dan lokasi penyimpanan.', 'A4', 'landscape', '{"schemaVersion":1,"paperSize":"A4","orientation":"landscape","showFooter":true,"pages":[{"id":"p1","name":"Laporan Inventaris","blocks":[{"instanceId":"b-kop","blockId":"kop_laporan","enabled":true,"data":{"variant":"pemerintah"}},{"instanceId":"b-judul","blockId":"judul_laporan","enabled":true,"data":{"judul":"LAPORAN REKAPITULASI ASET DAN INVENTARIS SEKOLAH","subjudul":"Data Kondisi dan Lokasi Barang Aset"}},{"instanceId":"b-summary","blockId":"ringkasan_kpi","enabled":true,"data":{"items":[{"label":"Total Unit Aset","key":"total_unit","format":"number"},{"label":"Kondisi Baik","key":"kondisi_baik","format":"number"},{"label":"Rusak Berat","key":"rusak_berat","format":"number"}]}},{"instanceId":"b-table","blockId":"tabel_laporan","enabled":true,"data":{"columns":[{"key":"no","label":"No","width":30,"align":"center"},{"key":"kode_barang","label":"Kode Barang","width":100,"align":"center"},{"key":"nama_barang","label":"Nama Barang / Spesifikasi","width":200,"align":"left"},{"key":"kategori","label":"Kategori","width":100,"align":"left"},{"key":"lokasi","label":"Lokasi Ruangan","width":120,"align":"left"},{"key":"jumlah","label":"Jumlah","width":60,"align":"center","format":"number","autoSum":true},{"key":"kondisi","label":"Kondisi","width":80,"align":"center"}]}},{"instanceId":"b-ttd","blockId":"tanda_tangan_ganda","enabled":true,"data":{"kiri_jabatan":"Pengelola Inventaris","kanan_jabatan":"Kepala Sekolah","show_stamp":"true"}}]}]}', 1, unixepoch(), unixepoch());
