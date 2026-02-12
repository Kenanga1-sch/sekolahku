# 🎓 Panduan Pengguna: Sistem Penerimaan Murid Baru (SPMB)

Dokumen ini menjelaskan cara menggunakan modul SPMB untuk Administrator dan Panitia PPDB.

## 1. Persiapan Awal (Administrator)

Sebelum membuka pendaftaran, Administrator harus menyiapkan periode pendaftaran.

### Membuat Periode Baru
1. Masuk ke menu **SPMB Admin** > **Periode**.
2. Klik tombol **+ Periode Baru**.
3. Isi form:
   - **Tahun Ajaran**: Contoh "2025/2026".
   - **Nama Gelombang**: Contoh "Gelombang 1".
   - **Tanggal Mulai & Selesai**: Tentukan durasi pendaftaran.
   - **Kuota**: Jumlah maksimal siswa yang diterima.
   - **Status**: Pilih "Aktif" untuk segera membuka pendaftaran.
4. Klik **Simpan**.

---

## 2. Proses Pendaftaran (Calon Siswa/Orang Tua)

Calon siswa dapat mendaftar secara mandiri melalui portal publik.

1. Buka halaman utama website sekolah.
2. Klik menu **Pendaftaran Siswa Baru** atau banner **Daftar Sekarang**.
3. **Langkah 1: Data Siswa**
   - Isi NISN, Nama Lengkap, NIK, Tempat/Tanggal Lahir.
   - Upload Pas Foto.
4. **Langkah 2: Data Orang Tua**
   - Isi data Ayah, Ibu, dan Wali (jika ada).
   - Pastikan nomor HP/WA aktif untuk notifikasi.
5. **Langkah 3: Lokasi Rumah (Zonasi)**
   - Gunakan peta interaktif untuk menandai lokasi rumah.
   - Sistem otomatis menghitung jarak ke sekolah (untuk jalur Zonasi).
6. **Langkah 4: Upload Dokumen**
   - Upload Scan KK, Akta Kelahiran, dan dokumen pendukung lainnya.
7. **Langkah 5: Review & Submit**
   - Periksa kembali semua data.
   - Klik **Kirim Pendaftaran**.
   - Simpan **Nomor Pendaftaran** dan **Kode Akses** yang muncul.

---

## 3. Verifikasi Data (Panitia PPDB)

Panitia bertugas memverifikasi data yang masuk.

1. Masuk ke menu **SPMB Admin** > **Pendaftar**.
2. Anda akan melihat daftar calon siswa dengan status `Pending`.
3. Klik nama siswa untuk melihat detail.
4. Periksa kelengkapan data dan dokumen:
   - Jika data **Lengkap & Valid**: Klik tombol **Verifikasi** (Hijau). Status berubah menjadi `Verified`.
   - Jika data **Kurang/Salah**: Klik tombol **Tolak/Revisi** (Merah). Tuliskan alasan penolakan pada kolom catatan.
   - Siswa akan melihat status dan catatan ini saat mereka mengecek pendaftaran.

---

## 4. Seleksi & Pengumuman

Setelah masa pendaftaran ditutup, Panitia melakukan seleksi akhir.

1. Masuk ke menu **SPMB Admin** > **Seleksi**.
2. Sistem dapat mengurutkan siswa berdasarkan:
   - Jarak (Zonasi).
   - Usia.
   - Nilai/Prestasi (jika diinput).
3. Tandai siswa yang **Diterima** atau **Cadangan**.
4. Publikasikan pengumuman melalui website.

---

## 5. Daftar Ulang

Siswa yang diterima wajib melakukan daftar ulang.

1. Siswa datang ke sekolah membawa berkas fisik.
2. Panitia memvalidasi berkas fisik dengan data di sistem.
3. Panitia mengubah status siswa menjadi **Accepted (Daftar Ulang)**.
4. Data siswa otomatis masuk ke database **Siswa Aktif** di menu Akademik.
