# 🧠 Project Context: Sekolahku (Sitaku & SmartLib)

File ini adalah referensi utama untuk agen AI (seperti Jules) agar memahami konteks, struktur, dan aturan main dalam pengembangan project ini.

## 🏗️ Folder Structure

- **`/app`**: Menggunakan Next.js App Router.
  - `(public)`: Halaman yang bisa diakses tanpa login (Landing page, SPMB).
  - `(auth)`: Login, Logout, dan Reset Password.
  - `(dashboard)`: Core modules (Dashboard, Perpustakaan, Tabungan, Inventaris, Akademik, Keuangan).
  - `api/`: API Routes (Gunakan hanya jika tidak bisa menggunakan Server Actions).
- **`/actions`**: Lokasi utama untuk **Server Actions**. Semua mutasi data (POST/PUT/DELETE) harus diletakkan di sini.
- **`/components`**:
  - `ui/`: Komponen dasar dari Shadcn UI.
  - `dashboard/`, `library/`, `savings/`: Komponen spesifik fitur.
- **`/db`**:
  - `schema/`: Definisi tabel database per modul.
  - `index.ts`: Inisialisasi Drizzle dan koneksi SQLite.
- **`/lib`**: Helper logic, validasi Zod, dan konfigurasi (auth, storage, toast).
- **`/scripts`**: Utility scripts untuk migrasi, seeding, dan maintenance database.

## 📜 Development Rules (Aturan Main)

1. **Bahasa**: Gunakan **Bahasa Indonesia** untuk seluruh antarmuka pengguna (UI), label, pesan error, dan notifikasi toast.
2. **UI/UX**:
   - Prioritaskan penggunaan komponen dari **Shadcn UI**.
   - Hindari membuat komponen custom baru jika Shadcn sudah menyediakannya.
   - Gunakan **Tailwind CSS** untuk styling.
3. **Data Fetching**:
   - Prioritaskan **React Server Components (RSC)** untuk pengambilan data awal (GET) di halaman dashboard.
   - Gunakan **SWR** di sisi client jika memerlukan data yang sangat dinamis atau real-time updates.
   - Hindari `useEffect` untuk data fetching jika bisa dilakukan di server.
4. **Data Mutations**:
   - **WAJIB** menggunakan **Server Actions** untuk menangani input form dan perubahan data.
   - Hindari penggunaan API Routes manual kecuali untuk integrasi eksternal (hardware scanner, webhooks).
5. **Database**:
   - Selalu cek `db/schema/` sebelum melakukan perubahan kode yang berhubungan dengan data.
   - **Jangan hapus data dummy** yang sudah ada di database selama proses development karena penting untuk testing.
   - Gunakan `npx drizzle-kit push` untuk sinkronisasi skema saat ada perubahan tabel.
6. **Error Handling**:
   - Gunakan `sonner` untuk notifikasi toast (Sukses/Error).
   - Pastikan pesan error user-friendly dan dalam Bahasa Indonesia.

## 🎯 Modul Utama
- **Sitaku (Akademik & Tabungan)**: Fokus pada manajemen siswa, kenaikan kelas, dan tabungan harian.
- **SmartLib (Perpustakaan)**: Fokus pada sirkulasi buku (Pinjam/Kembali) dan inventaris aset buku berbasis QR Code.

## 🔑 Kredensial Default (Pasca Seeding)
- **Role Super Admin**: `admin@sekolahku.id` / `admin123`
- **Role Bendahara**: (Ditunjuk melalui menu Admin)
