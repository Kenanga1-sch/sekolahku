# Audit Backend DocStation — Otorisasi, CSRF, Upload, Header Printer & Konkurensi

Tanggal: 2026-02 (audit statis, tanpa menjalankan runtime)
Cakupan utama:

- `go-backend/internal/handlers/docstation_handler.go`
- `go-backend/internal/handlers/docstation_handler_test.go`
- `go-backend/internal/middleware/csrf.go`
- (konteks rute) `go-backend/cmd/api/routes.go`
- (konteks pendukung) `go-backend/cmd/api/main.go`, `go-backend/internal/middleware/auth.go`,
  `go-backend/internal/handlers/upload_validation.go`, `go-backend/internal/handlers/file_handler.go`,
  `go-backend/internal/handlers/upload_handler.go`, `go-backend/internal/shared/helpers.go`

Fokus audit: (1) otorisasi & CSRF pada endpoint print/save/archive/escl, (2) validasi upload,
(3) header allowlist & keamanan request ke printer ESCL, (4) keamanan konfigurasi env printer,
(5) race condition/goroutine/context propagation.

Catatan: audit ini **tidak mengubah kode produksi apa pun**. Hanya dokumen ini yang ditulis.

---

## Ringkasan

Ada **13 temuan**: 3 Critical, 5 High, 4 Medium, 1 Low.

Kabar baiknya: fondasi pertahanan sudah ada dan lebih matang dari versi `server.py` lama.
`resolvePrinter` memvalidasi `X-Printer-Ip` terhadap daftar terdaftar (bukan fallback diam-diam ke
printer asing), `copyESCLHeaders` memakai allowlist eksplisit sehingga `Authorization`/`Cookie`/
`X-CSRF-Token` tidak bocor ke perangkat LAN, `isAuthSensitivePath` di `csrf.go` sudah mendata
`/api/docstation/{print,save,archive,escl}`, dan `PrintJob` memverifikasi magic bytes sebelum
mengirim ke printer. Test `TestCopyESCLHeadersAllowlist` + `TestCSRFDocStationRequiresDoubleSubmit`
sudah mengunci dua perilaku itu.

Namun ada beberapa **kelemahan nyata** yang perlu ditutup:

- **Double-submit CSRF untuk DocStation bergantung pada header `X-CSRF-Token` yang selalu disertakan
  oleh klien.** Bila klien tidak mengirimnya (atau permintaan datang dari non-browser yang lolos
  Origin check), tidak ada yang gagal — artinya proteksi ini tidak bisa diandalkan sebagai satu-satunya
  pertahanan; lihat temuan #1.
- **Token CSRF bersifat statis selama sesi** (cookie `SameSite=Lax`, nilai sama terus) dan
  `isAllowedOrigin` menerima request **tanpa Origin maupun Referer** (`return true`) — celah yang
  terbuka untuk klien non-browser.
- **`SaveDocument` menyimpan berkas ke `DOCSTATION_UPLOAD_DIR` tanpa mengaitkan pemilik** dan tanpa
  akses baca ulang yang diaudit → IDOR/lateral: berkas milik staf A dapat ditimpa/dibaca di folder
  bersama, dan nama file dikendalikan klien (hanya dibersihkan sebagian).
- **`ProxyESCL` meneruskan `Content-Type`/`Accept` mentah dan `RawQuery` mentah** ke printer, menyalin
  **seluruh header respons printer** ke klien (termasuk `Set-Cookie`, `Location` absolut) — vektor
  header/injeksi dan SSRF terbatas yang belum di-whitelist per path.
- **Konfigurasi printer hanya lewat env tanpa validasi bentuk**: entri `DOCSTATION_PRINTERS` yang
  salah bisa menghasilkan `IP` berisi hostname/port/URL, dan `InsecureSkipVerify: true` global mematikan
  verifikasi TLS untuk **semua** HTTPS eSCL/IPP.
- **Goroutine di `PrinterStatus` bocor** saat request dibatalkan (timeout 3 dtk hanya mengakhiri
  pengumpulan hasil, bukan goroutine `net.DialTimeout` yang masih berjalan), dan `context` request
  tidak pernah dipropagasi ke `http.NewRequest`/`net.DialTimeout` mana pun — pembatalan klien tidak
  menghentikan pekerjaan ke printer.
- **Log memuat IP printer dan `user_id`;** bila env printer berisi kredensial (user:pass@ip atau token),
  nilai itu ikut tercetak lewat `%s`/`printerIP` di log dan pesan error.

---

## Temuan

### [Critical] #1 — CSRF DocStation hanya "double-submit opsional": Origin kosong dianggap sah & token statis

