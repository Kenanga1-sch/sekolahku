-- Relasi orang tua <-> siswa. Satu akun orang tua bisa memiliki banyak
-- anak; satu siswa bisa ditautkan ke lebih dari satu orang tua (ayah, ibu,
-- wali). Akun ortu memakai role 'orangtua' di tabel users.
CREATE TABLE IF NOT EXISTS parent_students (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    relation TEXT NOT NULL DEFAULT 'orangtua',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_parent_students_user ON parent_students(user_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_student ON parent_students(student_id);

-- Pengajuan izin/sakit dari dashboard orang tua. Disetujui wali
-- kelas/admin; saat disetujui, presensi tanggal terkait ditandai otomatis.
CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    parent_user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'izin',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    attachment_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at INTEGER,
    review_note TEXT,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_leave_requests_student ON leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_parent ON leave_requests(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
