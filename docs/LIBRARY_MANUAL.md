# 📚 Panduan Pengguna: Manajemen Perpustakaan (SmartLib)

Modul SmartLib memungkinkan perpustakaan untuk mengelola katalog, sirkulasi, dan inventaris buku secara digital dan terpusat.

## 1. Persiapan Awal (Pustakawan)

Pustakawan harus memastikan bahwa database katalog buku telah diisi sebelum melakukan sirkulasi.

### Katalog Buku (Metadata)
1. Masuk ke menu **Perpustakaan** > **Katalog**.
2. Klik tombol **+ Buku Baru**.
3. **Pindai ISBN** menggunakan barcode scanner. Sistem akan mencoba mencari data buku secara otomatis.
4. Jika tidak ditemukan, isi data manual:
   - Judul, Penulis, Penerbit, Tahun Terbit, Kategori.
   - Upload Cover Buku (jika ada).
   - Isi Deskripsi Singkat.
5. Klik **Simpan**.

### Inventaris Buku Fisik (Eksemplar)
Setiap buku fisik harus memiliki ID unik (QR Code).

1. Klik tombol **Tambah Eksemplar** di halaman detail Katalog.
2. **Pindai QR Code** yang akan ditempelkan pada buku.
3. Tentukan **Lokasi Rak** (Misal: RAK-001).
4. Status awal default adalah **Tersedia (Available)**.
5. Klik **Simpan**.

### Manajemen Anggota
1. Masuk ke menu **Perpustakaan** > **Anggota**.
2. Klik tombol **+ Anggota Baru** atau **Import dari Siswa**.
3. Sistem akan membuat kartu anggota dengan **QR Code** unik.
4. Cetak Kartu Anggota untuk siswa/guru.

---

## 2. Sirkulasi (Peminjaman & Pengembalian)

### Peminjaman (Borrowing)
1. Masuk ke menu **Perpustakaan** > **Sirkulasi** atau tekan shortcut **F2**.
2. **Scan Kartu Anggota** peminjam. Profil peminjam akan muncul.
3. Periksa status peminjam (Apakah ada denda/tunggakan?).
4. **Scan QR Code Buku** yang akan dipinjam.
5. Sistem otomatis mencatat Tanggal Pinjam dan Tanggal Kembali (Default: 7 hari).
6. Klik **Konfirmasi Peminjaman**.
7. Status buku berubah menjadi **Dipinjam (Borrowed)**.

### Pengembalian (Returning)
1. Masuk ke menu **Perpustakaan** > **Sirkulasi** > **Pengembalian** atau tekan shortcut **F3**.
2. **Scan QR Code Buku** yang dikembalikan.
3. Sistem otomatis menghitung keterlambatan.
   - Jika terlambat > 0 hari, sistem akan menampilkan jumlah **Denda**.
4. Terima pembayaran denda (jika ada) dan klik **Bayar Denda** atau **Catat Hutang**.
5. Klik **Konfirmasi Pengembalian**.
6. Status buku kembali menjadi **Tersedia (Available)**.

---

## 3. Stock Opname (Audit Inventaris)

Lakukan Stock Opname secara berkala untuk mencocokkan data sistem dengan fisik buku di rak.

1. Masuk ke menu **Perpustakaan** > **Stock Opname**.
2. Buat sesi Stock Opname baru (Misal: "Opname Semester 1 2025").
3. Pilih lokasi rak yang akan diaudit (Misal: Rak Fiksi).
4. Mulai scan semua buku yang ada di rak tersebut satu per satu.
5. Sistem akan mencatat:
   - **Match**: Buku ada di sistem dan di rak (Status benar).
   - **Missing**: Buku ada di sistem (Available) tapi tidak ditemukan fisik saat scan.
   - **Found**: Buku berstatus hilang/dipinjam tapi ditemukan di rak.
6. Setelah selesai, klik **Selesai & Laporan**.
7. Sistem akan memberikan rekapitulasi buku hilang/rusak untuk ditindaklanjuti.

---

## 4. Pelaporan & Statistik

Lihat performa perpustakaan melalui menu **Laporan**.

- **Buku Terpopuler**: Daftar buku yang paling sering dipinjam.
- **Anggota Teraktif**: Siswa yang paling sering meminjam buku.
- **Denda & Keuangan**: Rekap pendapatan denda.
- **Grafik Peminjaman**: Tren peminjaman bulanan.
