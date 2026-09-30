# Audit Kematangan Lapisan Service & Crypto — `integrations/cloudstorage`

**Tanggal audit:** 2026-09-29
**Cakupan:** `internal/service/service.go`, `internal/service/service_test.go`, `internal/crypto/crypto.go`, `internal/model/model.go`
**Konteks pendukung (tidak diaudit penuh):** `internal/handler/handler.go`, `internal/telegram/client.go`, `internal/repository/repository.go`, `internal/config/config.go`, `cmd/server/main.go`
**Mode:** read-only. Tidak ada kode produksi yang diubah.

---

## 1. Ringkasan Eksekutif

Lapisan service (`service.go`) cukup matang pada aspek **orkestrasi CRUD + transaksi** (copy/move/trash/restore cascade, resolusi nama unik, penghapusan referensial ke Telegram). Namun terdapat **kesenjangan serius pada jalur upload/download terenkripsi**: seluruh file dibaca ke memori tanpa batas yang ditegakkan di service, tidak ada propagasi `context`, dan validasi ukuran/chunk praktis tidak ada. Lapisan crypto (`crypto.go`) secara algoritma **benar** (AES-256-GCM, nonce acak 12 byte di-prepend, validasi panjang kunci), tetapi **tanpa satu pun unit test** dan **terduplikasi** dengan implementasi di `telegram/client.go` sehingga berisiko divergensi.

Skor kematangan kasar per area:

| Area                         | Status          | Catatan singkat                                                  |
| ---------------------------- | --------------- | ---------------------------------------------------------------- |
| Enkripsi (algoritma)         | Baik            | AES-256-GCM, nonce acak, kegagalan auth tidak ditelan            |
| Manajemen kunci              | Perlu perbaikan | Hanya 1 kunci hex statis; tanpa rotasi/derivasi/versioning       |
| IV / Nonce                   | Baik            | 12 byte acak per operasi, di-prepend                             |
| Batas ukuran file/chunk      | Kritis          | Tidak ditegakkan di service; `io.ReadAll` seluruh file ke RAM    |
| Penanganan konteks/goroutine | Kritis          | Tidak ada `context.Context`; upload/download tak bisa dibatalkan |
| Penanganan error             | Perlu perbaikan | Error di-_swallow_ di beberapa tempat; wrapping inkonsisten      |
| Validasi input               | Perlu perbaikan | Cek MIME cacat logika; tanpa batas panjang nama                  |
| Cakupan test                 | Kritis          | 0 test untuk crypto; banyak jalur service tak teruji             |

---

## 2. Temuan Bertingkat

### KRITIS

#### K-1. Upload membaca seluruh file ke memori tanpa batas efektif (OOM / DoS)

`UploadFile` melakukan `io.ReadAll(file)` sebelum apa pun, lalu **tidak pernah** memeriksa ukuran terhadap `MaxUploadSize()`.

**Bukti kode:** `internal/service/service.go:102-106`

```go
// Baca seluruh file ke memory untuk enkripsi jika diperlukan
data, err := io.ReadAll(file)
if err != nil {
    return nil, err
}
```

`MaxUploadSize()` didefinisikan (`service.go:74-79`) tetapi **hanya dipakai** untuk `fiber.Config.BodyLimit` di `cmd/server/main.go:88` dan endpoint `/api/config` (`handler.go:32`). Tidak ada pemanggilan di jalur `UploadFile`. Konsekuensinya:

1. Seluruh isi file (default maksimum **2 GiB**, `config.go:38`) dibaca ke heap **plus** salinan terenkripsi (`encData`, `service.go:115-119`) plus `bytes.NewReader` untuk Telegram (`service.go:121`). Puncak memori mendekati **2x ukuran file** untuk satu upload.
2. Saat multipart, Fiber menyimpan berkas yang melampaui ambang batas ke disk lalu tetap dibaca penuh ke RAM.
3. Beberapa upload paralel (endpoint menerima `form.File["file"]` banyak, `handler.go:120-122`) menggandakan dampak ini.

**Rekomendasi konkret:**

- Terapkan cek ukuran berlapis dan streaming:
  ```go
  max := s.MaxUploadSize()
  if header.Size > max { return nil, fmt.Errorf("file terlalu besar: %d > %d", header.Size, max) }
  lr := io.LimitReader(file, max+1)
  data, err := io.ReadAll(lr)
  if err != nil { return nil, err }
  if int64(len(data)) > max { return nil, errors.New("file melebihi batas ukuran") }
  ```
