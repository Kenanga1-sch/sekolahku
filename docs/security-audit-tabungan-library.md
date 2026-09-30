# Audit Keamanan Modul Tabungan (Keuangan) & Perpustakaan

- **Tanggal audit:** 2026-01-27
- **Cakupan:** `lib/tabungan/*.ts`, `lib/library/*.ts`, `actions/savings-admin.ts`,
  `go-backend/internal/repository/*savings*`, `*library*`,
  `go-backend/internal/handlers/savings_handler*.go`, `library_handler*.go`,
  `library_public_handler.go`, `library_booking_handler.go`,
  `cmd/api/routes.go` (pemetaan rute & role), `middleware/auth.go`, `middleware/csrf.go`,
  `internal/db/migrations/*` (skema).
- **Sifat audit:** _Read-only_. Tidak ada kode produksi yang diubah. Dokumen ini adalah
  satu-satunya artefak yang ditulis.
- **Fokus:** race condition transaksi keuangan, otorisasi/IDOR, manipulasi angka,
  audit trail, QR/barcode (bypass & replay), endpoint publik tanpa auth.

---

## Ringkasan

Secara umum modul Tabungan dan Perpustakaan sudah menunjukkan kesadaran keamanan
yang jauh di atas rata-rata: transaksi keuangan dibungkus `BEGIN/COMMIT`,
pengurangan saldo memakai klaim atomik (`UPDATE ... WHERE status='AVAILABLE'` lalu
cek `RowsAffected`) pada peminjaman buku, scoping per-peran (siswa/orang tua/guru)
sudah ditambahkan di beberapa handler, teks error SQLite tidak dibocorkan ke klien,
generate batch QR sudah tahan race lewat PK `library_qr_codes`, dan ada hash
pernyataan rekening koran yang tersimpan.

Namun masih ada **satu celah kritis** dan beberapa **celah tinggi** yang berpotensi
menimbulkan kerugian uang nyata atau kebocoran data pribadi:

| #    | Severity          | Temuan singkat                                                                                                                                                                                                                                                               |
| ---- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-1  | **Kritis**        | Setoran kiosk (`KioskDeposit`) tidak idempoten pada baris transaksi, dan validasi saldo `tarik` memakai snapshot _read-then-write_ -> **double submit / setoran ganda** dan potensi _lost update_ saldo.                                                                     |
| F-2  | **Tinggi**        | `GetSiswa` (`/api/savings/students`, `/api/tabungan/siswa`) memakai cabang `qrCode`/`:id` yang menerima **NISN/NIS/qr_code/ID siswa**, dan cabang ini dilewati **sebelum** blok pembatasan peran serta pemaksaan scoping kelas guru -> **IDOR/enumerasi saldo & identitas**. |
| F-3  | **Tinggi**        | `student_me_handler.GetMySavings` menanyakan kolom `student_id` dan `keterangan` yang **tidak ada** di `tabungan_transaksi` (yang benar `siswa_id`/`catatan`) -> endpoint rusak dan menandakan jalur self-service siswa tidak teruji.                                        |
| F-4  | **Tinggi**        | Endpoint publik `POST /api/public/tabungan/check-balance` & `/tabungan/statement` memakai **NISN + tanggal lahir** sebagai satu-satunya faktor -> **penebakan saldo & unduh rekening koran** siswa lain, plus _enumeration oracle_ status HTTP.                              |
| F-5  | **Sedang-Tinggi** | Peminjaman buku: race pada **limit pinjaman** (`currentLoans >= maxLimit` dibaca sebelum klaim, tanpa transaksi `IMMEDIATE`) -> satu anggota bisa melewati batas pinjam dengan request paralel. Klaim aset tunggal sudah aman.                                               |
| F-6  | **Sedang**        | `VerifySetoran` memvalidasi saldo penarikan dengan **snapshot saldo tanpa kunci**, lalu meng-update `saldo_terakhir` berurutan -> dua verifikasi bersamaan dapat menembus proteksi saldo negatif.                                                                            |
| F-7  | **Sedang**        | Audit trail keuangan bersifat **best-effort** dan tidak lengkap: `VerifySetoran` memakai identitas pelaku dari **body request**, bukan dari JWT; `UpdateHutang`/`CancelHutang` tidak diaudit; endpoint publik-baca tidak diaudit.                                            |
| F-8  | **Sedang**        | Integritas FK `tabungan_transaksi.siswa_id` masih mengacu `tabungan_siswa(id)` (skema lama), sementara kode menulis `students.id` -> jika `PRAGMA foreign_keys=ON` insert gagal; jika OFF, tidak ada jaminan integritas.                                                     |
| F-9  | **Rendah-Sedang** | `SwapQR`/`BindAsset` mengubah PK aset tanpa audit log; Kiosk perpustakaan mengembalikan data anggota/buku ke peran `guru`+ tanpa pembatasan ruang lingkup ruangan/kelas.                                                                                                     |
| F-10 | **Rendah**        | Uang disimpan sebagai `int` (rupiah bulat) — aman dari floating point; tidak ada overflow praktis. Namun `nominal * jumlah` (hutang) tidak dibatasi tipe/rentang -> luapan teoretis pada nilai ekstrem.                                                                      |

