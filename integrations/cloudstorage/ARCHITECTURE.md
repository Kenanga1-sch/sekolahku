# Architecture & Data Flow

Arsitektur personal cloud storage berbasis Telegram, **plus hasil audit
integrasi** antara service Go standalone (folder ini) dan handler Go di backend
utama (`go-backend`).

> **Status (audit 2025):**
>
> - **Implementasi produksi** = `go-backend` (Echo). Inilah yang berjalan.
> - **Service standalone** di folder ini (Fiber) **RUSAK** (syntax error hasil
>   edit otomatis) dan **tidak dipakai**. Lihat §6 untuk detail gap.

---

## 1. Struktur Direktori (Standalone, referensi — TIDAK dipakai produksi)

```
integrations/cloudstorage/           # paket Go standalone (Fiber) — RUSAK
├── cmd/server/main.go               # entry point Fiber (buildApp, auth, CSRF)
├── internal/
│   ├── config/                      # Config env standalone (HOST, PORT, TELEGRAM_*, ...)
│   ├── handler/                     # HTTP handlers Fiber
│   ├── repository/                  # SQLite CRUD (paket repository)
│   ├── service/                     # logika bisnis + integrasi Telegram
│   ├── telegram/                    # klien Bot API standalone
│   ├── model/                       # model.File dkk.
│   └── crypto/                      # helper enkripsi
├── web/                             # go:embed frontend statis standalone
├── .env / .gitignore / go.mod / go.sum
├── AGENTS.md / API.md / ARCHITECTURE.md / PRD.md / README.md / SETUP.md
```

Struktur ini **berbeda** dari produksi. Produksi tidak memakai folder ini.

---

## 2. Arsitektur Produksi (yang sebenarnya berjalan)

