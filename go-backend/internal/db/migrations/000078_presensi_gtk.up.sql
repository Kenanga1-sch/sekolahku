-- 000078_presensi_gtk.up.sql
-- Presensi GTK (guru & tenaga kependidikan) lewat scan kartu GTK. Terpisah dari
-- attendance_records (siswa) karena GTK tidak punya sesi/kelas. Idempotent per
-- (employee, date) — scan ulang tidak membuat record ganda.
CREATE TABLE IF NOT EXISTS employee_attendance (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employee_details(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT DEFAULT 'hadir',
    check_in_time INTEGER,
    recorded_by TEXT,
    record_method TEXT DEFAULT 'scan',
    notes TEXT,
    created_at INTEGER,
    updated_at INTEGER
);
CREATE UNIQUE INDEX idx_employee_attendance_unique ON employee_attendance(employee_id, date);
CREATE INDEX idx_employee_attendance_date ON employee_attendance(date);