- Untuk enkripsi, ganti strategi "baca semua lalu seal" menjadi **chunked/streaming** (lihat K-3) atau setidaknya spool ke `os.CreateTemp` lalu enkripsi per potongan.
- Turunkan default `MaxUploadSize` (atau paksa lebih kecil) saat `ENCRYPTION_ENABLED=true`, karena mode terenkripsi menggandakan memori.

#### K-2. Tidak ada `context.Context` di seluruh lapisan service

Tidak satu pun method service menerima `context.Context`. Ini memutus pembatalan (client `Ctrl+C`, timeout, shutdown server) dan membuat operasi Telegram yang panjang tak dapat di-interupsi.

**Bukti kode:** `internal/service/service.go:95-101, 337-339`

```go
func (s *Service) UploadFile(file multipart.File, header *multipart.FileHeader, parentID *string) (*model.File, error) {
...
func (s *Service) DownloadDecryptedFile(id string) (io.ReadCloser, error) {
```

Telegram client pun mengabaikan context dari pemanggil: `UploadFile` memakai `http.NewRequest` tanpa context (`telegram/client.go:189`) dan `doAPICall` memakai `time.Sleep` untuk retry (`telegram/client.go:66-95`) yang **memblokir goroutine** dan tidak menghormati pembatalan. Satu-satunya context dibuat internal dengan `context.Background()` (`telegram/client.go:212, 241, 280`).

**Rekomendasi konkret:**

- Ubah signature publik: `UploadFile(ctx context.Context, ...)`, `DownloadDecryptedFile(ctx, id string)`, `CopyFiles(ctx, ...)`, `MoveFiles(ctx, ...)`, `PermanentDelete(ctx, ...)`, `EmptyTrash(ctx)`, dst. Ambil `ctx` dari handler via `c.UserContext()` (Fiber).
- Turunkan `ctx` ke repository (`QueryContext`/`ExecContext`) dan telegram client (`http.NewRequestWithContext`).
- Ganti `time.Sleep` di retry dengan `select { case <-ctx.Done(): return ...; case <-time.After(...): }`.

#### K-3. Enkripsi non-streaming & duplikasi implementasi crypto

`crypto.go` mengunci keseluruhan pesan dengan satu operasi GCM (`gcm.Seal`). Untuk file besar, ini menambah puncak memori dan mencegah dekripsi parsial (mis. untuk thumbnail atau range download).

**Bukti kode:** `internal/crypto/crypto.go:40-42`

```go
ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
return ciphertext, nil
```

Selain itu crypto **diduplikasi** hampir identik di `telegram/client.go:436-524` (`Encrypt`/`Decrypt`). Dua salinan ini harus dijaga sinkron; sudah ada perbedaan pesan error (`errors.New` di crypto vs `fmt.Errorf` di telegram) sehingga perbaikan di satu tempat mudah terlewat di tempat lain.

**Bukti duplikasi:** `internal/crypto/crypto.go:14` dan `internal/telegram/client.go:438` mendefinisikan fungsi dengan kontrak sama persis.

**Rekomendasi konkret:**

- Jadikan `internal/crypto` sebagai **satu-satunya** sumber; hapus salinan di `telegram/client.go` dan impor `cloudstorage/internal/crypto`.
- Untuk file di atas ambang tertentu, adopsi format **chunked AEAD** (potongan 4-8 MiB, tiap chunk nonce + counter di AAD, plus tag integritas global) sehingga upload/download bisa streaming.
- Tambahkan `version byte` di header ciphertext untuk memungkinkan migrasi format tanpa merusak data lama.

#### K-4. Cakupan test jalur crypto = nol

Tidak ada file test untuk package `crypto`. Tidak ada pembuktian otomatis atas: round-trip, nonce unik antar panggilan, penolakan kunci non-hex/panjang salah, penolakan ciphertext terlalu pendek, deteksi tamper (GCM auth failure), dan perilaku kunci kosong.

**Bukti:** tidak ada `internal/crypto/*_test.go` (struktur `internal/crypto/` hanya berisi `crypto.go`); `service_test.go` juga tidak pernah mengeset `EncryptionEnabled`/`EncryptionKey` — semua `config.Config{}` di test hanya mengeset `TelegramChatID`/`ShareExpiryDays` (`service_test.go:49, 484, 505`).

