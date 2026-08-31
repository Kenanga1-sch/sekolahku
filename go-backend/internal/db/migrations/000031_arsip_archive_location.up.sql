-- 000031_arsip_archive_location.up.sql
-- Kolom lokasi arsip fisik (rak/box) untuk surat masuk & keluar

ALTER TABLE surat_masuk ADD COLUMN archive_location TEXT;
ALTER TABLE surat_keluar ADD COLUMN archive_location TEXT;