- **Lokasi:** `go-backend/internal/middleware/csrf.go:70-100` (`isAllowedOrigin`), `csrf.go:144-160`
  (`isAuthSensitivePath`), `csrf.go:118-142` (`CSRFProtected`), `routes.go` (registrasi
  `staffGroup.POST("/docstation/print"|"/save"|"/archive")` dan `staffGroup.Any("/docstation/escl/*")`).
- **Bukti kode:**

  ```go
  origin := c.Request().Header.Get("Origin")
  if origin == "" {
      referer := c.Request().Referer()
      if referer == "" {
          return true   // ← request tanpa Origin & Referer dianggap SAH
      }
      ...
  }
  ```

  ```go
  // Layer 2: Double-submit token untuk endpoint auth-sensitive.
  if isAuthSensitivePath(path) {
      cookieToken := GetCSRFToken(c)
      headerToken := c.Request().Header.Get(csrfHeaderName)
      if cookieToken == "" || headerToken == "" || cookieToken != headerToken {
          return c.JSON(http.StatusForbidden, ...)
      }
  }
  ```

- **Dampak:** Proteksi CSRF untuk `print`/`save`/`archive`/`escl` bergantung pada keberadaan header
  dari klien. Dua konsekuensi:
  1. Permintaan yang **tidak mengirim `Origin`** (atau mengirim `Origin: null` pada konteks tertentu)
     akan lolos layer 1; bila klien juga tidak mengirim `X-CSRF-Token`, layer 2 menolaknya — tetapi
     begitu ada jalur yang melewatkan header (mis. `fetch` tanpa kredensial, `<form>` biasa, atau
     proxy yang men-strip header), tidak ada mekanisme tambahan yang menahan.
  2. Token tidak **di-rotate** dan tidak terikat request; cookie `Secure` bergantung `COOKIE_SECURE`
     dan `SameSite=Lax` masih mengizinkan top-level `GET` lintas situs. Karena endpoint `escl` adalah
     `Any(...)`, sebuah `GET /api/docstation/escl/...` lintas situs (mis. `<img src>`) tetap lolos
     layer 1 **dan** dilewati layer 2 (middleware `CSRFProtected` melewatkan GET/HEAD/OPTIONS di baris
     `if method == "GET" || method == "HEAD" || method == "OPTIONS"`), sehingga permintaan ke printer
     dapat dipicu dari origin mana pun (cross-site request ke perangkat LAN).
- **Rekomendasi:** Untuk semua mutasi DocStation, **wajibkan** header `X-CSRF-Token` dan **tolak**
  request tanpa `Origin`/`Referer` pada endpoint mutasi (bukan `return true`). Jangan gunakan
  `server.Any` untuk `escl`; pisahkan `GET` (read-only, dipakai klien) dari `POST`/`DELETE` dan
  terapkan double-submit hanya pada yang mutasi. Rotasi token saat login/logout dan ikat token ke
  sesi (mis. HMAC atas `sub` + exp) agar nilai statis tidak bisa dipakai selamanya. Tambahkan test
  negatif "POST tanpa Origin & tanpa Referer → 403" untuk endpoint DocStation.

### [Critical] #2 — `SaveDocument`: tidak ada kepemilikan/audit akses berkas → IDOR & penimpaan lintas user

- **Lokasi:** `go-backend/internal/handlers/docstation_handler.go:213-273` (`SaveDocument`),
  khususnya `docstation_handler.go:207-210` (`docStationMaxBodyBytes`), dan pemakaian
  `DOCSTATION_UPLOAD_DIR` di `docstation_handler.go:245-249`.
- **Bukti kode:**

  ```go
  dir := strings.TrimSpace(os.Getenv("DOCSTATION_UPLOAD_DIR"))
  if dir == "" {
      dir = filepath.Join("uploads", "docstation")
  }
  ...
  // Nama unik: nano-timestamp + nama bersih — tak pernah menimpa berkas lama.
  name = fmt.Sprintf("%d-%s", time.Now().UnixNano(), name)
  dest := filepath.Join(dir, name)
  if err := os.WriteFile(dest, body, 0o644); err != nil { ... }
  c.Logger().Infof("docstation save user=%s file=%s bytes=%d", currentUserID(c), name, len(body))
  ```

