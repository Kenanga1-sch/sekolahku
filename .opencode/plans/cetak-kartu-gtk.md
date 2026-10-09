# Cetak Kartu GTK (guru & tenaga kependidikan) — tiru mesin cetak kartu siswa

## Keputusan user

- **Akses**: tab baru "Cetak Kartu" di halaman Direktori GTK (`/admin/master/gtk`)
  → konversi halaman ke kerangka tab seperti manajemen siswa.
- **Isi kartu**: satu tipe "Kartu Identitas GTK" — depan: foto, nama+gelar,
  NIP/NUPTK, jabatan, status kepegawaian; belakang: kop sekolah + QR
  (di-generate frontend dari NIP — **tanpa kolom/migrasi DB baru**).
- **Desain**: reuse mesin cetak siswa 100% (ukuran 88×58mm, paginasi A4,
  kalibrasi mm, combined/duplex, PNG/ZIP, window.print) — hanya konten kartu baru.

## Konteks (hasil riset)

- Cetak kartu siswa: `app/(dashboard)/admin/siswa/cetak-kartu/` (page.tsx +
  use-cetak-kartu.ts + print-layout.ts + kartu-preview.tsx, semua ada test).
  Entry: tab di `admin/siswa/page.tsx:45` → `tab-kartu.tsx` (DataTable
  `selectable`) → `router.push(...?ids=...)` → `POST /api/master/students/print`.
- Halaman GTK: `app/(dashboard)/admin/master/gtk/page.tsx` (428 baris, satu
  halaman polos, TANPA tab; filter kategori lokal; DataTable tanpa seleksi).
- **Regresi nama**: repo GTK hanya isi `e.Name` (JSON `name`), `FullName`
  tak pernah diisi → `gtk/page.tsx:308` (`emp.fullName || '?'`) dan `:321`
  selalu tampil "?" / kosong. Fix sekalian: pakai `emp.name`.
- Field tersedia (`employee_details`): name (sudah termasuk gelar), nip, nuptk,
  nik, job_type, employment_status, category, degree, photo_url, join_date.
  Tidak ada: alamat, TTL, jenis kelamin, QR.
- Foto guru: folder upload `staff` (publik) → `resolveUploadUrl` aman.
- Endpoint list employees **tidak** membungkus `success` (beda students) —
  endpoint print baru akan membungkus `{success, data}` (ikuti pola students/print).
- Sidebar/link & judul: `layout-client.tsx:126` PAGE_TITLES, `:233` menu.

## Backend (Go)

1. **Repo** `go-backend/internal/repository/employee_repo.go` — tambah:
   ```go
   func (r *EmployeeRepository) GetEmployeesByIDs(ids []string) ([]models.Employee, error)
   ```
   SELECT kolom sama dengan `GetEmployees` (termasuk `photo_url`),
   `FROM employee_details WHERE id IN (...)`, ORDER BY `CASE id ... END`
   (urut sesuai input — pola `student_repo.go:940-961`).
2. **Handler** `go-backend/internal/handlers/employee_handler.go` — tambah:
   ```go
   func (h *EmployeeHandler) GetEmployeesForPrint(c echo.Context) error
   ```
   Body `{ employeeIds: []string }` → validasi non-empty → repo →
   `200 {"success": true, "data": [...]}` (pola `student_handler.go:297-326`).
3. **Route** `go-backend/cmd/api/routes.go` — setelah `:392`:
   `adminGroup.POST("/master/employees/print", h.Employee.GetEmployeesForPrint)`
   (aman dari bentrok `:id` — method POST vs GET).
4. **Test** baru `go-backend/internal/repository/employee_repo_test.go` —
   tiru pola `student_repo_test.go:132` (urut sesuai input, id asing
   diabaikan, kolom NULL aman). Cek dulu harness DB test yang dipakai
   student test (sqlite in-mem / stub) saat implementasi.

## Frontend

### 1. Mesin cetak → shared (nol perilaku)

- Pindah `admin/siswa/cetak-kartu/print-layout.ts` → **`lib/kartu-print-layout.ts`**;
  keempat fungsi storage diberi param prefix opsional
  (default `"siswa-cetak-kartu"` → kompatibel):
  `read/writeAdjustStorage(adjust, prefix?)`, `read/writeSettingsStorage(settings, prefix?)`
  (key lama `${prefix}-adjust` / `${prefix}-settings`).
- Update import siswa: `cetak-kartu/{page.tsx, use-cetak-kartu.ts, kartu-preview.tsx, kartu-preview.test.tsx}` → `@/lib/kartu-print-layout`; pindah test ke `lib/kartu-print-layout.test.ts`; hapus file lama.
- `CetakKartuSettings.cardType/showNIS` tetap — GTK mengabaikan field itu
  (prefix `gtk-cetak-kartu`, cardType selalu `"gtk"`).

### 2. Halaman GTK jadi kerangka tab

- `gtk/page.tsx` → shell tipis (pola `admin/siswa/page.tsx`):
  `TabType = "direktori" | "cetak-kartu"`, lazy import, Suspense fallback
  (Loader2), sync `?tab=`. Tanpa pembagian role (GTK = admin saja).
