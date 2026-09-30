# Audit CAKUPAN TES Modul DocStation

Tanggal: 2026-02
Fokus: **cakupan tes** modul DocStation (BUKAN audit logika produksi).
Metode: audit statis — membaca file tes yang ada, memetakan file produksi
terhadap tes, mencari tes lain yang relevan (`grep`/search `docstation`).

File produksi yang dipetakan:

- `go-backend/internal/handlers/docstation_handler.go`
- `go-backend/internal/handlers/docstation_handler_test.go` (satu-satunya tes Go DocStation)
- `go-backend/internal/middleware/csrf.go` + `csrf_test.go`
- `go-backend/cmd/api/routes.go` (blok `staffGroup.*docstation`)
- `app/(dashboard)/docstation/_hooks/use-opencv.ts` + `use-opencv.test.tsx` (satu-satunya tes FE DocStation)
- `public/docstation/worker.js`
- `lib/docstation/{api,canvas,editor,pdf,state,vendor-loader}.ts`
- `app/(dashboard)/docstation/_components/*` dan `_hooks/use-docstation.ts`

Tes yang ditemukan menyangkut DocStation (hasil pencarian):

1. `go-backend/internal/handlers/docstation_handler_test.go` — 12 fungsi tes, **semua unit helper** (IPP header, parse XML eSCL, resolve printer, env parsing, allowlist header).
2. `go-backend/internal/middleware/csrf_test.go` — 2 fungsi tes (`TestCSRFDocStationRequiresDoubleSubmit`, `TestCSRFDocStationGetTetapBebas`).
3. `app/(dashboard)/docstation/_hooks/use-opencv.test.tsx` — 3 fungsi tes (protokol korelasi `requestId`, timeout, worker error).

Tidak ada tes lain: pencarian `docstation` di repo hanya mengembalikan file produksi + 3 file tes di atas. **Tidak ada** tes Vitest untuk `lib/docstation/*`, komponen `.tsx`, maupun `public/docstation/worker.js`; tidak ada e2e Playwright untuk DocStation (`e2e/*.spec.ts` tidak memuat `docstation`).

---

## Ringkasan

Cakupan tes DocStation **sangat tipis di dua sisi**:

- **Backend Go**: yang diuji hanya fungsi murni/helper. Semua endpoint HTTP
  yang justru berisiko (`SaveDocument`, `PrintJob`/`PrintIPP`, `ProxyESCL`,
  `PrinterStatus`, `Session`, `ListPrinters`) **tidak punya satu pun tes handler**.
  Tidak ada tes yang memanggil handler via `httptest` + `echo.Context` (padahal
  pola ini sudah dipakai di `eoffice_upload_test.go`).
- **Frontend**: hanya hook protokol worker yang diuji (dan itupun memakai
  `Worker` palsu). `worker.js` (ribuan baris algoritme + handler `postMessage`),
  `lib/docstation/{canvas,editor,pdf,api}.ts`, dan seluruh komponen tidak diuji
  sama sekali. Semua jalur "crop/rotate", "export PDF", "stitch", "save/print"
  hanya diuji secara tidak langsung (atau tidak sama sekali).

Konsekuensinya, klaim keamanan/kestabilan pada komentar kode produksi (mis.
"crop 1:1", "tolak >40MP", "batas 15MB", "anti stored XSS") **tidak diverifikasi
oleh tes apa pun**. Regresi pada endpoint cetak/simpan/scan tidak akan tertangkap.

Jumlah temuan: **13** (3 High, 7 Medium, 3 Low). Tidak ada temuan Critical murni
karena DocStation di belakang auth staff; namun beberapa celah (SaveDocument tanpa
assert body, worker tanpa guard dimensi) berpotensi menjadi Critical bila
dikombinasikan dengan perubahan kode di masa depan.

---

## Temuan

### [High] Endpoint `SaveDocument` tidak punya tes handler sama sekali

