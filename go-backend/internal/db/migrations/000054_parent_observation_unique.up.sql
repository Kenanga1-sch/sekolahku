-- 000054: unique constraint untuk kuesioner pengamatan orang tua (§24)
-- Satu jawaban terbaru per (student, parent, tahun ajaran).
CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_observations_unique
    ON parent_observations(student_id, parent_user_id, academic_year);
