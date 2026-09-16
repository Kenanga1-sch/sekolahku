-- ============================================================
-- 000049: Modul Bank Soal
-- ============================================================

-- 1. Bab / Chapter (pengelompokan soal per mapel & kelas)
CREATE TABLE IF NOT EXISTS bab (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    class_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    order_number INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_bab_subject ON bab(subject_id);
CREATE INDEX IF NOT EXISTS idx_bab_class ON bab(class_id);

-- 2. Bank Soal (kumpulan soal per mapel/kelas/bab)
CREATE TABLE IF NOT EXISTS question_banks (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    class_id TEXT,
    bab_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_question_banks_subject ON question_banks(subject_id);
CREATE INDEX IF NOT EXISTS idx_question_banks_class ON question_banks(class_id);
CREATE INDEX IF NOT EXISTS idx_question_banks_bab ON question_banks(bab_id);
CREATE INDEX IF NOT EXISTS idx_question_banks_creator ON question_banks(created_by);

-- 3. Soal (pertanyaan individual)
CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'pg_single',
    content TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT,
    options TEXT,
    correct_answer TEXT,
    explanation TEXT,
    points INTEGER NOT NULL DEFAULT 1,
    order_number INTEGER NOT NULL DEFAULT 0,
    difficulty TEXT NOT NULL DEFAULT 'medium',
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_questions_bank ON questions(bank_id);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);

-- 4. Paket Soal (kumpulan soal yang disusun untuk ujian/latihan)
CREATE TABLE IF NOT EXISTS question_sets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bank_id TEXT NOT NULL,
    academic_year TEXT,
    shuffle_questions INTEGER NOT NULL DEFAULT 0,
    shuffle_options INTEGER NOT NULL DEFAULT 0,
    timer_minutes INTEGER,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_question_sets_bank ON question_sets(bank_id);

-- 5. Isi Paket Soal (relasi paket ↔ soal dengan urutan)
CREATE TABLE IF NOT EXISTS question_set_items (
    id TEXT PRIMARY KEY,
    set_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    order_number INTEGER NOT NULL DEFAULT 0,
    points_override INTEGER,
    UNIQUE(set_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_question_set_items_set ON question_set_items(set_id);

-- 6. Praktik Siswa (sesi pengerjaan)
CREATE TABLE IF NOT EXISTS student_practices (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    set_id TEXT NOT NULL,
    started_at INTEGER,
    finished_at INTEGER,
    total_score REAL NOT NULL DEFAULT 0,
    max_score REAL NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_student_practices_student ON student_practices(student_id);
CREATE INDEX IF NOT EXISTS idx_student_practices_set ON student_practices(set_id);

-- 7. Jawaban Siswa (per soal)
CREATE TABLE IF NOT EXISTS student_practice_answers (
    id TEXT PRIMARY KEY,
    practice_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    answer TEXT,
    is_correct INTEGER,
    points_earned REAL NOT NULL DEFAULT 0,
    answered_at INTEGER,
    UNIQUE(practice_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_student_practice_answers_practice ON student_practice_answers(practice_id);
