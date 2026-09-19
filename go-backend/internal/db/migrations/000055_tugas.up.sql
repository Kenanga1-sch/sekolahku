-- ============================================================
-- 000055: Modul Tugas & PR (guru → siswa)
-- ============================================================

-- 1. Tugas / PR yang dibuat guru untuk kelas yang diwaliinya.
CREATE TABLE IF NOT EXISTS tugas (
    id TEXT PRIMARY KEY,
    teacher_user_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    class_name TEXT,
    subject_id TEXT,
    subject_name TEXT,
    academic_year TEXT,
    title TEXT NOT NULL,
    description TEXT,
    attachment_url TEXT,
    attachment_name TEXT,
    due_at INTEGER,                       -- UnixMilli; NULL = tanpa batas waktu
    allow_late INTEGER NOT NULL DEFAULT 1, -- 1 = boleh kumpul terlambat
    status TEXT NOT NULL DEFAULT 'published', -- published | archived
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER,
    UNIQUE(class_id, title, academic_year)
);
CREATE INDEX IF NOT EXISTS idx_tugas_class ON tugas(class_id);
CREATE INDEX IF NOT EXISTS idx_tugas_teacher ON tugas(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_tugas_status ON tugas(status);
CREATE INDEX IF NOT EXISTS idx_tugas_due ON tugas(due_at);

-- 2. Pengumpulan tugas oleh siswa (satu pengumpulan per tugas per siswa).
CREATE TABLE IF NOT EXISTS tugas_submissions (
    id TEXT PRIMARY KEY,
    tugas_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    answer_text TEXT,
    attachment_url TEXT,
    attachment_name TEXT,
    submitted_at INTEGER NOT NULL,
    is_late INTEGER NOT NULL DEFAULT 0,
    score REAL,                            -- NULL = belum dinilai
    feedback TEXT,
    graded_by TEXT,
    graded_at INTEGER,
    status TEXT NOT NULL DEFAULT 'submitted', -- submitted | graded
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER,
    UNIQUE(tugas_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_tugas_sub_tugas ON tugas_submissions(tugas_id);
CREATE INDEX IF NOT EXISTS idx_tugas_sub_student ON tugas_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_tugas_sub_status ON tugas_submissions(status);
