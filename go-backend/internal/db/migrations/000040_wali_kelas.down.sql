-- SQLite modern mendukung DROP COLUMN; jika versi lama menolak,
-- kolom dibiarkan (tidak dipakai oleh aplikasi lama).
ALTER TABLE student_classes DROP COLUMN wali_user_id;
