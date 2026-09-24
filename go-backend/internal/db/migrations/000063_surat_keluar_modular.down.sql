-- Rollback 000063 (SQLite: drop column didukung sejak 3.35).
ALTER TABLE surat_keluar DROP COLUMN layout_type;
ALTER TABLE surat_keluar DROP COLUMN content_blocks;
