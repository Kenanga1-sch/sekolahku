# Gelar GTK tidak ikut — sinkron sumber nama + helper render (semua area)

## Keputusan user

- **Strategi**: sinkron `users.name`/`full_name` dengan gelar (backfill + tulis
  otomatis) + backend isi `Employee.FullName` (gabungan) + helper render frontend
  `formatNamaGtk(name, degree)` + ganti sumber Daftar-1 ke `employee_details`.
- **Cakupan**: semua area sekaligus (kartu, surat, finance/tabungan/pinjaman,
  laporan presensi, eoffice/arsip, tugas, dokumen, publik, form, import, test).

## Akar penyebab (terverifikasi: DB prod + kode)

- `employee_details.name` = **TANPA gelar** (`"Badrudin"`), `degree` terisi
  8/10 (`"S.Pd."`), `name_without_degree` NULL semua (kolom mati),
  `staff_profiles` **0 baris**, `users.name` 0 ber-gelar.
- `models.Employee.FullName` (json `fullName`) **tidak pernah di-assign** di
  `employee_repo.go` sejak descope → pola frontend `fullName || name` selalu
  jatuh ke `name` tanpa gelar.
- Konsumen `employee_details` (kartu, picker surat, selector finance, beranda)
  baca `name` tanpa menggabung `degree` — padahal API sudah mengirim `degree`.
- Konsumen `users.name` (wali kelas laporan presensi `academic_repo.go:74`,
  eoffice, tabungan, loans, tugas, dokumen) membaca salinan tanpa gelar.
- Daftar-1 Dapodik (`eoffice_handler_gtk.go:269`) baca `staff_profiles` (0 baris)
  → GTK selalu kosong (logika gabung `nm+", "+deg` sudah ada tapi mati).
- Hulu: label form "Nama Lengkap (dengan Gelar)" menyesatkan (data nyata tanpa
  gelar; label asli lama "Tanpa Gelar"); template import **tidak punya kolom
  Gelar** → import selalu `degree=NULL`.
- Format gabungan yang benar (konvergen): **`"Nama, Gelar"`**.

## Rencana perbaikan

### A. Backend Go — helper + isi FullName

1. Helper baru (mis. di `internal/models/employee.go` atau `internal/util`):
   ```go
   func FullNameWithDegree(name string, degree *string) string
   // trim name; bila degree non-kosong → name + ", " + degree
   ```
2. `employee_repo.go` — set `e.FullName` (pointer hasil gabungan) di SEMUA
   fungsi baca: `GetEmployees`, `GetEmployeesByIDs`, `GetEmployeeByID`,
   `GetEmployeesWithoutAccount` (yang terakhir: **SELECT `e.degree` dulu** —
   `:229` sekarang tanpa degree). `Name` tetap TANPA gelar (jangan ubah —
   publik page & Daftar-1 menggabungkan sendiri → hindari gelar ganda).
3. `public_repo.go` tetap (name+degree terpisah sudah benar).

### B. Backend Go — sinkron `users.name` + `users.full_name`

4. **Migrasi backfill** `000074_users_name_degree.up.sql` (+ down):
   ```sql
   UPDATE users SET
     name = (SELECT ed.name || CASE WHEN ed.degree IS NOT NULL AND ed.degree <> ''
                                     THEN ', ' || ed.degree ELSE '' END
              FROM employee_details ed WHERE ed.user_id = users.id),
     full_name = (same)  -- hanya untuk user yang ter-link employee_details
   WHERE EXISTS (SELECT 1 FROM employee_details ed WHERE ed.user_id = users.id);
   ```
   (`teacher_name` di `student_classes` produksi NULL semua → tidak perlu
   disentuh; laporan sudah fallback ke `waliUserName`/users.)
5. **Tulis sinkron** (3 titik):
   - `user_repo.go` `LinkEmployeeToUser:429` — sekalian
     `UPDATE users SET name=?, full_name=? WHERE id=?` (gabungan).
   - `user_handler.go` `GenerateAccounts` (~:487) — `Name`/`FullName` dari
     `FullNameWithDegree(e.Name, e.Degree)` (sekarang `&e.Name`).
   - `employee_repo.go` `UpdateEmployee:348` — setelah UPDATE, bila
     `user_id` terisi → sinkron `users.name`/`full_name` (gelar ikut saat
     admin mengubah nama/gelar GTK).
     Catatan: `GetEmployeesWithoutAccount` tidak terpengaruh (user_id NULL).
6. `eoffice_handler_gtk.go:269` — ganti sumber Daftar-1 dari
   `staff_profiles` (mati) ke `employee_details`:
   `SELECT name, degree, job_type, category, nip FROM employee_details
WHERE category IS NOT NULL ORDER BY display_order` — logika
   `nm+", "+deg` (:300-302) dipertahankan.

### C. Frontend — helper + titik konsumsi

7. Helper baru `lib/gtk-name.ts`:
   ```ts
   export function formatNamaGtk(
     name?: string | null,
     degree?: string | null,
   ): string;
   ```
