-- Add verification and e-arsip integration columns to surat_keluar
ALTER TABLE surat_keluar ADD COLUMN agenda_number TEXT;
ALTER TABLE surat_keluar ADD COLUMN verified_by TEXT REFERENCES users(id);
ALTER TABLE surat_keluar ADD COLUMN verified_at INTEGER;
ALTER TABLE surat_keluar ADD COLUMN digital_signature TEXT;
ALTER TABLE surat_keluar ADD COLUMN revision_note TEXT;
ALTER TABLE surat_keluar ADD COLUMN template_id TEXT REFERENCES letter_templates(id);

-- Add classification and numbering to letter_templates
ALTER TABLE letter_templates ADD COLUMN classification_code TEXT;
ALTER TABLE letter_templates ADD COLUMN letter_number_format TEXT;