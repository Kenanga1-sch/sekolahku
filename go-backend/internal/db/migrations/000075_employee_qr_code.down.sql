-- 000075_employee_qr_code.down.sql
-- Kembalikan state sebelum kolom qr_code (kartu kembali dihitung on-the-fly).
DROP INDEX IF EXISTS idx_employee_details_qr;
ALTER TABLE employee_details DROP COLUMN qr_code;
