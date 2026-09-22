-- ============================================================
-- 000060 (down): hapus taksonomi Bloom + tag.
-- ============================================================

DROP TABLE IF EXISTS question_tags;
-- SQLite lama tidak mendukung DROP COLUMN; kolom bloom_level dibiarkan.
