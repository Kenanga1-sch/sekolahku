# Buku Panduan Modul Tabungan Siswa

Dokumen ini menjelaskan alur kerja lengkap dan fitur-fitur yang tersedia dalam Modul Tabungan Siswa.

## 1. Pendahuluan

Modul Tabungan Siswa dirancang untuk mendigitalkan proses tabungan sekolah, mulai dari penerimaan uang oleh guru, verifikasi oleh bendahara, hingga pelaporan transparan kepada orang tua siswa.

## 2. Aktor & Peran

| Peran                 | Tugas Utama                                          | Akses Menu                                    |
| :-------------------- | :--------------------------------------------------- | :-------------------------------------------- |
| **Siswa**             | Menabung, Menarik Uang, Membayar Kewajiban           | (Tidak ada akses langsung ke sistem)          |
| **Guru Wali / Piket** | Menerima uang fisik, Input Setoran                   | `Tabungan > Setoran`, `Tabungan > Siswa`      |
| **Bendahara**         | Verifikasi uang fisik, Kelola Brankas, Cetak Laporan | `Tabungan > Verifikasi`, `Brankas`, `Laporan` |

---

## 3. Alur Kerja Utama (Workflow)

### A. Alur Setoran Harian

1.  **Penerimaan**: Siswa menyerahkan uang tunai ke Guru.
2.  **Input**: Guru mencatat transaksi di menu **Setoran**.
    - Status awal: `Collected` (Uang diterima Guru).
    - _Catatan: Transaksi ini sudah muncul di Rekening Koran siswa sebagai "Sedang Diproses" / "Collected"._
3.  **Penyetoran**: Di akhir hari, Guru menyerahkan total uang fisik ke Bendahara.
4.  **Verifikasi**: Bendahara membuka menu **Verifikasi Setoran**.
    - Bendahara mencocokkan fisik uang dengan data di sistem.
    - Jika sesuai, Bendahara klik **Verifikasi**.
5.  **Selesai**:
    - Status transaksi menjadi `Verified`.
    - Saldo siswa resmi bertambah.
    - Saldo Brankas sekolah bertambah.

### B. Alur Penarikan

1.  **Pengajuan**: Siswa mengajukan penarikan ke Guru/Bendahara.
2.  **Input**: Guru input transaksi **Penarikan**.
3.  **Validasi**: Sistem otomatis mengecek saldo.
    - Jika saldo cukup -> Transaksi Sukses.
    - Jika saldo kurang -> Transaksi Ditolak.

### C. Alur Pembayaran Kewajiban (Hutang)

Fitur untuk menangani pembelian sekolah (LKS, Batik, Seragam) secara kredit/potong tabungan.

1.  **Pencatatan**: Admin mencatat siswa mengambil barang (misal: Batik). Masuk sebagai Hutang Aktif.
2.  **Pelunasan**:
    - **Tunai**: Siswa membayar cash.
    - **Potong Tabungan**: Saldo tabungan dikurangi untuk melunasi hutang.

---

## 4. Fitur-Fitur Unggulan

### 📊 Dashboard Monitoring

- **Top Savers**: Melihat siswa dengan saldo tertinggi.
- **Grafik Arus Kas**: Visualisasi pemasukan (hijau) dan pengeluaran (merah) per periode.

### 📝 Rekening Koran (Bank Statement)

Laporan riwayat transaksi profesional untuk orang tua siswa.

- **Running Balance**: Menampilkan saldo berjalan di setiap baris transaksi.
- **QR Code**: Validasi keaslian dokumen. Scan QR untuk melihat status keaslian data.
- **Searchable**: Pencarian siswa mudah dengan Nama atau NISN.
- **Watermark & Layout**: Desain standar bank (BCA/Mandiri).

### 📋 Laporan Akhir Tahun

Laporan rekapitulasi untuk pembagian tabungan saat kenaikan kelas.

- **Net Settlement**: Menghitung otomatis sisa uang yang harus diterima siswa.
  - Rumus: `Saldo Akhir Tabungan - Sisa Hutang/Kewajiban`.
- **Status**: Otomatis melabeli "SIAP CAIR" atau "KURANG BAYAR".

### 🔒 Manajemen Brankas & Saldo

- Monitoring posisi uang tunai fisik yang ada di sekolah (Saldo Brankas).
- Mencatat `Mutasi Saldo` jika uang disetor ke Bank atau ditarik untuk keperluan sekolah.

---

## 5. Pertanyaan Sering Diajukan (FAQ)

**Q: Mengapa setoran saya belum menambah Saldo Akhir siswa di Dashboard?**
A: Setoran baru berstatus `Collected` (di tangan Guru). Saldo Akhir resmi baru bertambah setelah Bendahara melakukan **Verifikasi**. Namun, transaksi tersebut sudah tercatat di sistem histori.

**Q: Apakah Rekening Koran bisa dicetak kapan saja?**
A: Ya, bisa dicetak kapan saja dengan periode tanggal bebas (misal: 1 bulan, 1 semester).

**Q: Bagaimana jika ada selisih uang saat verifikasi?**
A: Bendahara bisa memasukkan "Nominal Fisik" yang diterima. Sistem akan mencatat **Selisih** (kurang/lebih) untuk audit.