- **Lokasi:** `go-backend/internal/handlers/docstation_handler.go:184` (`SaveDocument`); absen di `docstation_handler_test.go`.
- **Bukti:** `docstation_handler_test.go` hanya berisi `TestBuildIPPPrintJobHeader`, `TestExtractJobURLs*`, `TestResolvePrinter`, `TestNewDocStationHandler*`, `TestCopyESCLHeadersAllowlist`. Tidak ada nama tes yang mengandung `Save`. `SaveDocument` mengembalikan `c.JSON(http.StatusBadRequest, …)` untuk ekstensi/MIME/ukuran — tetapi tidak satu pun assert body/status diuji.
- **Dampak:** Validasi allowlist ekstensi (`.pdf/.jpg/.jpeg/.png`), cek `allowedUploadMime` (magic bytes), batas `docStationMaxBodyBytes` (15MB), dan pencegahan "nama menimpa" (timestamp nano) **tidak diproteksi tes**. Bug seperti menerima `text/html` berlabel `.png` (stored XSS di `/uploads/docstation`) bisa lolos ke produksi tanpa alarm. Logika ini persis yang di modul Arsip sudah diuji (`TestSaveArsipPDFRejectsSpoofedHTML`), tetapi versi DocStation tidak.
- **Rekomendasi tes konkret:** Tabel kasus:
  1. `TestSaveDocumentRejectsSpoofedHTML` — body `<html>…<script>…`, header `X-Docstation-Filename: x.png` → harap `400` dan body `{"success":false}`.
  2. `TestSaveDocumentRejectsDisallowedExtension` — `.exe`/`.svg` → `400`.
  3. `TestSaveDocumentRejectsOversized` — body `docStationMaxBodyBytes+1` → `400` (assert pesan "melebihi batas").
  4. `TestSaveDocumentRejectsEmptyBody` → `400`.
  5. `TestSaveDocumentAcceptsPDFAndUniqueName` — PDF valid, `t.Setenv("DOCSTATION_UPLOAD_DIR", t.TempDir())`, dua kali simpan nama sama → nama hasil beda, file ada.
  6. `TestSaveDocumentDecodesFilenameHeader` — nama URL-encoded → nama tersimpan ter-decode, tanpa `../` (path traversal).

### [High] Endpoint cetak (`PrintJob`/`PrintIPP`) tidak diuji sama sekali

- **Lokasi:** `go-backend/internal/handlers/docstation_handler.go:471` (`PrintJob`) & `:524` (`PrintIPP`).
- **Bukti:** Tidak ada tes yang memanggil `h.PrintJob`/`h.PrintIPP`. Yang diuji hanya `buildIPPPrintJob` (struktur byte IPP), bukan jalur handler; `sendIPP`/`sendRaw9100` (I/O jaringan) juga tanpa tes.
- **Dampak:** Deteksi format dari magic bytes (JPEG `FF D8`, PNG `89 50 4E 47`, PDF `%PDF`), fallback IPP→RAW untuk PDF, penolakan body kosong/oversize, dan pemetaan error ke `502` **tidak diverifikasi**. Tes mudah "hijau palsu": `TestBuildIPPPrintJobHeader` lulus walaupun handler-nya salah memilih format/endpoint.
- **Rekomendasi tes konkret:** Refaktor kecil agar `httptest.NewServer` bisa menggantikan target printer (atau ekstrak pemilihan format ke fungsi murni `detectDocFormat(body)` lalu uji tabel: `{"\xFF\xD8"→image/jpeg, "…PNG…"→image/png, "%PDF"→application/pdf, "raw junk"→""}`). Untuk handler: `TestPrintJobRejectsEmptyBody` → `400`; `TestPrintJobRejectsOversized` → `400`; `TestPrintJobUnknownPrinterHeader` → `400` (pakai `X-Printer-Ip: 10.0.0.99`); `TestPrintIPPDelegatesToPrintJob`.

### [High] Handler `ProxyESCL` (termasuk rewrite `Location` & clearing job macet) tanpa tes

- **Lokasi:** `docstation_handler.go:322` (`ProxyESCL`), `:432` (`clearStuckESCLJobs`).
- **Bukti:** `extractJobURLs` diuji, tetapi handler proxy, fallback skema http↔https, retry saat `503`, dan rewrite `Location`/`X-Docstation-Job` (baris `Location` → `/api/docstation/escl/ScanJobs/<segmen>`) **tidak diuji**.
- **Dampak:** Rewrite `Location` adalah logika string rapuh (mengiris `"ScanJobs"`) yang mudah regresi; bila salah, klien `api.ts` (`requestScan`) gagal mengambil `NextDocument`. Tidak ada tes `unauthorized`/`malformed location`, tidak ada tes fallback protokol.
- **Rekomendasi tes konkret:** Ekstrak logika rewrite ke `rewriteESCLocation(loc string) string` dan uji tabel: input absolut `http://192.168.10.140/eSCL/ScanJobs/abc-123` → `/api/docstation/escl/ScanJobs/abc-123`; input relatif `/eSCL/ScanJobs/def` → sama; input tanpa "ScanJobs" → dikembalikan apa adanya. Tambah `TestProxyESCLUnknownPrinter` (header asing → `400`) dan `TestCopyESCLHeadersDoesNotForwardHost`.

