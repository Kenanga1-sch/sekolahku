# API Reference: Personal Cloud Storage

Base URL: `http://localhost:8080/api`

Semua request dan response dalam format JSON, kecuali upload dan download.

---

## 1. File & Folder Endpoints

### List Files / Folders

- **GET** `/files`
- **Query Params:**
  - `parent_id` (string, optional) - Jika kosong/null, berarti root folder.
  - `limit` (int, optional, default 500, maks 1000) - Jumlah item per halaman.
  - `offset` (int, optional, default 0) - Lewati N item pertama.
- **Response Headers:**
  - `X-Total-Count`: total item yang cocok.
  - `X-Has-More`: `true`/`false` apakah masih ada halaman berikutnya.
- **Response (`200 OK`):** Array file/folder pada halaman tersebut.

```json
[
  {
    "id": "uuid-hex",
    "name": "Dokumen",
    "parent_id": null,
    "is_folder": true,
    "file_id": null,
    "mime_type": "",
    "size": 0,
    "created_at": 1712000000,
    "updated_at": 1712000000,
    "deleted_at": null,
    "share_token": null
  }
]
```

### Upload File (Satu atau Banyak)

- **POST** `/files`
- **Content-Type:** `multipart/form-data`
- **Form Data:**
  - `file` (binary) - bisa diulang untuk upload banyak file sekaligus
  - `parent_id` (string, optional)
- **Response (`200 OK`):**
  - 1 file sukses: objek file tunggal
  - Banyak file sukses: array objek file
- **Partial success (`207 Multi-Status`):** jika sebagian file gagal, dikembalikan
  `{ "files": [...], "errors": [{ "name": "...", "error": "..." }] }`. File yang
  sudah berhasil tetap tersimpan; file lain tetap dicoba.
- **Gagal semua (`500`):** `{ "error": "..." }`

### Get Detail File

- **GET** `/files/:id`
- **Response (`200 OK`):** Objek file dengan `id` tersebut.

### Download File (proxy)

- **GET** `/files/:id/download`
- **Response:** Binary stream file dengan header `Content-Disposition`.
- Mendukung **HTTP Range request** (`Range: bytes=...`) — dipakai browser untuk
  seek video/audio. Response `206 Partial Content` dengan header `Content-Range`
  diteruskan langsung dari Telegram.
- Endpoint ini juga dipakai frontend untuk preview inline (gambar/video/PDF), sehingga browser **tidak pernah** menerima URL Telegram yang memuat token bot.

### Thumbnail Gambar

- **GET** `/files/:id/thumb`
- **Response:** Gambar thumbnail JPEG/PNG berukuran maks. 400px untuk file gambar.
- Dipakai frontend pada grid view; file non-gambar mengembalikan 404 dan frontend menampilkan ikon.

### Rename File/Folder

- **PUT** `/files/:id`
- **Body (`application/json`):**

```json
{
  "name": "NewName.pdf"
}
```

- **Response (`200 OK`):** Objek file yang sudah di-rename.

### Move to Trash (Soft Delete)

- **DELETE** `/files/:id`
- **Response (`200 OK`):** `{ "status": "ok" }`
- File masuk ke Trash (`deleted_at` diisi).

### Copy File/Folder (Rekursif)

- **POST** `/files/copy`
- **Body (`application/json`):**

```json
{
  "ids": ["id-1", "id-2"],
  "target_id": "id-destination"
}
```

- Copy folder dilakukan rekursif (isi di dalam folder ikut disalin).
- Nama duplikat otomatis diberi suffix ` (1)`, ` (2)`, dst.
- **Response (`200 OK`):** `{ "status": "ok" }`

### Move (Cut-Paste)

- **POST** `/files/move`
- **Body (`application/json`):**

```json
{
  "ids": ["id-1", "id-2"],
  "target_id": "id-destination"
}
```

- **Response (`200 OK`):** `{ "status": "ok" }`

---

## 2. Pencarian

### Search Files

- **GET** `/search?q=keyword`
- **Response:** Array file/folder yang cocok (nama mengandung keyword). Setiap
  item menyertakan `path` (lokasi lengkap, mis. `Folder / Subfolder`) sehingga
  frontend tidak perlu melakukan request tambahan untuk menampilkan lokasi.

---

## 3. Share Links

### Generate Share Link

- **POST** `/files/:id/share`
- **Response (`200 OK`):**

```json
{ "share_token": "random_secure_token" }
```

- Masa berlaku link diatur `SHARE_EXPIRY_DAYS` (0 = tidak pernah). Link yang
  sudah kedaluwarsa otomatis dicabut saat diakses.
- Halaman publik dapat diakses di `/s/:token`.

### Halaman Publik Share

- **GET** `/s/:token`
- **Response:** Halaman HTML publik untuk download file (tanpa login).

### Download File Publik

- **GET** `/s/:token/download`
- **Response:** Binary stream file dari link share publik.

### Revoke Share Link

- **DELETE** `/files/:id/share`
- **Response (`200 OK`):** `{ "status": "ok" }`
- Token share dihapus, link publik tidak lagi valid.

---

## 4. Trash

### List Trash

- **GET** `/trash`
- **Response (`200 OK`):** Array file/folder yang sudah di-soft-delete.

### Restore dari Trash

- **POST** `/trash/:id/restore`
- **Response (`200 OK`):** `{ "status": "ok" }`

### Pulihkan Semua (Recovery)

- **POST** `/trash/restore-all`
- **Response (`200 OK`):** `{ "status": "ok" }`
- Memulihkan seluruh isi trash, termasuk folder beserta isinya.

### Hapus Permanen

- **DELETE** `/trash/:id`
- **Response (`200 OK`):** `{ "status": "ok" }`
- Menghapus metadata dari database secara permanen, cascade ke seluruh isi folder, dan memanggil `deleteMessage` Telegram untuk setiap file agar file di server Telegram ikut terhapus (hanya jika itu referensi terakhir).

### Kosongkan Trash (Empty Trash)

- **DELETE** `/trash`
- **Response (`200 OK`):** `{ "status": "ok" }`
- Menghapus permanen seluruh isi trash sekaligus. File di Telegram hanya dihapus jika tidak ada referensi lain (mis. hasil copy) yang masih memakainya.

---

## 5. Frontend

Frontend statis (`index.html`, `css/style.css`, `js/app.js`) di-embed ke binary Go menggunakan `go:embed`. Semua route non-API (`/`, `/css/*`, `/js/*`) di-serve oleh handler statis dari embedded filesystem, sehingga cukup 1 binary.

---

## 6. Catatan Keamanan & Utilitas

- **CSRF:** Semua request stateful (`POST/PUT/DELETE`) di `/api/*` yang membawa
  header `Origin` hanya diterima jika origin tersebut sama dengan `Host` server
  atau tercantum di `ALLOWED_ORIGINS` (dipisah koma). Request tanpa `Origin`
  (mis. curl) tetap diterima.
- **Backup:** Jalankan binary dengan flag `-backup <path>` untuk membuat snapshot
  database yang konsisten tanpa menghentikan server:
  ```bash
  cloudstorage.exe -backup ./backup.db
  ```
