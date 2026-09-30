# Audit Keamanan - Modul Data Publik (SPMB, Layanan, Portal Orang Tua)

Tanggal audit: 2026-06-17

Metode: tinjauan kode statis (read-only). Tidak ada perubahan pada kode produksi.

---

## Cakupan

- `app/(public)/spmb/*`, `app/(public)/layanan/*`, `app/(public)/daftar-ortu/*`
- `app/parent/*` dan `app/s/page.tsx` (halaman berbagi Cloud Storage)
- `actions/parent.ts`, `lib/api-client.ts`, `lib/security.ts`
- `go-backend/internal/handlers/spmb_handler.go`, `parent_handler.go`, `mutasi_handler.go`,
  `contact_handler.go`, `alumni_handler.go`, `public_handler.go`
- `go-backend/internal/models/spmb.go`, `repository/spmb_repo.go`, `repository/parent_repo.go`
- `go-backend/cmd/api/routes.go`, `cmd/api/main.go`, `middleware/auth.go`, `middleware/csrf.go`

---

## Ringkasan

Modul publik secara umum sudah melewati hardening yang matang dibanding modul lain:

- **Otorisasi orang tua** konsisten. Setiap endpoint `/api/parent/*` memanggil
  `Repo.IsParentOf(userID, studentId)` sebelum menyentuh data anak (`parent_handler.go`).
  `CreateLeave`, `GetChildAttendance`, `GetChildSavings`, `GetChildStatement`, dan
  `CreateMutasiOut` semuanya membalas 403 bila bukan anaknya.
- **Proyeksi data publik SPMB** sudah diperbaiki. Endpoint publik lacak status memakai DTO
  `PublicRegistrantStatus` (tanpa NIK/KK/alamat/nama ortu/path dokumen), bukan lagi struct
  `SPMBRegistrant` mentah (`models/spmb.go`).
- **CORS** produksi ketat (allowlist eksplisit; origin dev hanya saat `ENV != production`),
  plus allowlist terpisah untuk CSRF di `middleware/csrf.go`.
- **Error handler** mengembalikan pesan generik ("Terjadi kesalahan internal") pada hampir
  semua jalur; tidak membocorkan stack trace atau query SQL.
- **Security headers** lengkap (CSP, X-Frame-Options DENY, nosniff, HSTS di produksi).
- **Rate limiting** tersedia untuk login, form publik, dan endpoint sensitif terautentikasi.

Namun masih ada celah nyata di area yang paling terekspos publik. Yang paling berdampak:
(1) endpoint publik SPMB daftar pendaftar membocorkan nama lengkap anak beserta hasil seleksi;
(2) enumerasi nomor registrasi SPMB karena formatnya berurut dan endpoint lacak belum dibatasi
laju; (3) tidak ada captcha/bot-protection pada form publik (spam dan brute force NISN);
(4) kontrak frontend dan backend SPMB tidak sinkron sehingga label "NIK (Disamarkan)"
menyesatkan; dan (5) CORS `AllowCredentials` menerima seluruh subdomain sekolah.

**Belum ditemukan** IDOR langsung yang membuka data anak orang lain (otorisasi orang tua
solid), dan halaman berbagi `/s` memakai token acak (bukan ID enumerable).

Ringkasan tingkat keparahan:

| Severity | Jumlah |
| -------- | ------ |
| Kritis   | 0      |
| Tinggi   | 2      |
| Sedang   | 5      |
| Rendah   | 5      |

---

## Temuan

### T1 - Endpoint publik membocorkan daftar nama anak yang sudah diproses (Tinggi)

- **File:** `go-backend/cmd/api/routes.go` (baris `publicGroup.GET("/spmb/registrants",
h.SPMB.GetPublicRegistrants)`), `go-backend/internal/handlers/spmb_handler.go`
  (`GetPublicRegistrants`), `go-backend/internal/repository/spmb_repo.go`
  (`GetPublicRegistrants`).
- **Detail:** Route `GET /api/public/spmb/registrants` (tanpa auth, di-cache 5 menit)
  mengembalikan seluruh pendaftar berstatus `accepted`, `promoted`, atau `rejected` beserta
  `registrationNumber`, `fullName`, dan `status`. Ini adalah **daftar nama lengkap anak-anak**
  (termasuk yang ditolak) yang dapat diambil massal lewat satu request `GET`.
- **Dampak nyata:** Siapa pun di internet dapat mengunduh daftar nama calon siswa beserta hasil
  seleksinya (diterima/ditolak) - pelanggaran privasi anak dan berpotensi menimbulkan
  diskriminasi maupun penargetan. Tidak ada halaman UI yang memakai endpoint ini (halaman lacak
  memakai `/spmb/registrants/:number`), sehingga tampak sebagai sisa desain lama.

### T2 - Enumerasi nomor registrasi SPMB (Tinggi)

- **File:** `go-backend/internal/repository/spmb_repo.go` (`CreateRegistrant` menghasilkan
  `regNum := fmt.Sprintf("SPMB-%d-%04d", year, lastCount+1)`),
  `app/(public)/spmb/tracking/page.tsx`, `app/(public)/spmb/verify/detail/client-page.tsx`.
