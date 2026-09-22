-- ============================================================
-- 000059 (down): hapus fitur mode ujian bank soal.
-- ============================================================

DROP TABLE IF EXISTS exam_assignments;

-- SQLite tidak mendukung DROP COLUMN pada versi lama; kolom dibiarkan
-- agar rollback tetap aman (data lama tidak hilang).
