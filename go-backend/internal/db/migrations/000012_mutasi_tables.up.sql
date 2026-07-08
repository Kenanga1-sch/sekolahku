CREATE TABLE IF NOT EXISTS mutasi_requests (
    id TEXT PRIMARY KEY,
    registration_number TEXT UNIQUE,
    student_name TEXT,
    nisn TEXT,
    gender TEXT,
    origin_school TEXT,
    origin_school_address TEXT,
    target_grade INTEGER,
    target_class_id TEXT,
    parent_name TEXT,
    whatsapp_number TEXT,
    status_approval TEXT DEFAULT 'pending',
    status_delivery TEXT DEFAULT 'unsent',
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS mutasi_out_requests (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    destination_school TEXT,
    reason TEXT,
    reason_detail TEXT,
    status TEXT DEFAULT 'draft',
    downloaded_at INTEGER,
    processed_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS mutasi_logs (
    id TEXT PRIMARY KEY,
    mutasi_type TEXT, -- 'masuk' or 'keluar'
    student_id TEXT,
    student_name TEXT,
    nisn TEXT,
    gender TEXT,
    origin_or_destination TEXT,
    mutation_date INTEGER,
    reason TEXT,
    created_at INTEGER
);
