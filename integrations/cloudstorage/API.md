# API Reference: Personal Cloud Storage

> **Status dokumen (audit 2025):** File ini mendokumentasikan **dua** permukaan
> API yang berbeda:
>
> 1. **API produksi Sekolahku** — `go-backend/internal/handlers/cloudstorage_handler.go`
>    (Echo, prefix `/api/cloud/*`). **Inilah yang dipakai frontend.**
> 2. **API standalone referensi** — aplikasi Fiber di folder ini
>    (`internal/handler/handler.go`, prefix `/api/*`). Kode Go di folder ini
>    **RUSAK** dan tidak dikompilasi; hanya dipakai sebagai referensi desain.
>
> Riwayat: dokumen versi sebelumnya mendeskripsikan API standalone (Fiber, prefix
> `/api/files`) dan **tidak sinkron** dengan handler produksi. Lihat §7 untuk
> tabel gap sinkronisasi. Rekomendasi: jadikan dokumen ini sumber tunggal untuk
> API produksi, dan pisahkan referensi standalone ke lampiran bila masih dipakai.

Base URL produksi: `/api/cloud`
Base URL standalone (referensi): `/api`

Semua request/response JSON, kecuali upload (multipart), download, thumbnail,
dan ZIP (binary stream).

---

## 1. File & Folder Endpoints (PRODUKSI `/api/cloud/*`)

Semua endpoint di bawah ini terautentikasi JWT Sekolahku + CSRF, dan dibatasi
role **superadmin / admin / staff / guru**. Setiap operasi di-scope ke pemilik
(`owner_id`); berkas milik user lain → `404`.

### Config & Usage

- **GET** `/config` → `{ "success": true, "enabled": bool, "max_upload_size": int }`
  - `enabled` = false bila `CLOUDSTORAGE_BOT_TOKEN` / `CLOUDSTORAGE_CHAT_ID` kosong.
- **GET** `/usage` → `{ "success": true, "used_bytes": int, "file_count": int }`

### List Files / Folders

- **GET** `/files`
- **Query Params:**
  - `parent_id` (string, optional) — kosong / `root` = root folder.
  - `sort` (string, optional) — `name` (default) | `size` | `date_desc` | `date_asc` | `manual`.
  - `type` (string, optional) — `all` | `folder` | `image` | `video` | `audio` | `pdf` | `doc` | `other`.
  - `starred` (bool-ish, optional) — `1` = hanya favorit.
  - `view` (string, optional) — `starred` | `recent` | `large` (lintas folder; mengabaikan `parent_id`/`sort`).
  - `limit` (int, optional, default 500, maks 1000).
  - `offset` (int, optional, default 0).
- **Response Headers:**
  - `X-Total-Count`: total item yang cocok.
  - `X-Has-More`: `true`/`false` (hanya pada listing folder biasa).
- **Response (`200 OK`):** Array objek file/folder (lihat skema §5).

### Upload File

- **POST** `/files` (multipart/form-data)
- **Form Data:** `file` (binary, satu file), `parent_id` (optional).
- Batas ukuran per berkas: `CLOUDSTORAGE_MAX_UPLOAD_MB` (default 2048 MB).
  Body dibatasi `MaxBytesReader` terpisah dari `BodyLimit` global 60 MB.
- **Response (`200 OK`):** objek file tunggal.
- **`503`** bila `enabled = false`; **`413`** bila melebihi batas;
  **`502`** bila gagal ke Telegram.

> **Perbedaan dengan standalone:** standalone mendukung upload **banyak berkas**
> per request dan balasan `207 Multi-Status`; handler produksi hanya satu
> `file` per request (klien mengirim berurutan).

### Get Detail File

- **GET** `/files/:id`

### Download File (proxy, Range-aware)

- **GET** `/files/:id/download?dl=1`
  - `dl=1` → `Content-Disposition: attachment`; default `inline` (preview).
- Mendukung **HTTP Range** (`Range: bytes=...`) → `206 Partial Content` +
  `Content-Range`. Isi berkas dibaca **langsung dari disk** (mount Bot API lokal),
  bukan via HTTP `/file/...` (lihat ARCHITECTURE §3).

### Thumbnail Gambar

- **GET** `/files/:id/thumb` — thumbnail untuk berkas gambar, `404` untuk lainnya.

### Rename

- **PUT** `/files/:id` — body `{ "name": "Baru.pdf" }`.

### Move to Trash (Soft Delete)

- **DELETE** `/files/:id` → `{ "success": true }`.

### Copy / Move / Reorder

