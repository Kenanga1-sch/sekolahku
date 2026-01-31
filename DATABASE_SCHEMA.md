# 📊 Database Schema: Sekolahku

Project ini menggunakan **SQLite** dengan **Drizzle ORM**. Berikut adalah representasi tekstual dari tabel-tabel utama.

## 💰 Modul Tabungan (Savings)

Modul ini mengelola tabungan harian siswa dengan sistem verifikasi berjenjang.

### Tabel Utama:

- **`tabungan_siswa`**: Menyimpan profil tabungan tiap siswa, saldo terakhir, dan link ke Master Siswa.
- **`tabungan_transaksi`**: Log setiap transaksi (Setor/Tarik). Berisi status `verified` atau `pending`.
- **`tabungan_setoran`**: Bundel transaksi harian yang disetor guru kelas ke Bendahara.
- **`tabungan_brankas`** (**Source of Truth**): Mencatat saldo fisik uang sekolah (Kas Tunai & Bank).

### Relasi Penting:

- `tabungan_siswa` -> `students` (Master Data).
- `tabungan_transaksi` -> `tabungan_siswa` (Pemilik saldo).
- `tabungan_transaksi` -> `tabungan_setoran` (Kelompok setoran harian).
- Verifikasi `tabungan_setoran` oleh Bendahara akan menambah saldo di `tabungan_brankas`.

## 📚 Modul Perpustakaan (SmartLib)

Modul ini memisahkan data bibliografi (katalog) dengan data fisik buku (aset).

### Tabel Utama:

- **`library_catalog`**: Data metadata buku (Judul, Penulis, ISBN, Cover).
- **`library_assets`** (**Source of Truth**): Data fisik tiap eksemplar buku (Identitas unik = QR Code, Lokasi Rak, Kondisi).
- **`library_members`**: Link antara User/Siswa dengan kartu anggota perpustakaan.
- **`library_loans`**: Catatan peminjaman, tanggal kembali, dan denda.

### Status Buku (`itemStatusEnum`):

- `AVAILABLE`: Buku tersedia di rak.
- `BORROWED`: Sedang dipinjam.
- `DAMAGED`: Rusak dan tidak bisa dipinjam.
- `LOST`: Hilang.

## 🎓 Modul Akademik & Siswa

Mengelola data induk siswa dan riwayat pendidikan.

### Tabel Utama:

- **`students`**: Master data siswa (NISN, Nama, Tempat Tanggal Lahir, Orang Tua).
- **`student_classes`**: Daftar kelas (Rombel) yang tersedia.
- **`academic_years`**: Tahun ajaran aktif dan semester.
- **`student_class_history`**: Rekam jejak siswa tiap tahun (Kelas mana, Wali kelas siapa, Status: Naik/Tinggal).

## 👥 Pengguna (Users)

- **`users`**: Tabel sentral untuk Admin, Guru, Staff, dan Siswa (jika diberikan akses login).
- **Role**: `superadmin`, `admin`, `guru`, `staff`, `siswa`.

## 📋 Tabel Lainnya (Sistem)

- `school_settings`: Konfigurasi global (Nama Sekolah, Alamat, Tahun Ajaran Aktif, Bendahara ditunjuk).
- `spmb_registrants`: Pendaftaran siswa baru.
- `inventory_items`: Manajemen aset sekolah non-buku.
- `activity_logs`: Audit trail untuk setiap aksi penting di sistem.

---

_Catatan: Gunakan `npx drizzle-kit push` untuk melakukan pembaruan skema tanpa perlu menulis file migrasi manual._
