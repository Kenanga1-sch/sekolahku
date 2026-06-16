CREATE TABLE IF NOT EXISTS letter_template_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS letter_template_group_items (
    group_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    PRIMARY KEY (group_id, template_id),
    FOREIGN KEY (group_id) REFERENCES letter_template_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES letter_templates(id) ON DELETE CASCADE
);