- **Dampak:** Berkas disimpan ke satu direktori bersama tanpa kolom pemilik di DB dan tanpa pencatatan
  audit persisten (hanya log aplikasi). Semua staf yang dapat memanggil `/api/docstation/save` menulis
  ke ruang yang sama; berkas tercampur. Karena tidak ada endpoint baca di handler ini, pembacaannya
  mengandalkan `FileHandler.ServeFile` / static — yang **tidak** mengenal folder `docstation`
  (`folderRoleMatrix` di `file_handler.go:62-76` tidak memiliki entri `docstation`; `publicUploadFolders`
  juga tidak). Akibatnya berkas hasil scan bisa jatuh ke jalur yang tidak diaudit, atau tidak dapat
  diakses sama sekali sehingga operator memindahkannya secara manual. Selain itu `name` berasal dari
  header/`filename` klien setelah `cleanUploadName` — yang **tidak** memaksa ekstensi konsisten dengan
  isi, jadi berkas PDF bisa tersimpan sebagai `raport.png` (magic bytes dicek via `DetectContentType`
  di baris 240, tetapi nama file tetap boleh menyamar).
- **Rekomendasi:** Simpan metadata hasil simpan (pemilik, waktu, hash, ukuran) ke tabel
  `school_documents`/tabel khusus DocStation, dan kembalikan ID dokumen — bukan hanya nama file.
  Daftarkan folder DocStation pada matriks otorisasi `FileHandler` bila file perlu dibaca ulang.
  Paksa ekstensi mengikuti tipe hasil `http.DetectContentType` (bukan klaim klien), dan tolak nama
  yang mengandung `..` (sudah sebagian ditangani `cleanUploadName`, tetapi perjelas di sini dengan
  validasi eksplisit).

### [Critical] #3 — Goroutine `PrinterStatus` bocor & `context` tidak dipropagasi (pembatalan klien diabaikan)

- **Lokasi:** `go-backend/internal/handlers/docstation_handler.go:277-330` (`PrinterStatus`),
  `docstation_handler.go:348-378` (`ProxyESCL`), `docstation_handler.go:481-520` (`sendIPP`),
  `docstation_handler.go:522-533` (`sendRaw9100`).
- **Bukti kode:**

  ```go
  for i, p := range h.printers {
      wg.Add(1)
      go func(i int, p DocStationPrinter) {
          defer wg.Done()
          portCh := make(chan bool, 3)
          for _, port := range []string{"631", "9100", "80"} {
              go func(port string) {
                  conn, err := net.DialTimeout("tcp", net.JoinHostPort(p.IP, port), 800*time.Millisecond)
                  ...
              }(port)
          }
          for range []string{"631", "9100", "80"} {
              if <-portCh { online = true }
          }
          results[i] = result{...}
      }(i, p)
  }
  done := make(chan struct{})
  go func() { wg.Wait(); close(done) }()
  select {
  case <-done:
  case <-time.After(3 * time.Second):
  }
  ```

  ```go
  req, err := http.NewRequest(c.Request().Method, url, bytes.NewReader(body))
  // ← tidak ada http.NewRequestWithContext(c.Request().Context(), ...)
  ```

- **Dampak:** Dua masalah nyata:
  1. `select` dengan `time.After(3*time.Second)` hanya **berhenti menunggu hasil**; goroutine
     `net.DialTimeout` per port (dan goroutine per printer) tetap hidup hingga dial selesai. Dengan
     banyak printer/port dan klien yang berulang kali membuka halaman status, jumlah goroutine
     menumpuk. `portCh` berkapasitas 3 sehingga tidak ada goroutine yang macet permanen, tetapi biaya
     dial tetap dibayar walau respons sudah dikirim.
  2. Tidak ada jalur `context`: jika klien menutup koneksi (batal/navigasi), request ke printer di
     `ProxyESCL` (timeout 90 dtk!), `sendIPP`, dan `sendRaw9100` tetap berjalan penuh. Untuk `Raw9100`
     deadline tulis 45 dtk — pembatalan tidak menghentikannya. Ini juga berarti pekerjaan cetak bisa
     berlanjut setelah pengguna mengira sudah dibatalkan.
- **Rekomendasi:** Gunakan `http.NewRequestWithContext(c.Request().Context(), ...)` di `ProxyESCL`,
  `sendIPP`, dan `clearStuckESCLJobs`; gunakan `net.Dialer.DialContext`. Di `PrinterStatus`, pakai
  `context.WithTimeout(c.Request().Context(), 3*time.Second)` dan `errgroup`/`sync.WaitGroup` dengan
  seleksi `ctx.Done()` di setiap goroutine agar dial yang sudah tidak diperlukan berhenti
  (minimal lewat `Dialer.Context`). Hindari `time.After` di loop (buat timer sekali,
  `defer timer.Stop()`).

### [High] #4 — `ProxyESCL` menyalin seluruh header respons printer ke klien (termasuk `Set-Cookie`/`Location`)