**Rekomendasi konkret:** tambahkan `crypto_test.go` (lihat bagian 4 untuk matriks test).

---

### MAYOR

#### M-1. Validasi MIME cacat logika (false reject & false accept)

Logika mismatch `Content-Type` tidak berjalan seperti komentar menyatakan "izinkan mismatch untuk application/".

**Bukti kode:** `internal/service/service.go:108-116`

```go
contentType := http.DetectContentType(data)
expectedContentType := header.Header.Get("Content-Type")
if contentType != expectedContentType {
    // Izinkan mismatch untuk jenis file khusus (seperti aplikasi/) tetapi beri peringatan
    if !strings.HasPrefix(contentType, "application/") || !strings.HasPrefix(expectedContentType, "application/") {
        return nil, fmt.Errorf("mime type mismatch: expected %s, got %s", expectedContentType, contentType)
    }
}
```

Masalah:

- `http.DetectContentType` hanya mengenali sejumlah kecil signature; file teks/PDF/Office akan terdeteksi `text/plain; charset=utf-8` atau `application/octet-stream`, sementara klien mengirim `application/pdf`, `text/csv`, dst. Akibatnya **banyak upload sah ditolak**.
- Komentar menjanjikan "peringatan" tapi tidak ada `log.Printf` — hanya lolos diam-diam atau error keras.
- `header.Header.Get("Content-Type")` untuk `multipart.FileHeader` sering **kosong** pada klien tertentu, sehingga mismatch dan menolak file yang sebenarnya oke.

**Rekomendasi konkret:**

- Jangan bandingkan dengan header klien (tidak tepercaya). Simpan `contentType` hasil deteksi sebagai `MimeType` **saja** (sudah dilakukan di `service.go:143`) dan buang blok penolakan, atau jadikan allowlist/denylist eksplisit bila memang ada kebijakan keamanan.
- Jika butuh pertahanan terhadap file berbahaya, gunakan ekstensi + deteksi konten + (opsional) scanning, bukan perbandingan string tipe.

#### M-2. `DownloadDecryptedFile` tanpa batas, tanpa `defer`, dan inkonsistensi jalur download

Untuk file terenkripsi, seluruh unduhan dibaca ke memori lalu didekripsi, tanpa batas ukuran.

**Bukti kode:** `internal/service/service.go:351-364`

```go
data, err := io.ReadAll(rc)
rc.Close()
if err != nil {
    return nil, err
}
decData, err := crypto.Decrypt(data, s.cfg.EncryptionKey)
```

Ada juga **inkonsistensi fungsional**: handler unduhan (`handler.go:299`) memakai `DownloadTelegramFileWithRange` yang mengembalikan **stream mentah terenkripsi**, sehingga untuk file dengan `Encrypted == true` klien menerima byte sandi, bukan file asli. `DownloadDecryptedFile` tampak tidak dipakai oleh handler.

**Rekomendasi konkret:**

- Handler unduhan harus memilih jalur dekripsi untuk file `Encrypted == true`, atau menolak eksplisit untuk share link.
- Gunakan `defer rc.Close()` tepat setelah `DownloadFile` berhasil.
- Batasi pembacaan dengan `io.LimitReader` (`MaxUploadSize()` + overhead header AEAD).

#### M-3. Penanganan error yang di-swallow menutupi kegagalan data

**Bukti kode:**

- `internal/service/service.go:600-603`
  ```go
  existing, err := r.ListFiles(parentID)
  if err != nil {
      return map[string]bool{}
  }
  ```
  Query gagal lalu dianggap "tidak ada nama terpakai", sehingga bisa menabrak unique index, memicu loop retry tak perlu, atau error membingungkan.
- `internal/service/service.go:640-655` — `createFileWithUniqueName` menyembunyikan penyebab error asli; setelah 100 percobaan mengembalikan `errors.New("tidak bisa membuat nama file unik")` tanpa `lastErr`.
- `internal/service/service.go:548-555` — kegagalan `s.chatID()` diabaikan (`if chatID, cerr := s.chatID(); cerr == nil`), pesan Telegram jadi tak pernah dihapus tanpa jejak.

**Rekomendasi konkret:**

