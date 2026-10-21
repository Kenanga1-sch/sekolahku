-- Dokumen pribadi siswa (KK, akta, KIP, ijazah, pas foto).
-- Sebelumnya tab "Dokumen" di detail siswa memanggil endpoint yang tidak ada
-- sehingga selalu kosong dan upload selalu gagal.
CREATE TABLE IF NOT EXISTS student_documents (
    id          TEXT PRIMARY KEY,
    student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    doc_type    TEXT NOT NULL DEFAULT 'lainnya',
    file_path   TEXT NOT NULL,
    uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_documents_student ON student_documents(student_id);
