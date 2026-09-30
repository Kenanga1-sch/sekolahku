# PRD: Personal Cloud Storage Berbasis Telegram

> **Status dokumen (audit 2025):** PRD ini awalnya ditulis untuk **prototipe
> standalone** (single-user, Fiber, tabel `files`). Implementasi produksi di
> Sekolahku jauh lebih kaya (multi-user, Echo, tabel `cloud_files`, +fitur ZIP,
> catatan, rotasi, favorit, share folder). §5 (skema DB) dan §7 (API) di bagian
> bawah **sudah dikoreksi** ke bentuk produksi, dengan catatan gap eksplisit.

---

## 1. Ringkasan Produk

Layanan cloud storage pribadi (per-user) yang memakai **Telegram Bot API Server
lokal** sebagai backend penyimpanan, dengan UI mirip Google Drive, terintegrasi
ke dalam aplikasi Sekolahku.

|                     |                                                  |
| ------------------- | ------------------------------------------------ |
| **Target Pengguna** | Multi-user internal Sekolahku (admin/staff/guru) |
| **Storage Backend** | Telegram Bot API lokal (container, port 8086)    |
| **Tampilan**        | React Next.js, tema hijau Sekolahku              |
| **Isolasi Data**    | Per-user via `owner_id` (bukan single-user)      |

> **Koreksi:** versi awal menyatakan "Pribadi (single user)". Produksi adalah
> **multi-user dengan isolasi owner_id** — non-tujuan "tidak multi-user" di §2.2
> lama **sudah tidak berlaku**.

---

## 2. Tujuan & Non-Tujuan

### 2.1 Tujuan (berlaku)

- Penyimpanan berkas besar & murah memanfaatkan Telegram.
- UI familia seperti Google Drive, terintegrasi tema Sekolahku.
- Operasi file-manager (copy/cut/paste, rename, trash, restore).
- Isolasi ruang per-user (privasi antar pengguna).
- Fitur tambahan produksi: ZIP massal, editor teks/catatan, rotasi gambar,
  favorit, view lintas folder (Favorit/Terbaru/Ukuran besar), share folder.

### 2.2 Non-Tujuan (diperbarui)

- Tidak ada sinkronisasi folder lokal (auto-sync).
- Tidak ada sharing lintas-pengguna Telegram selain link token.
- Tidak ada versi berkas (versioning) / riwayat revisi.
- ~~Tidak multi-user~~ → **batal**: produksi multi-user.

---

## 3. Arsitektur

```
Browser (React: /cloud-storage, /s?t=<token>)
   │  JWT Sekolahku + CSRF
   ▼
go-backend (Echo)  ── metadata ── SQLite (cloud_files)
   │  HTTP upload (host:8086, --local)
   ▼
Telegram Bot API lokal
   └─ menyimpan berkas + dibaca langsung dari disk (mount)
```

Komponen: (1) go-backend Echo, (2) SQLite `cloud_files`, (3) Bot API lokal,
(4) frontend React Sekolahku. Detail teknis ada di ARCHITECTURE §2.

---

## 4. Tech Stack (Produksi)

| Layer    | Teknologi                            |
| -------- | ------------------------------------ |
| Backend  | Go + Echo v4 (bukan Fiber)           |
| Frontend | React / Next.js (`output: "export"`) |
| Database | SQLite (tabel `cloud_files`)         |
| Storage  | Telegram Bot API lokal (port 8086)   |
| Enkripsi | AES-256-GCM at-rest (opsional)       |

> **Koreksi:** dokumen lama menyebut "Fiber/Echo" dan "vanilla JS". Produksi
> memakai **Echo** + **React**.

---

## 5. Skema Database (Produksi) — tabel `cloud_files`

Berbeda dari tabel `files` versi lama. Kolom aktual (lihat
`repository/cloudstorage_repo.go` daftar `cloudFileColumns`):

