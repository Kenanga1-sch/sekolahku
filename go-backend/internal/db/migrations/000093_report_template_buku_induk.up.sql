-- Slot template Word "Buku Induk" (modul buku-induk).
--
-- Template ini adalah berkas .docx dengan variabel {{...}} yang sudah terisi
-- (nama lengkap, orang tua/wali, mutasi, kesehatan, kelulusan, nilai, dst).
-- Berkasnya disimpan di volume uploads: uploads/templates/buku-induk-v1.docx
-- (salinan repo: public/templates/buku-induk-v1.docx).
--
-- Idempoten: bila environment sudah punya template modul buku-induk (mis. slot
-- dibuat admin lewat UI), baris tidak diduplikasi; hanya file_path/kind/
-- is_default yang diselaraskan ke berkas kanonik.

INSERT INTO report_templates (
    code, name, category, module, description,
    paper_size, orientation, layout_json, file_path, kind, is_default,
    created_at, updated_at
)
SELECT
    'RPT_BUKU_INDUK_V1', 'Buku Induk', 'Buku Induk', 'buku-induk',
    'Format Buku Induk (Word) - variabel {{...}} sudah terisi pada tiap kolom isian',
    'A4', 'portrait', '{}', 'uploads/templates/buku-induk-v1.docx', 'docx', 1,
    unixepoch(), unixepoch()
WHERE NOT EXISTS (
    SELECT 1 FROM report_templates WHERE module = 'buku-induk'
);

UPDATE report_templates
SET file_path = 'uploads/templates/buku-induk-v1.docx',
    kind = 'docx',
    is_default = 1,
    updated_at = unixepoch()
WHERE module = 'buku-induk';