- **Detail:** Nomor registrasi SPMB berformat berurut `SPMB-<tahun>-<urut>` sehingga dapat
  diprediksi. Endpoint lacak status `GET /api/public/spmb/registrants/:number` hanya membutuhkan
  nomor registrasi (tanpa faktor kedua seperti NISN atau tanggal lahir), dan **tidak berada di
  bawah rate limiter** (`publicFormLimit`) - route ini terdaftar sebagai GET di `publicGroup`.
  Penyerang dapat mengiterasi `SPMB-2026-0001` sampai `9999` dan memperoleh `fullName` serta
  `status` setiap pendaftar. Sebagai perbandingan, mutasi sudah lebih baik: `GetPublicMutasiStatus`
  menuntut `regNum` **dan** `nisn`.
- **Dampak nyata:** Kebocoran massal nama dan status penerimaan seluruh pendaftar, serta
  memudahkan penargetan anak. Halaman verifikasi QR (`/spmb/verify/detail`) memakai `id` yang
  sama sehingga ikut dapat dienumerasi.

### T3 - Tidak ada captcha / bot-protection pada form publik (Tinggi, dampak Sedang)

- **File:** `app/(public)/layanan/mutasi-masuk/page.tsx` (memanggil `POST /api/mutasi/request`),
  `app/(public)/layanan/kritik-saran-pengaduan/page.tsx` (memanggil `POST /api/public/contact`),
  `app/(public)/daftar-ortu/page.tsx` (`verifyStudentAction`, `registerParentAction`),
  `go-backend/cmd/api/routes.go` (`publicFormLimit`).
- **Detail:** Semua form publik hanya dilindungi rate limiter berbasis IP (`publicFormLimit`:
  5 permintaan per 15 menit per IP). Tidak ada captcha, proof-of-work, atau honeypot. Endpoint
  verifikasi ortu `POST /api/public/parent/verify` (NISN + tanggal lahir) dan
  `POST /api/public/parent/register` dapat di-brute force dari banyak IP (botnet/proxy) untuk
  menebak kombinasi NISN + tanggal lahir yang berentropi rendah (NISN 10 digit; tanggal lahir
  anak sering diketahui pihak lain).
- **Dampak nyata:** (a) spam pada form kontak dan mutasi; (b) brute force NISN untuk mengaitkan
  akun orang tua ke anak yang bukan miliknya lewat pendaftaran akun - `Register` menautkan
  `user_id` ke `student_id` hanya berdasarkan NISN + tanggal lahir yang benar. Rate limit per-IP
  mudah dilewati karena aplikasi berjalan di balik Cloudflare Tunnel dengan `ExtractIPFromXFFHeader`.

### T4 - Kontrak publik SPMB tidak sinkron; label "NIK (Disamarkan)" menyesatkan (Sedang)

- **File:** `app/(public)/spmb/verify/detail/client-page.tsx` (membaca `result.studentNik` lalu
  menampilkannya sebagai "NIK (Disamarkan)"; `periodName` di-hardcode menjadi "PPDB Utama";
  `verifiedAt: result.createdAt` bertanda komentar `// Mocking`),
  `app/(public)/spmb/tracking/page.tsx` (menampilkan `registrant.gender`, `registrant.address`,
  `registrant.distanceToSchool`, `registrant.createdAt`), `go-backend/internal/models/spmb.go`
  (`PublicRegistrantStatus` hanya memuat ID/registrationNumber/fullName/status/notes/periodId/createdAt).
- **Detail:** Endpoint publik kini mengembalikan DTO minimal, tetapi frontend belum disesuaikan.
  Akibatnya halaman verifikasi menampilkan label "NIK (Disamarkan)" dengan nilai kosong (kebetulan
  aman, tapi menyesatkan dan rapuh), halaman lacak menampilkan kolom Alamat, Jarak, dan Jenis
  Kelamin yang kosong, dan nama periode di-hardcode.
- **Dampak nyata:** Bukan kebocoran langsung, tetapi UI menyiratkan NIK disamarkan padahal hanya
  tidak dikirim (rasa aman palsu). Risiko regresi: bila seseorang "memperbaiki" UI dengan menambah
  field dari struct penuh, PII akan bocor lagi. Perlu kontrak eksplisit dan masking server-side
  bila NIK memang ingin ditampilkan sebagian (mis. `3174********1234`).

### T5 - Halaman verifikasi QR publik menerima enumerasi `id` tanpa pembatasan (Sedang)

- **File:** `app/(public)/spmb/verify/detail/client-page.tsx` (memanggil
  `GET /api/public/spmb/registrants/` diikuti `id`), `app/(public)/spmb/tracking/page.tsx`,
  `go-backend/cmd/api/routes.go` (`GET /spmb/registrants/:number`).
- **Detail:** `id` yang dipakai adalah `registrationNumber` (dapat dienumerasi, lihat T2) yang
  dioper sebagai path param ke endpoint lacak publik. Route ini tidak berada di bawah rate limiter.
- **Dampak nyata:** Memperkuat T2; memungkinkan scraping massal data pendaftar (nama, status)
  dengan biaya sangat rendah.