| Kolom              | Tipe           | Keterangan                     |
| ------------------ | -------------- | ------------------------------ |
| `id`               | TEXT (cuid2)   | Primary key                    |
| `owner_id`         | TEXT           | **Pemilik (isolasi per-user)** |
| `name`             | TEXT           | Nama file/folder               |
| `parent_id`        | TEXT (NULL)    | Folder induk, NULL = root      |
| `is_folder`        | INTEGER        | 1 = folder                     |
| `file_id`          | TEXT (NULL)    | Telegram file_id               |
| `message_id`       | INTEGER (NULL) | Telegram message_id            |
| `mime_type`        | TEXT           | MIME type                      |
| `size`             | INTEGER        | Ukuran bytes                   |
| `encrypted`        | INTEGER        | 1 = terenkripsi at-rest        |
| `created_at`       | INTEGER        | Unix ts                        |
| `updated_at`       | INTEGER        | Unix ts                        |
| `deleted_at`       | INTEGER (NULL) | Soft delete / trash            |
| `share_token`      | TEXT (NULL)    | Token share                    |
| `share_expires_at` | INTEGER (NULL) | Kadaluarsa share               |
| `is_starred`       | INTEGER        | Favorit                        |
| `accessed_at`      | INTEGER (NULL) | Akses terakhir                 |
| `sort_order`       | INTEGER        | Urutan manual                  |
| `share_kind`       | TEXT (NULL)    | `file` \| `folder`             |

**Gap vs PRD lama:** tabel lama `files` tanpa `owner_id`, `message_id`,
`encrypted`, `is_starred`, `accessed_at`, `sort_order`, `share_kind`,
`share_expires_at`. Tabel `settings` di PRD lama tidak dipakai di produksi.

### 5.b Gap Model: `models.CloudFile` vs `model.File` (standalone)

| Field               | Produksi `models.CloudFile`     | Standalone `model.File`           | Match                   |
| ------------------- | ------------------------------- | --------------------------------- | ----------------------- |
| ID                  | `ID string`                     | `ID string`                       | ✅                      |
| Owner               | `OwnerID string`                | _(tidak ada)_                     | ❌                      |
| Name                | `Name string`                   | `Name string`                     | ✅                      |
| Path                | `Path string`                   | `Path string`                     | ✅                      |
| ParentID            | `*string`                       | `*string`                         | ✅                      |
| IsFolder            | `bool`                          | `bool`                            | ✅                      |
| Favorit             | `IsStarred bool` (`is_starred`) | `IsFavorite bool` (`is_favorite`) | ❌ nama & tag JSON beda |
| FileID/MsgID        | `*string` / `*int64`            | `*string` / `*int64`              | ✅                      |
| MimeType/Size       | `string` / `int64`              | `string` / `int64`                | ✅                      |
| Encrypted           | `bool`                          | `bool`                            | ✅                      |
| CreatedAt/UpdatedAt | `int64`                         | `int64`                           | ✅                      |
| AccessedAt          | `*int64` (nullable)             | `int64` (non-pointer)             | ❌ nullability beda     |
| DeletedAt           | `*int64`                        | `*int64`                          | ✅                      |
| ShareToken/Exp      | `*string` / `*int64`            | `*string` / `*int64`              | ✅                      |
| SortOrder           | `int64`                         | _(tidak ada)_                     | ❌                      |
| ShareKind           | `*string`                       | _(tidak ada)_                     | ❌                      |

**Kesimpulan:** 4 field mismatch/tidak ada (`owner_id`, `is_favorite` vs
`is_starred`, `sort_order`, `share_kind`) + perbedaan nullability `accessed_at`.
Field JSON `is_favorite` vs `is_starred` adalah **breaking** untuk klien yang
memakai kedua API sekaligus.

---

## 6. Fitur (Produksi)

- **Navigasi folder**, breadcrumb, grid/list, sortir, filter jenis.
- **Upload** streaming (satu berkas/request), batas 2048 MB (konfigurable).
- **Copy/Cut/Paste** rekursif, dedup nama ` (1)`.
- **Rename/Move/Reorder** manual.
- **Trash**: soft-delete, restore, restore-all, hapus permanen, empty.
- **Search** rekursif dengan `path`.
- **Favorit** + view lintas folder: Favorit / Terbaru / Ukuran besar.
- **ZIP massal** & **share folder** (ZIP/entry listing).
- **Editor teks/catatan** (batas 2 MiB) & **rotasi gambar**.
- **Share link** (file/folder) dengan `share_expires_at`.
- **Drag & drop**, seleksi area, dialog "Pindah/Salin ke…".