- **Lokasi:** `go-backend/internal/handlers/docstation_handler.go:411-425`.
- **Bukti kode:**

  ```go
  // Salin header respons (kecuali hop-by-hop / encoding).
  for k, vals := range resp.Header {
      lk := strings.ToLower(k)
      if lk == "content-encoding" || lk == "content-length" || lk == "transfer-encoding" || lk == "connection" {
          continue
      }
      for _, v := range vals {
          c.Response().Header().Add(k, v)
      }
  }
  ```

- **Dampak:** Allowlist diterapkan pada **request** ke printer, tetapi tidak pada **respons** dari
  printer. Printer (atau perangkat LAN apa pun yang menempati alamat printer) dapat menyuntikkan
  header arbitrer ke respons yang diterima browser operator: `Set-Cookie` (menanam/mengubah cookie
  aplikasi, termasuk `csrf_token`!), `Access-Control-Allow-Origin`, `Refresh`, `X-Frame-Options`,
  atau `Content-Disposition` palsu. Karena `Location` direwrite (baris 427-440) tetapi header lain
  diteruskan utuh, perangkat LAN bisa mempengaruhi state browser. Perangkat printer yang dikompromikan
  menjadi vektor XSS/CSRF-helper terhadap operator sekolah.
- **Rekomendasi:** Ganti logika "salin semua kecuali blacklist" menjadi **allowlist** respons
  (`Content-Type`, `Content-Length` yang dihitung ulang, `ETag`, `Last-Modified`, `Cache-Control`
  terbatas, `Location` hasil rewrite). Buang eksplisit `Set-Cookie`, `Set-Cookie2`,
  `Access-Control-*`, `Refresh`, `Content-Disposition`, dan semua header `X-*` yang tidak dikenal.
  Tambahkan test yang memastikan `Set-Cookie` dari printer tidak sampai ke klien.

### [High] #5 — `ProxyESCL` meneruskan `Content-Type`/`Accept` mentah + `RawQuery` mentah → risiko header/query injection

- **Lokasi:** `docstation_handler.go:332-343` (`docStationForwardHeaders`), `docstation_handler.go:381-384`
  (`copyESCLHeaders` + `req.URL.RawQuery = c.Request().URL.RawQuery`).
- **Bukti kode:**

  ```go
  var docStationForwardHeaders = map[string]bool{
      "content-type": true,
      "accept":       true,
  }
  ```

  ```go
  copyESCLHeaders(req.Header, c.Request().Header)
  req.URL.RawQuery = c.Request().URL.RawQuery
  ```

- **Dampak:** Allowlist header sudah benar (tidak ada `Authorization`/`Cookie`), tetapi **nilai**
  `Content-Type`/`Accept` diteruskan apa adanya. Bila klien mengirim nilai berisi CR/LF, `net/http`
  modern akan menolak, namun pola "teruskan nilai klien apa adanya ke perangkat pihak ketiga" tetap
  rapuh (bergantung pada sanitasi library). Yang lebih konkret: `RawQuery` diteruskan mentah ke URL
  printer, sehingga parameter tak dikenal (`?x=<payload>`) bisa mempengaruhi firmware eSCL, dan
  `Content-Type` bisa di-spoof (mis. `application/pdf` untuk request `ScanJobs`) yang membingungkan
  printer. Selain itu tidak ada pembatasan panjang header/query, sehingga bisa dipakai untuk
  memperbesar permintaan ke perangkat.
- **Rekomendasi:** Normalisasi nilai: hanya izinkan sekumpulan `Content-Type` eSCL yang dikenal
  (`text/xml`, `application/xml`, `application/octet-stream`, `image/jpeg`), strip karakter kontrol,
  dan batasi panjang. Untuk `RawQuery`, whitelist parameter yang diperlukan; tolak bila ada parameter
  di luar daftar. Tambahkan validasi eksplisit bahwa `esclPath` tidak mengandung `..`, `//`, atau
  skema (`http:`/`https:`) sebelum dibentuk menjadi URL — saat ini `esclPath` mentah dari
  `c.Param("*")` langsung di-`fmt.Sprintf` ke URL.

### [High] #6 — Klien dapat menentukan `X-Printer-Ip` apa pun yang terdaftar tanpa kontrol per-user

- **Lokasi:** `docstation_handler.go:151-165` (`resolvePrinter`), `routes.go` (grup `staffGroup`).
- **Bukti kode:**

  ```go
  func (h *DocStationHandler) resolvePrinter(c echo.Context) (string, bool, error) {
      ip := strings.TrimSpace(c.Request().Header.Get("X-Printer-Ip"))
      if ip == "" {
          return h.defaultPrinter, h.isSecure(h.defaultPrinter), nil
      }
      for _, p := range h.printers {
          if p.IP == ip {
              return p.IP, p.Secure, nil
          }
      }
      return "", false, fmt.Errorf("printer %q tidak terdaftar", ip)
  }
  ```

