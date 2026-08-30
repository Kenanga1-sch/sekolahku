-- 000029_unify_student_source.down.sql
-- Restore denormalized tables (data loss possible for wali_kelas; saldo preserved)

DROP TABLE IF EXISTS tabungan_siswa;
DROP TABLE IF EXISTS library_members;

CREATE TABLE tabungan_siswa (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    nisn TEXT,
    nama TEXT,
    kelas_id TEXT,
    saldo_terakhir INTEGER DEFAULT 0,
    qr_code TEXT,
    foto TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE tabungan_kelas (
    id TEXT PRIMARY KEY,
    nama TEXT,
    wali_kelas TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE library_members (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    student_id TEXT,
    name TEXT NOT NULL,
    class_name TEXT,
    qr_code TEXT UNIQUE,
    max_borrow_limit INTEGER DEFAULT 3,
    photo TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
);