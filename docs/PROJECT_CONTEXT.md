# 🧠 Project Context: Sekolahku (Sitaku & SmartLib)

File ini adalah referensi utama untuk agen AI agar memahami konteks, struktur, dan aturan main dalam pengembangan project ini.

## 🏗️ Folder Structure

- **`/app`**: Menggunakan Next.js App Router.
  - `(public)`: Halaman yang bisa diakses tanpa login (Landing page, SPMB).
  - `(auth)`: Login, Logout.
  - `(dashboard)`: Core modules (Dashboard, Perpustakaan, Tabungan, Inventaris, Akademik, Keuangan).
  - `api/`: API Routes (hanya jika tidak bisa menggunakan Go backend API).
- **`/actions`**: Client-side actions (auth, academic).
- **`/components`**:
  - `ui/`: Komponen dasar dari Shadcn UI.
  - `spmb/`, `perpustakaan/`, `tabungan/`, dll: Komponen spesifik fitur.
- **`/lib`**: Helper logic, validasi Zod, stores (Zustand), hooks, API client.
- **`/go-backend`**: Backend Go (Echo framework + SQLite).
  - `cmd/api/`: Entry point (`main.go`, `routes.go`, `database.go`, `static.go`).
  - `internal/handlers/`: HTTP handlers per modul.
  - `internal/repository/`: Database access layer.
  - `internal/models/`: Data structures.
  - `internal/middleware/`: Auth, cache, security headers.
  - `internal/db/migrations/`: SQL migration files.
  - `internal/scheduler/`: Cron jobs (Telegram backup, cleanup).

## 📜 Development Rules (Aturan Main)

1. **Bahasa**: Gunakan **Bahasa Indonesia** untuk seluruh antarmuka pengguna (UI), label, pesan error, dan notifikasi toast.
2. **UI/UX**:
   - Prioritaskan penggunaan komponen dari **Shadcn UI**.
   - Hindari membuat komponen custom baru jika Shadcn sudah menyediakannya.
   - Gunakan **Tailwind CSS** untuk styling.
3. **Data Fetching**:
   - Frontend Next.js di-build sebagai **static export** (`output: "export"`).
   - Semua data diambil dari **Go backend API** (`/api/*`) menggunakan relative path.
   - Gunakan **SWR** di sisi client untuk data dinamis.
4. **Data Mutations**:
   - Semua mutasi data melalui **Go backend API** (`POST`, `PUT`, `PATCH`, `DELETE`).
5. **Database**:
   - Backend menggunakan **SQLite** via `modernc.org/sqlite` (pure Go, tanpa CGO).
   - Migrasi menggunakan file SQL di `go-backend/internal/db/migrations/`.
   - Schema repair otomatis dilakukan saat startup via `RepairDatabase()`.
   - Jangan hapus data yang sudah ada di database selama development.
6. **Error Handling**:
   - Gunakan `sonner` untuk notifikasi toast (Sukses/Error).
   - Pastikan pesan error user-friendly dan dalam Bahasa Indonesia.

## 🎯 Modul Utama

- **Sitaku (Akademik & Tabungan)**: Manajemen siswa, kenaikan kelas, dan tabungan harian.
- **SmartLib (Perpustakaan)**: Sirkulasi buku (Pinjam/Kembali) dan inventaris aset buku berbasis QR Code.
- **SPMB**: Penerimaan murid baru online dengan zonasi.
- **E-Office**: Surat menyurat, template, dan generator batch.
- **Inventaris**: Manajemen aset dan stok barang.
- **Presensi**: Kehadiran siswa dengan QR scanning.
- **Keuangan (Loan)**: Pinjaman karyawan (kasbon/cicilan).
- **Alumni (Buku Induk)**: Data alumni, transkrip, prestasi, dokumen.

## 🔑 Kredensial Default (Pasca Seeding)

Kredensial admin dapat dikonfigurasi via environment variable:

- `ADMIN_EMAIL` (default: `admin@sekolah.sch.id`)
- `ADMIN_USERNAME` (default: `admin`)
- `ADMIN_PASSWORD` (default: `admin123`)

Role bendahara ditunjuk melalui menu Admin.

## 🚀 Deployment

Frontend Next.js di-build sebagai static export dan di-embed ke binary Go menggunakan `embed.FS`. Hasil akhir adalah **satu binary executable** yang berisi:

- Go backend API (port default 8181)
- Seluruh frontend Next.js statis
- SPA fallback routing

Lihat [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) untuk instruksi development dan build.
