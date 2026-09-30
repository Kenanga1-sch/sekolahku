# Audit Kematangan: Cloudstorage (Repository, Telegram Client, Wiring Server)

Tanggal: 2026-09-29
Ruang lingkup:

- `integrations/cloudstorage/internal/repository/repository.go`
- `integrations/cloudstorage/internal/repository/repository_test.go`
- `integrations/cloudstorage/internal/telegram/client.go`
- `integrations/cloudstorage/cmd/server/main.go`
- `integrations/cloudstorage/cmd/server/main_test.go`

Dokumen ini murni analisis. Tidak ada kode produksi yang diubah.

---

## Ringkasan Eksekutif

Repo cloudstorage berada pada tingkat kematangan **"prototipe fungsional dengan utang teknis berat"**.
Logika bisnis (cascade delete/restore, resolusi nama unik, share link) cukup matang dan teruji,
namun terdapat **cacat yang membuat proyek tidak dapat di-compile** dan **sejumlah bug kebenaran
(correctness) pada klien Telegram** yang tidak terdeteksi karena tidak ada satu pun test untuk
lapisan tersebut.

| Area                                 | Tingkat Kematangan | Risiko Dominan                                                                                                      |
| ------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Repository (query/transaksi/migrasi) | Sedang             | Migrasi tersembunyi yang memutasi data, kolom `created_at` hilang saat scan, race SQLite                            |
| Telegram client                      | Rendah             | Tidak bisa di-compile; body response selalu tertutup; timeout download bertabrakan                                  |
| Wiring `cmd/server`                  | Sedang-Bawah       | Tidak bisa di-compile (handler memanggil API service yang tidak ada); graceful shutdown keliru; observability minim |
| Test                                 | Rendah             | Tidak ada test telegram; test repo sangat tipis; tidak ada test migrasi/rollback                                    |

---

## Temuan Bertingkat

Legenda tingkat: **BLOCKER** (tidak bisa dibangun/jalan), **KRITIS** (kebenaran/kehilangan data),
**TINGGI** (keandalan/keamanan), **SEDANG** (perawatan/performa), **RENDAH** (kebersihan).

### BLOCKER-1 — Paket `handler` memanggil API `Service` yang tidak ada (gagal compile)

`cmd/server/main.go` dan `internal/handler/handler.go` berada di binary yang sama, dan
`handler.HealthCheck` memanggil `h.svc.Repo()` dan `h.svc.Cfg()`, serta mengakses `...Repo().DB`.

Bukti:

- `internal/handler/handler.go:58` — `if h.svc == nil || h.svc.Repo() == nil || h.svc.Repo().DB == nil {`
- `internal/handler/handler.go:64` — `if err := h.svc.Repo().DB.Ping(); err != nil {`
- `internal/handler/handler.go:73` — `if cfg := h.svc.Cfg(); cfg != nil && cfg.TelegramAPI != "" {`
- `internal/service/service.go:26-30` — struct `Service` hanya punya field `repo`, `cfg`, `telegram`; tidak ada method `Repo()` maupun `Cfg()`.
- Pencarian `func (s *Service) Repo` dan `func (s *Service) Cfg` → **tidak ada hasil** di seluruh repo.

Dampak: `go build ./...` dan `go test ./...` gagal, sehingga seluruh rangkaian test
(`cmd/server/main_test.go`, `handler_test.go`) tidak bisa dieksekusi. Status "hijau" proyek
tidak dapat dipercaya.

Rekomendasi (tanpa mengubah sekarang): tambahkan aksesor pada `Service`
(`func (s *Service) Repo() *repository.Repository` dan `func (s *Service) Cfg() *config.Config`),
atau ubah `HealthCheck` agar memakai method eksplisit seperti `svc.Healthy(ctx) error`.
Jangan ekspos field `DB` mentah; bungkus dengan `func (r *Repository) Ping(ctx) error`.

### BLOCKER-2 — `telegram/client.go` memanggil `doAPICall` sebagai fungsi bebas, padahal method

`doAPICall` didefinisikan sebagai method `*Client`, tetapi semua pemanggil memanggilnya sebagai
fungsi level paket.

Bukti:

- `internal/telegram/client.go:63` — `func (c *Client) doAPICall(req *http.Request) (*http.Response, error) {`
- `internal/telegram/client.go:197` — `resp, err := doAPICall(req)` (dalam `UploadFile`)
- `internal/telegram/client.go:236` — `resp, err := doAPICall(req)` (dalam `DeleteMessage`)
- `internal/telegram/client.go:283` — `resp, err := doAPICall(req)` (dalam `getFileOnce`)
- `internal/telegram/client.go:322` — `resp, err := doAPICall(req)` (dalam `DownloadFileWithRange`)

