# Audit Kematangan Handler & Konfigurasi `integrations/cloudstorage`

**Cakupan:** `internal/handler`, `internal/config`, serta keterkaitannya dengan `cmd/server/main.go` (routing/middleware) dan `internal/service`.

**File target yang ditinjau:**

- `integrations/cloudstorage/internal/handler/handler.go`
- `integrations/cloudstorage/internal/handler/handler_test.go`
- `integrations/cloudstorage/internal/config/config.go`
- `integrations/cloudstorage/internal/config/config_test.go`

**Referensi pendukung (dibaca, tidak diubah):** `cmd/server/main.go`, `internal/service/service.go`, `internal/repository/repository.go`, `internal/model/model.go`, `internal/crypto/crypto.go`.

> Catatan metodologi: temuan diberi peringkat **Kritis / Tinggi / Sedang / Rendah**. Setiap temuan disertai bukti `file:line`. Nomor baris mengacu pada isi file saat audit. Tidak ada kode produksi yang diubah dalam audit ini.

---

## 1. Ringkasan Eksekutif

Handler HTTP cloudstorage secara umum **fungsional dan cukup matang**: pemisahan `internalError`/`byIDError` konsisten, paginasi punya batas atas, upload menangani multi-file dengan status `207 Multi-Status`, dan auth middleware memakai `subtle.ConstantTimeCompare`. Konfigurasi juga memiliki default yang wajar.

Namun ada beberapa kelemahan berarti:

- **Otorisasi hanya bersifat "all-or-nothing"** — jika `AUTH_TOKEN` kosong, seluruh API terbuka untuk publik, termasuk upload/hapus permanen (temuan **Kritis** bila dijalankan tanpa token di jaringan yang dapat dijangkau).
- **Enkripsi diam-diam tidak aktif** bila `ENCRYPTION_ENABLED=true` tetapi `ENCRYPTION_KEY` kosong/invalid, tanpa peringatan fatal saat startup (temuan **Tinggi**).
- **Tidak ada rate limit pada endpoint API selain `/api/login`** — upload/download/delete tidak dibatasi (temuan **Tinggi**).
- **Cakupan test tipis**: `handler_test.go` hanya menguji sebagian kecil dari ~20 endpoint, dan hampir semua skenario status 500/207/validasi tidak diuji (temuan **Sedang**).
- **Config tidak memvalidasi nilai wajib/kritis** (port, ukuran, key enkripsi) saat load (temuan **Sedang**).

---

## 2. Temuan Bertingkat

### KRITIS

#### K-1. Tidak ada otorisasi ketika `AUTH_TOKEN` kosong — seluruh API terbuka

**Bukti:**

- `cmd/server/main.go:120` — `if cfg.AuthToken != "" { app.Use(authMiddleware(cfg)) }`. Middleware auth **hanya dipasang jika token diisi**. Jika kosong, tidak ada proteksi sama sekali.
- `internal/handler/handler.go:35` — `GetConfig` mengembalikan `auth_required: false`, memberi sinyal ke frontend bahwa auth tidak aktif.
- `internal/config/config.go:31` — `AuthToken: getEnv("AUTH_TOKEN", "")` — default kosong.
- `internal/service/service.go:56` — `AuthRequired()` hanya `s.cfg.AuthToken != ""`.

**Dampak:** Pada deployment tanpa `AUTH_TOKEN`, siapa pun dapat memanggil `/api/files` (upload), `/api/files/:id` (DELETE), `/api/trash` (DELETE), `/api/files/:id/share`, dsb. Ini adalah kegagalan autorisasi total.

**Rekomendasi:**

1. Tolak startup (`log.Fatal`) bila `AUTH_TOKEN` kosong kecuali flag eksplisit "insecure/dev mode" diberikan.
2. Dokumentasikan sebagai syarat deployment wajib di `SETUP.md`/`DEPLOYMENT.md`.
3. Beri peringatan startup yang mencolok (saat ini hanya ada peringatan untuk Telegram, bukan untuk auth).

---

### TINGGI

#### T-1. Enkripsi "enabled" tetapi tidak berfungsi senyap tanpa key valid

**Bukti:**

