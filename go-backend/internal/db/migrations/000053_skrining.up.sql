-- ============================================================
-- 000053: Modul Skrining & Perkembangan Peserta Didik (Ruang Tumbuh)
-- ============================================================

-- 1. Katalog game skrining (seeded; id fix agar mudah dirujuk)
CREATE TABLE IF NOT EXISTS screening_games (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    version TEXT NOT NULL DEFAULT '1.0',
    order_number INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_screening_games_domain ON screening_games(domain);

-- 2. Sesi skrining (guru membuat; satu sesi = satu game)
CREATE TABLE IF NOT EXISTS screening_sessions (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    class_name TEXT,
    teacher_user_id TEXT NOT NULL,
    academic_year TEXT,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at INTEGER,
    finished_at INTEGER,
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_screening_sessions_class ON screening_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_screening_sessions_teacher ON screening_sessions(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_screening_sessions_status ON screening_sessions(status);

-- 3. Roster siswa per sesi (snapshot kelas saat sesi dibuat)
CREATE TABLE IF NOT EXISTS screening_session_students (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    UNIQUE(session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_screening_session_students_session ON screening_session_students(session_id);
CREATE INDEX IF NOT EXISTS idx_screening_session_students_student ON screening_session_students(student_id);

-- 4. Attempt: satu siswa mengerjakan satu sesi (attempt_number naik bila diulang)
CREATE TABLE IF NOT EXISTS screening_attempts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    game_version TEXT,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'in_progress',
    started_at INTEGER,
    completed_at INTEGER,
    duration_ms INTEGER,
    device_type TEXT,
    browser TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    input_type TEXT,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_screening_attempts_session ON screening_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_screening_attempts_student ON screening_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_screening_attempts_status ON screening_attempts(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_screening_attempts_unique ON screening_attempts(session_id, student_id, attempt_number);

-- 5. Trial mentah: setiap percobaan satu stimulus (§22: simpan data mentah)
CREATE TABLE IF NOT EXISTS screening_trials (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL,
    trial_number INTEGER NOT NULL,
    level INTEGER,
    stimulus TEXT,
    response TEXT,
    is_correct INTEGER,
    reaction_time_ms INTEGER,
    responded_at INTEGER,
    UNIQUE(attempt_id, trial_number)
);
CREATE INDEX IF NOT EXISTS idx_screening_trials_attempt ON screening_trials(attempt_id);

-- 6. Hasil terhitung per attempt (metrik per dimensi, scoring bisa diupdate ulang dari trial mentah)
CREATE TABLE IF NOT EXISTS screening_results (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL UNIQUE,
    session_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    metrics TEXT NOT NULL,
    level_reached INTEGER,
    accuracy REAL,
    computed_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_screening_results_session ON screening_results(session_id);
CREATE INDEX IF NOT EXISTS idx_screening_results_student ON screening_results(student_id);
CREATE INDEX IF NOT EXISTS idx_screening_results_domain ON screening_results(domain);

-- 7. Observasi guru (checklist + catatan bebas, §26)
CREATE TABLE IF NOT EXISTS teacher_observations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    checklist TEXT,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    UNIQUE(session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_teacher_observations_student ON teacher_observations(student_id);

-- 8. Pengamatan orang tua (kuesioner, §27) — Milestone 3
CREATE TABLE IF NOT EXISTS parent_observations (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    parent_user_id TEXT NOT NULL,
    academic_year TEXT,
    answers TEXT NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_parent_observations_student ON parent_observations(student_id);

-- 9. Rekomendasi tindak lanjut (§25) — Milestone 3
CREATE TABLE IF NOT EXISTS screening_recommendations (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    session_id TEXT,
    domain TEXT,
    recommendation TEXT NOT NULL,
    follow_up_type TEXT NOT NULL DEFAULT 'observasi',
    shared_to_parent INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_screening_recommendations_student ON screening_recommendations(student_id);

-- Seed katalog game
INSERT INTO screening_games (id, code, name, domain, description, icon, version, order_number, is_active, created_at, updated_at)
VALUES
  ('game-tangkap-target', 'tangkap-target', 'Tangkap Target', 'perhatian', 'Mengamati konsistensi perhatian: pilih hanya target yang benar di antara benda bergerak.', 'fish', '1.0', 1, 1, 0, 0),
  ('game-jangan-terkecoh', 'jangan-terkecoh', 'Jangan Terkecoh', 'inhibitory', 'Mengamati pengendalian respons: klik hanya gambar yang sesuai aturan.', 'shield', '1.0', 2, 1, 0, 0),
  ('game-ingat-urutannya', 'ingat-urutannya', 'Ingat Urutannya', 'working_memory', 'Mengamati ingatan jangka pendek: ulangi urutan benda yang makin panjang.', 'list-ordered', '1.0', 3, 1, 0, 0),
  ('game-kereta-kata', 'kereta-kata', 'Kereta Kata', 'literasi', 'Mengamati kemampuan literasi dasar: huruf, suku kata, kata, kalimat, hingga pemahaman.', 'book-open', '1.0', 4, 1, 0, 0),
  ('game-toko-buah', 'toko-buah', 'Toko Buah', 'numerasi', 'Mengamati kemampuan numerasi: number sense, operasi dasar, hingga soal cerita.', 'apple', '1.0', 5, 1, 0, 0);