Dampak: `undefined: doAPICall` → paket telegram gagal compile.

Rekomendasi: panggil `c.doAPICall(req)`.

### BLOCKER-3 — `telegram/client.go` memakai `hex.DecodeString` tanpa import `encoding/hex`

Bukti:

- `internal/telegram/client.go:366` — `keyBytes, err := hex.DecodeString(key)` (dalam `Encrypt`)
- `internal/telegram/client.go:398` — `keyBytes, err := hex.DecodeString(key)` (dalam `Decrypt`)
- Daftar import (`internal/telegram/client.go:3-16`) tidak memuat `encoding/hex`.

Dampak: `undefined: hex` → gagal compile.

Catatan tambahan: `Encrypt`/`Decrypt` di `telegram/client.go` adalah **duplikat** dari
`internal/crypto/crypto.go` yang sudah benar dan dipakai oleh service. Kode kripto di klien
telegram adalah dead code dan sebaiknya dihapus, bukan diperbaiki.

### KRITIS-1 — `doAPICall` menutup `resp.Body` via `defer` sebelum pemanggil membacanya

Body response ditutup oleh `defer resp.Body.Close()` di dalam `doAPICall`, lalu `resp`
dikembalikan ke pemanggil yang kemudian men-decode `resp.Body`.

Bukti:

- `internal/telegram/client.go:64-69` — `resp, err := c.client.Do(req)` ... `defer resp.Body.Close()`
- Pemakaian setelah pemanggilan: `internal/telegram/client.go:205` (`json.NewDecoder(resp.Body).Decode`),
  serta jalur serupa di `DeleteMessage`, `getFileOnce`, dan `DownloadFileWithRange`.

Dampak: setiap decode body akan gagal (`http: read on closed response body`), sehingga seluruh
operasi unggah/hapus/ambil file Telegram rusak total. Ini juga memboroskan koneksi karena body
tidak pernah di-close oleh pemanggil dengan benar.

Rekomendasi: jangan `defer Close()` pada response yang dikembalikan; serahkan penutupan ke
pemanggil. Khusus path retry 429, tutup body sebelum retry.

### KRITIS-2 — `CreatedAt` tidak pernah di-scan (kehilangan data diam-diam)

Query memilih `fileColumns` yang **tidak memuat `created_at`**, tetapi `CreateFile` meng-insert
kolom itu dan `scanFile` tidak memindainya. Nilai `File.CreatedAt` hasil query selalu nol.

Bukti:

- `internal/repository/repository.go:16` — konstanta `fileColumns` = `... encrypted, updated_at, deleted_at, share_token, share_expires_at` (tanpa `created_at`).
- `internal/repository/repository.go:187-191` — `INSERT INTO files (..., created_at, updated_at, ...)`.
- `internal/repository/repository.go:246-250` — `scanFile` memindai kolom tanpa `created_at`.
- `internal/model/model.go:14` — `CreatedAt` ada di model.
- `internal/repository/repository.go` (`GetAllActivePaths`) memakai `scanFile` ini juga.

Dampak: setiap `GetFile`/`ListFiles`/`ListTrash` mengembalikan `created_at = 0`. Data usia/urutan
file hilang di API walau tersimpan di DB. `TestRepository_CRUD` menetapkan `CreatedAt` tapi tidak
pernah memverifikasinya setelah baca, sehingga bug ini lolos.

Rekomendasi: tambahkan `created_at` ke `fileColumns` dan ke urutan `scanFile`, lalu tambahkan
assertion `got.CreatedAt == now` di `repository_test.go`.

### KRITIS-3 — `WithTx` tidak mengisi `sqlDB`; transaksi bersarang akan panic (nil pointer)

`WithTx` membuat `txRepo := &Repository{db: tx}` tanpa mengisi `sqlDB`. Jika dalam callback
`fn` dipanggil `WithTx` lagi, `r.sqlDB.Begin()` akan memanggil method pada pointer nil → panic.
Semua operasi lain memakai `r.db` sehingga tidak terpengaruh, tetapi kontraknya tidak aman.

Bukti:

