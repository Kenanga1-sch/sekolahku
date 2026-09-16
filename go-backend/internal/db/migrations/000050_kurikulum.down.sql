-- Rollback 000050
DROP INDEX IF EXISTS idx_question_banks_kurikulum;
DROP INDEX IF EXISTS idx_bab_kurikulum;
DROP INDEX IF EXISTS idx_kurikulum_active;

ALTER TABLE question_banks DROP COLUMN semester;
ALTER TABLE question_banks DROP COLUMN kurikulum_id;
ALTER TABLE bab DROP COLUMN semester;
ALTER TABLE bab DROP COLUMN kurikulum_id;

DROP TABLE IF EXISTS kurikulum;
