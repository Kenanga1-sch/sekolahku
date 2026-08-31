-- 000032_school_stamp.up.sql
-- Stempel sekolah terpisah dari tanda tangan pejabat (untuk cetak surat)

ALTER TABLE school_settings ADD COLUMN school_stamp TEXT;