- **POST** `/files/copy` — `{ "ids": [...], "target_id": "id"|null }` (rekursif).
- **POST** `/files/move` — `{ "ids": [...], "target_id": "id"|null }`.
- **POST** `/files/reorder` — `{ "ids": [...] }` (urutan manual dalam folder;
  hanya bermakna saat `sort=manual`).

### Favorit (Star)

- **POST** `/files/:id/star` — `{ "starred": true|false }` → objek file.

### Editor Teks / Catatan

- **POST** `/notes` — `{ "name", "content", "parent_id" }` → objek file baru.
- **PUT** `/files/:id/content` — `{ "content": "..." }` (ganti isi berkas teks;
  batas `MaxTextBytes` = 2 MiB).

### Rotasi Gambar

- **POST** `/files/:id/rotate` — `{ "deg": 90|180|270 }` (hasil di-encode ulang JPEG).

### Folder

- **POST** `/folders` — `{ "name", "parent_id" }`.

### ZIP Massal

- **POST** `/files/zip` — `{ "ids": [...] }` → stream `application/zip`
  (`Content-Disposition: attachment`). Route ini dikecualikan dari middleware
  gzip; batas total `MaxZipBytes` = 4 GiB.

---

## 2. Pencarian (Produksi)

- **GET** `/search?q=keyword`
- Mengembalikan array file/folder milik owner yang namanya cocok (rekursif,
  maks 200). Setiap item menyertakan `path` (mis. `Folder / Subfolder`).

---

## 3. Share Links (Produksi)

- **POST** `/files/:id/share` → `{ "success": true, "share_token": "..." }`
  - Mendukung **berkas maupun folder** (`share_kind`).
  - Masa berlaku `CLOUDSTORAGE_SHARE_EXPIRY_DAYS` (0 = tanpa kadaluarsa).
- **DELETE** `/files/:id/share` → cabut token.

### Halaman & Download Publik (tanpa login)

- **GET** `/api/cloud/s/:token` → metadata publik. Folder mengembalikan `entries`.
- **GET** `/api/cloud/s/:token/download` → stream berkas tunggal (share file).
- **GET** `/api/cloud/s/:token/file/:id` → sajikan berkas di dalam folder share.
- **GET** `/api/cloud/s/:token/zip` → unduh seluruh isi folder share sebagai ZIP.

> Halaman HTML publik dibaca di **`/s?t=<token>`** (halaman statis `out/s.html`
> karena `output: "export"`). Dokumen lama menyebut `/s/:token` (route dinamis)
> — itu **tidak berlaku** di produksi.

---

## 4. Trash (Produksi)

- **GET** `/trash` → array item ter-soft-delete.
- **POST** `/trash/:id/restore` → pulihkan satu item.
- **POST** `/trash/restore-all` → pulihkan seluruh isi trash.
- **DELETE** `/trash/:id` → hapus permanen (metadata + `deleteMessage` Telegram
  bila referensi terakhir).
- **DELETE** `/trash` → kosongkan trash.

---

## 5. Skema Objek File (Produksi)

Cocok dengan `models.CloudFile` (`go-backend/internal/models/cloudstorage.go`):

```json
{
  "id": "cuid2",
  "owner_id": "user-id",
  "name": "Dokumen.pdf",
  "path": "Folder / Subfolder/Dokumen.pdf",
  "parent_id": null,
  "is_folder": false,
  "file_id": "telegram-file-id",
  "message_id": 1234,
  "mime_type": "application/pdf",
  "size": 1048576,
  "encrypted": false,
  "created_at": 1712000000,
  "updated_at": 1712000000,
  "deleted_at": null,
  "share_token": null,
  "share_expires_at": null,
  "is_starred": false,
  "accessed_at": 1712000000,
  "sort_order": 0,
  "share_kind": "file"
}
```

Catatan: `path` hanya diisi pada hasil `/search`; `share_kind` diisi pada item
yang sedang dibagikan (`file` | `folder`).

---

## 6. API Standalone (Referensi, TIDAK DIPAKAI)

Aplikasi Fiber di folder ini memakai prefix `/api/*` dan bentuk berbeda. Daftar
rute aktual (`cmd/server/main.go`): `GET /api/config`, `POST /api/login`,
`GET|POST /api/files`, `POST /api/folders`, `GET /api/folders/all`,
`GET /api/files/:id`, `GET /api/files/:id/download`, `GET /api/files/:id/thumb`,
`PUT /api/files/:id`, `DELETE /api/files/:id`, `POST|DELETE /api/files/:id/share`,
`POST /api/files/copy`, `POST /api/files/move`, `GET /api/search`,
`GET /api/trash`, `POST /api/trash/restore-all`, `POST /api/trash/:id/restore`,
`DELETE /api/trash`, `DELETE /api/trash/:id`, `GET /api/healthz`,
`GET /s/:token/download`, `GET /login`.

