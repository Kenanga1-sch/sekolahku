-- ============================================================
-- 000050: Kurikulum untuk Bank Soal
-- ============================================================

-- Tabel kurikulum (Kurikulum 2013, Kurikulum Merdeka, dll.)
CREATE TABLE IF NOT EXISTS kurikulum (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_kurikulum_active ON kurikulum(is_active);

-- Seed nilai default
INSERT OR IGNORE INTO kurikulum (id, name, description, is_active, created_at, updated_at) VALUES
    ('kur_2013', 'Kurikulum 2013', 'Pelajaran Kurikulum 2013 (K-13)', 1,
        CAST(strftime('%s','now') AS INTEGER) * 1000,
        CAST(strftime('%s','now') AS INTEGER) * 1000),
    ('kur_merdeka', 'Kurikulum Merdeka', 'Pelajaran Kurikulum Merdeka', 1,
        CAST(strftime('%s','now') AS INTEGER) * 1000,
        CAST(strftime('%s','now') AS INTEGER) * 1000);

-- Tambah kolom kurikulum_id & semester di bab
ALTER TABLE bab ADD COLUMN kurikulum_id TEXT;
ALTER TABLE bab ADD COLUMN semester TEXT;

-- Tambah kolom kurikulum_id & semester di question_banks
ALTER TABLE question_banks ADD COLUMN kurikulum_id TEXT;
ALTER TABLE question_banks ADD COLUMN semester TEXT;

CREATE INDEX IF NOT EXISTS idx_bab_kurikulum ON bab(kurikulum_id);
CREATE INDEX IF NOT EXISTS idx_question_banks_kurikulum ON question_banks(kurikulum_id);
