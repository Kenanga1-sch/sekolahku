-- SQLite modern mendukung DROP COLUMN; jika versi lama menolak,
-- kolom dibiarkan (tidak dipakai oleh aplikasi lama).
ALTER TABLE mutasi_out_requests DROP COLUMN destination_street;
ALTER TABLE mutasi_out_requests DROP COLUMN destination_village;
ALTER TABLE mutasi_out_requests DROP COLUMN destination_district;
ALTER TABLE mutasi_out_requests DROP COLUMN destination_regency;
ALTER TABLE mutasi_out_requests DROP COLUMN destination_province;

ALTER TABLE mutasi_logs DROP COLUMN destination_street;
ALTER TABLE mutasi_logs DROP COLUMN destination_village;
ALTER TABLE mutasi_logs DROP COLUMN destination_district;
ALTER TABLE mutasi_logs DROP COLUMN destination_regency;
ALTER TABLE mutasi_logs DROP COLUMN destination_province;
