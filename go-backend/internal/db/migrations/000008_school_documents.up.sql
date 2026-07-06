CREATE TABLE IF NOT EXISTS school_documents (
    id TEXT PRIMARY KEY,
    document_type TEXT NOT NULL,
    title TEXT NOT NULL,
    recipient TEXT NOT NULL,
    reference_id TEXT,
    file_path TEXT NOT NULL,
    created_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_school_documents_type ON school_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_school_documents_ref ON school_documents(reference_id);