### [High] `worker.js` — handler `postMessage` & algoritme citra tanpa tes apa pun

- **Lokasi:** `public/docstation/worker.js` (seluruh file; blok `self.onmessage` ~baris 37, `default:` ~411), absen dari suite Vitest.
- **Bukti:** `vitest.config.ts` `include` mencakup `**/*.test.tsx`, tetapi tidak ada file `worker.test.*`. `use-opencv.test.tsx` hanya menguji hook dengan `Worker` **palsu** (`installFakeWorker`), sehingga `worker.js` asli tidak pernah dieksekusi. Semua type (`ENHANCE_BW`, `DESKEW`, `AUTO_STITCH`, `AUTO_PIPELINE`, `DETECT_PAPER`, …) dan fungsi murni (`sauvolaBinarizeBuffer`, `detectBlankPure`, `orderCorners`, `perspectiveWarpBilinearBuffer`) tidak diuji.
- **Dampak:** Bug algoritme (mis. `detectBlankPure` ambang `0.0035`, `orderCorners` salah urut, guard `>40_000_000` pada `AUTO_STITCH`) dan kontrak `postMessage` (balasan `requestId`, `ERROR`) hanya "diverifikasi" oleh komentar. Karena `worker.js` di-serve sebagai file statis (bukan modul), sulit diimpor — ini alasan nyata kenapa tes tidak ada, tetapi bukan alasan yang bisa diterima.
- **Rekomendasi tes konkret:** Tambah `public/docstation/worker.test.ts` yang mengeksekusi worker via `new Worker` (vitest `environment: jsdom` + `?worker`/`importScripts` shim) **atau** refaktor fungsi murni ke `lib/docstation/imaging.ts` yang bisa diimpor langsung. Uji tabel:
  - `detectBlankPure` dengan buffer semua putih → `blank:true, inkRatio:0`; buffer bergaris hitam → `blank:false`.
  - `orderCorners([[0,0],[10,0],[10,10],[0,10]])` → urutan TL,TR,BR,BL.
  - `AUTO_STITCH` dengan 2 gambar cocok → `STITCH_RESULT` sukses & dimensi benar; dengan `width*height>40_000_000` → balasan `{error}`.
  - Kirim `{type:"NOPE"}` → assert balasan error/`UNKNOWN` dengan `requestId` sama (bukan diam sampai timeout).

### [Medium] `PrintJob`/`SaveDocument` "hijau palsu" — `TestBuildIPPPrintJobHeader` tidak menguji jalur handler

- **Lokasi:** `docstation_handler_test.go:11-34` (`TestBuildIPPPrintJobHeader`).
- **Bukti:** Tes meng-assert struktur byte `buildIPPPrintJob` (versi, operasi, atribut, payload di akhir). Ini berguna tapi **tidak menyentuh** `PrintJob`, `sendIPP`, maupun penentuan `secure`/scheme. Assert juga longgar: `bytes.Contains(body, []byte("printer-uri"))` tidak memverifikasi nilai/tipe tag atribut benar.
- **Dampak:** Memberi kesan "IPP tercakup" padahal integrasi HTTP IPP (Content-Type `application/ipp`, parse status IPP 4-byte, `document-format`) tidak diuji. Nilai `document-format` yang salah (mis. `image/jpeg` dikirim saat printer butuh `application/octet-stream`) tidak akan tertangkap.
- **Rekomendasi tes konkret:** Tambah `TestSendIPPUsesApplicationIpp` dengan `httptest.Server` yang merekam `Content-Type` dan body; assert header `application/ipp` dan status code IPP `0x0000` → `sendIPP` mengembalikan `nil`; status non-nol (mis. `0x0406`) → error.

### [Medium] `csrf_test.go` menguji middleware tapi tidak menguji **wiring route** DocStation

