# 📦 Panduan Pengguna: Manajemen Inventaris

Dokumen ini menjelaskan cara menggunakan modul Inventaris untuk pengelolaan aset sekolah, barang habis pakai (ATK), dan pemeliharaan gedung.

## 1. Persiapan Awal (Staff Sarpras)

Staff Sarpras bertanggung jawab untuk mendata seluruh aset dan ruangan.

### Daftar Ruangan (Master Ruangan)
Setiap aset harus terhubung dengan lokasi spesifik.
1. Masuk ke menu **Inventaris** > **Ruangan**.
2. Klik tombol **+ Ruangan Baru**.
3. Isi form:
   - **Nama Ruangan**: Contoh "Ruang Guru", "Kelas 1A".
   - **Kode Ruangan**: (Opsional) e.g., R-001.
   - **Lokasi**: Lantai/Gedung.
   - **PIC**: Penanggung Jawab Ruangan (Guru/Staff).
4. Klik **Simpan**.

### Kategori Barang
1. Masuk ke menu **Inventaris** > **Kategori**.
2. Buat kategori standar:
   - Elektronik (Komputer, Proyektor).
   - Mebel (Meja, Kursi, Lemari).
   - ATK (Kertas, Spidol).
   - Kebersihan (Sapu, Alat Pel).
3. Klik **Simpan**.

---

## 2. Pencatatan Aset Tetap (Fixed Assets)

Aset Tetap adalah barang yang memiliki masa manfaat lebih dari 1 tahun (Meja, Kursi, Laptop).

### Registrasi Aset Baru
1. Masuk ke menu **Inventaris** > **Aset**.
2. Klik tombol **+ Aset Baru**.
3. Isi form:
   - **Nama Barang**: Contoh "Meja Guru Kayu Jati".
   - **Kategori**: Mebel.
   - **Tanggal Pembelian**: Tanggal pengadaan.
   - **Harga Perolehan**: Harga beli per unit.
   - **Jumlah Awal**: Total unit yang dibeli.
   - **Lokasi Awal**: Pilih Ruangan.
   - **Kondisi**: Baik / Rusak Ringan / Rusak Berat.
4. **Cetak Label QR Code**:
   - Setelah disimpan, klik tombol **Cetak Label**.
   - Tempelkan QR Code pada fisik barang.

### Mutasi Aset (Pindah Ruangan)
1. Masuk ke menu **Inventaris** > **Mutasi**.
2. Scan QR Code barang yang akan dipindahkan.
3. Pilih **Ruangan Tujuan**.
4. Masukkan **Alasan Pindah** (e.g., "Kelas 1A direnovasi").
5. Klik **Proses Mutasi**.
6. Aset otomatis berpindah lokasi di sistem.

---

## 3. Manajemen Barang Habis Pakai (Consumables/ATK)

Barang yang habis dipakai atau memiliki masa manfaat pendek.

### Stok Masuk (Pembelian)
1. Masuk ke menu **Inventaris** > **Stok ATK**.
2. Klik tombol **+ Barang Masuk**.
3. Cari nama barang (e.g., "Kertas A4 70gr").
4. Masukkan **Jumlah Masuk** (e.g., 50 Rim).
5. Masukkan **Supplier/Sumber** (e.g., "Toko ABC").
6. Upload foto Nota/Bukti Pembelian (Opsional).
7. Klik **Simpan**. Stok bertambah otomatis.

### Stok Keluar (Pemakaian)
1. Guru/Staff mengajukan permintaan barang.
2. Staff Sarpras membuka menu **Inventaris** > **Stok Keluar**.
3. Pilih barang yang diminta.
4. Masukkan **Jumlah Keluar**.
5. Pilih **Penerima** (Nama Guru/Staff).
6. Masukkan **Keperluan** (e.g., "Ujian Tengah Semester").
7. Klik **Simpan**. Stok berkurang otomatis.
8. Sistem akan memberi peringatan jika stok mencapai batas minimum (**Min Stock**).

---

## 4. Stock Opname (Audit Aset)

Lakukan pemeriksaan fisik secara berkala (semester/tahunan).

1. Masuk ke menu **Inventaris** > **Opname**.
2. Klik **Mulai Opname Baru**.
3. Pilih **Ruangan Target** (e.g., Lab Komputer).
4. Staff melakukan scan QR Code semua aset di ruangan tersebut.
   - **Scan**: Barang ditemukan.
   - **Manual Input**: Update kondisi (Baik -> Rusak).
5. Sistem akan menampilkan selisih:
   - Barang yang seharusnya ada tapi tidak discan (**Hilang?**).
   - Barang yang seharusnya di ruangan lain tapi ada di sini (**Salah Tempat?**).
6. Finalisasi hasil opname dan cetak **Berita Acara**.

---

## 5. Pelaporan & Penghapusan Aset

### Laporan Aset
- **Daftar Inventaris Ruangan (DIR)**: Cetak daftar barang per ruangan untuk ditempel di dinding.
- **Laporan Nilai Aset**: Total valuasi aset sekolah.

### Penghapusan Aset (Write-off)
Jika barang rusak berat atau hilang dan tidak bisa diperbaiki.
1. Ajukan penghapusan melalui menu **Penghapusan**.
2. Lampirkan foto kondisi barang.
3. Kepala Sekolah menyetujui penghapusan.
4. Aset dikeluarkan dari daftar aktif dan masuk ke **Arsip Aset Dihapus**.
