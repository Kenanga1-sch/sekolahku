-- Alamat lengkap sekolah tujuan pada pengajuan mutasi keluar dari portal
-- orang tua. Lima komponen alamat (merging konvensi SPMB) supaya bisa
-- disusun ulang di surat permohonan dan detail admin.
ALTER TABLE mutasi_out_requests ADD COLUMN destination_street TEXT;
ALTER TABLE mutasi_out_requests ADD COLUMN destination_village TEXT;
ALTER TABLE mutasi_out_requests ADD COLUMN destination_district TEXT;
ALTER TABLE mutasi_out_requests ADD COLUMN destination_regency TEXT;
ALTER TABLE mutasi_out_requests ADD COLUMN destination_province TEXT;

-- Buku Mutasi: alamat yang sama ikut saat permohonan selesai maupun mutasi
-- keluar langsung dari admin.
ALTER TABLE mutasi_logs ADD COLUMN destination_street TEXT;
ALTER TABLE mutasi_logs ADD COLUMN destination_village TEXT;
ALTER TABLE mutasi_logs ADD COLUMN destination_district TEXT;
ALTER TABLE mutasi_logs ADD COLUMN destination_regency TEXT;
ALTER TABLE mutasi_logs ADD COLUMN destination_province TEXT;