- **Lokasi:** `go-backend/internal/middleware/csrf_test.go:29` (`TestCSRFDocStationRequiresDoubleSubmit`), `routes.go` blok `staffGroup.*docstation`.
- **Bukti:** Tes memverifikasi `CSRFProtected()` pada path string `/api/docstation/print|save|archive|escl`. Namun tidak ada tes yang memastikan route-rute tersebut **benar-benar** terpasang `CSRFProtected` dan `RoleMiddleware(staff)` di `registerRoutes` — `registerRoutes` tidak diuji sama sekali (tidak ada `routes_test.go`).
- **Dampak:** Bila seseorang menambah route DocStation baru (mis. `/docstation/print/ipp` sudah ada di produksi tapi **tidak** masuk daftar `isAuthSensitivePath`) atau memindahkan grup, CSRF bisa hilang tanpa gagal tes. Catatan: `/api/docstation/print/ipp` memang **tercakup** karena `strings.HasPrefix(path, "/api/docstation/print")`, tetapi coverage ini implisit, bukan eksplisit.
- **Rekomendasi tes konkret:** Tambah `TestIsAuthSensitivePathDocStation` (tabel: semua path DocStation mutasi → `true`, `GET /api/docstation/status` → `false`) dan tes integrasi `registerRoutes` yang menembak `POST /api/docstation/print` tanpa token → `403`, dengan token+role staff → bukan `403`.

### [Medium] `use-opencv.test.tsx` tidak menguji `load()`/`cancel()` dan memakai mock yang menutupi bug

- **Lokasi:** `app/(dashboard)/docstation/_hooks/use-opencv.test.tsx` (3 tes), `use-opencv.ts` (`load` ~berkas baris 150, `cancel` ~129).
- **Bukti:** Tes hanya memverifikasi `run()` (korelasi id, timeout, worker error). `load()` (fetch OpenCV + progres + fallback `pure-js-timeout` + revoke blob URL) dan `cancel()` (set status `cancelled`, batal pembacaan reader, reject pending) **tidak diuji**. `installFakeWorker` mengganti `Worker` global, tetapi tidak ada assert bahwa `terminate()` dipanggil pada unmount.
- **Dampak:** Regresi progres download, fallback saat OpenCV gagal, dan pembersihan saat unmount tidak tertangkap. Karena mock `Worker` lengkap, bug yang hanya muncul di worker nyata (mis. worker tidak membalas `INITIALIZED`) tidak terdeteksi — diperparah karena `load()` tidak diuji.
- **Rekomendasi tes konkret:** `TestLoadReportsProgressAndReady` (stub `fetch` dengan `ReadableStream` potongan kecil, `content-length`); `TestLoadFallsBackToPureJsWhenFetchFails` (fetch reject → status `ready`, bukan `error`); `TestCancelSetsCancelledAndRejectsPending`; `TestUnmountTerminatesWorker` (assert `fake.terminate` dipanggil).

### [Medium] Tidak ada tes boundary ukuran/limit pada DocStation (Go & FE)

- **Lokasi:** `docStationMaxBodyBytes` (`docstation_handler.go:38`), `ADF_MAX_PAGES` (`lib/docstation/api.ts`), guard `>40_000_000` (`worker.js:346`).
- **Bukti:** Ketiga konstanta batas tidak punya tes yang menguji tepat di batas (`==` batas vs `+1`). `SaveDocument` memakai `LimitReader(…+1)` lalu `len(body) > max` — perilaku batas tak terverifikasi.
- **Dampak:** Off-by-one pada batas file (menerima `max+1` atau menolak `max`) tidak tertangkap; `ADF_MAX_PAGES` pada `requestScan` (loop ADF) tak diuji sehingga loop tanpa akhir/kurang satu lembar lolos.
- **Rekomendasi tes konkret:** `TestSaveDocumentAtExactLimitAccepted` & `TestSaveDocumentOneByteOverRejected`; `TestRequestScanStopsAtAdfMaxPages` (mock `fetch` mengembalikan blob tak habis-habis → assert ≤ `ADF_MAX_PAGES` panggilan lalu berhenti).

### [Medium] Tidak ada tes "unauthorized"/role pada endpoint DocStation