- `internal/service/service.go` (UploadFile) — `if s.cfg.EncryptionEnabled && s.cfg.EncryptionKey != "" { ... Encrypt ... }`. Bila `EncryptionEnabled=true` namun `EncryptionKey` kosong, file **di-upload dalam keadaan polos** dan `Encrypted=false`, tanpa error.
- `internal/config/config.go:34` — `EncryptionEnabled: getEnv("ENCRYPTION_ENABLED", "false") == "true"` — parsing longgar, tidak ada validasi bahwa key ada saat enabled.
- `internal/crypto/crypto.go` — `Encrypt`/`Decrypt` mengembalikan plaintext apa adanya bila `key == ""`, sehingga kegagalan konfigurasi tidak terdeteksi.

**Dampak:** Operator mengira data terenkripsi padahal tidak. Risiko kepatuhan dan kebocoran data.

**Rekomendasi:**

1. Validasi saat startup: bila `EncryptionEnabled=true` dan `EncryptionKey==""` → `log.Fatal`.
2. Validasi bahwa `EncryptionKey` adalah 64 hex char (32 byte) sesuai `crypto.go`; gagal → fatal.
3. Pertimbangkan menolak upload bila `EncryptionEnabled` tapi key tidak dapat di-decode.

#### T-2. Rate limit hanya untuk `/api/login`

**Bukti:**

- `cmd/server/main.go:127` — `api.Post("/login", loginHandler(cfg, newRateLimiter(time.Minute, 10)))`. Rate limiter hanya dipasang pada login.
- Endpoint mahal/tulis lainnya (`/api/files` upload, `/api/search`, `/api/files/:id/download`) tidak memiliki limiter.

**Dampak:** DoS melalui upload berulang atau download besar tidak dibatasi; `/api/search` melakukan query `LIKE` tanpa batas laju.

**Rekomendasi:**

1. Pasang rate limit global (per-IP) pada grup `/api`, dengan limit lebih ketat untuk endpoint tulis/upload.
2. Pertimbangkan middleware Fiber `limiter` dengan storage persisten bila multi-instance.

#### T-3. `MaxUploadSize` negatif/`0` dapat menghasilkan `BodyLimit` tidak konsisten

**Bukti:**

- `internal/config/config.go:33` — `MaxUploadSize: getEnvInt64("MAX_UPLOAD_SIZE", 2048*1024*1024)`. Bila env berisi angka negatif, nilainya diterima apa adanya.
- `cmd/server/main.go:109` — `BodyLimit: int(cfg.MaxUploadSize + 1*1024*1024)`. Jika `MAX_UPLOAD_SIZE` negatif atau sangat kecil, body limit menjadi tidak masuk akal (mis. ≤ 1MB) atau non-positif.
- `internal/service/service.go` (`MaxUploadSize()`) mem-fallback ke default bila `<= 0`, tetapi `BodyLimit` di `main.go` **tidak** memakai fallback ini, sehingga ada inkonsistensi: config melaporkan nilai default tetapi Fiber memberlakukan batas lain.

**Dampak:** Perilaku tak terduga; upload gagal dengan error framework yang tidak deskriptif, atau batas tidak konsisten antara yang dilaporkan `/api/config` dan yang diberlakukan.

**Rekomendasi:**

1. Normalisasi di `config.Load()`: bila `MaxUploadSize <= 0`, set ke default.
2. `main.go` sebaiknya menggunakan `svc.MaxUploadSize()` (satu sumber kebenaran) untuk `BodyLimit`.

#### T-4. Handler tidak memvalidasi ID path dan query `parent_id`

**Bukti:**

- `internal/handler/handler.go` — `GetFile`, `DeleteFile`, `RenameFile`, `CreateShareLink`, `PermanentDelete`, dll. langsung memakai `c.Params("id")` tanpa validasi format (mis. panjang/karakter).
- `ListFiles` — `parent_id` diterima apa adanya sebagai `*string` tanpa validasi keberadaan folder.
- ID salah bergantung pada `sql.ErrNoRows` untuk mengembalikan 404; jika format ID aneh memicu error lain, bisa keluar 500.

**Dampak:** Terutama kebersihan API dan potensi pesan error 500 untuk input tak terduga; bukan injeksi (query ter-parameterisasi) tetapi kurang matang.

**Rekomendasi:**

