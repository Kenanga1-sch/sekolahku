-- Manual migration to add missing columns to library_visits
-- The guest_name, institution, and purpose columns are referenced in the schema
-- but were never added to the actual table

ALTER TABLE library_visits ADD COLUMN guest_name TEXT;
ALTER TABLE library_visits ADD COLUMN institution TEXT;
ALTER TABLE library_visits ADD COLUMN purpose TEXT;
