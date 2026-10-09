# Kartu GTK Bisa Discan di Semua Modul (sama seperti kartu siswa)

## Keputusan user (terkunci)

- **QR GTK harus stabil & tersimpan** di DB (bukan dihitung ulang) — pola sama
  seperti `students.qr_code`. Kartu lama tetap dikenali walau NIP diisi/diubah.
- **Perpustakaan**: GTK aktif yang di-scan pertama kali **otomatis jadi anggota**
  (konsisten dengan siswa yang auto-sync).
- **Tabungan**: **bangun rekening tabungan GTK** (terpisah dari `tabungan_siswa`),
  bisa setor/tarik, rekap.
- **Presensi**: **bangun presensi GTK sekarang** (bukan fondasi saja) — rekam
  hadir via scan + rekap harian.
- **Semua modul ber-Scan** harus mengenali kartu GTK: perpustakaan (kiosk/anggota/
  peminjaman/kunjungan), tabungan, presensi. Unified QR Workbench rutekan per
  jenis orang (siswa vs GTK).

## Konteks (hasil riset)

- **Kartu siswa**: `students.qr_code` = `STU-`+NISN (fallback `STU-`+id),
  diisi sekali via `NewStudentQRCode` + `BackfillStudentQRCodes`; semua scanner
  multi-cocok `qr_code/nisn/nis/id` (`attendance_repo.go:400`,
  `savings_repo.go:277`, `library_repo.go:535`).
- **Kartu GTK hari ini**: `kartu-preview.tsx:22` `gtkCardIdentity = nip||nuptk||id`
  **dihitung on-the-fly, tidak disimpan**; **tidak ada** scanner resolve staf
  (semua query ke `students`). Kartu GTK = "QR tidak valid" di stasiun scan.
- **Perpustakaan**: `library_members` dual-sumber (`student_id`/`user_id`), tapi
  resolusi staf hanya by `member.id` (`library_repo.go:547`). Dialog "Tambah
  Anggota" siswa-only (label "NIS/NIP" diarahkan ke `student_id`). Auto-sync staf
  belum ada.
- **Tabungan**: `tabungan_siswa` (student_id UNIQUE) + `tabungan_transaksi`
  (siswa_id FK). Handler `savings_handler*.go`, route di `tabunganGroup` +
  `bendaharaGroup`. Murni siswa.
- **Presensi**: `attendance_sessions` (per kelas) + `attendance_records`
  (session_id+student_id UNIQUE). `RecordQRScanV2` siswa-only. Rute
  `guruGroup /attendance/*`.
- **Unified QR Workbench** (`components/scan/unified-qr-workbench.tsx`): satu scan
  → paralel `POST /api/attendance/scan` + `GET /api/tabungan/siswa?qrCode=`;
  `IdentityKind = "student"|"savings-only"`. Kartu GTK = dua-duanya gagal.
- **Employee**: `employee_details` (kolom: id, name, nip, nuptk, degree,
  user_id, category, employment_status, photo_url, dll). `CreateEmployee`
  INSERT tanpa qr_code. Print `GetEmployeesForPrint` kirim nip/nuptk/id.
- Pola QR helper: `NewStudentQRCode`/`BackfillStudentQRCodes` di
  `student_repo.go:120-136`. Migrasi terakhir `000074`.

---

## Fase 0 — Fondasi: QR GTK stabil (prasyarat semua fase)

**Migrasi** `000075_employee_qr_code`:

- `ALTER TABLE employee_details ADD COLUMN qr_code TEXT;`
- `CREATE UNIQUE INDEX idx_employee_details_qr ON employee_details(qr_code);`
- Backfill: `UPDATE employee_details SET qr_code = 'GTK-' || COALESCE(NULLIF(nip,''), NULLIF(nuptk,''), id) WHERE qr_code IS NULL OR qr_code='';`
- `.down.sql`: drop index + kolom.

**Go**:

- `models/employee.go`: tambah `QrCode string \`json:"qrCode"\``ke`Employee`+`EmployeeResponse` (+ di semua varian struct print bila perlu).
- `employee_repo.go`:
  - Helper `NewEmployeeQRCode(nip, nuptk, id *string) string` — tiru
    `NewStudentQRCode` (return `GTK-`+NIP else `GTK-`+NUPTK else `GTK-`+id).
  - `CreateEmployee`: hitung qr_code → masuk kolom & INSERT.
  - `UpdateEmployee`: bila `qr_code` kosong di DB → isi (regenerasi); **jangan
    timpa** yang sudah ada (stabilitas kartu lama).
  - Semua SELECT yang memberi `models.Employee`/print → tambah `e.qr_code` +
    scan: `GetEmployees`, `GetEmployeeByID`, `GetEmployeesByIDs`,
    `GetEmployeesWithoutAccount`, `GetEmployeesForPrint`, `scanEmployeeRow`.