- `collectUsedNames` harus mengembalikan `(map[string]bool, error)` dan error diteruskan.
- Simpan `lastErr` di loop retry dan bungkus: `fmt.Errorf("gagal insert file unik: %w", lastErr)`.
- Di `permanentDeleteCascade`, log saat `chatID()` gagal (konsisten dengan log delete message yang sudah ada di `service.go:554`).

#### M-4. `GetThumbnail` men-decode gambar tanpa batas ukuran & tanpa proteksi decompression bomb

`image.Decode` pada stream dari Telegram tanpa batas ukuran/dimensi memungkinkan **decompression bomb** (PNG/GIF kecil dapat mengembang jadi ratusan MB saat didekode) dan OOM.

**Bukti kode:** `internal/service/service.go:401-407`

```go
rc, err := s.telegram.DownloadFile(*f.FileID)
if err != nil {
    return nil, "", err
}
defer rc.Close()

img, _, err := image.Decode(rc)
```

Tidak ada `io.LimitReader` untuk unduhan, dan tidak ada cek `f.Size` sebelum decode. Perlu dicatat juga bahwa untuk file terenkripsi, thumbnail akan gagal karena byte yang di-decode masih ciphertext.

**Rekomendasi konkret:**

- Bungkus `rc` dengan `io.LimitReader(rc, maxDecodeBytes)` (mis. 20-50 MB).
- Cek `f.Size` sebelum mengunduh; tolak bila melampaui ambang thumbnail.
- Manfaatkan `image.DecodeConfig` untuk validasi dimensi dari header sebelum decode penuh.

#### M-5. Cache thumbnail: race tulis dan tanpa batas total

`GetThumbnail` membaca (`service.go:396-398`) dan menulis (`service.go:425-428`) file cache tanpa sinkronisasi. Dua request bersamaan untuk file yang sama akan menulis path yang sama; ada jendela di mana file parsial dibaca. Tidak ada batas total ukuran cache — hanya pembersihan berbasis referensi (`CleanThumbCache`).

**Bukti kode:** `internal/service/service.go:396-399` (baca cache) vs `425-428` (tulis cache); `CleanThumbCache` (`service.go:444-485`).

**Rekomendasi konkret:**

- Tulis ke file sementara unik lalu `os.Rename` atomik ke path final.
- Tambahkan TTL/LRU atau batas total bytes untuk `ThumbCacheDir`.

#### M-6. `EmptyTrash` / `RestoreAll` berpotensi lambat dan rekursi dalam transaksi tunggal

`EmptyTrash` melakukan iterasi seluruh isi trash dan per item menjalankan `permanentDeleteCascade` rekursif — semuanya di dalam **satu transaksi** (`service.go:497-522`). Untuk trash besar, ini menghasilkan transaksi panjang yang menahan lock SQLite, dan satu kegagalan Telegram/DB membatalkan seluruh operasi.

**Bukti kode:** `internal/service/service.go:497-522` dan `service.go:530-562`.

**Rekomendasi konkret:**

- Batch operasi (mis. per N item) dari luar transaksi, atau keluarkan panggilan jaringan Telegram dari transaksi DB (lakukan penghapusan DB dulu, lalu best-effort hapus Telegram secara asinkron/enqueued).
- Beri batas waktu pada transaksi.

---

### MINOR

#### m-1. `Encrypt`/`Decrypt` dengan kunci kosong bersifat no-op diam-diam

**Bukti kode:** `internal/crypto/crypto.go:14-16` dan `internal/crypto/crypto.go:51-56`

```go
if key == "" {
    return plaintext, nil
}
...
if key == "" {
    return ciphertext, nil
}
```

Ini penting sebagai perilaku _fail-safe_, tetapi berbahaya karena salah konfigurasi (mis. `ENCRYPTION_KEY` lupa di-set tetapi `ENCRYPTION_ENABLED=true`) membuat upload **sukses menyimpan plaintext** tanpa peringatan. Jenis kelalaian yang diam-diam merusak kerahasiaan.

**Rekomendasi:** di `UploadFile`, bila `EncryptionEnabled && EncryptionKey == ""`, **tolak upload** dengan error konfigurasi eksplisit (bukan diam-diam plaintext).

#### m-2. `model.File` mengembalikan `ShareToken` pada respons list/get

