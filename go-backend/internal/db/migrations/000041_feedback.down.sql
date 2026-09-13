-- SQLite modern mendukung DROP COLUMN; jika versi lama menolak,
-- kolom dibiarkan (tidak dipakai oleh aplikasi lama).
ALTER TABLE contact_messages DROP COLUMN updated_at;
ALTER TABLE contact_messages DROP COLUMN ticket;
ALTER TABLE contact_messages DROP COLUMN status;
ALTER TABLE contact_messages DROP COLUMN category;
DROP INDEX IF EXISTS idx_contact_ticket;
