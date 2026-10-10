-- 000082_library_computers.up.sql
-- Modul "Komputer Belajar" perpustakaan: siswa membaca buku, menuliskan
-- ringkasan/kesimpulan/pertanyaan, guru memverifikasi, lalu siswa boleh
-- memakai komputer dalam jatah menit tertentu. Jatah menit diatur admin dan
-- bisa berbeda per kelas. Tidak ada uang yang berpindah (bukan billing uang),
-- hanya kuota waktu.

-- 1) Inventaris komputer/station yang bisa dibooking.
CREATE TABLE IF NOT EXISTS computer_stations (
    id           TEXT PRIMARY KEY,
    code         TEXT NOT NULL UNIQUE,          -- kode unik stasiun, dipakai di URL kiosk / scan
    name         TEXT NOT NULL,
    location     TEXT NOT NULL DEFAULT '',
    sort_order   INTEGER NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'active', -- active|maintenance|inactive
    last_seen_at INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_computer_stations_status ON computer_stations(status, sort_order);

-- 2) Kuota menit per kelas (diatur admin). Satu baris per kelas.
CREATE TABLE IF NOT EXISTS computer_quota_policies (
    class_name   TEXT PRIMARY KEY,              -- '' = default untuk semua kelas
    minutes       INTEGER NOT NULL DEFAULT 0,   -- jatah menit per siswa (total, bisa dipecah)
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- 3) Catatan penggunaan kuota per siswa (bisa dipecah lintas sesi).
CREATE TABLE IF NOT EXISTS computer_time_quotas (
    student_id    TEXT PRIMARY KEY,
    total_minutes INTEGER NOT NULL DEFAULT 0,   -- total jatah yang diberikan
    used_minutes  INTEGER NOT NULL DEFAULT 0,   -- akumulasi menit terpakai
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- 4) Laporan baca: bukti syarat (ringkasan, kesimpulan, pertanyaan) + verifikasi guru.
CREATE TABLE IF NOT EXISTS reading_reports (
    id             TEXT PRIMARY KEY,
    student_id     TEXT NOT NULL,
    student_name   TEXT NOT NULL DEFAULT '',
    class_name     TEXT NOT NULL DEFAULT '',
    catalog_id     TEXT,
    book_title     TEXT NOT NULL DEFAULT '',
    book_author    TEXT NOT NULL DEFAULT '',
    summary        TEXT NOT NULL DEFAULT '',    -- cerita ulang / ringkasan
    conclusion     TEXT NOT NULL DEFAULT '',    -- kesimpulan
    question       TEXT NOT NULL DEFAULT '',    -- pertanyaan seputar bacaan
    status         TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected
    review_notes   TEXT NOT NULL DEFAULT '',
    reviewed_by    TEXT,
    reviewed_at    INTEGER NOT NULL DEFAULT 0,
    created_at     INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at     INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_reading_reports_student ON reading_reports(student_id, status);
CREATE INDEX IF NOT EXISTS idx_reading_reports_status ON reading_reports(status, created_at);

-- 5) Booking penggunaan komputer (dibuat guru/admin untuk siswa).
CREATE TABLE IF NOT EXISTS computer_bookings (
    id              TEXT PRIMARY KEY,
    station_id      TEXT NOT NULL,
    student_id      TEXT NOT NULL,
    student_name    TEXT NOT NULL DEFAULT '',
    class_name      TEXT NOT NULL DEFAULT '',
    report_id       TEXT,                       -- laporan baca yang menjadi dasar izin
    slot_start      INTEGER NOT NULL,           -- epoch ms
    slot_end        INTEGER NOT NULL,           -- epoch ms
    planned_minutes INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'booked', -- booked|active|completed|cancelled|expired|no_show
    notes           TEXT NOT NULL DEFAULT '',
    created_by      TEXT,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_computer_bookings_station ON computer_bookings(station_id, slot_start);
CREATE INDEX IF NOT EXISTS idx_computer_bookings_student ON computer_bookings(student_id, status);
CREATE INDEX IF NOT EXISTS idx_computer_bookings_status ON computer_bookings(status, slot_start);

-- 6) Sesi nyata pemakaian komputer (timer berjalan; deadline di sisi server).
CREATE TABLE IF NOT EXISTS computer_sessions (
    id            TEXT PRIMARY KEY,
    booking_id    TEXT,
    station_id    TEXT NOT NULL,
    student_id    TEXT NOT NULL,
    student_name  TEXT NOT NULL DEFAULT '',
    started_at    INTEGER NOT NULL,             -- epoch ms
    deadline_at   INTEGER NOT NULL,             -- epoch ms (server-authoritative)
    ended_at      INTEGER NOT NULL DEFAULT 0,
    minutes_used  INTEGER NOT NULL DEFAULT 0,
    end_reason    TEXT NOT NULL DEFAULT '',     -- time_up|manual|cancelled
    warn_sent_at  INTEGER NOT NULL DEFAULT 0,   -- kapan notif "sisa 5 menit" dikirim
    created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_computer_sessions_station ON computer_sessions(station_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_computer_sessions_active ON computer_sessions(ended_at, deadline_at);
CREATE INDEX IF NOT EXISTS idx_computer_sessions_student ON computer_sessions(student_id, started_at);
