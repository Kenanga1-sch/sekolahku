PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS library_visits_new (
    id TEXT PRIMARY KEY NOT NULL,
    member_id TEXT NOT NULL,
    date TEXT NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT 0,
    time TEXT,
    guest_name TEXT,
    guest_institution TEXT,
    guest_purpose TEXT,
    created_at INTEGER,
    FOREIGN KEY (member_id) REFERENCES library_members(id)
);

INSERT OR IGNORE INTO library_visits_new (
    id,
    member_id,
    date,
    timestamp,
    time,
    guest_name,
    guest_institution,
    guest_purpose,
    created_at
)
SELECT
    id,
    member_id,
    date,
    COALESCE(timestamp, created_at, 0),
    time,
    guest_name,
    guest_institution,
    guest_purpose,
    created_at
FROM library_visits;

DROP TABLE library_visits;
ALTER TABLE library_visits_new RENAME TO library_visits;

CREATE INDEX IF NOT EXISTS idx_visit_member_date ON library_visits (member_id, date);

PRAGMA foreign_keys = ON;