- Test: `employee_repo_test.go` — qr ter-generate saat create; stabil saat
  update NIP; fallback urutan NIP→NUPTK→id.

**FE**:

- `use-cetak-kartu.ts` `GtkCard`: tambah `qrCode: string`.
- `kartu-preview.tsx`: `gtkCardIdentity(card) = card.qrCode || card.nip || card.nuptk || card.id`
  (utamakan qrCode stabil). Caption `ID:`/QR pakai nilai ini.
- Test `kartu-preview.test.tsx`: QR = qrCode bila ada; fallback lama tetap jalan.

---

## Fase 1 — Resolver orang + Perpustakaan

**Resolver bersama** — `repository/identity_repo.go` (baru):

```go
type PersonIdentity struct {
    Kind       string // "student" | "staff"
    StudentID  string // bila student
    EmployeeID string // bila staff
    UserID     string // staff: user ter-link (boleh kosong)
    Name       string
    ClassName  string // student
    Category   string // staff: guru/kepsek/staff/support
    IsActive   bool
}
func ResolvePersonByCode(db, code) (*PersonIdentity, error) // sql.ErrNoRows bila tak dikenal
```

Urutan: cek `students` (qr_code/nisn/nis/id) → `employee_details` (qr_code/nip/
nuptk/id, join users utk user_id + is_active). Test unit pakai DB tiruan.

**Perpustakaan**:

- Migrasi `000076_library_members_employee`: `ALTER TABLE library_members ADD
COLUMN employee_id TEXT REFERENCES employee_details(id) ON DELETE CASCADE;` +
  index; `.down` drop.
- `library_repo.go`:
  - `memberBaseQuery`: tambah `LEFT JOIN employee_details ed ON m.employee_id = ed.id`;
    `COALESCE(st.full_name, ed.name, u.name,'')` utk display; qr ambil
    `COALESCE(st.qr_code, ed.qr_code,'')`.
  - `scanEmployeeRow`/`scanMember`: baca `employee_id`.
  - `GetMemberByCode`: setelah lookup siswa gagal → resolve staff via resolver →
    cari `library_members` by `employee_id`; **auto-create** bila employee active
    & belum ada member (INSERT employee_id) — mirror `AutoSyncStudentToSavingsAndLibrary`.
  - `CreateMember`: dukung `EmployeeID` (cabang ketiga).
- `library_handler_members.go` `GetMemberByQRCode` + `KioskScan`/`KioskScanComplete`
  (`library_handler_misc.go`): otomatis ikut (panggil `GetMemberByCode` yang sudah
  staff-aware); pesan "bukan anggota" → coba auto-create dulu.
- **FE anggota** (`perpustakaan/anggota/page.tsx`): toggle "Siswa / GTK" di dialog
  Tambah — pilih GTK (search by nama/NIP) → kirim `employeeId` (bukan studentId).
  Minimal: resolver NIP→employee_id di backend saat input "NIP" diisi.

**Auto-create on scan** (konsisten siswa): fungsi
`AutoEnsureGtkLibraryMember(db, employeeID)` — dipanggil dari `GetMemberByCode`
staff-miss.

---

## Fase 2 — Tabungan GTK

**Migrasi** `000077_tabungan_gtk`:

- `tabungan_gtk` (id TEXT PK, employee_id TEXT UNIQUE NOT NULL REFERENCES
  employee_details(id), saldo_terakhir INTEGER DEFAULT 0, created_at, updated_at)
  - `idx_tabungan_gtk_employee`.
- `tabungan_gtk_transaksi` (id TEXT PK, gtk_id TEXT NOT NULL REFERENCES
  tabungan_gtk(id), user_id TEXT, tipe TEXT NOT NULL ('SETOR'|'TARIK'),
  nominal INTEGER NOT NULL, status TEXT DEFAULT 'pending', catatan TEXT,
  verified_by TEXT, verified_at INTEGER, created_at, updated_at) + index
  (gtk_id), (created_at), (tipe), (status).
- `.down`: drop keduanya.

**Go** — repo `tabungan_gtk_repo.go` + handler `tabungan_gtk_handler.go` (pola
panggil `savings_repo`/`savings_handler`, di-scope GTK):

- `EnsureGtk(employeeID)` — buat baris `tabungan_gtk` bila belum ada & active.
- `GetGtkByQR(code)` — resolver staff → saldo (auto-Ensure).
- `GetGtkDetail(gtkID)`, `GetGtkRekap(range)`.
- `CreateGtkSetoran` / `CreateGtkTransaksi` (SETOR/TARIK, update
  `saldo_terakhir`, catat `tabungan_gtk_transaksi`) — mirror siswa tanpa
  brankas/hutang/kelas (di luar lingkup).
- Rute (di `tabunganGroup`, role sama): `GET /tabungan/gtk?qrCode=`,
  `GET /tabungan/gtk/:id`, `GET /tabungan/gtk/rekap`, `POST /tabungan/gtk/setoran`,
  `POST /tabungan/gtk/transaksi`. (bendahara untuk mutasi.)

