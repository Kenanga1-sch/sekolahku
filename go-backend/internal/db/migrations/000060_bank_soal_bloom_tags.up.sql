-- ============================================================
-- 000060: Bank Soal — taksonomi Bloom + tag bebas.
-- ============================================================

-- Level kognitif (taksonomi Bloom revisi). NULL = belum ditentukan.
ALTER TABLE questions ADD COLUMN bloom_level TEXT;  -- remember|understand|apply|analyze|evaluate|create

-- Tag bebas per soal (many-to-many sederhana, disimpan sebagai baris).
CREATE TABLE IF NOT EXISTS question_tags (
    id          TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    tag         TEXT NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT 0,
    UNIQUE(question_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_question_tags_question ON question_tags(question_id);
CREATE INDEX IF NOT EXISTS idx_question_tags_tag ON question_tags(tag);