`model.File` menyertakan `ShareToken` dan (implisit) `Path` dalam JSON. Endpoint `ListFiles`, `GetFile`, `Search` mengembalikan struct ini apa adanya, sehingga **token share bisa bocor** ke klien yang sekadar listing.

**Bukti kode:** `internal/model/model.go:2, 16` (`ShareToken *string \`json:"share_token,omitempty"\``), digunakan langsung di `handler.go:87` (`c.JSON(files)`), `handler.go:208` (`GetFile`).

**Rekomendasi:** gunakan DTO terpisah untuk respons list/read yang hanya memuat field publik, `ShareToken` hanya dikirim pada endpoint `CreateShareLink`.

#### m-3. Tidak ada batas panjang/validasi nama file & folder

`CreateFolder`/`RenameFile` hanya menolak nama kosong (`service.go:87-89, 187-189`); tidak ada batas panjang, penjagaan karakter kontrol, atau penolakan `.`/`..`/separator path. `uniqueNameFromUsed` menangani perpanjangan nama, tetapi nama yg sangat panjang dapat menyebabkan tekanan pada DB/URL.

**Bukti kode:** `internal/service/service.go:86-89` dan `service.go:186-189`.

**Rekomendasi:** batasi panjang nama (mis. 1-255 byte), tolak karakter kontrol dan `/`/`\\`, normalisasi Unicode (NFC), dan tolak `"."`/`".."`.

#### m-4. `generateToken` hanya 96 bit dan tidak dibandingkan constant-time

`generateToken` memakai 12 byte acak (`service.go:684-690`). Token share diperiksa via query SQL (`GetFileByShareToken`), bukan perbandingan constant-time, sehingga secara teoretis rentan timing. En tropi 96 bit rendah untuk token bearer publik.

**Bukti kode:** `internal/service/service.go:684-690`; perbandingan di `repository.go:298-301`.

**Rekomendasi:** naikkan ke 32 byte (256 bit) dan bandingkan hash-nya. Simpan token dalam bentuk hash di DB bila memungkinkan.

#### m-5. Error dekripsi membocorkan detail internal

`crypto.Decrypt` mengembalikan `"decryption failed: " + err.Error()` (`crypto.go:79`) yang menyertakan pesan GCM internal. Pesan ini bisa dilempar ke klien via `DownloadDecryptedFile` (`service.go:363`).

**Bukti kode:** `internal/crypto/crypto.go:79` dan `internal/service/service.go:362-364`.

**Rekomendasi:** kembalikan error generik ke luar ("file rusak atau kunci salah"), detail hanya di log server.

#### m-6. `chatID()` dipanggil berulang per operasi dan tidak di-cache

`chatID()` (`service.go:159-164`) membaca `s.cfg.TelegramChatID` tiap kali. Minor, tetapi pada `permanentDeleteCascade` / `EmptyTrash` bisa dipanggil ratusan kali.

**Rekomendasi:** validasi sekali saat startup (`NewService`) dan simpan hasilnya.

---

## 3. Cakupan Test Saat Ini & Celah

Test yang ada (`service_test.go`, 15 fungsi) fokus pada:

- Copy & move + resolusi konflik nama.
- Cascade soft-delete / restore / permanent-delete.
- Referential delete Telegram (beberapa skenario referensi).
- Share link expiry.
- Upload hanya satu kasus (resolusi konflik nama, tanpa enkripsi/batas ukuran).

**Celah yang tidak teruji sama sekali:**

1. Seluruh package `crypto` (Enkripsi/Dekripsi).
2. `UploadFile` dengan enkripsi aktif (`EncryptionEnabled=true`).
3. Batas ukuran upload / penolakan file di atas `MaxUploadSize`.
4. Validasi MIME (blok `service.go:108-116`).
5. `DownloadDecryptedFile` (termasuk jalur sukses & gagal dekripsi).
6. `GetThumbnail` (cache hit/miss, image invalid, non-image).
7. `CleanThumbCache`.
8. `EmptyTrash` dengan dedup referensi file_id & item bersarang.
9. `RestoreAll`.
10. Race konkuren pada `createFileWithUniqueName` (loop retry).
11. `expandPath`/`GetAllActivePaths` visibilitas via `Search` pada nested folder.
12. Perilaku `ctx` (belum ada).

