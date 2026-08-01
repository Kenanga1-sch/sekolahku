-- Migration 000027: Performance indexes for student sync tables
-- Menambahkan indeks untuk mempercepat query sinkronisasi dan lookup data siswa
-- pada tabel library_members, tabungan_siswa, dan tabungan_transaksi

-- === library_members ===
-- student_id: sering dipakai di JOIN & WHERE saat sync/update
CREATE INDEX IF NOT EXISTS idx_library_members_student_id ON library_members(student_id);

-- is_active: filter anggota aktif (digunakan di list anggota)
CREATE INDEX IF NOT EXISTS idx_library_members_is_active ON library_members(is_active);

-- class_name: filter per kelas (digunakan di rekap)
CREATE INDEX IF NOT EXISTS idx_library_members_class_name ON library_members(class_name);

-- composite untuk query "anggota aktif per kelas"
CREATE INDEX IF NOT EXISTS idx_library_members_is_active_class ON library_members(is_active, class_name);

-- qr_code sudah UNIQUE (otomatis index), tapi pastikan ada
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_library_members_qr_code ON library_members(qr_code);

-- === tabungan_siswa ===
-- student_id: FK ke students, sering dipakai di JOIN & WHERE saat sync
CREATE INDEX IF NOT EXISTS idx_tabungan_siswa_student_id ON tabungan_siswa(student_id);

-- is_active: filter nasabah aktif
CREATE INDEX IF NOT EXISTS idx_tabungan_siswa_is_active ON tabungan_siswa(is_active);

-- kelas_id: filter nasabah per kelas (join ke tabungan_kelas)
CREATE INDEX IF NOT EXISTS idx_tabungan_siswa_kelas_id ON tabungan_siswa(kelas_id);

-- nisn: pencarian nasabah via NISN
CREATE INDEX IF NOT EXISTS idx_tabungan_siswa_nisn ON tabungan_siswa(nisn);

-- nama: pencarian nasabah via nama
CREATE INDEX IF NOT EXISTS idx_tabungan_siswa_nama ON tabungan_siswa(nama);

-- composite untuk query "nasabah aktif per kelas"
CREATE INDEX IF NOT EXISTS idx_tabungan_siswa_is_active_kelas ON tabungan_siswa(is_active, kelas_id);

-- === tabungan_transaksi ===
-- siswa_id: FK ke tabungan_siswa, filter transaksi per siswa
CREATE INDEX IF NOT EXISTS idx_tabungan_transaksi_siswa ON tabungan_transaksi(siswa_id);

-- tipe: filter setor/tarik
CREATE INDEX IF NOT EXISTS idx_tabungan_transaksi_tipe ON tabungan_transaksi(tipe);

-- status: filter pending/verified
CREATE INDEX IF NOT EXISTS idx_tabungan_transaksi_status ON tabungan_transaksi(status);

-- created_at: sort by date (laporan harian/bulanan)
CREATE INDEX IF NOT EXISTS idx_tabungan_transaksi_created_at ON tabungan_transaksi(created_at);

-- composite untuk "transaksi siswa tertentu dalam rentang waktu"
CREATE INDEX IF NOT EXISTS idx_tabungan_transaksi_siswa_created ON tabungan_transaksi(siswa_id, created_at);

-- === library_loans ===
-- member_id: FK ke library_members
CREATE INDEX IF NOT EXISTS idx_library_loans_member ON library_loans(member_id);

-- item_id: FK ke library_assets
CREATE INDEX IF NOT EXISTS idx_library_loans_item ON library_loans(item_id);

-- is_returned: filter pinjaman aktif/belum dikembalikan
CREATE INDEX IF NOT EXISTS idx_library_loans_returned ON library_loans(is_returned);

-- borrow_date: laporan peminjaman per periode
CREATE INDEX IF NOT EXISTS idx_library_loans_borrow_date ON library_loans(borrow_date);

-- === students (tambahan indeks yang mungkin belum ada) ===
-- status: filter siswa aktif/lulus/dll
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

-- is_active: filter aktif
CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active);

-- gender: rekap gender
CREATE INDEX IF NOT EXISTS idx_students_gender ON students(gender);

-- composite untuk "siswa aktif per kelas"
CREATE INDEX IF NOT EXISTS idx_students_is_active_class ON students(is_active, class_id);

-- nisn: pencarian unik
CREATE INDEX IF NOT EXISTS idx_students_nisn ON students(nisn);

-- nis: pencarian unik
CREATE INDEX IF NOT EXISTS idx_students_nis ON students(nis);

-- === tabungan_kelas ===
-- nama: lookup nama kelas saat sync
CREATE INDEX IF NOT EXISTS idx_tabungan_kelas_nama ON tabungan_kelas(nama);

-- === library_visits ===
-- member_id + date: statistik kunjungan
CREATE INDEX IF NOT EXISTS idx_library_visits_member_date ON library_visits(member_id, date);

-- === alumni ===
-- student_id: lookup alumni by student
CREATE INDEX IF NOT EXISTS idx_alumni_student_id ON alumni(student_id);

-- graduation_year: filter lulus per tahun
CREATE INDEX IF NOT EXISTS idx_alumni_graduation_year ON alumni(graduation_year);