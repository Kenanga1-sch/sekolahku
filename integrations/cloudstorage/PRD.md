# PRD: Personal Cloud Storage Berbasis Telegram

## 1. Ringkasan Produk

Layanan cloud storage pribadi yang memanfaatkan **Telegram Bot API Server lokal** sebagai backend penyimpanan file, dengan tampilan yang sederhana dan familiar seperti Google Drive.

|                     |                               |
| ------------------- | ----------------------------- |
| **Target Pengguna** | Pribadi (single user)         |
| **Storage Backend** | Telegram Bot API lokal        |
| **Tampilan**        | Familiar seperti Google Drive |

---

## 2. Tujuan & Non-Tujuan

### 2.1 Tujuan

- Mendapatkan penyimpanan file besar & gratis memanfaatkan Telegram.
- UI yang ringan, cepat, dan familier seperti Google Drive.
- Copy-paste file yang sangat mudah dan seamless (mirip interaksi di file manager desktop).
- Aplikasi ringan (single binary, tanpa build step frontend).

### 2.2 Non-Tujuan (MVP)

- Tidak mendukung multi-user / autentikasi beragam.
- Tidak mendukung sinkronisasi folder lokal (auto-sync).
- Tidak ada sharing publik lintas pengguna Telegram (hanya share link dengan token).

---

## 3. Arsitektur

```
┌──────────────────┐
│  Browser (Web)   │  HTML + vanilla JS + CSS
└────────┬─────────┘
         │ HTTP (REST API)
┌────────▼─────────┐
│  Go Backend      │  Fiber/Echo, single binary, embed static
│  - File metadata │  (SQLite)
│  - API handler   │
└────────┬─────────┘
         │ HTTP (local, port 8081)
┌────────▼─────────┐
│  Telegram Bot    │  telegram-bot-api (server lokal, tanpa limit 50MB)
│  API Server      │
└──────────────────┘
```

### Komponen

1. **Go Backend** (Fiber/Echo) — REST API + serve frontend statis (embed).
2. **SQLite** — metadata file & folder (tanpa menyimpan blok file).
3. **Telegram Bot API Server lokal** — menyimpan file sebenarnya, menerima upload hingga 2GB (4GB utk akun Premium), tanpa rate limit publik.
4. **Frontend** — HTML + vanilla JS + CSS, tampilan bergaya Google Drive.

---

## 4. Tech Stack

| Layer       | Teknologi                         | Alasan                                         |
| ----------- | --------------------------------- | ---------------------------------------------- |
| Backend     | Go + Fiber/Echo                   | Single binary, ringan, concurrency tinggi      |
| Frontend    | HTML + vanilla JS + CSS           | Paling ringan, tanpa bundler/build step        |
| Database    | SQLite                            | Metadata ringan, file tunggal, tanpa server DB |
| Storage     | Telegram Bot API lokal            | Gratis, besar, terenkripsi via TLS lokal       |
| Share Token | Token acak (SHA-256 dari file_id) | Share link sederhana tanpa auth                |

---

## 5. Skema Database (SQLite)

### Tabel `files`

| Kolom       | Tipe           | Keterangan                         |
| ----------- | -------------- | ---------------------------------- |
| id          | TEXT (UUID)    | Primary key                        |
| name        | TEXT           | Nama file/folder                   |
| parent_id   | TEXT (NULL)    | Parent folder id, NULL = root      |
| is_folder   | INTEGER        | 1 = folder, 0 = file               |
| file_id     | TEXT           | Telegram file_id (NULL utk folder) |
| mime_type   | TEXT           | MIME type                          |
| size        | INTEGER        | Ukuran dalam bytes                 |
| created_at  | INTEGER        | Unix timestamp                     |
| updated_at  | INTEGER        | Unix timestamp                     |
| deleted_at  | INTEGER (NULL) | Soft delete / trash                |
| share_token | TEXT (NULL)    | Token unik utk share link          |

**Index:** `parent_id`, `name`, `deleted_at`, `share_token`

### Tabel `settings`

| Kolom | Tipe | Keterangan        |
| ----- | ---- | ----------------- |
| key   | TEXT | PRIMARY KEY       |
| value | TEXT | Nilai konfigurasi |

---

## 6. Fitur MVP

### 6.1 Navigasi Folder

- List file & folder dalam direktori saat ini.
- Breadcrumb + tombol "Naik satu level" (mirip Google Drive).
- Baris per file: ikon (berdasarkan MIME), nama, tanggal, ukuran, tombol aksi.

### 6.2 Upload & Download

- Upload file melalui drag-and-drop dan tombol upload.
- Upload di-forward ke Telegram Bot API lokal (mendukung file s.d. 2GB/4GB).
- Download file via endpoint yang meng-stream dari Telegram ke browser.
- Indikator progres upload/download.

### 6.3 Copy-Paste Seamless (Prioritas Tinggi)

- **Shortcut**: `Ctrl+C` / `Ctrl+V`, `Ctrl+X` / `Ctrl+V` (cut & paste).
- **Kontekstual**: klik kanan → Copy / Cut / Paste (menu konteks bergaya Drive).
- **Clipboard visual**: paste ke folder mana pun, termasuk root; menunjukkan status "Menyalin..." dengan animasi.
- Copy folder = copy seluruh isi secara rekursif.
- Cut + paste = pindah (update `parent_id`).
- Nama duplikat otomatis diberi suffix ` (1)`, ` (2)`, dst. — tidak menimpa.
- Paste langsung berhasil = operasi asynchronous, tidak perlu refresh halaman.

### 6.4 Rename

