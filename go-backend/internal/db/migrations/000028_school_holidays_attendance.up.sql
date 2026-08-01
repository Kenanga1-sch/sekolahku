-- Migration 000028: School holidays and attendance performance indexes
CREATE TABLE IF NOT EXISTS school_holidays (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_school_holidays_date ON school_holidays(date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_records_unique_student ON attendance_records(session_id, student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date_class ON attendance_sessions(date, class_name);
