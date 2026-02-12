# ⚙️ Panduan Super Admin: Manajemen Admin & Sistem

Dokumen ini berisi panduan teknis khusus untuk peran **Super Admin** atau Tim IT Sekolah. Akses fitur ini **SANGAT TERBATAS** dan sensitif.

## 1. Manajemen Pengguna (Users)

Fitur ini digunakan untuk membuat akun baru, mengubah hak akses (Role), dan reset password.

### Membuat Akun Baru (Guru/Staff/Admin)
1. Masuk ke menu **Admin** > **Users** (Pengguna).
2. Klik tombol **+ Tambah User**.
3. Isi formulir:
   - **Nama Lengkap**: Sesuai KTP/SK.
   - **Email**: Email aktif (untuk login & notifikasi).
   - **Username**: Unik (Misal: `nip_guru`).
   - **Password**: Password awal (User wajib ganti saat login pertama).
   - **Role**: Pilih hak akses.
     - `superadmin`: Akses penuh sistem & database.
     - `admin`: Akses modul manajemen sekolah.
     - `guru`: Akses kelas, nilai, presensi.
     - `staff`: Akses inventaris/keuangan.
     - `siswa`: Akses terbatas profil & akademik.
4. Klik **Simpan**.

### Mengubah Role (Promosi/Demosi)
1. Cari nama user di tabel Users.
2. Klik tombol **Edit** (ikon pensil).
3. Ubah pilihan **Role**.
4. Klik **Update**.
   > **Perhatian**: Jangan mengubah role diri sendiri menjadi role yang lebih rendah! Anda akan kehilangan akses admin.

### Reset Password User
Jika user lupa password:
1. Cari nama user.
2. Klik tombol **Reset Password**.
3. Sistem akan membuat password sementara (biasanya `123456` atau acak).
4. Berikan password baru ke user tersebut.

---

## 2. Konfigurasi Sekolah (Settings)

Mengatur data identitas sekolah yang muncul di Kop Surat, Laporan, dan Footer Website.

1. Masuk ke menu **Pengaturan** (Settings).
2. Tab **Identitas Sekolah**:
   - **Nama Sekolah**: Sesuai NPSN.
   - **NPSN / NSS**: Nomor identitas nasional.
   - **Alamat Lengkap**: Jalan, Kelurahan, Kecamatan, Kota.
   - **Logo Sekolah**: Upload file PNG transparan (Max 2MB).
   - **Kepala Sekolah**: Nama & NIP Pejabat saat ini (Untuk TTD digital).
3. Tab **Tahun Ajaran**:
   - Set **Tahun Ajaran Aktif** (Misal: `2025/2026`).
   - Set **Semester Aktif** (Ganjil/Genap).
   - Sistem akan mengunci data akademik tahun lalu saat tahun ajaran diganti.
4. Klik **Simpan Perubahan**.

---

## 3. Backup & Restore Database

Sistem ini menggunakan database SQLite yang tersimpan dalam file tunggal. Backup rutin sangat penting!

### Backup Otomatis (Server)
Sistem melakukan backup harian otomatis setiap jam 00:00.
- Lokasi File: `/backups/` di server.
- Format Nama: `backup-YYYY-MM-DD.db`.

### Backup Manual (Download)
1. Masuk ke menu **Pengaturan** > **Maintenance**.
2. Klik tombol **Backup Database Sekarang**.
3. Sistem akan memproses dan menyediakan link **Download**.
4. Simpan file `.db` atau `.sql` di komputer/cloud pribadi Anda.

### Restore Database
Jika terjadi kerusakan data fatal:
1. Masuk ke menu **Pengaturan** > **Maintenance**.
2. Bagian **Restore Database**: Upload file backup `.db`.
3. Masukkan password konfirmasi admin.
4. Klik **Restore**.
   > **Peringatan**: Semua data saat ini akan TIMPA dengan data backup. Sistem akan restart otomatis.

---

## 4. Keamanan Sistem

### Activity Log
Pantau aktivitas mencurigakan di menu **Activity Log**.
- **Login Gagal Beruntun**: Indikasi brute-force attack.
- **Hapus Data Massal**: Indikasi kesalahan user atau sabotase.
- **Akses IP Asing**: Indikasi akun kompromi.

### Blokir User
Jika akun terindikasi diretas:
1. Buka menu **Users**.
2. Edit User -> Ubah status `is_active` menjadi **Non-Aktif (False)**.
3. User tersebut tidak akan bisa login lagi.