- **Dampak:** Validasi terhadap daftar terdaftar sudah baik (mencegah SSRF ke IP sembarang). Namun
  **tidak ada otorisasi per printer**: setiap staf dapat mengarahkan pekerjaan cetak/scan ke printer
  apa pun yang terdaftar — termasuk dokumen sensitif ke printer yang sedang dipakai pihak lain
  (`Scanner di ruang kepala sekolah`, dsb.), atau menarik hasil scan dari printer yang mungkin
  mengandung dokumen orang lain. Tidak ada kuota/rate-limit khusus DocStation, sehingga satu akun
  staf dapat membombardir printer (`DoS`) atau memakai `PrinterStatus` sebagai pemindai jaringan
  (`/docstation/status` melakukan TCP dial ke 3 port per printer — refleksi untuk port-scan internal
  terbatas, karena IP dibatasi daftar). Tidak ada audit log (hanya `c.Logger()`).
- **Rekomendasi:** Tambahkan pemetaan printer → role/ruangan/user yang diizinkan, atau minimal
  rate-limit per user untuk `/docstation/print|save|escl`. Catat setiap operasi ke audit log
  persisten (handler `AuditLogRepository` sudah tersedia). Pertimbangkan mengunci printer default
  untuk role `staff` dan hanya mengizinkan `admin` memilih printer lain.

### [High] #7 — `InsecureSkipVerify: true` global untuk semua printer + transport di-share (kebocoran setting TLS)

- **Lokasi:** `docstation_handler.go:105-135` (`NewDocStationHandler`), khususnya
  `docstation_handler.go:126-134`.
- **Bukti kode:**

  ```go
  transport := &http.Transport{
      // Printer LAN sering memakai sertifikat self-signed.
      TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
  }
  ...
  shortClient: &http.Client{ Timeout: 5 * time.Second, Transport: transport },
  ```

