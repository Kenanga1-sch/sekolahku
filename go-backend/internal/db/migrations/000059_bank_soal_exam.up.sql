-- ============================================================
-- 000059: Bank Soal — mode latihan/ujian, penugasan kelas,
--          kontrol jadwal/attempt, dan urutan soal tersimpan.
-- ============================================================
-- Satu entitas `question_sets` melayani dua mode:
--   - latihan : bebas, tanpa jadwal (perilaku lama)
--   - ujian   : wajib ditugaskan ke kelas, punya window jadwal,
--               timer, dan batas percobaan.
-- ============================================================

-- 1. Kolom kontrol pada paket soal.
ALTER TABLE question_sets ADD COLUMN mode TEXT NOT NULL DEFAULT 'latihan';        -- latihan|ujian
ALTER TABLE question_sets ADD COLUMN max_attempts INTEGER;                        -- NULL = tak terbatas
ALTER TABLE question_sets ADD COLUMN available_from INTEGER;                      -- Unix ms, NULL = tanpa batas awal
ALTER TABLE question_sets ADD COLUMN available_until INTEGER;                     -- Unix ms, NULL = tanpa batas akhir
ALTER TABLE question_sets ADD COLUMN result_visible INTEGER NOT NULL DEFAULT 1;   -- 1 = siswa boleh lihat hasil

-- 2. Penugasan paket ujian ke kelas.
CREATE TABLE IF NOT EXISTS exam_assignments (
    id          TEXT PRIMARY KEY,
    set_id      TEXT NOT NULL,
    class_id    TEXT NOT NULL,
    assigned_by TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL DEFAULT 0,
    UNIQUE(set_id, class_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_set ON exam_assignments(set_id);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_class ON exam_assignments(class_id);

-- 3. Urutan soal tersimpan per sesi + deadline server-side.
--    question_order = JSON array question_id, agar urutan teracak stabil
--    antar-refresh dan tidak bisa diubah klien.
--    deadline_at = started_at + timer, divalidasi di server saat submit.
ALTER TABLE student_practices ADD COLUMN question_order TEXT;
ALTER TABLE student_practices ADD COLUMN deadline_at INTEGER;
