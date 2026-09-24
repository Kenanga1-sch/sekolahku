# Cloud Storage — Integrasi ke Sekolahku

Layanan penyimpanan berkas pribadi (mirip Google Drive) yang memanfaatkan
**Telegram Bot API server lokal** sebagai backend penyimpanan file, dengan
metadata di SQLite Sekolahku.

## Status integrasi

- **Backend produksi**: `go-backend/internal/cloudstorage/` (ditulis ulang,
  bersih, di atas Echo + net/http).
- **Frontend produksi**: `app/(dashboard)/cloud-storage/` + `lib/cloudstorage/`
  (React, tema hijau Sekolahku).
- **Aset di folder ini**: salinan **referensi arsitektur** saja.

> **Penting**: kode sumber Go asli di folder ini **RUSAK** (syntax error akibat
> operasi edit otomatis yang gagal di `internal/handler/handler.go`,
> `internal/repository/repository.go`, dan `internal/telegram/client.go`).
> Proyek ini juga memakai framework **Fiber**, sedangkan backend Sekolahku
> memakai **Echo**. Karena itu implementasi produksi **ditulis ulang** di dalam
> `go-backend`, hanya mengambil ide arsitekturnya (metadata SQLite + Telegram
> sebagai object store). Jangan mengompilasi folder ini.

## Arsitektur produksi

```
Browser (React: /cloud-storage)
   │  JWT sesi Sekolahku + CSRF
   ▼
go-backend (Echo)
   ├─ handlers/cloudstorage_handler.go   REST API /api/cloud/*
   ├─ cloudstorage/service.go            logika: upload/copy/move/trash/share
   ├─ cloudstorage/telegram.go           klien Bot API (upload + baca lokal)
   └─ repository/cloudstorage_repo.go    metadata (cloud_files) ter-scope owner
   │
   ├─ HTTP upload → host:8086 (Bot API lokal, mode --local)
   └─ baca berkas langsung dari /app/telegram-data (mount host)
Telegram Bot API lokal (container sekolahku-telegram-api)
   └─ menyimpan berkas di /home/chitchat/telegram-api-data (uid 1000)
```

### Mengapa baca berkas langsung dari disk?

Server Bot API lokal dijalankan dengan `--local`: `getFile` mengembalikan **path
absolut** dan endpoint HTTP `/file/...` pada build ini tidak melayani berkas
lokal (selalu 404). Karena direktori data di-mount ke container Sekolahku,
`cloudstorage/telegram.go` membaca berkas **langsung dari disk** (mendukung
HTTP Range). Container Bot API berjalan sebagai **uid 1000** agar berkas yang
ditulis dimiliki uid 1000 — sama dengan identitas container sekolahku-prod
(podman rootless memetakan uid 0 container → uid 1000 host).

Container Bot API khusus ini didefinisikan di `deploy/telegram-bot-api.yml`
(port 8086), terpisah dari server bot API bersama di port 8081.

## Isolasi per-user

Setiap pengguna memiliki ruang **terpisah**. Kolom `owner_id` di tabel
`cloud_files` diwajibkan pada semua query; akses berkas milik user lain
menghasilkan 404 (bukan 403) agar keberadaan berkas tidak bocor.

## Konfigurasi (env)

| Variabel                         | Default                                | Keterangan                                      |
| -------------------------------- | -------------------------------------- | ----------------------------------------------- |
| `TELEGRAM_API_URL`               | `http://host.containers.internal:8086` | Base URL Bot API lokal (Cloud Storage)          |
| `CLOUDSTORAGE_BOT_TOKEN`         | _(kosong)_                             | Token bot dari @BotFather                       |
| `CLOUDSTORAGE_CHAT_ID`           | _(kosong)_                             | Chat/grup tujuan penyimpanan                    |
| `CLOUDSTORAGE_MAX_UPLOAD_MB`     | `2048`                                 | Batas upload per berkas                         |
| `CLOUDSTORAGE_THUMB_DIR`         | `./data/cloud-thumbs`                  | Cache thumbnail                                 |
| `CLOUDSTORAGE_LOCAL_FILE_ROOT`   | `/app/telegram-data`                   | Mount berkas server lokal (baca langsung)       |
| `CLOUDSTORAGE_REMOTE_PREFIX`     | `/var/lib/telegram-bot-api`            | Prefix path dari getFile (mode --local)         |
| `CLOUDSTORAGE_ENCRYPTION_KEY`    | _(kosong)_                             | AES-256-GCM at-rest (64 hex). Nonaktif = kosong |
| `CLOUDSTORAGE_SHARE_EXPIRY_DAYS` | `0`                                    | Umur tautan share (0 = tanpa kadaluarsa)        |