Tabel endpoint di §7 PRD (versi lama) **tidak akurat** terhadap kode standalone
maupun produksi; jangan dijadikan acuan.

---

## 7. Tabel Gap Sinkronisasi API.md vs Handler Produksi

| #   | Item di dokumen lama                                                                                                                                           | Handler produksi (`cloudstorage_handler.go`)                                 | Status                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| 1   | Prefix `/api/files`, `/api/trash`, `/api/share`, `/api/preview`                                                                                                | Semua di bawah `/api/cloud/*` (`/files`, `/trash`, `/files/:id/share`, dst.) | ❌ Tidak sinkron → diperbaiki di §1–4 |
| 2   | `POST /api/files/upload`                                                                                                                                       | `POST /api/cloud/files` (multipart `file`)                                   | ❌ Tidak sinkron                      |
| 3   | `PATCH /api/files/:id` (rename + pindah)                                                                                                                       | `PUT /api/cloud/files/:id` (rename saja); pindah lewat `/files/move`         | ❌ Tidak sinkron                      |
| 4   | `GET /api/preview/:id`                                                                                                                                         | Tidak ada; preview memakai `/files/:id/download?dl=1` (inline)               | ❌ Tidak sinkron                      |
| 5   | `POST /api/trash/restore`                                                                                                                                      | `POST /api/cloud/trash/:id/restore` + `/trash/restore-all`                   | ❌ Tidak sinkron                      |
| 6   | Share: `POST                                                                                                                                                   | DELETE /api/share/:id`                                                       | `POST                                 | DELETE /api/cloud/files/:id/share` | ❌ Tidak sinkron |
| 7   | Halaman share `/s/:token`                                                                                                                                      | `/s?t=<token>` (statis) + API `/api/cloud/s/:token/*`                        | ❌ Tidak sinkron                      |
| 8   | Balasan `{ "status": "ok" }`                                                                                                                                   | `{ "success": true }`                                                        | ❌ Tidak sinkron                      |
| 9   | Upload multi-file + `207`                                                                                                                                      | Upload satu file per request                                                 | ❌ Tidak sinkron (fitur standalone)   |
| 10  | Tidak menyebut `sort`/`type`/`starred`/`view`                                                                                                                  | Didukung (`ListFiles`, `SetStar`, `Reorder`)                                 | ⚠️ Gap dokumentasi                    |
| 11  | Tidak menyebut `/usage`, `/config.enabled`, `/notes`, `/folders`, `/files/zip`, `/files/:id/rotate`, `/files/:id/star`, `/files/:id/content`, `/files/reorder` | Semua ada di handler                                                         | ⚠️ Gap dokumentasi                    |
| 12  | Header `X-Total-Count`/`X-Has-More`                                                                                                                            | Ada (`ListFiles`), hanya untuk listing folder                                | ✅ Sinkron                            |
| 13  | Range / `206` streaming download                                                                                                                               | Ada (`streamFile`)                                                           | ✅ Sinkron                            |
| 14  | Thumbnail `GET /files/:id/thumb`                                                                                                                               | Ada (`Thumbnail`)                                                            | ✅ Sinkron                            |

**Kesimpulan §7:** ikatan endpoint lama **tidak sinkron** di 9 dari 14 baris
yang dinilai (≈36% akurasi). Versi revisi §1–5 kini sinkron dengan handler
produksi. Sisa gap: tidak ada dokumentasi OpenAPI/Swagger otomatis, dan skema
JSON belum divalidasi terhadap `models.CloudFile` oleh CI.

---

## 8. Catatan Keamanan & Utilitas (Produksi)

- **Auth & CSRF:** JWT Sekolahku untuk `/api/cloud/*`; publik hanya
  `/api/cloud/s/:token*`. CSRF ditangani middleware global Sekolahku (bukan
  `ALLOWED_ORIGINS` standalone).
- **Isolasi per-user:** semua query menyertakan `owner_id`; berkas pihak lain →
  `404` (`repository.ErrCloudNotFound`).
- **Bot token tidak bocor:** browser tidak pernah menerima URL Telegram;
  semua baca/tulis melewati backend.
- **Backup:** gunakan mekanisme backup Sekolahku (Telegram backup / SQLite
  snapshot). Flag `-backup` **hanya** milik aplikasi standalone.
