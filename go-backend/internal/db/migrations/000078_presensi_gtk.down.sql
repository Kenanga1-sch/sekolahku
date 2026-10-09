-- 000078_presensi_gtk.down.sql
DROP INDEX IF EXISTS idx_employee_attendance_date;
DROP INDEX IF EXISTS idx_employee_attendance_unique;
DROP TABLE IF EXISTS employee_attendance;