- Isi direktori sekarang pindah ke **`gtk/tab-direktori.tsx`** (default export)
  - **fix fullName**: `emp.fullName` → `emp.name` (2 tempat).

### 3. Tab Cetak Kartu + halaman cetak (baru)

- **`gtk/tab-cetak-kartu.tsx`** — pola `siswa/tab-kartu.tsx`:
  `goGet(/api/master/employees?page&limit&q)` (response polos
  `{data, pagination}` — handle tanpa wrapper success), DataTable
  `selectable` (kolom: foto+nama, NIP/NUPTK, jabatan, status, kategori),
  pencarian `q`, tombol **"Cetak Kartu (N)"** →
  `router.push(/admin/master/gtk/cetak-kartu?ids=...)`.
- **`gtk/cetak-kartu/`** (4 file, salin pola siswa lalu sesuaikan):
  - `use-cetak-kartu.ts`: interface `GtkCard {id, name, nip, nuptk, nik?,
jobType?, employmentStatus?, category?, degree?, photoUrl?, joinDate?}`;
    fetch `goPost("/api/master/employees/print", { employeeIds })`;
    redirect fallback `/admin/master/gtk`; prefix storage `gtk-cetak-kartu`;
    unduh PNG/ZIP identik (html-to-image pixelRatio 3 + jszip);
    `handlePrint = window.print()`.
  - `kartu-preview.tsx`: `KartuGtkFront` + `KartuGtkBack` (import
    `CARD_W_MM/CARD_H_MM` dari `@/lib/kartu-print-layout`, preview 380×250px):
    - **Depan**: strip header (logo+nama sekolah) + judul "KARTU IDENTITAS
      GURU & TENAGA KEPENDIDIKAN"; foto kiri; kanan: nama (`name`, sudah
      ber-gelar), NIP (prominen), NUPTK, jabatan (`jobType`),
      status (`employmentStatus`); baris bawah: NIK opsional.
    - **Belakang**: logo sekolah, nama+alamat sekolah (settings), QR
      `QRCodeSVG value={nip || nuptk || id} level="H"` + caption identitas.
    - Gaya/typography mengikuti `kartu-preview.tsx` siswa (warna, radius,
      `print-color-adjust` tidak perlu di sini — di page).
  - `page.tsx`: salin dari siswa — tanpa switch tipe kartu (hanya "gtk"),
    `showNIS` → `showNIP` (label saja), sisanya identik: cardsPerRow,
    showPhoto/showBackSide, printMode combined/duplex + flipEdge, kalibrasi
    mm, CSS portal `@page { size: A4; margin: 7mm }` + netralkan chrome
    dashboard + grid 4 baris + `break-before: page`, ref per kartu.
  - `kartu-preview.test.tsx`: render front/back mock — assert nama, NIP,
    QR hadir; `CARD_W_MM === 88 && CARD_H_MM === 58`.
- **`layout-client.tsx`**: PAGE_TITLES +=
  `"/admin/master/gtk/cetak-kartu": "Cetak Kartu GTK"` (prefix-match sudah
  didukung baris 154-161).

## File disentuh

| Baru                                                                                        | Ubah                                                                                 | Hapus                                     |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------- |
| `lib/kartu-print-layout.ts` (+pindah test)                                                  | `admin/master/gtk/page.tsx` (shell)                                                  | `admin/siswa/cetak-kartu/print-layout.ts` |
| `gtk/tab-direkturi.tsx` (pindah isi)                                                        | `siswa/cetak-kartu/{page,use-cetak-kartu,kartu-preview,kartu-preview.test}` (import) |                                           |
| `gtk/tab-cetak-kartu.tsx`                                                                   | `layout-client.tsx` (+1 judul)                                                       |                                           |
| `gtk/cetak-kartu/{page.tsx, use-cetak-kartu.ts, kartu-preview.tsx, kartu-preview.test.tsx}` | `employee_repo.go`, `employee_handler.go`, `routes.go`                               |                                           |
| `employee_repo_test.go`                                                                     |                                                                                      |                                           |

## Urutan eksekusi

1. Backend (repo → handler → route → test) — `go vet && go test ./...`.
2. Pindah print-layout ke `lib/` (refactor siswa nol perilaku) — vitest siswa lulus.
3. Shell tab GTK + pindah `tab-direkturi` + fix `emp.name`.
4. `tab-cetak-kartu` + folder `cetak-kartu/` + judul sidebar.
5. Verifikasi penuh: `npx vitest run`, `tsc --noEmit`, eslint, go vet/test.
6. Commit → push detached (`setsid nohup … &`) → pantau pipeline sampai
   `SEMUA SEHAT — [prod] OK` → smoke dev: buka tab, pilih beberapa GTK,
   cetak, cek PDF/preview.

## Risiko

- Dua bentuk respons berbeda (list polos vs print `{success}`) — sudah
  diperhitungkan di dua tempat penanganan.
- Perpindahan print-layout menyentuh file siswa — guard = test lama
  (print-layout.test + kartu-preview.test) harus lulus tanpa edit assert.
- Kartu tanpa NIP (staff support): QR fallback `nuptk` → `id`; baris NIP
  disembunyikan bila kosong.
- Jumlah terpilih besar → URL panjang (batas praktis sama dengan siswa;
  tanpa guard ekstra, ikuti pola).
