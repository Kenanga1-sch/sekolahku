-- 000074_users_name_degree.up.sql
-- Sinkron nama akun login GTK: users.name/full_name = "Nama, Gelar" agar
-- semua konsumen berbasis users (wali kelas laporan presensi, eoffice/arsip,
-- tabungan, pinjaman, tugas, dokumen) ikut menampilkan gelar. Sebelumnya
-- users.name = salinan employee_details.name TANPA gelar (bug "gelar tak
-- pernah ikut"). Hanya user yang ter-link employee_details (GTK) disentuh.
-- Penulisan berikutnya dijaga oleh LinkEmployeeToUser / GenerateAccounts /
-- UpdateEmployee.

UPDATE users SET
  name = (
    SELECT COALESCE(ed.name, '') ||
           CASE WHEN COALESCE(ed.degree, '') <> '' THEN ', ' || ed.degree ELSE '' END
    FROM employee_details ed WHERE ed.user_id = users.id
  ),
  full_name = (
    SELECT COALESCE(ed.name, '') ||
           CASE WHEN COALESCE(ed.degree, '') <> '' THEN ', ' || ed.degree ELSE '' END
    FROM employee_details ed WHERE ed.user_id = users.id
  )
WHERE EXISTS (SELECT 1 FROM employee_details ed WHERE ed.user_id = users.id);

-- student_classes.teacher_name = salinan users.name (satu-satunya penulis:
-- savings_handler_kelas saat assign wali) — selaraskan juga agar dashboard
-- presensi menampilkan "Nama, Gelar" (produksi: semua NULL karena belum
-- pernah set ulang sejak konsolidasi; hanya baris ber-wali_user_id disentuh).
UPDATE student_classes SET teacher_name = (
  SELECT COALESCE(ed.name, '') ||
         CASE WHEN COALESCE(ed.degree, '') <> '' THEN ', ' || ed.degree ELSE '' END
  FROM users u JOIN employee_details ed ON ed.user_id = u.id
  WHERE u.id = student_classes.wali_user_id
)
WHERE wali_user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM users u JOIN employee_details ed ON ed.user_id = u.id WHERE u.id = student_classes.wali_user_id);
