-- 000072_report_templates_file.up.sql
-- Template file-based (.xlsx): kolom `file_path` menunjuk berkas template
-- di public/templates/ (relatif terhadap repo / dist). Template semacam ini
-- tidak memakai layout_json grid — injeksi variabel dilakukan klien
-- (lihat lib/presensi-excel.ts). Seed default: Daftar Hadir Bulanan presensi.

ALTER TABLE report_templates ADD COLUMN file_path TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_report_templates_file_path ON report_templates(file_path);

INSERT OR IGNORE INTO report_templates
    (code, name, category, module, description, paper_size, orientation, layout_json, file_path, is_default, created_at, updated_at)
VALUES (
    'RPT_PRESENSI_BULANAN_XLSX',
    'Daftar Hadir Bulanan (Excel)',
    'Presensi',
    'presensi',
    'Template Excel daftar hadir bulanan per kelas: 31 kolom tanggal + rekap H/S/I/A + tanda tangan. Variabel {{...}} diisi otomatis saat unduh.',
    'A4',
    'landscape',
    '',
    'templates/daftar-hadir-bulanan-v1.xlsx',
    1,
    unixepoch(),
    unixepoch()
);