- **Dampak:** `InsecureSkipVerify: true` diterapkan pada **satu** `http.Transport` yang dipakai
  bersama oleh klien panjang (90 dtk) dan pendek, untuk **semua** skema (http/https) dan semua printer.
  Selain verifikasi sertifikat mati, tidak ada pinning, tidak ada `ServerName`, dan `schemes` mencoba
  `https` lalu **fallback ke `http`** (`docstation_handler.go:363-368`) sehingga data scan (dokumen
  sensitif) bisa dikirim polos ke perangkat yang hanya menjawab http. Tidak ada `DialContext` dengan
  timeout/callback untuk memblokir alamat loopback/link-local (validasi IP hanya lewat daftar env —
  lihat #8). Karena transport di-share, perubahan/pengotoran (mis. `h2`/`TLSClientConfig`) berlaku
  lintas semua jalur.
- **Rekomendasi:** Buat `tls.Config` per-printer dengan `InsecureSkipVerify` **hanya** untuk printer
  yang ditandai `secure` dan secara eksplisit mengizinkan self-signed, atau sediakan opsi
  `DOCSTATION_TLS_VERIFY=true` + CA kustom (pin sidik jari sertifikat). Pisahkan transport per
  percobaan skema, dan **jangan** fallback ke `http` untuk dokumen sensitif — kalau https gagal,
  kembalikan error agar operator tahu. Tambahkan `net.Dialer` dengan `Control` yang menolak
  loopback/link-local/metadata address sebagai pertahanan lapis kedua.

### [High] #8 — Konfigurasi printer dari env tidak divalidasi bentuk → IP bisa berisi host/port/URL

- **Lokasi:** `docstation_handler.go:52-103` (`NewDocStationHandler`), khususnya `docstation_handler.go:73-100`.
- **Bukti kode:**

  ```go
  if idx := strings.Index(entry, ":"); idx >= 0 {
      ip = strings.TrimSpace(entry[:idx])
      name = strings.TrimSpace(entry[idx+1:])
      if strings.HasSuffix(strings.ToLower(name), ":s") { ... }
  }
  if ip == "" {
      continue
  }
  ...
  parsed = append(parsed, DocStationPrinter{IP: ip, Name: name, Secure: secure})
  ```

- **Dampak:** Nilai `ip` hanya dicek "tidak kosong". `DOCSTATION_PRINTERS` yang berisi
  `http://10.0.0.1/path:x`, `evil.com:80:x`, `::1:x`, atau `10.0.0.1:631:x` (port ikut masuk ke
  "IP" karena split pada `:` pertama) akan diterima. Kemudian `resolvePrinter` menganggapnya
  "terdaftar" → SSRF ke host/port sembarang (mis. `localhost`, `169.254.169.254`, host internal lain),
  dan `fmt.Sprintf("%s://%s/eSCL/%s", scheme, printerIP, esclPath)` membentuk URL yang bisa jadi
  `http://evil.com:80:x/eSCL/...`. Tidak ada validasi bahwa nilai adalah alamat IPv4/IPv6 murni.
- **Rekomendasi:** Validasi setiap `ip` dengan `net.ParseIP` (atau `netip.ParseAddr`) dan tolak
  jika bukan IP literal; tolak IP loopback/link-local/unspecified secara default (kecuali
  `DOCSTATION_ALLOW_PRIVATE=true` eksplisit). Taruh port di field terpisah, jangan digabung ke `IP`.
  Tambahkan test unit untuk entri env yang berbahaya (`168.254.169.254`, `localhost`, `http://...`).

### [Medium] #9 — `docStationMaxBodyBytes` dibaca penuh ke memori (14 MB/dump) tanpa streaming & batas konsisten

- **Lokasi:** `docstation_handler.go:207-210` (`docStationMaxBodyBytes`), `docstation_handler.go:252-256`
  (`SaveDocument`), `docstation_handler.go:392-400` (`ProxyESCL`), `docstation_handler.go:544-556` (`PrintJob`).
- **Bukti kode:**

  ```go
  const docStationMaxBodyBytes = 15 << 20
  ...
  body, err := io.ReadAll(io.LimitReader(c.Request().Body, docStationMaxBodyBytes+1))
  ...
  if int64(len(body)) > docStationMaxBodyBytes {
      return c.JSON(http.StatusBadRequest, ...)
  }
  ```

- **Dampak:** Setiap `save`/`print`/`escl` menampung isi request **seluruhnya** di memori (hingga ~15 MB)
  sebelum diteruskan. Untuk `escl` yang biasanya request kecil, ini tidak perlu; dan untuk `save`,
  seluruh berkas dipegang di RAM lalu ditulis sekali — puncak memori = ukuran berkas × jumlah request
  bersamaan. Tidak ada batas jumlah request bersamaan/rate-limit, sehingga beberapa staf (atau klien
  yang disalahgunakan) bisa menahan memori sekaligus. Selain itu batas hanya "nyaris konsisten":
  `BodyLimitWithConfig` global di `main.go` = 60 MB, `SaveDocument`/`PrintJob` = 15 MB, sementara
  `ProxyESCL` juga 15 MB — tetapi `Content-Length` tidak divalidasi lebih awal, dan untuk request
  chunked `LimitReader` tetap membaca hingga batas +1.
- **Rekomendasi:** Tetapkan batas eksplisit dan seragam lewat satu konstanta/env, kembalikan
  `413 Request Entity Too Large` (bukan `400`) saat melebihi, dan untuk `save` gunakan
  `io.Copy` streaming ke file tujuan (dengan `io.LimitReader` + cleanup bila melebihi) agar tidak
  menahan seluruh berkas di memori. Untuk `escl`, batasi jauh lebih kecil (mis. 1–2 MB) dan
  teruskan body secara streaming. Tambahkan rate-limit per user untuk endpoint DocStation.

### [Medium] #10 — `clearStuckESCLJobs` memakai kembali `scheme` pertama dari loop sebagai basis URL job

- **Lokasi:** `docstation_handler.go:443-478` (`clearStuckESCLJobs`), khususnya baris 470-474.
- **Bukti kode:**

  ```go
  for _, scheme := range schemes {
      url := fmt.Sprintf("%s://%s/eSCL/ScanJobs", scheme, printerIP)
      ...
      for _, jobURL := range extractJobURLs(data) {
          if !strings.HasPrefix(jobURL, "http") {
              jobURL = fmt.Sprintf("%s://%s%s", scheme, printerIP, jobURL)
          }
          delReq, _ := http.NewRequest(http.MethodDelete, jobURL, nil)
          ...
      }
      return
  }
  ```

- **Dampak:** Jika printer mengembalikan `JobUri` **absolut** (`http://...` atau bahkan
  `https://host-lain/...`), nilainya dipakai langsung sebagai tujuan `DELETE` tanpa validasi host →
  SSRF/penghapusan lintas host (perangkat LAN yang menjawab `ScanJobs` dapat menyuruh server
  menghapus resource di host lain). Meskipun `jobURL` biasanya dari printer yang sudah ada di
  allowlist, kepercayaan pada data dari perangkat tanpa verifikasi host adalah kelemahan nyata.
  Selain itu `delReq` bisa `nil` (error diabaikan dengan `_`) lalu dicek, tetapi bukan sumber masalah
  utama; yang utama adalah ketiadaan validasi host/path.
- **Rekomendasi:** Jangan pernah memakai `jobURL` absolut dari printer. Selalu bentuk ulang URL dari
  `printerIP` + path hasil ekstraksi (ambil hanya path, buang host/skema), validasi bahwa path
  diawali `/eSCL/`, dan tolak jika tidak. Periksa error `http.NewRequest` sebelum memakai.

### [Medium] #11 — Mutex per-printer benar, tetapi `clearStuckESCLJobs` dipanggil di luar jalur lock saat retry 503

- **Lokasi:** `docstation_handler.go:365-370` dan `docstation_handler.go:404-409` (`ProxyESCL` →
  `clearStuckESCLJobs`), `docstation_handler.go:443-449` (lock).
- **Bukti kode:**

  ```go
  if esclPath == "ScanJobs" && c.Request().Method == http.MethodPost && secure {
      h.clearStuckESCLJobs(printerIP)
  }
  ...
  if res.StatusCode == http.StatusServiceUnavailable && esclPath == "ScanJobs" && c.Request().Method == http.MethodPost {
      _ = res.Body.Close()
      h.clearStuckESCLJobs(printerIP)
      ...
  }
  ```

- **Dampak:** `clearStuckESCLJobs` memang mengambil lock per-printer, tetapi lock hanya melindungi
  bagian pembersihan **terhadap sesama clearStuck** — `ProxyESCL` sendiri tidak memegang lock saat
  mengirim `POST ScanJobs`. Jadi dua request `ScanJobs` bersamaan tetap dapat: (a) keduanya memanggil
  `clearStuckESCLJobs` sebelum salah satu mengirim POST, (b) yang satu menghapus job yang baru saja
  dibuat yang lain (karena DELETE mencakup semua job di daftar), sehingga pemindaian pengguna lain
  gagal secara acak. `PrinterStatus` juga melakukan dial paralel ke printer yang sama tanpa lock —
  tidak fatal, tetapi menambah beban. Race logika ini sulit direproduksi dan menghasilkan kegagalan
  intermiten ("scan hilang").
- **Rekomendasi:** Pegang lock per-printer **selama** siklus POST ScanJobs + retry (atau gunakan
  semaphore per printer dengan timeout antre). Jangan hapus **semua** job tanpa mempertimbangkan job
  milik request lain — cukup hapus job yang macet (umur > N menit) atau job yang kita buat sendiri.
  Dokumentasikan model konkurensi yang diinginkan (serialize per printer vs paralel).

### [Medium] #12 — Log & pesan error membocorkan IP printer, `user_id`, dan berpotensi kredensial env

- **Lokasi:** `docstation_handler.go:270` (`SaveDocument`), `docstation_handler.go:438`
  (`ProxyESCL`), `docstation_handler.go:566-571` (`PrintJob`), `docstation_handler.go:155-164,
395-400, 480, 555` (pesan error yang menyertakan `printerIP`).
- **Bukti kode:**

  ```go
  c.Logger().Infof("docstation save user=%s file=%s bytes=%d", currentUserID(c), name, len(body))
  c.Logger().Infof("docstation escl user=%s printer=%s %s %s -> %d", currentUserID(c), printerIP, c.Request().Method, esclPath, resp.StatusCode)
  c.Logger().Infof("docstation print user=%s printer=%s bytes=%d format=%s", currentUserID(c), printerIP, len(body), docFormat)
  ```

- **Dampak:** Log aplikasi (stdout, dikumpulkan/backup) memuat `user_id` + IP printer + nama berkas
  hasil scan. Ini metadata dokumen sensitif (siapa mencetak apa, kapan, ke perangkat mana). Bila kelak
  env printer memuat kredensial (mis. `DOCSTATION_PRINTERS="user:pass@10.0.0.1:Nama"` sering dipakai
  untuk IPP auth), pasangan kredensial itu akan ikut tampil di log dan **di seluruh pesan error**
  yang menyertakan `printerIP` (`fmt.Sprintf("Printer (%s) tidak merespon eSCL: %v", printerIP, ...)`)
  → kredensial bocor ke response API dan log. Environment variable juga disimpan polos (tidak
  terenkripsi) dalam `.env`; tidak ada mekanisme rotasi atau secret manager.
- **Rekomendasi:** Jangan pernah mencetak/mengembalikan `printerIP` mentah — gunakan ID/nama printer
  (mis. `printerName`) di log & pesan error, atau redaksi (`10.x.x.x` → `printer-1`). Jangan
  mengizinkan bentuk `user:pass@host` pada env; simpan kredensial printer di secret store terpisah
  dan baca sebagai field terpisah. Turunkan level log untuk operasi rutin atau pindahkan ke audit log
  dengan kontrol akses. Pastikan `.env` tidak ikut backup/commit.

### [Low] #13 — Tidak ada `defer resp.Body.Close()` untuk `clearStuckESCLJobs` saat request gagal & `extractJobURLs` tanpa batas ukuran

- **Lokasi:** `docstation_handler.go:459-467` (`clearStuckESCLJobs`), `docstation_handler.go:483-520`
  (`extractJobURLs`), `docstation_handler.go:411-425` (`ProxyESCL`).
- **Bukti kode:**

  ```go
  data, _ := io.ReadAll(res.Body)
  _ = res.Body.Close()
  ```

  ```go
  dec := xml.NewDecoder(bytes.NewReader(data))
  ...
  for {
      tok, err := dec.Token()
      if err != nil { break }
      ...
  }
  ```

- **Dampak:** `io.ReadAll(res.Body)` tanpa `io.LimitReader` membaca seluruh respons daftar job dari
  printer ke memori — perangkat yang nakal/rusak dapat mengirim respons sangat besar (atau stream tak
  berujung) sehingga server kehabisan memori. Karena `shortClient` punya timeout 5 dtk, dampaknya
  terbatas, tetapi tetap tidak ada batas ukuran eksplisit. Di `ProxyESCL`, `defer resp.Body.Close()`
  ada (baris 415) dan `c.Stream` menutup body — tidak ada masalah. Temuan ini minor, tetapi
  mencerminkan pola "percaya ukuran respons dari perangkat" yang sama dengan #10.
- **Rekomendasi:** Bungkus `io.ReadAll(io.LimitReader(res.Body, maxESCLListBytes))` (mis. 2 MB) dan
  perlakukan kelebihan sebagai "job list tak terbaca". Sama untuk `extractJobURLs` — batasi jumlah
  entri yang diekstrak agar tidak ada ledakan memori/time parsing.

---

## Prioritas Perbaikan

### P0 — segera (Critical)

1. **#1** — Wajibkan `X-CSRF-Token` untuk semua mutasi DocStation; tolak request tanpa `Origin`/`Referer`
   (jangan `return true`); pisahkan `GET`/`POST` pada `escl` dan rotasi/ikat token ke sesi.
2. **#2** — Simpan metadata (pemilik/hash/ukuran) tiap `SaveDocument` dan kembalikan ID dokumen;
   daftarkan folder DocStation di matriks otorisasi `FileHandler` bila perlu dibaca ulang; paksa
   ekstensi sesuai `DetectContentType`.
3. **#3** — Propagasi `c.Request().Context()` ke semua request keluar (`ProxyESCL`, `sendIPP`,
   `clearStuckESCLJobs`, `sendRaw9100`) dan hentikan goroutine `PrinterStatus` saat context selesai.