---

## 7. API Endpoint (Produksi — koreksi ringkas)

Selengkapnya di API.md §1–5. Ringkas:

| Method          | Path                                              | Fungsi                                      |
| --------------- | ------------------------------------------------- | ------------------------------------------- |
| GET             | `/api/cloud/config`, `/api/cloud/usage`           | Konfigurasi & pemakaian                     |
| GET             | `/api/cloud/files`                                | List (sort/type/starred/view, limit/offset) |
| POST            | `/api/cloud/files`                                | Upload (multipart)                          |
| GET             | `/api/cloud/files/:id[/download\|/thumb]`         | Detail / unduh (Range) / thumbnail          |
| PUT             | `/api/cloud/files/:id`                            | Rename                                      |
| DELETE          | `/api/cloud/files/:id`                            | Trash                                       |
| POST            | `/api/cloud/files/copy\|move\|zip\|reorder`       | Copy / move / ZIP / urutan                  |
| PUT             | `/api/cloud/files/:id/content`                    | Ganti isi teks                              |
| POST            | `/api/cloud/files/:id/rotate`                     | Rotasi gambar                               |
| POST            | `/api/cloud/files/:id/star`                       | Favorit                                     |
| POST            | `/api/cloud/folders`, `/api/cloud/notes`          | Buat folder / catatan                       |
| GET             | `/api/cloud/search?q=`                            | Cari                                        |
| GET/POST/DELETE | `/api/cloud/trash[...]`                           | Trash                                       |
| POST/DELETE     | `/api/cloud/files/:id/share`                      | Share                                       |
| GET             | `/api/cloud/s/:token[/download\|/file/:id\|/zip]` | Publik                                      |
| GET             | `/s?t=<token>`                                    | Halaman share statis                        |

**Gap:** tabel endpoint di PRD lama (versi standalone) **tidak akurat** dan
sudah diganti di atas (lihat API.md §7 untuk detail baris-per-baris).

---

## 8. Batasan & Asumsi

- Bot API lokal berjalan di container terpisah (produksi: port 8086, `--local`).
- Bot token & chat id hanya via env backend (tidak ke repo).
- Maks upload 2 GB (konfigurable); >2 GB perlu Bot API `--local`.
- Telegram dapat meng-expire `file_id` yang lama tak diakses.

---

## 9. Non-Fungsional (Target)

| Aspek            | Target                               |
| ---------------- | ------------------------------------ |
| List 10.000 file | < 100ms                              |
| Copy 100 file    | < 10 detik                           |
| Deployment       | backend + container Bot API + SQLite |
| Startup          | < 1 detik                            |

---

## 10. Roadmap (Post-MVP)

- Sinkronisasi folder lokal, album/grid foto, multi-channel storage, pin folder,
  versioning berkas, OpenAPI/Swagger otomatis untuk `/api/cloud/*`.

---

## 11. Acceptance Criteria (Produksi)

- [ ] Upload & download berkas besar (≥100 MB) ke folder & kembali.
- [ ] Copy-paste 100 file (folder bersarang) tanpa refresh.
- [ ] Cut-paste memindah tanpa duplikasi data.
- [ ] Search menemukan berkas bertingkat + `path`.
- [ ] Preview gambar/video/PDF inline (Range-aware).
- [ ] Share file **dan folder** bisa dibuka tanpa login & di-revoke.
- [ ] Trash: restore, restore-all, hapus permanen, empty.
- [ ] Isolasi per-user: berkas user lain tidak dapat diakses (404).
- [ ] ZIP massal & ZIP folder share streaming.
- [ ] Seluruh fitur jalan dengan Bot API lokal mode `--local`.
