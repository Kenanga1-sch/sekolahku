-- 000094_employee_status_pppk.down.sql
-- Kembalikan penamaan PPPK → P3K untuk baris yang diubah migrasi up.
-- attendance_required dikembalikan ke 0 (PPPK/P3K sama-sama ASN).
UPDATE employee_details
SET employment_status = 'P3K',
    attendance_required = 0,
    updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE LOWER(TRIM(COALESCE(employment_status, ''))) = 'pppk';