---

## Temuan (severity + bukti)

### F-1 — Kritis: Race condition / double submit pada setoran keuangan

**Lokasi:**

- `go-backend/internal/handlers/savings_handler_transaksi.go` -> `KioskDeposit`
- `go-backend/internal/repository/savings_transaction_repo.go` -> `CreateTransaksi`
- `go-backend/internal/repository/savings_setoran_repo.go` -> `VerifySetoran`

**Bukti:**

`KioskDeposit` memanggil `CreateTransaksi` per request tanpa _idempotency key_ di
level basis data (mis. `UNIQUE` pada `catatan`/kolom baru), dan `CreateTransaksi`
menjalankan validasi saldo dengan pola _read-then-write_:

```go
// savings_transaction_repo.go
var saldo int
tx.QueryRow("SELECT saldo_terakhir FROM tabungan_siswa WHERE student_id = ...", realStudentID).Scan(&saldo)

var pendingNet int
tx.QueryRow(`SELECT COALESCE(SUM(CASE WHEN tipe = 'setor' THEN nominal ELSE -nominal END), 0)
             FROM tabungan_transaksi WHERE siswa_id = ... AND status = 'collected'`, realStudentID).Scan(&pendingNet)

if req.Tipe == "tarik" && saldo+pendingNet < req.Nominal {
    return errors.New("Saldo tidak cukup")
}
// ... INSERT tabungan_transaksi (status 'collected')
```

SQLite default `BEGIN` bersifat _deferred_: dua transaksi paralel dapat membaca
`saldo`/`pendingNet` yang sama sebelum salah satunya menulis, sehingga:

- **Double submit setoran:** siswa/operator mengirim dua request `KioskDeposit`
  dengan nominal sama (klik ganda atau retry network). Keduanya lolos dan tercatat
  sebagai transaksi `collected`; saat bendahara memverifikasi, saldo bertambah dua
  kali.
- **Penarikan melebihi saldo (lost update):** dua `tarik` paralel masing-masing
  lolos validasi karena keduanya melihat saldo lama. Test
  `CreateTransaksiPreventsPendingOverdraw` hanya menguji kasus **berurutan**, bukan
  paralel, sehingga celah ini tidak tertangkap.

Notifikasi ke orang tua memakai tag idempoten `kiosk-deposit-<siswa>-<tanggal>`
(`savings_handler_transaksi.go`) — menunjukkan _niat_ idempoten sudah ada untuk
notifikasi — tetapi **tidak diterapkan pada row transaksi**, tepat di titik yang
menyentuh uang.

**Verifikasi pendukung:** Tidak ada `UNIQUE` idempotency dan tidak ada
`BEGIN IMMEDIATE`/locking eksplisit.

---

### F-2 — Tinggi: IDOR / enumerasi saldo pada lookup siswa (qrCode / id)

**Lokasi:**

- `savings_handler.go` -> `GetSiswa` (cabang `qrCode`), `GetDetailSiswa`/`getDetailSiswaCore`
- `repository/savings_repo.go` -> `GetSiswaByQR`
- Rute: `cmd/api/routes.go` (`savingsRead.GET("/savings/students", ...)`,
  `tabunganGroup.GET("/siswa", ...)`, `tabunganGroup.GET("/siswa/:id", ...)`,
  `guruGroup.GET("/kiosk/savings-lookup", h.Savings.GetSiswa)`)

**Bukti:**

`GetSiswaByQR` menerima **empat** bentuk identifier sekaligus:

```go
// savings_repo.go — GetSiswaByQR
WHERE ts.student_id = (
    SELECT id FROM students
    WHERE id = ... OR nisn = ... OR qr_code = ... OR nis = ...
    LIMIT 1
)
```

Handler `GetSiswa` mengevaluasi cabang `qrCode` **sebelum** blok pembatasan role
dan sebelum pemaksaan scoping kelas untuk guru:

```go
func (h *SavingsHandler) GetSiswa(c echo.Context) error {
    if qrCode := c.QueryParam("qrCode"); qrCode != "" {
        s, err := h.Repo.GetSiswaByQR(qrCode)   // <-- tidak ada cek role / scope kelas
        ...
        return c.JSON(http.StatusOK, ...)
    }

    role, _ := c.Get("user_role").(string)
    if role == "guru" { /* paksa classId = kelas wali-nya */ }
    if role == "siswa" { /* paksa ke dirinya sendiri */ }
    if role != "admin" && ... && role != "guru" { return Forbidden }
    ...
}
```

