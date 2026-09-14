-- Hubungkan akun siswa (role='siswa') ke data siswa melalui NISN.
-- Backfill dari users.username = students.nisn (konvensi create siswa).
ALTER TABLE users ADD COLUMN student_id TEXT REFERENCES students(id);

UPDATE users
SET student_id = (
    SELECT id FROM students WHERE nisn = users.username
)
WHERE role = 'siswa'
  AND student_id IS NULL
  AND EXISTS (
    SELECT 1 FROM students WHERE nisn = users.username
  );
