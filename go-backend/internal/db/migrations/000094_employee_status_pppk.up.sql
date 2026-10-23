-- 000094_employee_status_pppk.up.sql
-- Satukan penamaan status kepegawaian ASN: P3K → PPPK.
--
-- UI, form, dan dokumen baru memakai "PPPK". Data lama yang tersimpan sebagai
-- "P3K" (variasi ejaan populer) dimigrasikan agar label, filter statistik, dan
-- kartu GTK menampilkan satu istilah. attendance_required tidak berubah karena
-- P3K dan PPPK sama-sama ASN (tidak wajib presensi) — tetap disetel 0 agar
-- konsisten bila baris lama sempat terisi 1.
UPDATE employee_details
SET employment_status = 'PPPK',
    attendance_required = 0,
    updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE LOWER(TRIM(COALESCE(employment_status, ''))) = 'p3k';