Konsekuensi:

- Peran yang boleh mengakses grup (`superadmin/admin/bendahara/guru/staff`) dapat
  membaca `saldo_terakhir`, `nisn`, `qrCode`, kelas, dan foto siswa **mana pun**
  hanya dengan `qrCode=<NISN>` — termasuk **guru wali kelas A membaca siswa kelas B**,
  karena pemaksaan `classId` di blok guru tidak pernah tercapai (short-circuit).
- Halaman scan (`components/scan/unified-qr-workbench.tsx`) memang memanggil
  `/api/tabungan/siswa` dengan parameter `qrCode`, jadi endpoint ini dirancang untuk
  alur scan — tetapi seharusnya tetap dibatasi ke konteks yang sah (kelas yang
  diampu / bendahara).
- `getDetailSiswaCore` juga memicu **efek samping DB**
  (`AutoSyncStudentToSavingsAndLibrary`) berdasarkan identifier apa pun
  (`id OR nisn OR qr_code`) yang cocok dengan siswa aktif.

**Catatan positif:** cabang non-`qrCode` sudah benar — `role == "siswa"` dipaksa ke
`GetDetailSiswaById(sid)`, dan role tak berhak diblokir. Masalahnya murni pada
short-circuit `qrCode` di atas.

---

### F-3 — Tinggi: Endpoint self-service siswa membaca kolom yang tidak ada

**Lokasi:** `go-backend/internal/handlers/student_me_handler.go` -> `GetMySavings`
Rute: `studentGroup.GET("/me/savings", ...)` (role `siswa`)

**Bukti:**

```go
rows, err := h.DB.Query(`
    SELECT id, tipe, nominal, keterangan, created_at
    FROM tabungan_transaksi
    WHERE student_id = ...
    ORDER BY created_at DESC
    LIMIT 10
`, studentID)
```

Skema aktual (`000001_baseline.up.sql`, `models/savings.go`) mendefinisikan kolom
`siswa_id` dan `catatan` — **bukan** `student_id` dan `keterangan`:

```sql
CREATE TABLE IF NOT EXISTS tabungan_transaksi (
    id TEXT PRIMARY KEY,
    siswa_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    ...
    catatan TEXT,
    ...
);
```

Akibatnya query selalu error, `rows.Scan` gagal, `transaksi` tetap kosong, dan
endpoint mengembalikan saldo dengan daftar transaksi kosong — siswa tidak pernah
melihat riwayat tabungannya sendiri. Ini juga bukti bahwa jalur `student/me/*`
**tidak tercakup tes**, sehingga kelas bug yang sama (salah nama kolom / salah
`student_id` vs `siswa_id`) bisa lolos di tempat lain.

---

### F-4 — Tinggi: Endpoint publik mengekspos saldo & rekening koran via NISN + tanggal lahir

**Lokasi:**

- `savings_handler.go` -> `CheckPublicBalance`, `GetPublicStatement`; repo -> `GetPublicBalance`
- Rute: `publicGroup.POST("/tabungan/check-balance", ...)`,
  `publicGroup.POST("/tabungan/statement", ...)` di bawah `/api/public/`
  (tanpa JWT), dibatasi `publicFormLimit` (rate-limit per-IP 5/15 menit).

**Bukti:**

`GetPublicBalance` mengizinkan **empat** bentuk identifier + `birth_date`:

```go
WHERE (st.nisn = ... OR st.nis = ... OR st.id = ... OR st.qr_code = ...)
  AND st.birth_date = ...
```

Tidak ada OTP/kode sekali pakai/rate-limit per-identitas (hanya per-IP). NISN
bersifat semi-publik (tercetak di buku induk, dipakai di grup kelas), dan tanggal
lahir juga sering diketahui. Dampak:

- **Bocor privasi keuangan:** pihak luar dapat menebak `NISN + tanggal lahir` siswa
  lain dan memperoleh `name`, `className`, `balance`.
- **Unduh rekening koran penuh:** `GetPublicStatement` memakai verifikasi yang sama
  lalu mengembalikan seluruh `mutations` (setor/tarik, saldo berjalan) satu bulan —
  kebocoran riwayat keuangan lengkap tanpa login.
- **Oracle enumerasi:** status HTTP 404 vs 200 memberi sinyal "kombinasi cocok" yang
  bisa dipakai untuk memverifikasi data pribadi secara iteratif.

Aktivitas ini juga **tidak tercatat** di audit trail (`auditSavings` tidak dipanggil),
sehingga tidak ada jejak siapa menebak apa.

---
