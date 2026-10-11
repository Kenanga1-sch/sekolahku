-- 000084_presensi_gtk_honorer.up.sql
-- Presensi GTK hanya untuk honorer (GTT/GTY/Honorer/PTT + Pembina Ekskul).
-- PNS & PPPK/P3K dikecualikan. Presensi via scan QR divalidasi radius lokasi.
--
-- Perubahan:
--  1. employee_details.attendance_required  → penanda siapa yang wajib presensi
--  2. attendance_points                      → titik lokasi presensi (radius)
--  3. extracurricular_teachers               → pengajar ekskul (GTK jenis khusus)
--  4. employee_attendance (ALTER)            → kolom geo/ekskul/aktivitas

-- 1. Penanda wajib presensi di employee_details.
ALTER TABLE employee_details ADD COLUMN attendance_required INTEGER DEFAULT 0;

-- Backfill: status non-ASN wajib presensi (case-insensitive, variasai ejaan).
UPDATE employee_details
SET attendance_required = 1
WHERE LOWER(TRIM(COALESCE(employment_status, ''))) IN (
    'gtt', 'gty', 'ptt', 'honorer',
    'guru tidak tetap', 'guru tetap yayasan', 'pegawai tidak tetap',
    'pembina ekskul', 'pembina ekstrakurikuler'
);

-- 2. Titik lokasi presensi (sekolah / ekskul / custom) dengan radius meter.
CREATE TABLE IF NOT EXISTS attendance_points (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    point_type TEXT DEFAULT 'custom', -- 'sekolah' | 'ekskul' | 'custom'
    ref_id TEXT,                      -- id ekskul terkait (opsional)
    latitude REAL,
    longitude REAL,
    radius_m INTEGER DEFAULT 100,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_attendance_points_type ON attendance_points(point_type);

-- Seed titik default = lokasi sekolah (pakai school_settings bila ada).
INSERT INTO attendance_points (id, name, point_type, latitude, longitude, radius_m, is_active, created_at, updated_at)
SELECT 'point_sekolah_default', 'Sekolah', 'sekolah',
       COALESCE(school_lat, -6.3275), COALESCE(school_lng, 108.3208), 100, 1,
       CAST(strftime('%s','now') AS INTEGER) * 1000,
       CAST(strftime('%s','now') AS INTEGER) * 1000
FROM (SELECT school_lat, school_lng FROM school_settings ORDER BY CASE WHEN id = 'default' THEN 0 ELSE 1 END LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM attendance_points WHERE id = 'point_sekolah_default');

-- Bila school_settings belum ada, tetap buat titik default.
INSERT INTO attendance_points (id, name, point_type, latitude, longitude, radius_m, is_active, created_at, updated_at)
SELECT 'point_sekolah_default', 'Sekolah', 'sekolah', -6.3275, 108.3208, 100, 1,
       CAST(strftime('%s','now') AS INTEGER) * 1000,
       CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE NOT EXISTS (SELECT 1 FROM attendance_points WHERE id = 'point_sekolah_default');

-- 3. Pengajar ekstrakurikuler (GTK jenis khusus). Satu GTK bisa mengampu >1 ekskul.
CREATE TABLE IF NOT EXISTS extracurricular_teachers (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employee_details(id) ON DELETE CASCADE,
    extracurricular_name TEXT NOT NULL,
    schedule TEXT,
    point_id TEXT, -- titik presensi khusus (opsional; fallback titik sekolah)
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ekskul_teachers_employee ON extracurricular_teachers(employee_id);
CREATE INDEX IF NOT EXISTS idx_ekskul_teachers_name ON extracurricular_teachers(extracurricular_name);

-- 4. Perluas employee_attendance (kolom lama tetap aman / backward-compatible).
ALTER TABLE employee_attendance ADD COLUMN attendee_type TEXT DEFAULT 'gtk'; -- 'gtk' | 'ekskul'
ALTER TABLE employee_attendance ADD COLUMN extracurricular_id TEXT;
ALTER TABLE employee_attendance ADD COLUMN latitude REAL;
ALTER TABLE employee_attendance ADD COLUMN longitude REAL;
ALTER TABLE employee_attendance ADD COLUMN distance_m REAL;
ALTER TABLE employee_attendance ADD COLUMN within_radius INTEGER;
ALTER TABLE employee_attendance ADD COLUMN point_id TEXT;
ALTER TABLE employee_attendance ADD COLUMN point_name TEXT;
ALTER TABLE employee_attendance ADD COLUMN status_override_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_employee_attendance_type ON employee_attendance(attendee_type);
