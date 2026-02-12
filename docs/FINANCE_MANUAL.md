# 💰 Panduan Pengguna: Manajemen Keuangan Sekolah

Modul ini digunakan untuk mencatat arus kas (cash flow) sekolah, selain tabungan siswa.

> **Catatan:** Untuk panduan **Tabungan Siswa**, silakan lihat dokumen terpisah: [Panduan Tabungan Siswa](TABUNGAN_MANUAL.md).

## 1. Arus Kas (Cash Flow)

Fitur ini mencatat semua transaksi penerimaan dan pengeluaran dana operasional sekolah (BOS, BOP, Sumbangan, dll) secara sentral (Cash Basis).

### Akses Menu
Masuk ke menu **Keuangan** > **Arus Kas**.

### Mencatat Pemasukan (Income)
1. Klik tombol **+ Transaksi Baru**.
2. Pilih jenis **Pemasukan**.
3. Isi data:
   - **Tanggal**: Tanggal transaksi (default hari ini).
   - **Akun Kas**: Pilih rekening tujuan (Misal: Kas Tunai TU, Bank BJB BOS).
   - **Kategori**: Sumber dana (Misal: Dana BOS, Iuran Komite).
   - **Jumlah**: Nominal uang.
   - **Keterangan**: Rincian transaksi.
   - **Bukti Transaksi**: Upload foto kwitansi/nota (opsional).
4. Klik **Simpan**. Saldo akun kas akan bertambah.

### Mencatat Pengeluaran (Expense)
1. Klik tombol **+ Transaksi Baru**.
2. Pilih jenis **Pengeluaran**.
3. Isi data:
   - **Tanggal**: Tanggal pengeluaran.
   - **Akun Kas**: Sumber dana (Misal: Kas Tunai TU).
   - **Kategori**: Pos anggaran (Misal: ATK, Transport Guru, Listrik/Air).
   - **Jumlah**: Nominal uang.
   - **Keterangan**: Rincian pengeluaran.
   - **Bukti Transaksi**: Upload foto struk/nota.
4. Klik **Simpan**. Saldo akun kas akan berkurang.

### Transfer Antar Akun (Mutasi)
Digunakan saat memindahkan uang, misal dari Bank ke Kas Tunai (Penarikan).

1. Klik tombol **+ Transaksi Baru**.
2. Pilih jenis **Transfer**.
3. Isi data:
   - **Dari Akun**: Sumber dana (Misal: Bank BJB BOS).
   - **Ke Akun**: Tujuan dana (Misal: Kas Tunai Bendahara).
   - **Jumlah**: Nominal yang dipindahkan.
   - **Keterangan**: Alasan transfer (Misal: Penarikan Tunai untuk Gaji Honorer).
4. Klik **Simpan**.

---

## 2. Laporan Keuangan

Sistem menyediakan laporan otomatis berdasarkan data transaksi yang diinput.

### Laporan Buku Kas Umum (BKU)
1. Buka menu **Laporan**.
2. Pilih **Buku Kas Umum**.
3. Pilih periode (Bulan/Tahun).
4. Klik **Tampilkan** atau **Cetak PDF**.
5. Laporan akan menampilkan saldo awal, mutasi debet/kredit, dan saldo akhir.

### Laporan Per Kategori
Untuk melihat total pengeluaran spesifik (misal: berapa total biaya listrik tahun ini?).

1. Buka menu **Laporan**.
2. Pilih **Laporan Kategori**.
3. Pilih Kategori (Misal: Listrik/Air).
4. Pilih Rentang Waktu.
5. Sistem akan menjumlahkan semua transaksi pada kategori tersebut.

---

## 3. Manajemen Akun & Kategori

Hanya Admin Keuangan yang bisa mengubah pengaturan ini.

- **Akun Kas**: Rekening atau tempat penyimpanan uang (Brankas, Bank A, Bank B).
- **Kategori**: Pos anggaran (Makan Minum, Rapat, ATK, Gaji, dll).

Pastikan kategori sudah sesuai dengan standar pelaporan sekolah (misal: ARKAS) agar laporan mudah disinkronkan.
