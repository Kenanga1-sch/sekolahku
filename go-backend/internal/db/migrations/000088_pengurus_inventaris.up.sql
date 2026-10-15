-- Tempat penunjukan Pengelola Barang / Bendahara BOS untuk laporan inventaris.
-- Selama ini nama/NIP pengelola di-hardcode sementara; kini punya kolom resmi
-- di school_settings sehingga bisa dikelola lewat Admin → Pengaturan Sekolah.
ALTER TABLE school_settings ADD COLUMN pengurus_inventaris_nama TEXT NOT NULL DEFAULT '';
ALTER TABLE school_settings ADD COLUMN pengurus_inventaris_nip TEXT NOT NULL DEFAULT '';

-- Seed awal: Lucki Hari Munnandar beserta NIP resminya dari employee_details.
UPDATE school_settings
SET pengurus_inventaris_nama = COALESCE(
        (SELECT name FROM employee_details WHERE lower(name) LIKE '%lucki%' LIMIT 1),
        ''),
    pengurus_inventaris_nip = COALESCE(
        (SELECT nip FROM employee_details WHERE lower(name) LIKE '%lucki%' AND nip <> '' LIMIT 1),
        '')
WHERE id = 1;
