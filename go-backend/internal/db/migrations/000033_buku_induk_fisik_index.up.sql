-- 000033_buku_induk_fisik_index.up.sql
-- Kolom penunjuk lokasi buku induk FISIK lama:
-- siswa terindeks ke buku (jilid) tertentu + nomor urut register.
-- Contoh: "si A ada di buku induk nomor VI nomor urut 1421".

ALTER TABLE alumni ADD COLUMN buku_fisik_no TEXT;
ALTER TABLE alumni ADD COLUMN register_no INTEGER;
