-- Tambah academic_year ke attendance_sessions untuk koneksi presensi ↔ akademik
ALTER TABLE attendance_sessions ADD COLUMN academic_year TEXT;
