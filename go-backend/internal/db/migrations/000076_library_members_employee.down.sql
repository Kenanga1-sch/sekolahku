-- 000076_library_members_employee.down.sql
DROP INDEX IF EXISTS idx_library_members_employee_id;
ALTER TABLE library_members DROP COLUMN employee_id;
