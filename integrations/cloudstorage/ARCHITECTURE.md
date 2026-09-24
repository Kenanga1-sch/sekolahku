# Architecture & Data Flow

Struktur proyek dan desain alur data untuk personal cloud storage berbasis Telegram.

---

## 1. Struktur Direktori Proyek

```
cloudstorage/
├── cmd/
│   └── server/
│       └── main.go          # Entry point aplikasi Go
├── internal/
│   ├── config/              # Konfigurasi env & Telegram API URL
│   ├── handler/             # HTTP Handlers (Fiber)
│   ├── repository/          # Query database SQLite (CRUD + trash + share)
│   ├── service/             # Business logic (Telegram API integration, copy/move, trash)
│   └── telegram/            # Client untuk Telegram Bot API (upload/get/download)
├── web/
│   ├── embed.go             # go:embed frontend statis ke binary
│   └── static/              # Frontend (index.html, app.js, style.css)
├── .env                     # Konfigurasi lokal (tidak masuk repo)
├── .gitignore
├── go.mod
├── go.sum
├── PRD.md
├── SETUP.md
├── API.md
└── ARCHITECTURE.md
```

---

## 2. Data Flow Alur Utama

### A. Alur Upload File

1. User pilih file dan drop/klik upload di web frontend.
2. Frontend kirim `multipart/form-data` ke `/api/files` (bisa banyak file sekaligus) menggunakan `XMLHttpRequest` dengan indikator progres.
3. Backend Go menerima file, lalu melakukan `HTTP POST` multipart ke Telegram Bot API (`/sendDocument`) untuk tiap file.
4. Telegram server menyimpan file dan merespons dengan JSON berisi `file_id`.
5. Backend menyimpan metadata ke SQLite (`files` table) dengan `file_id` tersebut.
6. Backend merespons objek file (tunggal) atau array (banyak file) ke frontend.

### B. Alur Copy-Paste Seamless (Tanpa Re-upload)

1. User pilih file/folder dan tekan `Ctrl+C` / `Ctrl+X` (atau klik kanan → Copy/Cut).
2. User menavigasi ke folder lain dan tekan `Ctrl+V` (atau klik kanan → Paste).
3. Frontend kirim `POST /api/files/copy` atau `POST /api/files/move` dengan `ids` dan `target_id`.
4. Copy folder dilakukan **rekursif** (seluruh isi folder ikut disalin) dan nama duplikat otomatis diberi suffix ` (1)`, ` (2)`.
5. Cut-paste cukup meng-update `parent_id` sumber (pindah, tanpa salin file).
6. Frontend memperbarui tampilan secara instan.

### C. Alur Download & Preview File

1. User klik Download.
2. Backend mengambil `file_id` dari SQLite.
3. Backend meminta file path ke Telegram API (`getFile` -> `file_path`).
4. Backend mengunduh/men-stream file dari URL Telegram (`/file/bot<TOKEN>/<file_path>`) dengan **dukungan HTTP Range** (meneruskan header `Range` dari browser, sehingga video/audio bisa di-seek tanpa mengunduh ulang seluruh file), lalu meneruskannya ke browser klien.
5. Preview inline (gambar/video/PDF/teks) dilakukan melalui `GET /api/files/:id/download` yang memakai `Content-Disposition: inline`. Browser **tidak pernah** menerima URL Telegram yang memuat token bot.

---

## 3. Serve Frontend (Single Binary)

Frontend statis di-embed menggunakan `go:embed` di `web/embed.go`. Route API didaftarkan terlebih dahulu, lalu route wildcard `/*` di akhir berfungsi sebagai fallback untuk melayani file statis dari embedded filesystem. Hasilnya cukup **1 binary + 1 SQLite file**, tanpa dependensi folder `web/static/` saat runtime.

---

## 4. Keamanan & Operasional

- **CSRF**: middleware memvalidasi header `Origin` untuk request stateful di
  `/api/*` — hanya origin same-host atau yang tercantum di `ALLOWED_ORIGINS`
  yang diterima.
- **Nama file unik**: index unik `(name, COALESCE(parent_id,''))` pada file aktif
  memastikan tidak ada nama kembar, bahkan saat upload/copy/move berjalan konkuren
  (alokasi nama di dalam transaksi + retry otomatis saat konflik).
- **Share link**: token opsional punya masa berlaku (`SHARE_EXPIRY_DAYS`); link
  kedaluwarsa otomatis dicabut saat diakses.
- **Pagination**: `GET /api/files` mendukung `limit`/`offset` dan mengembalikan
  total via header `X-Total-Count`/`X-Has-More`.
- **Backup**: flag `-backup <path>` memakai `VACUUM INTO` untuk snapshot yang
  konsisten (termasuk data WAL) tanpa menghentikan server.
- **Thumbcache**: dibersihkan berkala (default tiap 24 jam) dari thumbnail yang
  file_id-nya sudah tidak direferensikan.
