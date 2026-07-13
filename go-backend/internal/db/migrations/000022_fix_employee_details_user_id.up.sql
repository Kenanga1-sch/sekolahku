PRAGMA foreign_keys=off;

BEGIN TRANSACTION;

CREATE TABLE employee_details_new (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    nip TEXT,
    nuptk TEXT,
    nik TEXT,
    employment_status TEXT,
    job_type TEXT,
    join_date TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    category TEXT, 
    degree TEXT, 
    quote TEXT, 
    photo_url TEXT, 
    display_order INTEGER DEFAULT 0, 
    name_without_degree TEXT, 
    name TEXT, 
    email TEXT, 
    role TEXT DEFAULT 'guru',
    FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO employee_details_new (id, user_id, nip, nuptk, nik, employment_status, job_type, join_date, created_at, updated_at, category, degree, quote, photo_url, display_order, name_without_degree, name, email, role)
SELECT id, user_id, nip, nuptk, nik, employment_status, job_type, join_date, created_at, updated_at, category, degree, quote, photo_url, display_order, name_without_degree, name, email, role 
FROM employee_details;

DROP TABLE employee_details;
ALTER TABLE employee_details_new RENAME TO employee_details;

COMMIT;

PRAGMA foreign_keys=on;