**Bukti tidak adanya test:** `service_test.go` tidak pernah mengeset `EncryptionEnabled`/`EncryptionKey`/`MaxUploadSize` (config yang disuntik hanya `TelegramChatID` dan `ShareExpiryDays`), dan `mockTelegram.DownloadFile` selalu mengembalikan `errors.New("not implemented")` (`service_test.go:33-35`), sehingga semua jalur unduh/dekripsi/thumbnail tidak terjangkau test.

---

## 4. Rekomendasi Matriks Test

### `internal/crypto/crypto_test.go` (prioritas tertinggi)

| Test                                | Tujuan                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `TestEncryptDecryptRoundTrip`       | plainteks kembali utuh untuk berbagai ukuran (0, 1, 15, 16, 1MB)         |
| `TestEncryptUniqueNonce`            | dua enkripsi plaintext sama menghasilkan ciphertext berbeda (nonce acak) |
| `TestEncryptRejectsBadKey`          | kunci non-hex / panjang bukan 32 byte -> error                           |
| `TestDecryptRejectsShortCiphertext` | ciphertext < nonce size -> error                                         |
| `TestDecryptDetectsTamper`          | ubah 1 byte ciphertext -> error GCM                                      |
| `TestEmptyKeyNoOp`                  | dokumen perilaku kunci kosong                                            |

### `internal/service/service_test.go` (tambahan)

| Test                                      | Tujuan                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `TestUploadFile_EnforcesMaxSize`          | header.Size / data melebihi batas -> ditolak                                         |
| `TestUploadFile_EncryptsWhenEnabled`      | `MockTelegram` menangkap byte -> pastikan ciphertext != plaintext & `Encrypted=true` |
| `TestUploadFile_NoKeyButEnabled_Rejected` | `EncryptionEnabled=true` + key kosong -> error                                       |
| `TestDownloadDecryptedFile_RoundTrip`     | mock mengembalikan ciphertext -> hasil = plaintext                                   |
| `TestDownloadDecryptedFile_WrongKey`      | error, tidak panik                                                                   |
| `TestGetThumbnail_ImageAndCacheHit`       | mock balikin PNG kecil; verifikasi cache ditulis & hit kedua                         |
| `TestGetThumbnail_NotImage`               | MIME non-image -> error                                                              |
| `TestCleanThumbCache_RemovesStale`        | file cache tanpa referensi dihapus                                                   |
| `TestEmptyTrash_DedupTelegramDelete`      | beberapa referensi file_id sama -> deleteMessage dipanggil sekali                    |
| `TestRestoreAll`                          | seluruh trash dipulihkan, nama unik                                                  |

Untuk mendukung test unduh, `mockTelegram.DownloadFile` perlu diperluas agar bisa mengembalikan isi yang dapat dikonfigurasi (saat ini selalu error).

---

## 5. Rekomendasi Konkret (Prioritas)

1. **Tegakkan batas ukuran di `UploadFile`** dan ganti `io.ReadAll` dengan jalur berbatas/streaming. (K-1)
2. **Tambahkan `context.Context`** ke seluruh API service dan teruskan ke repo + client. (K-2)
3. **Deduplikasi crypto** ke `internal/crypto` tunggal dan tambahkan `crypto_test.go`. (K-3, K-4)
4. **Perbaiki/matikan validasi MIME** yang cacat dan perkuat validasi nama. (M-1, m-3)
5. **Satukan jalur download** supaya file terenkripsi tidak dikirim sebagai ciphertext, dan hapus `defer`-gate. (M-2)
6. **Batasi decode thumbnail** + tulis cache via rename atomik. (M-4, M-5)
7. **Teruskan/log error** yang selama ini di-swallow dan sertakan `lastErr` pada loop retry. (M-3)
8. **DTO respons** untuk mencegah kebocoran `ShareToken`. (m-2)
9. **Perkuat token** share (256 bit + perbandingan aman). (m-4)

---

## 6. Catatan Positif

- AES-256-GCM diterapkan dengan nonce acak per operasi & nonce di-prepend — pola yang tepat.
- Validasi panjang kunci (32 byte / 64 hex) eksplisit dan menolak lebih awal.
- Manajemen transaksi (`WithTx`) dan resolusi nama unik sudah menangani race konkuren via unique index + retry deterministik.
- Penghapusan Telegram bersifat referensial (`CountByFileID`) sehingga salinan tidak kehilangan file.
- Perilaku `Encrypt`/`Decrypt` idempoten pada input kosong mencegah panik.
