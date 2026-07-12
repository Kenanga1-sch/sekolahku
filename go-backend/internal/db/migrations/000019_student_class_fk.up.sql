-- Tambah FK constraints: students.class_id → student_classes.id
-- dan student_class_history.class_id → student_classes.id

-- 1. Bersihkan orphan class_id di students
UPDATE students SET class_id = NULL, class_name = NULL
WHERE class_id IS NOT NULL
  AND class_id != ''
  AND class_id NOT IN (SELECT id FROM student_classes);

-- 2. Bersihkan orphan class_id di student_class_history
UPDATE student_class_history SET class_id = NULL, class_name = NULL
WHERE class_id IS NOT NULL
  AND class_id != ''
  AND class_id NOT IN (SELECT id FROM student_classes);

-- 3. Tambah index untuk performance lookup
CREATE INDEX IF NOT EXISTS idx_student_class_history_student_id ON student_class_history(student_id);
CREATE INDEX IF NOT EXISTS idx_student_class_history_class_id ON student_class_history(class_id);

-- 4. Tambah FK constraints
-- SQLite tidak support ADD CONSTRAINT, perlu rebuild tabel.
-- Karena student_classes.id adalah TEXT PRIMARY KEY dan sudah ada index di students.class_id,
-- kita enforce di application layer saja. FK di SQLite hanya bisa via CREATE TABLE.
-- Tetap tambahkan index yang lebih baik:
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
