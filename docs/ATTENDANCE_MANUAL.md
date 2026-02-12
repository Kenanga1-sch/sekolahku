# 📅 Panduan Pengguna: Presensi & Aktivitas

Modul ini digunakan untuk memantau kehadiran siswa, guru, dan aktivitas sistem.

## 1. Presensi Siswa

Sistem Presensi Siswa mendukung metode **QR Code** (Self-Checkin) dan **Input Manual** oleh Guru/Wali Kelas.

### Dashboard Presensi
1. Buka menu **Presensi**.
2. Anda akan melihat **Statistik Hari Ini**:
   - Total Siswa.
   - Hadir (Hijau).
   - Sakit/Izin (Kuning).
   - Belum Absen/Alpha (Merah).
3. **Sesi Aktif**: Daftar kelas yang sedang berlangsung absensinya.

### Cara 1: Scan QR Code (Self-Service)
Metode ini digunakan jika sekolah menyediakan Tablet/Kiosk di depan kelas atau gerbang.

1. Buka menu **Presensi** > **Scan QR**.
2. Pastikan kamera/webcam aktif.
3. Siswa menunjukkan Kartu Pelajar (yang berisi QR Code).
4. Sistem akan berbunyi **"Beep"** dan menampilkan foto & nama siswa.
5. Status kehadiran otomatis tercatat sebagai **Hadir**.
6. Jika siswa terlambat, sistem akan mencatat jam masuk.

### Cara 2: Presensi Manual (Oleh Guru)
Digunakan jika siswa lupa membawa kartu atau sistem QR sedang offline.

1. Buka menu **Presensi** > **Sesi Baru**.
2. Pilih **Kelas** (Misal: 1A).
3. Pilih **Tanggal** (Default: Hari ini).
4. Klik **Mulai Sesi**.
5. Daftar nama siswa akan muncul.
6. Klik tombol status di sebelah nama siswa:
   - **H** (Hadir - Hijau).
   - **S** (Sakit - Kuning).
   - **I** (Izin - Biru).
   - **A** (Alpha - Merah).
7. Klik **Simpan** atau **Tutup Sesi** setelah selesai.

### Edit Kehadiran
Jika ada kesalahan input (misal: siswa datang terlambat tapi dicatat Alpha):
1. Buka menu **Presensi** > **Riwayat Sesi**.
2. Cari sesi kelas/tanggal yang dimaksud.
3. Klik **Detail**.
4. Ubah status kehadiran siswa tersebut.
5. Klik **Simpan Perubahan**.

---

## 2. Laporan Presensi

Laporan ini digunakan untuk rekap bulanan atau semesteran.

1. Buka menu **Presensi** > **Laporan**.
2. Pilih **Kelas** dan **Bulan**.
3. Sistem menampilkan tabel rekapitulasi (Jumlah H, S, I, A per siswa).
4. Klik **Download Excel** atau **Cetak PDF**.
5. Persentase kehadiran (% Kehadiran) dihitung otomatis: `(Hadir / Total Hari Efektif) * 100`.

---

## 3. Log Aktivitas (Activity Log)

Fitur keamanan untuk memantau siapa melakukan apa di dalam sistem. Hanya Admin yang bisa mengakses menu ini.

1. Buka menu **Pengaturan** > **Activity Log**.
2. Anda bisa melihat riwayat:
   - **Login/Logout**: Siapa saja yang masuk ke sistem.
   - **Create**: Siapa yang menambahkan data baru (Siswa, Surat, Transaksi).
   - **Update**: Siapa yang mengedit data.
   - **Delete**: Siapa yang menghapus data.
3. Gunakan filter **Tanggal** atau **User** untuk mencari aktivitas mencurigakan.
4. Data log tidak bisa diedit/dihapus untuk menjaga integritas audit.