8. Terapkan (pakai `formatNamaGtk` / `fullName` yang kini ber-gelar):
   | Titik                                                                                            | Ubahan                                                                                                                                   |
   | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
   | `gtk/cetak-kartu/kartu-preview.tsx` (front, ~:74/96)                                             | `formatNamaGtk(card.name, card.degree)` — field sudah ada                                                                                |
   | `gtk/tab-cetak-kartu.tsx` (~:185)                                                                | nama di daftar pilih                                                                                                                     |
   | `gtk/tab-direkturi.tsx` (~:319-323)                                                              | kolom Nama (kolom Gelar terpisah dibiarkan)                                                                                              |
   | `app/(public)/page.tsx` (StaffItem ~:56/386)                                                     | tambah field `degree` + gabung (API sudah kirim)                                                                                         |
   | `components/master/employee-form-dialog.tsx:95`                                                  | **KRITIS**: prefill `fullName: data.name` — JANGAN `data.fullName` (kini ber-gelar) → kalau tidak, edit GTK → name DB ikut gelar → dobel |
   | `pengaturan/tab-sistem.tsx:144`                                                                  | `fullName \|\| name` → otomatis benar setelah A                                                                                          |
   | `pengaturan/tab-users.tsx:247,798`                                                               | pakai `fullName` (setelah A + SELECT degree)                                                                                             |
   | `letter-builder/data-picker-dialog.tsx:129-213`                                                  | `formatNamaGtk`/`fullName` → `{{guru_nama}}`                                                                                             |
   | `letters/generator/recipient-selector.tsx:202-257`                                               | didahulukan `fullName`                                                                                                                   |
   | `admin/surat/buat/page.tsx:242-247`                                                              | `penerima_nama`/`guru_nama`                                                                                                              |
   | `finance/treasurer-selector.tsx`, `class-rep-manager.tsx`, `debt-manager.tsx`                    | `fullName`/helper                                                                                                                        |
   | `tabungan/tab-bendahara.tsx:172`, `setoran/detail:239`, `verifikasi:217,300,367`, `pengguna:255` | helper/fullName (sumber users → sudah ber-gelar setelah B)                                                                               |
   | `admin/akademik/tab-kelas.tsx:89,234`                                                            | `fullName`/helper (users → B menolong)                                                                                                   |
   | Konsumen berbasis `users` (loans, tugas, dokumen, eoffice surat,                                 |
   | presensi `waliUserName`) → **otomatis benar setelah B** (tanpa ubah kode).                       |
9. Cek cepat saat eksekusi: apakah `admin/laporan-builder` punya variabel
   nama guru → bila ya, terapkan helper di pemetaannya.

### D. Hulu kecil (form & import)

10. `employee-form-dialog.tsx:226` → label **"Nama Lengkap (Tanpa Gelar)"**
    (sinkron dengan data nyata; placeholder tetap `"Siti Aminah"` tanpa gelar).
11. Import: tambah kolom `"Gelar"` di `employee-import-dialog.tsx` template
    (~:65-77) + baca di `employee_handler.go` `BulkImportEmployees` (~:174-193):
    `Degree: ptr(importString(row, "Gelar","Gelar","degree","Degree"))`.

### E. Test (penjaga — fixture lama salah asumsi!)

12. Go: `employee_repo_test.go` — fixture `name='Budi, S.Pd'` **diperbaiki**
    jadi `name='Budi', degree='S.Pd'` + asersi `FullName == "Budi, S.Pd"`;
    test `FullNameWithDegree` (dengan/ tanpa degree, whitespace);
    test `GetEmployeesWithoutAccount` kini SELECT degree (fixture baru);
    bila ada test `UpdateEmployee` → asersi sinkron `users.name`.
13. FE: `kartu-preview.test.tsx` — fixture dipisah `name: "Budi Santoso"` +
    `degree: "S.Pd"` + asersi hasil render **"Budi Santoso, S.Pd"**;
    test baru `lib/gtk-name.test.ts` (trim, tanpa degree, gabungan).
14. `lib/_e2e-template.test.ts` / `template-pdf-verify.test.ts` fixture
    `waliKelasNama: "Siti, S.Pd"` dibiarkan (menguji substitusi, bukan sumber).

## Urutan eksekusi

1. A (helper Go + FullName) + E test Go → `go vet && go test ./...`.
2. B (migrasi 000074 + sinkron 3 titik + Daftar-1) → test.
3. C (helper FE + semua titik konsumsi) + D (form/import).
4. E test FE → `npx vitest run`, `tsc --noEmit`, eslint.
5. Commit → push `setsid nohup` → pantau pipeline → smoke prod:
   - `SELECT name, full_name FROM users` sudah ber-gelar,
   - kartu/daftar tampil "Nama, S.Pd.",
   - Daftar-1 tidak kosong (bila data kategori ada).

## Risiko

- **Gelar ganda**: jangan MENULIS `name` = gabungan (form prefill & semua tulis
  ke `name` harus tanpa gelar) — `guru-staf/page.tsx` & Daftar-1 menggabungkan
  sendiri. Titik paling rawan: `employee-form-dialog.tsx:95` (prefill).
- `fullName` kini ber-gelar → audit SEMUA pemakaian `fullName` yang
  **menulis balik** ke DB (hanya form GTK; sisanya tampilan = aman).
- Backfill menyentuh `users.name` semua role ter-link (hanya GTK yang ter-link
  employee_details → scope aman); `LIKE %q%` pencarian tetap cocok.
- Sinkron bisa ditimpa bila user edit profil sendiri (tanpa field gelar) —
  dampak kecil, catat di kode.