### P1 — penting (High)

4. **#4** — Allowlist header respons printer (buang `Set-Cookie`/`Access-Control-*`/`Refresh`/
   `Content-Disposition`); rewrite `Location` tetap.
5. **#5** — Normalisasi nilai `Content-Type`/`Accept`, whitelist `RawQuery`, validasi `esclPath`
   (tanpa `..`, `//`, skema) sebelum membentuk URL printer.
6. **#6** — Otorisasi per printer/role + rate-limit per user + audit log persisten untuk
   `print`/`save`/`escl`.
7. **#7** — Batasi `InsecureSkipVerify` hanya pada printer yang ditandai secure/verify-off; jangan
   fallback diam-diam ke `http` untuk dokumen sensitif; tambahkan `net.Dialer` guard (tolak
   loopback/link-local).
8. **#8** — Validasi setiap `ip` printer dengan `net.ParseIP`/`netip.ParseAddr`; pisahkan port; tolak
   host/URL/loopback; tambah test entri env berbahaya.

### P2 — ketahanan (Medium)

9. **#9** — Streaming body untuk `save` (jangan tahan 15 MB di RAM), kembalikan `413`, batas `escl`
   lebih kecil, plus rate-limit.
10. **#10** — Jangan pakai `JobUri` absolut dari printer; bentuk ulang URL dari `printerIP` + path
    tervalidasi (`/eSCL/...`) untuk DELETE.
11. **#11** — Pegang lock per-printer selama siklus POST ScanJobs + retry; jangan hapus job milik
    request lain.
12. **#12** — Redaksi IP printer di log/pesan error; larang kredensial printer di env biasa; pindahkan
    ke secret store; audit log dengan kontrol akses.

### P3 — penyempurnaan (Low)

13. **#13** — Batasi ukuran respons daftar job (`io.LimitReader`) dan jumlah entri `extractJobURLs`.
14. Tambahkan test regresi negatif: POST tanpa Origin/Referer → 403; respons printer berisi
    `Set-Cookie` tidak diteruskan; entri env printer non-IP ditolak; context cancel menghentikan
    request ke printer.