1. Validasi `id` non-kosong dan (opsional) pola hex sebelum memanggil service.
2. Untuk `parent_id`, kembalikan 400/404 yang jelas bila folder tidak ada.

---

### SEDANG

#### S-1. Cakupan test handler sangat terbatas

**Bukti:**

- `internal/handler/handler_test.go:26-32` — hanya 5 route yang diregistrasi di app test: `POST /folders`, `GET /files/:id`, `DELETE /files/:id`, `POST /files/:id/share`, `DELETE /files/:id/share`.
- Endpoint yang **tidak** diuji di `handler_test.go`: `GetConfig`, `HealthCheck`, `ListFiles`, `UploadFile` (validasi multipart / `file is required` / 207), `ListAllFolders`, `RenameFile`, `SharedPage`, `DownloadSharedFile`, `CopyFiles`, `MoveFiles`, `Search`, `DownloadFile`, `Thumbnail`, `ListTrash`, `RestoreFile`, `RestoreAll`, `EmptyTrash`, `PermanentDelete`.
- Tidak ada test untuk: `internalError` dengan `*fiber.Error`, `byIDError` untuk error non-`ErrNoRows`, validasi `limit`/`offset` di `ListFiles`, header `X-Total-Count`/`X-Has-More`.

Catatan: sebagian endpoint (upload, pagination, CSRF, auth, login, trash) diuji di `cmd/server/main_test.go`, namun bukan di paket `handler` itu sendiri, sehingga unit test handler kurang.

**Dampak:** Regresi pada handler mudah lolos; matriks status code tidak terjaga.

**Rekomendasi:** Tambah test tabel per endpoint yang mencakup happy path, body invalid (400), not found (404), validasi `limit`/`offset`, `UploadFile` tanpa file (400), multi-file partial (207), serta `byIDError` untuk error generik (500).

#### S-2. Status code tidak seragam dan beberapa titik ambigu

**Bukti:**

- `internal/handler/handler.go` — `CreateFolder` dan `RenameFile` menggunakan `fiber.StatusBadRequest` untuk **semua** error service, termasuk error internal tak terduga (mis. gagal generate ID / error DB) yang seharusnya 500.
- `UploadFile` — kegagalan satu-satunya upload mengembalikan **500**, padahal bisa jadi karena input tidak valid.
- `CreateFolder` sukses mengembalikan **200 OK** (bukan 201 Created) — `handler_test.go:64` mengunci ekspektasi ini.
- `CopyFiles`/`MoveFiles` — error apapun (termasuk target tidak ada) dipetakan ke 400; `NotFound` untuk target yang hilang tidak dibedakan.

**Dampak:** Klien sulit membedakan kesalahan klien vs server; observability/alerting terganggu.

**Rekomendasi:**

1. Bedakan error validasi (400/422) dari error internal (500), idealnya dengan sentinel error dari service.
2. Gunakan 201 untuk pembuatan resource secara konsisten.
3. Dokumentasikan matriks status di `API.md`.

#### S-3. Konfigurasi tidak memvalidasi nilai wajib/kritis saat load

**Bukti:**

- `internal/config/config.go:23-37` — `Load()` hanya membaca env tanpa validasi.
- `Port` (`config.go:25`) diterima string bebas; `Port=abc` baru gagal di `main.go` saat `app.Listen`.
- `getEnvInt64` (`config.go:41-47`) diam-diam fallback ke default bila parse gagal — tidak ada peringatan, sehingga salah tulis env tidak terdeteksi.
- `EncryptionEnabled` parsing ketat `== "true"` (`config.go:34`): nilai `1`, `TRUE`, `yes` dianggap **false** tanpa peringatan.

**Dampak:** Kesalahan konfigurasi tersembunyi; operator tidak tahu env diabaikan.

**Rekomendasi:**

1. Tambah `Validate()` yang mengembalikan error dan dipanggil dari `main.go`; gagal → `log.Fatal`.
2. Log peringatan saat parse env gagal/fallback.
3. Terima nilai boolean yang lebih toleran (`strconv.ParseBool`) atau validasi nilai yang diizinkan.

#### S-4. `AllowedOrigins` / CORS default kurang ketat dan mudah salah konfigurasi

**Bukti:**