- Klik dua kali nama / ikon pensil.
- Enter untuk konfirmasi, Esc untuk batal.

### 6.5 Delete & Trash

- Delete file/folder → masuk ke Trash (`deleted_at`).
- Trash bisa di-restore atau dihapus permanen.
- Hapus permanen = hapus metadata + panggil `deleteMessage` di Telegram.

### 6.6 Search

- Cari file/folder berdasarkan nama (dari root, rekursif).
- Hasil dikelompokkan dengan path lokasi file.

### 6.7 Preview

- **Gambar**: tampil inline di panel preview (mendukung zoom).
- **Video & Audio**: pemutar inline.
- **PDF/Dokumen**: tampil dalam `<iframe>`/object.
- **Lainnya**: tampilkan ikon + metadata (nama, ukuran, tipe).

### 6.8 Share Link

- Setiap file memiliki tombol "Share" → menghasilkan link unik bertoken.
- Link menampilkan halaman publik sederhana (download/preview tanpa akses ke folder lain).
- Bisa revoke (hapus token).

### 6.9 Responsive & Tampilan Drive

- Layout grid/list toggle.
- Tema terang/gelap otomatis mengikuti sistem.
- Mobile-friendly (gesture swipe ke atas untuk upload).

---

## 7. API Endpoint

| Method | Path                      | Fungsi                                 |
| ------ | ------------------------- | -------------------------------------- |
| GET    | `/api/files?parent_id=`   | List file/folder                       |
| POST   | `/api/files/upload`       | Upload file (multipart)                |
| GET    | `/api/files/:id/download` | Download file                          |
| PATCH  | `/api/files/:id`          | Rename / pindah (parent_id)            |
| DELETE | `/api/files/:id`          | Pindah ke trash                        |
| POST   | `/api/files/copy`         | Copy file/folder (rekursif)            |
| POST   | `/api/trash/restore`      | Restore dari trash                     |
| DELETE | `/api/trash/:id`          | Hapus permanen                         |
| GET    | `/api/search?q=`          | Pencarian rekursif                     |
| GET    | `/api/preview/:id`        | Metadata utk preview                   |
| POST   | `/api/share/:id`          | Generate share token                   |
| DELETE | `/api/share/:id`          | Revoke share token                     |
| GET    | `/s/:token`               | Halaman publik share                   |
| GET    | `/api/config`             | Konfigurasi klien (upload limit, dll.) |

---

## 8. Alur Copy-Paste Seamless

1. User pilih file/folder (click, atau `Ctrl+Click` multi-select).
2. `Ctrl+C` / klik kanan → Copy → sistem simpan referensi id dalam **clipboard in-app** (JS).
3. User navigasi ke folder tujuan (bisa folder mana pun, termasuk root).
4. `Ctrl+V` / klik kanan → Paste:
   - Jika sumber = **copy**: backend menduplikasi metadata baru + memanggil Telegram `copyMessage` (server-side copy, cepat, tanpa re-upload) → `parent_id` baru.
   - Jika sumber = **cut**: update `parent_id` sumber ke folder tujuan (pindah, tanpa salin file).
5. Tampilkan toast "Menyalin 3 item..." + animasi progres per item.
6. Selesai → daftar file direfresh otomatis; item duplikat bernama `file (1).ext`.
7. Folder copy dilakukan rekursif dengan BFS/DFS di backend, tetap menampilkan progres total.

> **Catatan teknis**: Telegram `copyMessage` dapat menyalin file tanpa mengunggah ulang. Untuk file yang tidak bisa di-copy (document expiration), fallback ke re-upload via `sendDocument` dari file lokal sementara.

---

## 9. Batasan & Asumsi

- Telegram Bot API Server lokal berjalan di mesin yang sama / LAN (default port **8081**).
- Bot token disimpan di environment variable / `.env` (tidak masuk ke repo).
- API lokal diakses hanya dari localhost/LAN.
- Maksimal ukuran file upload: **2GB** (default) / **4GB** (utk akun Premium).
- Telegram dapat menghapus file yang tak diakses > beberapa bulan (`file_id` tidak lagi valid) — PRD mencatat ini sebagai risiko, mitigasi dengan `settings` timestamp akses terakhir.

---

## 10. Non-Fungsional

| Aspek           | Target                             |
| --------------- | ---------------------------------- |
| Performa        | List 10.000 file < 100ms           |
| Copy 100 file   | Selesai < 10 detik                 |
| Bundle frontend | < 100KB total                      |
| Deployment      | 1 binary + 1 SQLite file + bot API |
| Startup         | < 1 detik                          |

---

## 11. Roadmap (Post-MVP)

- Sinkronisasi folder lokal (watch folder → auto upload).
- Enkripsi client-side sebelum upload (AES-256).
- Album / foto grid view.
- Dukungan beberapa bot token (multi-channel storage).
- Koleksi/highlight (pin) folder.
- Migrasi ke frontend framework bila kebutuhan tumbuh.

---

## 12. Acceptance Criteria MVP

- [ ] Bisa upload file 100MB ke folder & download kembali dengan benar.
- [ ] Copy-paste 100 file (termasuk folder bersarang) berhasil tanpa refresh.
- [ ] Cut-paste memindahkan file tanpa duplikasi data di Telegram.
- [ ] Search menemukan file di dalam folder bertingkat.
- [ ] Preview gambar/video/PDF tampil inline.
- [ ] Share link bisa dibuka tanpa login dan bisa di-revoke.
- [ ] Trash bisa restore & hapus permanen.
- [ ] Seluruh fitur berjalan dengan Telegram Bot API lokal di port 8081.