**FE**:

- Workbench rute staff → `GET /api/tabungan/gtk?qrCode=` (lihat Fase 4) + setor
  GTK.
- Modul tabungan: tab/filter "GTK" untuk daftar & rekap rekening GTK (tabel
  sederhana: nama, kategori, saldo, terakhir disetor). Entry kecil di
  `app/(dashboard)/tabungan/`.

---

## Fase 3 — Presensi GTK

**Migrasi** `000078_presensi_gtk`:

- `employee_attendance` (id TEXT PK, employee_id TEXT NOT NULL REFERENCES
  employee_details(id), date TEXT NOT NULL, status TEXT DEFAULT 'hadir',
  check_in_time INTEGER, recorded_by TEXT, record_method TEXT DEFAULT 'scan',
  notes TEXT, created_at, updated_at) +
  `UNIQUE(employee_id, date)` + `idx (date)`.
- `.down`: drop.

**Go** — `attendance_gtk_repo.go` + metode handler di `attendance_handler.go` (atau
file baru `attendance_gtk_handler.go`):

- `ScanGTK(code, status, recordedBy)` — resolver staff → record hadir idempotent
  per (employee,date); balas identitas GTK; error "bukan kelas" tidak berlaku
  (GTK tanpa kelas).
- `GetGTKDaily(date)` + `GetGTKReport(startDate,endDate)` — rekap H/S/I/A per GTK.
- Rute (`guruGroup`): `POST /gtk-attendance/scan`, `GET /gtk-attendance/daily`,
  `GET /gtk-attendance/report`.

**FE** — halaman/tab "Presensi GTK" di modul presensi
(`app/(dashboard)/presensi/`): tabel rekap harian/rentang (mirip
`laporan-presensi-tab` tapi tanpa kelas, per orang), scan hadir manual bila
perlu. Workbench rute staff → `POST /api/gtk-attendance/scan` (Fase 4).

---

## Fase 4 — Unified QR Workbench rute per orang + kartu

**Backend** — endpoint ringkas `POST /api/scan/resolve` (baru, `guruGroup`):
`{code}` → `{kind:"student"|"staff", studentId?, employeeId?, name, category?, className?}` (404 bila tak dikenal). (Alternatif: deteksi di FE dgn coba siswa lalu staff — endpoint resolver lebih bersih.)

**FE** `unified-qr-workbench.tsx`:

- `IdentityKind` tambah `"staff"`.
- Alur `processQrCode`: (1) `POST /api/scan/resolve`. (2) `kind==="student"` →
  alur lama persis (attendance siswa + tabungan siswa) — **jangan ubah**. (3)
  `kind==="staff"` → paralel `POST /api/gtk-attendance/scan` + `GET
/api/tabungan/gtk?qrCode=`; tampilkan nama GTK + katagori; setor GTK bila
  dipilih; log "GTK dikenali". (4) 404 → "QR tidak dikenal".
- Tambah state/panel identitas staff (nama, kategori, saldo GTK, status hadir).
- Test FE: routing staff vs siswa, kartu GTK tak lagi "QR tidak valid".

**Kartu**: sudah pakai `qrCode` stabil (Fase 0) — selesai.

---

## Verifikasi & deploy

- Go: `go vet ./... && go test ./...` (repo identity, library staff, tabungan gtk,
  attendance gtk, employee qr).
- FE: `npx vitest run` (kartu preview, workbench routing) + `tsc` + eslint.
- Migrasi: dry-run ke copy DB prod (`/tmp/opencode/*.db`) — backfill qr_code,
  kolom baru; `.down` bersih.
- Smoke dev → prod via pipeline selfhost (pola `post-receive` + pantau
  `cicd.log` sampai `DEPLOY PRODUKSI BERHASIL` + health 200).
- Uji nyata: cetak 1 kartu GTK → scan di perpustakaan (auto-anggota) → tabungan
  (setor) → presensi (hadir) → rekap tampil.

## Catatan lingkup / risiko

- Tabungan GTK **tanpa** brankas/hutang/kelas/treasurer (cukup saldo+setor/tarik+
  rekap) — hindari scope creep modul tabungan siswa yang berat.
- Presensi GTK **tanpa** sesi/kelas & tanpa notifikasi ortu (khusus siswa).
- Resolusi tabrakan: prefix `GTK-` vs `STU-` mencegah NIP≡NISN; resolver urut
  student-dulu agar kode siswa yang ambigu tetap prioritas siswa.
- `library_members.employee_id` jalur baru — pastikan join lama (student/user)
  tidak regresi (test GetMembers tampil).
- Banyak SELECT employee harus ikut tambah kolom `qr_code` — telusuri semua
  `scanEmployeeRow`/varian agar tak ada yang ketinggalan (risiko NPE/QR kosong).
