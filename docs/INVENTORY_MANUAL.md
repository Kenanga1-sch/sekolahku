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

> Tidak ada halaman "Mutasi" tersendiri. Pindah ruangan dilakukan dengan
> **menyunting aset** tersebut.

1. Masuk ke menu **Inventaris** > **Aset**.
2. Buka aset yang ingin dipindahkan, lalu klik **Sunting**.
3. Ubah **Lokasi Ruangan** ke ruangan tujuan.
4. **Simpan**. Perpindahan ini tercatat di **Jejak Audit**, sehingga riwayat
   lokasi aset dapat ditelusuri kembali.

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

## 5. Pelaporan

Semua laporan ada di menu **Inventaris > Laporan**, terdiri dari empat tab.
Tombol **Cetak / Simpan PDF** menghasilkan dokumen A4 portrait dengan kop sekolah,
dan blok tanda tangan Kepala Sekolah + Pengurus Inventaris.

### Laporan Aset Tetap

Daftar seluruh aset, **dikelompokkan per ruangan** dengan sub-total tiap ruangan
dan jumlah keseluruhan. Kolom: No, Kode, Nama Barang, Kategori, Ruangan, Qty,
kondisi (Baik / Rusak Ringan / Rusak Berat / Hilang), dan Nilai.

Di atas daftar ada **Rekapitulasi Kondisi**. Bila kondisi suatu aset belum diisi
sehingga jumlah kondisi tidak sama dengan total unit, laporan menambahkan baris
**"Belum Diklasifikasi"** — jadi angkanya selalu tertutup dan tidak menyesatkan.

Laporan memuat seluruh aset, bukan hanya halaman pertama.

### Laporan Stok Habis Pakai

Daftar barang habis pakai beserta stok berjalan, stok minimum, satuan, harga,
dan nilai persediaan. Baris dengan stok di bawah minimum dicetak tebal.

### DIR per Ruangan

**Daftar Inventaris Ruangan** — satu ruangan dicetak pada halaman tersendiri,
siap ditempel di dinding ruangan tersebut. Berisi kode, nama, kategori, jumlah,
dan kondisi tiap barang, dengan jumlah total ruangan.

### Berita Acara Pemeriksaan (Opname)

Pilih sesi pemeriksaan yang pernah dilakukan, lalu cetak berita acaranya.
Dokumen memuat jumlah menurut sistem, hasil hitung di lapangan (Baik / Rusak
Ringan / Rusak Berat / Hilang), dan **Selisih**-nya. Selisih dicetak tebal bila
tidak nol. Nama dan kode barang ikut tercetak.

---

## 6. Penghapusan Aset (Write-off)

> **Belum tersedia sebagai halaman tersendiri.** Yang sudah ada saat ini:
> kondisi aset dapat diubah menjadi **Rusak Berat** atau **Hilang** lewat
> halaman Aset, dan perubahannya tercatat di **Jejak Audit**.
>
> Alur berikut masih merupakan rencana dan belum dapat dilakukan di aplikasi:
>
> 1. Ajukan penghapusan melalui menu **Penghapusan**.
> 2. Lampirkan foto kondisi barang.
> 3. Kepala Sekolah menyetujui penghapusan.
> 4. Aset dikeluarkan dari daftar aktif dan masuk ke **Arsip Aset Dihapus**.