```
Browser (React: /cloud-storage, /s?t=<token>)
   │  JWT sesi Sekolahku + CSRF
   ▼
go-backend (Echo)
   ├─ internal/handlers/cloudstorage_handler.go   REST API /api/cloud/*
   ├─ internal/cloudstorage/service.go            upload/copy/move/trash/share/zip/note/rotate
   ├─ internal/cloudstorage/telegram.go           klien Bot API + baca berkas lokal
   ├─ internal/cloudstorage/crypto.go             AES-256-GCM at-rest (opsional)
   ├─ internal/cloudstorage/imageutil.go          thumbnail & rotasi gambar
   ├─ internal/cloudstorage/extras.go             helper (ZIP, teks, dll.)
   └─ internal/repository/cloudstorage_repo.go    metadata tabel cloud_files (owner-scoped)
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
`cloudstorage/telegram.go` membaca berkas **langsung dari disk** (mendukung HTTP
Range). Container Bot API berjalan sebagai **uid 1000** agar berkas yang ditulis
dimiliki uid 1000 (podman rootless memetakan uid 0 container → uid 1000 host).

Container Bot API didefinisikan di `deploy/telegram-bot-api.yml` (port 8086),
terpisah dari server bot API bersama di port 8081.

---

## 3. Alur Data Utama (Produksi)

### A. Upload

1. Frontend kirim `multipart/form-data` ke `POST /api/cloud/files` (satu `file`).
2. Handler dibatasi `MaxBytesReader` (`CLOUDSTORAGE_MAX_UPLOAD_MB`, route
   dikecualikan dari BodyLimit global 60 MB).
3. `service.Upload` mengalirkan berkas via `io.Pipe` → multipart → `sendDocument`
   (tanpa menampung di memori/disk; container read-only).
4. Metadata (file_id/message_id) disimpan ke tabel `cloud_files`.

### B. Copy / Move

- Copy: duplikasi metadata rekursif; file fisik disalin via `copyMessage`.
- Move: update `parent_id` (tanpa salin).
- Nama duplikat diberi suffix ` (1)`, ` (2)`, dst.

### C. Download & Preview

1. `GET /api/cloud/files/:id/download` (dengan `?dl=1` untuk attachment).
2. Service membuka stream (Range-aware) dari berkas di disk.
3. `streamFile` mengirim `206 Partial Content` + `Content-Range` bila Range ada.

### D. ZIP Massal & Share

- `POST /files/zip` → `archive/zip` streaming (route di luar gzip).
- Share publik lewat `/api/cloud/s/:token*` + halaman statis `/s?t=<token>`.

---

## 4. Keamanan & Operasional (Produksi)

- **Isolasi per-user:** `owner_id` wajib di semua query; berkas orang lain → 404
  (bukan 403) agar keberadaan berkas tidak bocor.
- **CSRF/JWT:** middleware Sekolahku menangani `/api/*`; publik hanya token share.
- **Enkripsi at-rest (opsional):** bila `CLOUDSTORAGE_ENCRYPTION_KEY` diisi,
  Range/seek, thumbnail, dan rotasi **tidak didukung** (GCM butuh dekripsi penuh).
- **ZIP:** streaming, `zip.Store`, batas `MaxZipBytes` (4 GiB).
- **Editor teks:** batas `MaxTextBytes` (2 MiB); simpan = unggah konten baru +
  tukar `file_id`, hapus pesan lama bila tak ada referensi lain.
- **Thumbcache:** dibersihkan berkala (tiap 24 jam) dari thumbnail yatim.

---

## 5. Deployment, Env & Operasional

### 5.1 Deployment produksi

| Komponen             | Cara jalan                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `go-backend`         | Kontainer `sekolahku-prod` (podman rootless), binary tunggal                                 |
| Telegram Bot API     | Kontainer `sekolahku-telegram-api` dari `deploy/telegram-bot-api.yml` (port 8086, `--local`) |
| Data berkas Telegram | Host mount `/home/chitchat/telegram-api-data` → `/app/telegram-data` di backend              |
| Frontend             | Next.js `output: "export"` di-serve statis (termasuk `out/s.html`)                           |
| Database             | SQLite Sekolahku (tabel `cloud_files`)                                                       |

Detail langkah deploy ada di README (Bagian "Status integrasi") dan SETUP.

### 5.2 Env produksi (`go-backend`)

| Variabel                         | Default                                    | Keterangan                                                                |
| -------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| `TELEGRAM_API_URL`               | `https://api.telegram.org` (fallback kode) | Base URL Bot API; produksi memakai `http://host.containers.internal:8086` |
| `CLOUDSTORAGE_BOT_TOKEN`         | _(kosong)_                                 | Token bot; kosong = upload nonaktif                                       |
| `CLOUDSTORAGE_CHAT_ID`           | _(kosong)_                                 | Chat/grup penyimpanan                                                     |
| `CLOUDSTORAGE_MAX_UPLOAD_MB`     | `2048`                                     | Batas upload per berkas                                                   |
| `CLOUDSTORAGE_THUMB_DIR`         | _(kosong)_                                 | Cache thumbnail                                                           |
| `CLOUDSTORAGE_LOCAL_FILE_ROOT`   | _(kosong)_                                 | Mount berkas Bot API (baca langsung)                                      |
| `CLOUDSTORAGE_REMOTE_PREFIX`     | `/var/lib/telegram-bot-api`                | Prefix path dari `getFile` (mode `--local`)                               |
| `CLOUDSTORAGE_ENCRYPTION_KEY`    | _(kosong)_                                 | AES-256-GCM at-rest (64 hex); kosong = nonaktif                           |
| `CLOUDSTORAGE_SHARE_EXPIRY_DAYS` | `0`                                        | Umur tautan share (0 = tanpa kadaluarsa)                                  |

> Catatan: `TELEGRAM_API_URL` **tidak** didaftarkan di docstring
> `NewCloudStorageHandler` (yang menyebut 5 var lain), padahal dibaca handler.
> Sudah ditambahkan di tabel ini; sebaiknya disinkronkan ke komentar kode juga.

### 5.3 Operasional

- **Monitoring:** health check `GET /api/health`; log upload/Telegram di backend.
- **Backup DB:** pakai mekanisme backup Sekolahku (telegram backup / snapshot).
  Flag `-backup` **hanya** milik standalone, tidak ada di produksi.
- **Bot API > 2GB:** jalankan `telegram-bot-api` dengan flag `--local`.
- **Rotasi/thumb saat enkripsi aktif:** dinonaktifkan otomatis.
- **Thumbcleaner:** goroutine `StartThumbCleaner` dijalankan saat boot backend.

---

## 6. Gap Integrasi: Service Standalone vs Handler Backend Utama

Ringkasan perbedaan yang membuat kedua implementasi **tidak dapat saling
menggantikan secara langsung**:

| Aspek              | Standalone (`integrations/cloudstorage`)       | Produksi (`go-backend`)                                               | Dampak                                |
| ------------------ | ---------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------- |
| Framework HTTP     | Fiber v2                                       | Echo v4                                                               | ❌ Kode tidak portabel                |
| Paket repository   | `repository.Repository` (+ `NewRepository`)    | `repository.CloudStorageRepository` (+ `NewCloudStorageRepository`)   | ❌ Nama & signature beda              |
| Nama paket service | `service.Service`                              | `cloudstorage.Service`                                                | ❌ Beda module path                   |
| Model file         | `model.File` (`IsFavorite`)                    | `models.CloudFile` (`IsStarred`, `OwnerID`, `SortOrder`, `ShareKind`) | ❌ Field tidak match (lihat PRD §gap) |
| Routing            | `/api/files`, `/api/trash`, `/api/share`       | `/api/cloud/*`                                                        | ❌ Prefix beda                        |
| Auth               | `AUTH_TOKEN` statis + cookie/`ALLOWED_ORIGINS` | JWT Sekolahku + role                                                  | ❌ Model auth beda                    |
| Multi-user         | Tanpa `owner_id` (single user)                 | `owner_id` per user (isolasi)                                         | ❌ Skema DB beda                      |
| Nama tabel/kolom   | `files` (lihat PRD lama)                       | `cloud_files` + kolom baru                                            | ❌ Migrasi beda                       |
| Baca berkas        | HTTP `/file/bot<TOKEN>/...`                    | Baca langsung dari disk                                               | ❌ Strategi I/O beda                  |
| Frontend           | Vanilla JS + `go:embed`                        | React Next.js (Sekolahku)                                             | ❌ Tidak ada UI shared                |
| Fitur ekstra       | —                                              | zip, note, rotate, star, reorder, view, share folder                  | ❌ Hanya di produksi                  |

**Kesimpulan:** integrasi **hanya pada level ide arsitektur** (metadata SQLite +
Telegram sebagai object store). Tidak ada kode bersama (shared library), tidak
ada kontrak API bersama, dan tidak ada skema DB bersama. Folder standalone harus
diperlakukan sebagai **referensi dokumentasi**, bukan dependensi.

---

## 7. Serve Frontend (Produksi)

Frontend React di-embed/serve oleh pipeline Next.js Sekolahku (`output:
"export"`). Halaman share publik statis di `out/s.html` (query `?t=`) karena
export tidak punya route dinamis. Klaim "1 binary + 1 SQLite" di dokumen lama
**hanya untuk standalone**, tidak berlaku di produksi.
