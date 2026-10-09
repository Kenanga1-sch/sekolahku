-- 000075_employee_qr_code.up.sql
-- QR GTK stabil tersimpan di DB (pola sama seperti students.qr_code).
-- Sebelumnya kartu GTK menghitung QR on-the-fly (NIP→NUPTK→id) sehingga nilai
-- berubah bila NIP diisi/diubah dan kartu lama tak terbaca. Dengan kolom ini
-- kartu yang sudah tercetak tetap dikenali semua modul scan (perpustakaan,
-- tabungan, presensi). Format: GTK-{NIP} → GTK-{NUPTK} → GTK-{id}.
ALTER TABLE employee_details ADD COLUMN qr_code TEXT;
CREATE UNIQUE INDEX idx_employee_details_qr ON employee_details(qr_code);

UPDATE employee_details
SET qr_code = 'GTK-' || COALESCE(NULLIF(TRIM(nip), ''), NULLIF(TRIM(nuptk), ''), id)
WHERE qr_code IS NULL OR TRIM(qr_code) = '';