- `internal/repository/repository.go:38-41` — `tx, err := r.sqlDB.Begin()`.
- `internal/repository/repository.go:44` — `txRepo := &Repository{db: tx}` (field `sqlDB` sengaja dibiarkan nil).
- `internal/service/service.go` memanggil `WithTx` di banyak tempat (`CreateFolder`, `UploadFile`,
  `DeleteFile`, `RestoreFile`, `RestoreAll`, `EmptyTrash`, `PermanentDelete`, `CopyFiles`, `MoveFiles`).

Dampak: rapuh terhadap perubahan; nested transaksi → panic runtime, bukan error yang tertangani.

Rekomendasi: simpan penanda `inTx bool` atau teruskan `*sql.Tx` eksplisit; jika `WithTx` dipanggil
saat sudah di dalam transaksi, cukup jalankan `fn(txRepo)` tanpa begin baru.

### KRITIS-4 — Timeout klien HTTP (60 detik) membunuh unduhan besar (30 menit)

`NewClient` menyetel `http.Client.Timeout = defaultTimeout` (60 detik). Timeout ini berlaku untuk
**seluruh durasi request termasuk streaming body**, sehingga mengabaikan konteks
`DownloadFileWithRange` yang berniat 30 menit.

Bukti:

- `internal/telegram/client.go:20-24` — `defaultTimeout = 60 * time.Second`, `downloadTimeout = 30 * time.Minute`.
- `internal/telegram/client.go:38-43` — `client: &http.Client{Timeout: defaultTimeout}`.
- `internal/telegram/client.go` (`DownloadFileWithRange`) — `context.WithTimeout(context.Background(), downloadTimeout)`
  (konteks 30 menit, tetapi tetap dibatasi `Client.Timeout` 60 detik).

Dampak: unduhan file besar gagal `context deadline exceeded` walaupun kode lain berniat
melonggarkan batas. Ini menyalahi klaim dukungan file besar (`MAX_UPLOAD_SIZE` default 2 GiB di
`internal/config/config.go`).

Rekomendasi: untuk streaming, gunakan `http.Client` tanpa `Timeout` global dan andalkan
per-request `context` (unduh: `downloadTimeout`, unggah/meta: `defaultTimeout`). Atau buat dua
instance client terpisah.

### KRITIS-5 — Retry 429 memakai `req` yang body-nya sudah habis + menutup body dua kali

Pada saat menerima 429, `doAPICall` tidur lalu mengirim ulang `req` yang sama. Untuk request
ber-body (POST `sendDocument`), body sudah dikonsumsi siklus pertama sehingga retry mengirim body
kosong. Selain itu `resp.Body` ditutup via `defer` **dan** lewat `resp.Body.Close()` eksplisit di
dalam blok retry, sementara `resp2.Body` juga langsung di-close sebelum isinya dibaca pemanggil.

Bukti:

- `internal/telegram/client.go:73-99` — blok handling 429.
- `internal/telegram/client.go:88` — `resp.Body.Close()` di dalam loop retry.
- `internal/telegram/client.go:91` — `resp2.Body.Close()` sebelum `resp = resp2`.
- `internal/telegram/client.go:103` — mengembalikan `resp` (yang body-nya sudah ditutup).

Dampak: retry tidak berfungsi untuk upload; response yang dikembalikan sudah tertutup; tidak ada
pengecekan bila 429 berlanjut setelah `maxRetries`.

Rekomendasi: bangun ulang request + rewind body (mis. `req.GetBody`) pada tiap percobaan, tutup
body percobaan sebelumnya, dan periksa status akhir untuk mengembalikan error eksplisit
(`ErrRateLimited`).

### KRITIS-6 — `GetFile` selalu mengembalikan `size = 0` pada jalur sukses pertama

`GetFile` mengembalikan `filePath, 0, nil` ketika percobaan pertama sukses, mengabaikan nilai
`size` hasil `getFileOnce`. Ukuran hanya benar pada percobaan kedua.

Bukti:

- `internal/telegram/client.go` (`GetFile`) — `filePath, _, err := c.getFileOnce(fileID)` lalu `return filePath, 0, nil`.

Dampak: pemanggil yang butuh ukuran file mendapatkan 0 pada umumnya.

Rekomendasi: teruskan nilai size dari percobaan pertama: `return filePath, size, nil`.

### TINGGI-1 — Migrasi tersembunyi memutasi data pengguna saat startup

`InitDB` → `migrate` → `ensureUniqueNameIndex` tidak hanya membuat index, tetapi juga **mengubah
nama file duplikat** yang sudah ada (menambahkan sufiks ` (n)`). Ini migrasi data yang berjalan
diam-diam setiap startup, tanpa log, tanpa transaksi, dan tanpa batas.