Selama `CLOUDSTORAGE_BOT_TOKEN`/`CHAT_ID` kosong, fitur upload nonaktif namun
halaman tetap dapat dibuka.

## Endpoint

Semua di bawah `/api/cloud/*` (auth JWT + role admin/superadmin/staff/guru),
kecuali tautan publik `/api/cloud/s/:token`.

**Baca & listing**

- `GET  /config`, `GET /usage`
- `GET  /files?parent_id=&sort=&type=&starred=&view=&limit=&offset=`
  - `sort`: `name` (default) | `size` | `date_desc` | `date_asc` | `manual`
  - `type`: `all` | `folder` | `image` | `video` | `audio` | `pdf` | `doc` | `other`
  - `view`: `starred` | `recent` | `large` (lintas folder)
- `GET  /files/:id`, `GET /search?q=`
- `GET  /files/:id/download` (Range-aware), `GET /files/:id/thumb`

**Tulis & kelola**

- `POST /files` (multipart upload), `POST /folders`, `POST /notes` (catatan teks)
- `PUT  /files/:id` (rename), `DELETE /files/:id` (trash)
- `PUT  /files/:id/content` (ganti isi berkas teks)
- `POST /files/:id/rotate` (`{deg: 90|180|270}` — gambar)
- `POST /files/:id/star` (`{starred: bool}`)
- `POST /files/copy`, `POST /files/move`, `POST /files/reorder`
- `POST /files/zip` (`{ids: [...]}` — unduh massal streaming)

**Trash**

- `GET  /trash`, `POST /trash/:id/restore`, `POST /trash/restore-all`,
  `DELETE /trash/:id`, `DELETE /trash`

**Share**

- `POST /files/:id/share`, `DELETE /files/:id/share`
  - Mendukung **berkas maupun folder** (`share_kind`).
- `GET  /api/cloud/s/:token` — metadata publik (folder mengembalikan `entries`)
- `GET  /api/cloud/s/:token/download` — unduh berkas tunggal
- `GET  /api/cloud/s/:token/file/:id` — sajikan berkas di dalam folder share
- `GET  /api/cloud/s/:token/zip` — unduh seluruh isi folder share

## Halaman share publik (`/s`)

Ubah tautan `shareUrl()` menjadi `/s?t=<token>` — sebuah halaman **statis**
(`out/s.html`) yang membaca token dari query string di sisi klien (wajib, karena
`output: "export"` tidak punya route dinamis). Halaman menampilkan pratinjau
inline (gambar/video/audio/PDF), tombol unduh, dan daftar isi + tombol
"Unduh Semua (.zip)" untuk folder.

## Fitur UI (halaman `/cloud-storage`)

- **Tampilan** kotak/daftar (dengan kolom ukuran & tanggal), tersimpan di `localStorage`.
- **Sortir** & **filter jenis** berkas.
- **Favorit** (bintang) dan view lintas folder: **Favorit**, **Terbaru**, **Ukuran besar**.
- **Drag & drop**: seret berkas/folder ke folder (atau breadcrumb) untuk
  **memindahkan**; tahan **Alt** saat menyeret = **salin**. Seret berkas dari OS
  ke area daftar untuk **mengunggah**.
- **Seleksi area (rubber-band)**: seret di ruang kosong untuk memilih banyak item.
- **Unduh ZIP massal** dari bilah seleksi.
- **Editor teks** untuk berkas `.txt/.md/.json/.csv/...` + tombol **Catatan** baru.
- **Rotasi gambar** 90°/180°/270° langsung dari menu.
- **Pindah/Salin ke…** lewat dialog pemilih folder (penting untuk perangkat
  sentuh, karena HTML5 DnD tidak berjalan di layar sentuh).

## Catatan operasional

- **Upload streaming**: berkas dialirkan lewat `io.Pipe` → multipart →
  `sendDocument` tanpa menampung di memori/disk (container read-only).
- **Unduh ZIP** dibuat **streaming** (`archive/zip` → langsung ke response),
  memakai `zip.Store` karena konten media sudah terkompresi. Route ZIP
  dikecualikan dari middleware gzip. Batas total: `MaxZipBytes` (4 GiB).
- **Editor teks**: dibatasi `MaxTextBytes` (2 MiB). Menyimpan = unggah konten
  baru ke Telegram, tukar `file_id`/`message_id`, lalu hapus pesan lama bila
  tidak ada referensi lain.
- **Rotasi** menimpa berkas: hasil selalu dikodekan ulang sebagai JPEG.
- **Enkripsi**: bila `CLOUDSTORAGE_ENCRYPTION_KEY` diisi, HTTP Range (seek
  video/PDF), thumbnail, dan rotasi tidak didukung karena GCM butuh dekripsi penuh.
- **Bot API > 2GB**: perlu menjalankan `telegram-bot-api` dengan flag `--local`.
