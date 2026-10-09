-- 000074_users_name_degree.down.sql
-- Kembalikan users.name/full_name DAN student_classes.teacher_name dari
-- employee_details.name TANPA gelar (state sebelum backfill).

UPDATE users SET
  name = (SELECT COALESCE(ed.name, '') FROM employee_details ed WHERE ed.user_id = users.id),
  full_name = (SELECT COALESCE(ed.name, '') FROM employee_details ed WHERE ed.user_id = users.id)
WHERE EXISTS (SELECT 1 FROM employee_details ed WHERE ed.user_id = users.id);

UPDATE student_classes SET teacher_name = (
  SELECT COALESCE(ed.name, '')
  FROM users u JOIN employee_details ed ON ed.user_id = u.id
  WHERE u.id = student_classes.wali_user_id
)
WHERE wali_user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM users u JOIN employee_details ed ON ed.user_id = u.id WHERE u.id = student_classes.wali_user_id);
