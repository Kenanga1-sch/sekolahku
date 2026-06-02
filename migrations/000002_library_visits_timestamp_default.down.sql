PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS library_visits_old (
    id TEXT PRIMARY KEY NOT NULL,
    member_id TEXT NOT NULL,
    date TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    created_at INTEGER,
    FOREIGN KEY (member_id) REFERENCES library_members(id)
);

INSERT OR IGNORE INTO library_visits_old (
    id,
    member_id,
    date,
    timestamp,
    created_at
)
SELECT
    id,
    member_id,
    date,
    timestamp,
    created_at
FROM library_visits;

DROP TABLE library_visits;
ALTER TABLE library_visits_old RENAME TO library_visits;

CREATE INDEX IF NOT EXISTS idx_visit_member_date ON library_visits (member_id, date);

PRAGMA foreign_keys = ON;