Bukti:

- `internal/repository/repository.go:92-142` — `ensureUniqueNameIndex` memindai duplikat, lalu
  `db.Exec("UPDATE files SET name = ? WHERE id = ?", candidate, d.id)` sebelum membuat unique index.
- `internal/repository/repository.go:83-90` — `migrate` selalu memanggil `ensureUniqueNameIndex`.
- `internal/repository/repository.go:64-66` — `InitDB` memanggil `migrate` pada setiap boot.

Dampak: file pengguna bisa berganti nama tanpa notifikasi; jika proses mati di tengah loop,
terjadi rename parsial tanpa rollback. Untuk dataset besar, seluruh tabel dipindai sinkron saat boot.

Rekomendasi: jadikan migrasi bernomor (versioned) yang idempotent dan tercatat; bungkus dalam satu
transaksi; log jumlah rename; sediakan flag dry-run.

### TINGGI-2 — Konfigurasi SQLite tidak di-lock ke satu koneksi; PRAGMA hanya berlaku 1 koneksi

`PRAGMA journal_mode=WAL` dan `PRAGMA busy_timeout=5000` dieksekusi lewat `db.Exec` pada pool
koneksi standar `database/sql`. `busy_timeout` bersifat per-koneksi, sehingga koneksi lain di pool
tidak mendapatkannya. Tidak ada `db.SetMaxOpenConns(1)` maupun `_pragma` di DSN.

Bukti:

- `internal/repository/repository.go:69-77` — `sql.Open("sqlite", path)` lalu dua `db.Exec("PRAGMA ...")`;
  tidak ada `SetMaxOpenConns`/`SetConnMaxLifetime`.

Dampak: pada beban konkuren, error `SQLITE_BUSY: database is locked` masih mungkin terjadi karena
timeout tidak konsisten antar koneksi. Relevan dengan klaim penanganan konkuren di
`createFileWithUniqueName` (`internal/service/service.go`).

Rekomendasi: set `db.SetMaxOpenConns(1)` untuk SQLite (modernc), atau masukkan PRAGMA ke DSN
(`file:...?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)`) agar berlaku semua koneksi.

### TINGGI-3 — Graceful shutdown dianggap error oleh `log.Fatal`

`main` memanggil `log.Fatal(app.Listen(addr))`. Saat shutdown sinyal berhasil,
`Listen` mengembalikan error penutupan (mis. `http.ErrServerClosed`) yang akan dicetak sebagai
fatal dan membuat proses keluar dengan status non-nol — menyesatkan sistem manajer proses
(systemd/Docker) untuk menganggap crash.

Bukti:

- `cmd/server/main.go:47-53` — goroutine menangkap sinyal dan memanggil `app.ShutdownWithContext(ctx)`,
  error `Shutdown` sengaja diabaikan (`_ =`).
- `cmd/server/main.go:57` — `log.Fatal(app.Listen(addr))`.

Dampak: shutdown rapi tidak terdeteksi sebagai sukses; tidak ada log yang membedakan "sengaja berhenti"
vs "gagal start". Selain itu, bila `Shutdown` gagal (timeout 5 detik), tidak ada fallback paksa.

Rekomendasi: tangani error `Listen` secara eksplisit — abaikan `http.ErrServerClosed`/error saat
shutdown, catat error lain via `log.Printf` lalu `os.Exit(1)`; naikkan timeout shutdown atau buat
konfigurabel; log hasil `Shutdown`.

### SEDANG-1 — Duplikasi query antara `ListFiles` dan `ListFilesPage`

`ListFiles` mendelegasikan ke `listFiles(parentID, filter)` sementara `ListFilesPage` menulis ulang
pola query yang sama, termasuk dua cabang `parentID == nil`. Risiko divergensi filter/pengurutan.

Bukti:

- `internal/repository/repository.go:185-215` — `listFiles` dengan param `filter`.
- `internal/repository/repository.go:263-317` — `ListFilesPage` menyalin pola yang sama.

Rekomendasi: satukan menjadi satu helper dengan parameter opsional `limit, offset`.

### SEDANG-2 — `Search` memakai `LIKE '%...%'` (full table scan, leading wildcard)

`LOWER(name) LIKE '%query%'` tidak dapat memanfaatkan `idx_files_name`. `LOWER()` pada kolom juga
mematikan penggunaan index biasa.

Bukti:

- `internal/repository/repository.go:369-372` — `LOWER(name) LIKE ?` dengan `pattern := "%" + strings.ToLower(query) + "%"`.
- Index `idx_files_name` dibuat di `internal/repository/repository.go` (schema) tetapi tidak terpakai.

Dampak: performa pencarian menurun linear terhadap jumlah baris; ada `LIMIT 500` sebagai pengaman
hasil, tetapi biaya scan tetap penuh.

Rekomendasi: gunakan FTS5 atau kolom `name_normalized` dengan index, atau minimal prefix search
(`name LIKE 'query%'`) saat memungkinkan.

### SEDANG-3 — `GetAllActivePaths` berpotensi O(n·depth) dan tidak memoize

`resolve` rekursif ke atas untuk setiap node tanpa cache, memanggil ulang resolusi parent berulang
kali. Batas `depth > 100` hanya mencegah loop, bukan menurunkan kompleksitas.

Bukti:

- `internal/repository/repository.go` (`GetAllActivePaths`) — `resolve` rekursif per id di dalam loop `for id := range byID`.

Dampak: untuk pohon dalam, biaya kuadratik; dipanggil setiap pencarian (`service.Search`).

Rekomendasi: memoize hasil per id (map id->path) atau lakukan single-pass iteratif bottom-up.

### SEDANG-4 — `IsUniqueConstraint` mengandalkan pencocokan string error

Selain `sqlite.Error.Code()`, fungsi melakukan fallback
`strings.Contains(err.Error(), "UNIQUE constraint failed")` yang bisa memberi false positive untuk
unique index lain (mis. `share_token` bila kelak menjadi unique).

Bukti:

- `internal/repository/repository.go:145-159` — `IsUniqueConstraint`.

Rekomendasi: bergantung hanya pada kode extended SQLite (2067/19 + pesan terstruktur) atau periksa
nama index/kolom di pesan.

### SEDANG-5 — Rate limiter `main.go` menyimpan map tanpa eviksi (memory leak)

`rateLimiter.hits` di-key per IP dan entri lama dibersihkan hanya ketika IP tersebut diakses lagi.
IP yang berhenti mengakses tidak pernah dihapus.

Bukti:

- `cmd/server/main.go` — `rateLimiter`/`allow` (`l.hits[key]` di-trim berbasis waktu hanya untuk key yang diakses).
- Dipakai di `loginHandler(cfg, newRateLimiter(time.Minute, 10))` (`cmd/server/main.go`).

Rekomendasi: tambahkan pembersihan periodik (goroutine ticker) atau gunakan cache ber-TTL.

### SEDANG-6 — Tidak ada request logging / observability terstruktur

`buildApp` hanya memakai `recover.New()`; tidak ada middleware logger, request ID, atau metrik
latensi. Log hanya via `log.Printf` standar di beberapa titik, tanpa level atau korelasi.

Bukti:

- `cmd/server/main.go` — `app.Use(recover.New())`, `app.Use(cors.New(...))`, `app.Use(csrfMiddleware(cfg))`;
  tidak ada `logger.New`.
- `internal/handler/handler.go` — `log.Printf("internal error: %v", err)`, `log.Printf("upload failed: ...")` (tak terstruktur).

Rekomendasi: tambahkan middleware logger (Fiber) + request ID, dan pertimbangkan `log/slog` untuk
log terstruktur; beri label status health.

### RENDAH-1 — Field `From.isBot` tidak terekstrak karena unexported

`json` hanya mengisi field exported, sehingga `isBot` selalu false.

Bukti:

- `internal/telegram/client.go` — struct `From{ ID int64 ...; isBot bool `json:"isBot"` ... }`.

Rekomendasi: jadikan `IsBot bool` bila memang dipakai, atau hapus field yang tidak terpakai.

### RENDAH-2 — Artefak `_probe.tmp` tertinggal di root modul

`integrations/cloudstorage/_probe.tmp` berisi teks `"probe"` dan bukan bagian build (tidak ber-ekstensi `.go`).
Bukti: `integrations/cloudstorage/_probe.tmp`.

Rekomendasi: hapus dan pastikan `.gitignore` menutup pola artefak sementara.

### RENDAH-3 — Cookie sesi tanpa `HttpOnly`/`Secure`

Login page menulis cookie `token` via `document.cookie` tanpa `HttpOnly`/`Secure`, sehingga rentan
terhadap pencurian via XSS dan pengiriman lewat kanal non-TLS.

Bukti:

- `cmd/server/main.go` — `document.cookie = 'token=' + encodeURIComponent(token) + '; path=/; SameSite=Lax';`.

