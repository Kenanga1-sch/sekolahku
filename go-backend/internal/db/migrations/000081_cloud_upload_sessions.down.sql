-- 000081_cloud_upload_sessions.down.sql
DROP INDEX IF EXISTS idx_cloud_upload_sessions_created;
DROP INDEX IF EXISTS idx_cloud_upload_sessions_owner;
DROP TABLE IF EXISTS cloud_upload_sessions;
