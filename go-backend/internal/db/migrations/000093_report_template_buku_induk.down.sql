-- Hapus slot template "Buku Induk" yang dibuat migrasi 000093.
-- Berkas uploads/templates/buku-induk-v1.docx dibiarkan (bukan data DB).
DELETE FROM report_templates WHERE code = 'RPT_BUKU_INDUK_V1';