Rekomendasi: set cookie melalui server dengan `HttpOnly`, `Secure`, dan `SameSite`.

### RENDAH-4 — CSRF middleware melewatkan request tanpa `Origin`

Permintaan stateful tanpa header `Origin` diizinkan (komentar menyatakan ini untuk klien non-browser).
Klien yang tidak mengirim `Origin` bisa melewati proteksi; perlu dipertegas mengingat auth berbasis cookie.

Bukti:

- `cmd/server/main.go` — `csrfMiddleware`: `if origin == "" { return c.Next() }`.

Rekomendasi: untuk request berbasis cookie, tolak bila `Origin`/`Referer` absen (kecuali ada token CSRF eksplisit).

---

## Analisis Kualitas Test

### `repository_test.go`

- Hanya menguji CRUD happy-path: create, get, list, soft delete, list trash, restore, permanent delete.
- **Tidak menguji**: `WithTx` (commit/rollback), `migrate` & `ensureUniqueNameIndex`, `IsUniqueConstraint`,
  `GetAllActivePaths`, `CountByFileID`, `ListActiveFileIDs`, `Search`, `ListFilesPage`, `ListFolders`.
- Tidak memverifikasi `CreatedAt` → bug KRITIS-2 lolos (bukti: `repository_test.go:29-42` set `CreatedAt`,
  tetapi assertion hanya pada `Name` di `:48-50`).
- `InitDB` memanggil `log.Fatalf` pada error; artinya kegagalan DB mematikan test-process, tidak bisa di-assert.

### `cmd/server/main_test.go`

- Cakupan bagus untuk endpoint API, auth, CSRF, rate limit, backup, pagination, trash.
- Namun seluruh package `cmd/server` bergantung pada `buildApp` → terhalang BLOCKER-1; test tidak dapat jalan.
- `doRequest` mem-`panic(err)` alih-alih `t.Fatal`, sehingga kegagalan kurang informatif.

### `telegram/client.go`

- **Nol file test**. Tidak ada `client_test.go`. Retry, 429, timeout, dan parsing JSON tidak terverifikasi —
  padahal justru di sinilah bug terbanyak (KRITIS-1, 4, 5, 6).

Rekomendasi test:

1. `telegram/client_test.go` memakai `httptest.Server`: uji 429→retry→sukses, 5xx, body tertutup,
   `GetFile` mengembalikan size, dan timeout download (tanpa batas 60s).
2. Test `WithTx` rollback (error di tengah → tidak ada baris tertulis) dan nested-tx tidak panic.
3. Test migrasi: seed DB lama tanpa kolom `encrypted`, lalu `InitDB` harus menambah kolom dan
   menangani nama duplikat (tanpa mengubah data yang bukan duplikat).
4. Test konkuren: dua `CreateFile` nama sama paralel → tepat satu sukses, lainnya dapat sufiks.

---

## Rekomendasi Prioritas (Urutan Aksi)

1. **Perbaiki build (BLOCKER-1/2/3)** — tanpa ini apa pun tidak terverifikasi. Tambah aksesor
   `Service.Repo()`/`Cfg()`, ubah pemanggilan `doAPICall` → `c.doAPICall`, hapus/perbaiki kripto duplikat di klien.
2. **Perbaiki kebenaran Telegram (KRITIS-1/4/5/6)** dan tambahkan `telegram/client_test.go`.
3. **Perbaiki repository (KRITIS-2/3, TINGGI-1/2)** — lengkapi `created_at` di select/scan, amankan
   `WithTx`, jadikan migrasi eksplisit & transaksional, konfigurasi pool SQLite.
4. **Perbaiki wiring server (TINGGI-3, SEDANG-6)** — tangani error `Listen` saat shutdown, tambah logging.
5. **Perbaikan perawatan (SEDANG/RENDAH)** — dedup query, FTS untuk search, cookie `HttpOnly`.

---

## Catatan Metodologi

- Temuan berbasis pembacaan statis sumber; tidak ada eksekusi `go build`/`go test` (tidak tersedia tool shell
  pada sesi ini). Kesimpulan BLOCKER-1 s.d. BLOCKER-3 diturunkan dari ketidakcocokan simbol yang dapat
  diverifikasi via pencarian di repo (tidak ditemukan definisi `Repo()`/`Cfg()` maupun import `encoding/hex`).
- Nomor baris disajikan sebagai referensi pendekatan; verifikasi ulang dengan `grep -n` sebelum mengeksekusi perbaikan.
