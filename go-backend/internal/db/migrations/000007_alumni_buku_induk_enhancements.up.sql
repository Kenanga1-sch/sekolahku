-- Add columns to alumni table
ALTER TABLE alumni ADD COLUMN nickname TEXT;
ALTER TABLE alumni ADD COLUMN citizenship TEXT;
ALTER TABLE alumni ADD COLUMN sibling_kandung INTEGER DEFAULT 0;
ALTER TABLE alumni ADD COLUMN sibling_tiri INTEGER DEFAULT 0;
ALTER TABLE alumni ADD COLUMN sibling_angkat INTEGER DEFAULT 0;
ALTER TABLE alumni ADD COLUMN daily_language TEXT;
ALTER TABLE alumni ADD COLUMN living_with TEXT;
ALTER TABLE alumni ADD COLUMN guardian_education TEXT;
ALTER TABLE alumni ADD COLUMN previous_school_address TEXT;
ALTER TABLE alumni ADD COLUMN previous_school_cert_no TEXT;
ALTER TABLE alumni ADD COLUMN previous_school_cert_date TEXT;
ALTER TABLE alumni ADD COLUMN mutasi_masuk_asal_sekolah TEXT;
ALTER TABLE alumni ADD COLUMN mutasi_masuk_dari_kelas TEXT;
ALTER TABLE alumni ADD COLUMN mutasi_masuk_diterima_tanggal TEXT;
ALTER TABLE alumni ADD COLUMN mutasi_masuk_di_kelas TEXT;
ALTER TABLE alumni ADD COLUMN scholarship_info TEXT;
ALTER TABLE alumni ADD COLUMN mutation_out_class TEXT;
ALTER TABLE alumni ADD COLUMN mutation_out_to_school TEXT;
ALTER TABLE alumni ADD COLUMN mutation_out_to_class TEXT;
ALTER TABLE alumni ADD COLUMN mutation_out_date TEXT;
ALTER TABLE alumni ADD COLUMN dropped_out_date TEXT;
ALTER TABLE alumni ADD COLUMN dropped_out_reason TEXT;

-- Create alumni_health_records table
CREATE TABLE IF NOT EXISTS alumni_health_records (
    id TEXT PRIMARY KEY,
    alumni_id TEXT NOT NULL,
    year TEXT NOT NULL,
    weight INTEGER,
    height INTEGER,
    illness TEXT,
    abnormality TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE
);