- `cmd/server/main.go` (`corsConfig`) — bila `cfg.AllowedOrigins == ""`, dipakai `cors.ConfigDefault`. `ConfigDefault` Fiber mengizinkan semua origin (`*`) dengan metode/header luas, yang dapat tidak sinkron dengan CSRF middleware yang memakai daftar origin berbeda.
- `internal/config/config.go:35` — default `AllowedOrigins` kosong.
- `cmd/server/main.go` (`csrfMiddleware`) — memperlakukan origin kosong sebagai "diizinkan" (bypass), sehingga klien non-browser tanpa `Origin` lolos.

**Dampak:** Default `*` untuk CORS berisiko; ada dua sumber kebenaran origin (CORS vs CSRF) yang bisa tidak sinkron.

**Rekomendasi:**

1. Default `AllowedOrigins` ke nilai konservatif (mis. hanya host sendiri) atau jadikan wajib untuk produksi.
2. Gunakan satu sumber daftar origin untuk CORS dan CSRF middleware.

#### S-5. `HealthCheck` membocorkan detail konfigurasi

**Bukti:**

- `internal/handler/handler.go` (`HealthCheck`) — mengembalikan `telegram_api` (nilai `cfg.TelegramAPI`) ke klien.
- Route health berada di grup `/api` (`main.go`), sehingga ikut terproteksi hanya bila `AUTH_TOKEN` diisi (lihat K-1).

**Dampak:** Kebocoran informasi konfigurasi minor; pada mode tanpa auth, health endpoint terbuka.

**Rekomendasi:** Jangan kembalikan nilai konfigurasi pada health; cukup boolean `configured`/`not_configured`. Pertimbangkan health endpoint terpisah tanpa info sensitif.

---

### RENDAH

#### R-1. Validasi MIME tipe file rapuh

**Bukti:** `internal/service/service.go` (UploadFile) — membandingkan `http.DetectContentType(data)` dengan header `Content-Type` klien, dengan pengecualian longgar `application/*`. Jika klien tidak mengirim `Content-Type` (nilai kosong), perbandingan dapat berperilaku tak terduga.

**Dampak:** Rendah; validasi bisa dilewati atau justru menolak file valid.

**Rekomendasi:** Jangan bergantung pada header klien; jadikan hasil `DetectContentType` sebagai kebenaran (sudah disimpan ke `f.MimeType`) dan longgarkan aturan mismatch agar tidak menolak false positive.

#### R-2. `SharedPage` membangun HTML dengan `fmt.Sprintf` tanpa escaping

**Bukti:** `internal/handler/handler.go` (`SharedPage`) — `fmt.Sprintf(...)` menyisipkan `f.Name` langsung ke HTML. `f.Name` berasal dari nama file yang bisa mengandung `<`/`>`.

**Dampak:** Potensi stored XSS pada halaman share publik. Rendah karena nama file berasal dari upload terotentikasi (bila auth aktif), tetapi tetap cacat.

**Rekomendasi:** Escape nilai dengan `html.EscapeString` atau gunakan `html/template`.

#### R-3. Kualitas test: `panic`, body tidak ditutup, DB tidak ditutup

**Bukti:** `internal/handler/handler_test.go:43-56` memakai `panic(err)` alih-alih `t.Fatal`; beberapa pemanggilan (mis. `handler_test.go:60`) mengabaikan `resp.Body.Close()`; `newTestHandler` membuat DB temporer namun tidak menutup `*sql.DB` (hanya `os.Remove`).

**Dampak:** Sinyal kegagalan test kurang rapi dan berpotensi resource leak kecil pada suite test.

**Rekomendasi:** Gunakan `t.Fatal`, tutup body via `defer resp.Body.Close()`, dan tutup DB pada `t.Cleanup`.

#### R-4. `getEnvInt64` tidak memvalidasi rentang

**Bukti:** `internal/config/config.go:41-47` menerima nilai negatif. Test `config_test.go` hanya menguji fallback bila parse gagal (`TestLoadInvalidIntFallsBack`) dan override valid (`TestLoadOverrides`), tetapi tidak menguji nilai negatif/nol.

**Dampak:** Nilai env yang tidak masuk akal (`SHARE_EXPIRY_DAYS=-1`, `THUMB_CLEAN_HOURS=0`) diterima tanpa peringatan.

