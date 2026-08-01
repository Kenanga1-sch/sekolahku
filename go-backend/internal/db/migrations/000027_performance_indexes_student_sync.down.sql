-- Rollback 000027: Drop performance indexes

-- library_members
DROP INDEX IF EXISTS idx_library_members_student_id;
DROP INDEX IF EXISTS idx_library_members_is_active;
DROP INDEX IF EXISTS idx_library_members_class_name;
DROP INDEX IF EXISTS idx_library_members_is_active_class;

-- tabungan_siswa
DROP INDEX IF EXISTS idx_tabungan_siswa_student_id;
DROP INDEX IF EXISTS idx_tabungan_siswa_is_active;
DROP INDEX IF EXISTS idx_tabungan_siswa_kelas_id;
DROP INDEX IF EXISTS idx_tabungan_siswa_nisn;
DROP INDEX IF EXISTS idx_tabungan_siswa_nama;
DROP INDEX IF EXISTS idx_tabungan_siswa_is_active_kelas;

-- tabungan_transaksi
DROP INDEX IF EXISTS idx_tabungan_transaksi_siswa;
DROP INDEX IF EXISTS idx_tabungan_transaksi_tipe;
DROP INDEX IF EXISTS idx_tabungan_transaksi_status;
DROP INDEX IF EXISTS idx_tabungan_transaksi_created_at;
DROP INDEX IF EXISTS idx_tabungan_transaksi_siswa_created;

-- library_loans
DROP INDEX IF EXISTS idx_library_loans_member;
DROP INDEX IF EXISTS idx_library_loans_item;
DROP INDEX IF EXISTS idx_library_loans_returned;
DROP INDEX IF EXISTS idx_library_loans_borrow_date;

-- students
DROP INDEX IF EXISTS idx_students_status;
DROP INDEX IF EXISTS idx_students_is_active;
DROP INDEX IF EXISTS idx_students_gender;
DROP INDEX IF EXISTS idx_students_is_active_class;
DROP INDEX IF EXISTS idx_students_nisn;
DROP INDEX IF EXISTS idx_students_nis;

-- tabungan_kelas
DROP INDEX IF EXISTS idx_tabungan_kelas_nama;

-- library_visits
DROP INDEX IF EXISTS idx_library_visits_member_date;

-- alumni
DROP INDEX IF EXISTS idx_alumni_student_id;
DROP INDEX IF EXISTS idx_alumni_graduation_year;