DROP INDEX IF EXISTS idx_leave_requests_status;
DROP INDEX IF EXISTS idx_leave_requests_parent;
DROP INDEX IF EXISTS idx_leave_requests_student;
DROP TABLE IF EXISTS leave_requests;
DROP INDEX IF EXISTS idx_parent_students_student;
DROP INDEX IF EXISTS idx_parent_students_user;
DROP TABLE IF EXISTS parent_students;