**Rekomendasi:** Validasi rentang per field (mis. `>= 0`) dan tambahkan test untuk rentang tersebut.

---

## 3. Cakupan Test (Ringkasan)

### `handler_test.go`

| Aspek                               | Status                                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Validasi request (body invalid 400) | Hanya `POST /folders` nama kosong (`TestCreateFolderValidation`)                                                                         |
| Status code 404                     | Diuji untuk get/delete/share (`TestGetFileNotFound`, `TestDeleteFileNotFound`, `TestCreateShareLinkNotFound`, `TestRevokeShareNotFound`) |
| 500 / 207 / 400 validasi lain       | Tidak diuji                                                                                                                              |
| `GetConfig`, `HealthCheck`          | Tidak diuji                                                                                                                              |
| `UploadFile`                        | Tidak diuji di paket handler                                                                                                             |
| Paginasi `ListFiles`                | Tidak diuji di paket handler                                                                                                             |
| Otorisasi/auth                      | Tidak diuji di paket handler (ada di `cmd/server/main_test.go`)                                                                          |

### `config_test.go`

| Aspek                                                | Status                                                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Default value                                        | Diuji (`TestLoadDefaults`) — namun tidak mencakup `ShareExpiryDays`, `ThumbCleanHours`, `EncryptionEnabled`, `EncryptionKey`, `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` |
| Override valid                                       | Diuji (`TestLoadOverrides`)                                                                                                                                        |
| Parse int gagal → fallback                           | Diuji (`TestLoadInvalidIntFallsBack`)                                                                                                                              |
| Nilai negatif/nol                                    | Tidak diuji                                                                                                                                                        |
| Validasi `EncryptionEnabled` (nilai boolean longgar) | Tidak diuji                                                                                                                                                        |
| `Validate()`/kewajiban env                           | Tidak ada (fungsi pun tidak ada)                                                                                                                                   |

---

## 4. Kekuatan (Positif)

- Pemisahan error helper `internalError`/`byIDError` yang konsisten (`handler.go`).
- Auth memakai perbandingan waktu konstan `subtle.ConstantTimeCompare` (`main.go`).
- CSRF middleware untuk request stateful lintas-origin (`main.go` `csrfMiddleware`).
- Rate limit brute-force pada login (`main.go` `newRateLimiter`).
- Validasi nama file unik & penanganan race dengan unique index (`service.go`, `repository.go`).
- Paginasi dengan batas atas (`limit` di-clamp ke maksimum 1000) dan header `X-Total-Count`/`X-Has-More` (`handler.go` `ListFiles`).
- Upload multi-file dengan respons parsial `207 Multi-Status` dan `UploadResponse` yang terstruktur (`handler.go` `UploadFile`, `model.UploadResponse`).
- Share link dengan expiry opsional & auto-revoke saat kadaluarsa (`service.go` `GetSharedFile`).

---

## 5. Matriks Prioritas Rekomendasi

| Prioritas | Item          | Aksi utama                                                                  |
| --------- | ------------- | --------------------------------------------------------------------------- |
| P0        | K-1           | Wajibkan `AUTH_TOKEN` (atau mode dev eksplisit); jangan biarkan API terbuka |
| P0        | T-1           | Fail-fast bila enkripsi aktif tanpa key valid                               |
| P1        | T-2           | Rate limit global pada `/api`, khusus endpoint tulis/upload                 |
| P1        | T-3           | Normalisasi `MaxUploadSize`; satukan sumber `BodyLimit`                     |
| P2        | T-4, S-1, S-2 | Validasi ID, tambah unit test handler, seragamkan status code               |
| P2        | S-3, S-4      | Tambah `Validate()` config & satukan sumber origin CORS/CSRF                |
| P3        | S-5, R-1..R-4 | Perbaikan minor keamanan/kebersihan & ketahanan test                        |

---

## 6. Catatan

Audit ini **tidak mengubah kode produksi**. File yang dibuat/diubah hanya dokumen ini (`docs/cloudstorage-audit-handler.md`). Untuk verifikasi test dapat dijalankan `go test ./...` di direktori `integrations/cloudstorage` (tidak dijalankan dalam audit ini).
