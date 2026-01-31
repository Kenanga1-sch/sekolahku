# 🔄 Business Workflows: Sekolahku

Dokumentasi alur logika fitur-fitur kompleks untuk menghindari kesalahan saat modifikasi kode.

## 1. Library Binding (Pendaftaran Buku Baru)

Alur untuk mendaftarkan buku fisik ke dalam sistem SmartLib.

1.  **Scan QR Stiker**: Petugas menempelkan QR Code unik pada fisik buku dan melakukan scan (atau input manual). Ini menjadi ID Unik di tabel `library_assets`.
2.  **Scan ISBN**: Petugas melakukan scan barcode ISBN pada buku.
3.  **Auto Fetch Data**: Sistem melakukan lookup ke API internal/eksternal untuk mengambil metadata buku (Judul, Penulis, Penerbit).
4.  **Konfirmasi & Lokasi**: Petugas menentukan lokasi rak (Contoh: RAK-A1).
5.  **Simpan**: Data disimpan ke `library_assets` dengan kondisi default **"Baik"** dan status **"AVAILABLE"**. Jika metadata buku belum ada di `library_catalog`, maka entri baru akan dibuat otomatis.

## 2. Tabungan & Verifikasi Bendahara

Alur pengelolaan uang siswa yang aman dengan audit trail yang jelas.

1.  **Input Transaksi**: Guru Kelas menerima uang dari siswa dan menginput ke sistem. Status transaksi langsung `verified` (oleh guru) dan saldo siswa di `tabungan_siswa` bertambah.
2.  **Penyetoran Harian (Daily Settlement)**: Di akhir hari/minggu, Guru membuat "Setoran" di sistem yang berisi kumpulan transaksi harian untuk diserahkan ke Bendahara.
3.  **Verifikasi Bendahara**:
    - Bendahara menerima uang fisik dari Guru.
    - Bendahara membuka menu Verifikasi, mencocokkan jumlah di sistem dengan uang fisik.
    - **Approve**: Jika cocok, status `tabungan_setoran` menjadi `verified`. Saldo di **`tabungan_brankas` (Kas Tunai)** bertambah otomatis sesuai nominal yang diverifikasi.
    - **Reject**: Jika uang fisik tidak cocok atau ada masalah, setoran ditolak untuk diperbaiki oleh Guru.

## 3. Kenaikan Kelas & Kelulusan (Academic Promotion)

Proses tahunan untuk mengelola perpindahan siswa antar kelas.

- **Alur Naik Kelas (Promoted)**:
  1.  Admin memilih siswa yang naik kelas.
  2.  Sistem mengubah Tingkat/Grade siswa menjadi X+1 (Contoh: Kelas 1 menjadi Kelas 2).
  3.  Sistem memperbarui `classId` siswa ke ID kelas baru di tahun ajaran baru.
  4.  Sistem mencatat riwayat di `student_class_history` dengan status **"promoted"**.
- **Alur Tinggal Kelas (Retained)**:
  1.  Siswa tetap di Tingkat/Grade yang sama (Contoh: Tetap di Kelas 1).
  2.  Sistem memperbarui `classId` siswa ke ID kelas baru (Rombel baru) untuk tahun ajaran baru.
  3.  Sistem mencatat riwayat di `student_class_history` dengan status **"retained"**.
- **Alur Lulus (Graduated)**:
  1.  Status siswa di tabel `students` diubah menjadi "Alumni".
  2.  Data siswa dipindahkan/dicatat di tabel `alumni` (jika diperlukan).
  3.  Sistem mencatat riwayat di `student_class_history` dengan status **"graduated"**.

## 4. Keuangan Sekolah (Brankas & Bank)

1.  **Single Source of Truth**: Tabel `tabungan_brankas` adalah satu-satunya acuan jumlah uang fisik sekolah.
2.  **Transfer Kas ke Bank**: Saat uang di brankas terlalu banyak, Bendahara melakukan "Setor Bank". Saldo Brankas Kas berkurang, Saldo Brankas Bank bertambah. Semua tercatat di `tabungan_brankas_transaksi`.