- **Lokasi:** `routes.go` (`staffGroup.Use(RoleMiddleware(Superadmin, Admin, Staff))` untuk semua `/docstation/*`).
- **Bukti:** Tidak ada tes yang memverifikasi: (a) tanpa JWT → `401`; (b) role `guru`/`siswa`/`orangtua` → `403`; (c) staff → lolos. `docstation_handler_test.go` memanggil `resolvePrinter`/helper langsung, melewati auth. `SaveDocument` memanggil `currentUserID(c)` (untuk log) tanpa tes.
- **Dampak:** DocStation memicu perangkat keras (printer/scan) LAN; kebocoran role (mis. `guru` bisa cetak/scan) adalah masalah nyata, dan tidak ada tes yang menjaganya. Perubahan `routes.go` (mis. memindah grup) tak akan tertangkap.
- **Rekomendasi tes konkret:** Tes integrasi yang membangun `echo` + `registerRoutes` dengan repo stub, lalu tabel role × endpoint (`/docstation/print`, `/docstation/status`, `/docstation/save`) → assert `401/403/200` sesuai role.

### [Medium] Tidak ada tes untuk CSRF **missing/mismatch** pada endpoint DocStation versi non-`print`/`save`

- **Lokasi:** `csrf_test.go` mencakup `print`, `save`, `archive`, `escl` — tetapi **tidak** menguji `malformed` token (mis. header ada, cookie kosong nilai lain), dan tidak menguji bahwa `GET /docstation/*` mutasi tak diminta token.
- **Bukti:** `TestCSRFDocStationRequiresDoubleSubmit` menguji tiga kasus (tanpa token, cookie saja, cocok). Tidak ada kasus: header ≠ cookie, token kedaluwarsa/hash tidak cocok, atau `Origin` tidak diizinkan khusus path DocStation.
- **Dampak:** Layer 1 (Origin/Referer) untuk endpoint DocStation tidak diuji; celah `Referer` spoof (`"?x=localhost"`) hanya diuji umum (jika ada) di tempat lain. Regresi pada `isAllowedOrigin` akan mempengaruhi DocStation tanpa tertangkap.
- **Rekomendasi tes konkret:** Tambah kasus di `csrf_test.go`: header `"abc"` vs cookie `"def"` → `403`; `Origin: https://evil.com` untuk `POST /api/docstation/print` → `403`; `Referer: https://evil.com/?x=localhost` → `403`.

### [Low] Assert `TestExtractJobURLs` hanya mengecek 1 dari 2 URL

- **Lokasi:** `docstation_handler_test.go:57-64` (`TestExtractJobURLs`).
- **Bukti:** Tes menyatakan `want 2` dan meng-assert `urls[0]`, tetapi **tidak** meng-assert `urls[1]` (`/eSCL/ScanJobs/def-456` dari `pwg:JobUrl`). Urutan hanya diasumsikan.
- **Dampak:** Jika `extractJobURLs` menaruh `JobUrl` pertama/duplikat, tes tetap hijau. Assert trivial (hanya panjang + elemen pertama).
- **Rekomendasi tes konkret:** Assert `reflect.DeepEqual(urls, []string{"/eSCL/ScanJobs/abc-123", "/eSCL/ScanJobs/def-456"})` (atau `ElementsMatch`) dan tambah kasus `JobUri` kosong/whitespace tidak ikut tersimpan.

### [Low] `TestResolvePrinter` tidak menguji trimming/empty header eksplisit & case-sensitivity IP

- **Lokasi:** `docstation_handler_test.go:70-110` (`TestResolvePrinter`).
- **Bukti:** Menguji header valid, tak dikenal, dan tanpa header. Tidak menguji header berisi spasi (`" 192.168.10.140 "`) — padahal produksi `strings.TrimSpace` — maupun dua printer IP sama (dedup tidak ada).
- **Dampak:** Cabang `TrimSpace` dan perilaku ketika env mendefinisikan IP duplikat tidak terverifikasi; tes longgar soal boundary input.
- **Rekomendasi tes konkret:** Tambah sub-kasus `X-Printer-Ip: " 192.168.10.140 "` → resolve ke Epson/secure; dan header hanya berisi spasi `"   "` → jatuh ke default.

### [Low] `TestCopyESCLHeadersAllowlist` menguji allowlist tapi tidak menguji `Host`/hop-by-hop

