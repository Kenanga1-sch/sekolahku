-- 000029_unify_student_source.up.sql
-- Make tabungan_siswa and library_members extensions of students table

-- Drop obsolete triggers that copied student data
DROP TRIGGER IF EXISTS sync_class_rename;
DROP TRIGGER IF EXISTS sync_student_profile_to_library;
DROP TRIGGER IF EXISTS sync_student_profile_to_savings;
DROP TRIGGER IF EXISTS sync_student_class_to_savings;

-- === TABUNGAN_SISWA ===
-- Create new extension table: only student_id + saldo
CREATE TABLE tabungan_siswa_new (
    id TEXT PRIMARY KEY,
    student_id TEXT UNIQUE NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    saldo_terakhir INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
);

-- Migrate existing data
INSERT INTO tabungan_siswa_new (id, student_id, saldo_terakhir, created_at, updated_at)
SELECT
    old.id,
    COALESCE(old.student_id, s.id) AS student_id,
    old.saldo_terakhir,
    old.created_at,
    old.updated_at
FROM tabungan_siswa old
LEFT JOIN students s ON s.nisn = old.nisn
WHERE COALESCE(old.student_id, s.id) IS NOT NULL;

-- Drop old tables (tabungan_kelas is no longer needed)
DROP TABLE tabungan_kelas;
DROP TABLE tabungan_siswa;

ALTER TABLE tabungan_siswa_new RENAME TO tabungan_siswa;

-- === LIBRARY_MEMBERS ===
-- New table: only student_id (or user_id for staff) + max_borrow_limit
CREATE TABLE library_members_new (
    id TEXT PRIMARY KEY,
    student_id TEXT UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    max_borrow_limit INTEGER DEFAULT 3,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
);

INSERT INTO library_members_new (id, student_id, user_id, max_borrow_limit, is_active, created_at, updated_at)
SELECT
    id,
    student_id,
    user_id,
    COALESCE(max_borrow_limit, 3),
    is_active,
    created_at,
    updated_at
FROM library_members;

DROP TABLE library_members;
ALTER TABLE library_members_new RENAME TO library_members;

-- Indexes
CREATE INDEX idx_tabungan_siswa_student_id ON tabungan_siswa(student_id);
CREATE INDEX idx_library_members_student_id ON library_members(student_id);
CREATE INDEX idx_library_members_user_id ON library_members(user_id);

-- Ensure every active student has a savings row (idempotent)
INSERT OR IGNORE INTO tabungan_siswa (id, student_id, saldo_terakhir, created_at, updated_at)
SELECT
    'sav_' || s.id,
    s.id,
    0,
    strftime('%s','now')*1000,
    strftime('%s','now')*1000
FROM students s
WHERE s.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM tabungan_siswa ts WHERE ts.student_id = s.id);

-- Ensure every active student has a library member row
INSERT OR IGNORE INTO library_members (id, student_id, max_borrow_limit, is_active, created_at, updated_at)
SELECT
    'lib_' || s.id,
    s.id,
    3,
    1,
    strftime('%s','now')*1000,
    strftime('%s','now')*1000
FROM students s
WHERE s.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM library_members lm WHERE lm.student_id = s.id);