-- Rollback 000064 (SQLite: drop column didukung sejak 3.35).
ALTER TABLE surat_masuk DROP COLUMN cloud_file_id;
ALTER TABLE surat_keluar DROP COLUMN cloud_file_id;
ALTER TABLE school_documents DROP COLUMN cloud_file_id;