- **Lokasi:** `docstation_handler_test.go:206-226` (`TestCopyESCLHeadersAllowlist`).
- **Bukti:** Meng-assert `Authorization`, `Cookie`, `X-CSRF-Token`, `X-Printer-Ip`, `X-Custom-Evil` tidak bocor. Tidak menguji `Host` (dari klien) — yang secara default tidak ikut karena `http.NewRequest` baru, tetapi tidak di-assert — dan header bernilai ganda.
- **Dampak:** Ringan; namun header sensitif lain yang ditambahkan di masa depan tidak otomatis dites karena daftar uji hardcoded per-nama.
- **Rekomendasi tes konkret:** Assert bahwa **hanya** key di `docStationForwardHeaders` yang ada di `dst` (loop seluruh key `dst` → assert anggota allowlist), bukan sekadar daftar nama yang disebut manual.

### [Low] Tidak ada tes keunikan nama file / race (Race detector belum dijalankan)

- **Lokasi:** `SaveDocument` (nama `time.Now().UnixNano()+…`), `docStationPrinterLock` (`docstation_handler.go:456`), `PrinterStatus` (`:246`, goroutine + channel).
- **Bukti:** Tidak ada tes yang memanggil `SaveDocument` dua kali bersamaan atau `docStationPrinterLock` dari banyak goroutine. Tidak ada indikasi suite Go dijalankan dengan `-race` pada CI (`scripts/ci.sh` tidak diperiksa dari sisi tes DocStation; tidak ada `go test -race` khusus DocStation). `PrinterStatus` menjalankan 3 goroutine per printer + `results[i] =` tanpa tes.
- **Dampak:** Potensi data race pada `results`/`docStationLocks` atau kolisi nama file pada timestamp nano bersamaan tidak akan terdeteksi tanpa `-race` + tes konkuren.
- **Rekomendasi tes konkret:** `TestSaveDocumentConcurrentUniqueNames` (100 goroutine, `t.TempDir()`, assert semua nama unik & file ada) dijalankan dengan `go test -race`. `TestDocStationPrinterLockSerializes` (dua goroutine lock printer sama, assert tidak overlap). Tambahkan langkah `go test -race ./internal/handlers/... ./internal/middleware/...` ke CI.

---

## Prioritas Perbaikan

### P0 — segera (High)

1. **Tes SaveDocument** (validasi MIME/magic bytes, batas 15MB, ekstensi, nama unik/traversal, body kosong). Temuan #1.
2. **Tes PrintJob/PrintIPP** (deteksi format dari magic bytes, penolakan body kosong/oversize, printer tak dikenal, delegasi `PrintIPP`). Temuan #2.
3. **Tes ProxyESCL** (rewrite `Location`, fallback protokol, `503` retry, error printer tak dikenal). Temuan #3.
4. **Tes worker.js / ekstrak fungsi murni imaging** ke modul yang dapat diimpor; uji `AUTO_STITCH` guard, `orderCorners`, `detectBlankPure`, dan balasan type tak dikenal. Temuan #4.

### P1 — penting (Medium)

5. **Tes integrasi `sendIPP`** (header `application/ipp`, parse status IPP) via `httptest.Server`. Temuan #5.
6. **Tes wiring route + role + CSRF** (`registerRoutes`) untuk semua endpoint DocStation. Temuan #6 & #9.
7. **Tes `load()`/`cancel()` hook** dan assert `terminate()` pada unmount. Temuan #7.
8. **Tes boundary ukuran** (tepat di batas & +1) untuk `docStationMaxBodyBytes` dan `ADF_MAX_PAGES`. Temuan #8.

### P2 — kualitas (Medium/Low)

9. Perkuat assert `extractJobURLs` (semua elemen, bukan hanya indeks 0). Temuan #10.
10. Tambah sub-kasus `TrimSpace`/header spasi pada `resolvePrinter`. Temuan #11.
11. Assert allowlist header secara loop (bukan daftar manual). Temuan #12.

### P3 — ketahanan (Low)

12. **Tes konkuren + jalankan `go test -race`** untuk `SaveDocument` (nama unik) & `docStationPrinterLock`. Temuan #13.
13. Tambah e2e Playwright ringan untuk alur DocStation (buka page → pilih mode → tanpa error konsol) sebagai jaring regresi UI. (Tidak ada sekarang.)
