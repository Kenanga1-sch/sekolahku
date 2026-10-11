-- 000084_presensi_gtk_honorer.down.sql
DROP INDEX IF EXISTS idx_employee_attendance_type;
-- SQLite tidak mendukung DROP COLUMN pada versi lama; biarkan kolom tambahan
-- (harmless) atau hapus manual bila perlu. Kita coba DROP COLUMN (SQLite >= 3.35).
ALTER TABLE employee_attendance DROP COLUMN status_override_reason;
ALTER TABLE employee_attendance DROP COLUMN point_name;
ALTER TABLE employee_attendance DROP COLUMN point_id;
ALTER TABLE employee_attendance DROP COLUMN within_radius;
ALTER TABLE employee_attendance DROP COLUMN distance_m;
ALTER TABLE employee_attendance DROP COLUMN longitude;
ALTER TABLE employee_attendance DROP COLUMN latitude;
ALTER TABLE employee_attendance DROP COLUMN extracurricular_id;
ALTER TABLE employee_attendance DROP COLUMN attendee_type;

DROP INDEX IF EXISTS idx_ekskul_teachers_name;
DROP INDEX IF EXISTS idx_ekskul_teachers_employee;
DROP TABLE IF EXISTS extracurricular_teachers;

DROP INDEX IF EXISTS idx_attendance_points_type;
DROP TABLE IF EXISTS attendance_points;

ALTER TABLE employee_details DROP COLUMN attendance_required;
