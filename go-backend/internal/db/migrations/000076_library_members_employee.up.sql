-- 000076_library_members_employee.up.sql
-- Perpustakaan mengenali anggota GTK lewat jalur employee_id (konsisten dengan
-- siswa yang memakai student_id). Sebelumnya staf hanya bisa di-resolve lewat
-- member.id; kartu GTK (berisi NIP/qr_code) tidak dikenali. Dengan kolom ini
-- scan kartu GTK otomatis jadi anggota (auto-create) tanpa perlu akun users.
ALTER TABLE library_members ADD COLUMN employee_id TEXT REFERENCES employee_details(id) ON DELETE CASCADE;
CREATE INDEX idx_library_members_employee_id ON library_members(employee_id);
