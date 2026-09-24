-- ============================================================
-- 000064: Tautan arsip ke Cloud Storage (Telegram).
--   cloud_file_id : ID file di cloud_files bila dokumen juga disimpan
--                   ke "ruang arsip" Cloud Storage (arsip bersama).
--                   Kosong/NULL = hanya tersimpan di disk server.
-- ============================================================

ALTER TABLE surat_masuk ADD COLUMN cloud_file_id TEXT;
ALTER TABLE surat_keluar ADD COLUMN cloud_file_id TEXT;
ALTER TABLE school_documents ADD COLUMN cloud_file_id TEXT;
