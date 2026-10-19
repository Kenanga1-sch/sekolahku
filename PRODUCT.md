# PRODUCT.md — Sekolahku

Sumber kebenaran produk untuk pekerjaan desain/UI. Perbarui bila fakta produk
berubah; jangan mencampurnya dengan keputusan visual (lihat `DESIGN.md`).

## Produk

**Sekolahku** adalah sistem operasional sekolah dasar negeri: akademik, presensi,
tabungan siswa, perpustakaan, inventaris, keuangan, surat-menyurat, SPMB, dan
portal orang tua. Frontend Next.js diekspor statis dan di-embed ke satu binary Go;
data dilayani API Go + SQLite.

## Pengguna dan konteks

| Pengguna             | Kebutuhan utama                                     | Konteks pemakaian                         |
| -------------------- | --------------------------------------------------- | ----------------------------------------- |
| Admin/kepala sekolah | Melihat ringkasan, mengelola data induk, pengaturan | Desktop kantor, sesekali tablet           |
| Guru/wali kelas      | Presensi, nilai, tugas, melihat siswa               | Ponsel saat mengajar; desktop untuk rekap |
| Bendahara            | Tabungan, keuangan, verifikasi                      | Desktop; input cepat dan akurat           |
| Pustakawan           | Sirkulasi, katalog, inventaris buku                 | Desktop + scanner QR                      |
| Orang tua            | Kehadiran, tabungan, pengumuman, izin               | Ponsel, koneksi tidak stabil              |
| Publik/calon siswa   | Profil sekolah, berita, SPMB, mutasi                | Ponsel, pencarian Google                  |

## Tujuan

1. Tugas harian staff selesai lebih cepat dan lebih sedikit salah input.
2. Orang tua mendapat informasi anak tanpa harus menghubungi sekolah.
3. Publik menemukan informasi resmi sekolah dengan jelas dan terpercaya.

## Batasan yang tidak bisa dilanggar

- Bahasa Indonesia untuk seluruh teks UI, pesan error, dan notifikasi.
- Static export: tanpa server-side rendering dinamis, tanpa image optimizer server.
- Satu binary Go; jalan di perangkat sekolah dan koneksi terbatas.
- Tidak boleh menghapus/mengubah data lama saat development.
- Shadcn UI + Tailwind sebagai basis; hindari komponen custom bila primitif sudah ada.
- `lib/theme.ts`: admin dapat mengganti palet brand saat runtime.
- Modul cetak (PDF/label) punya kebutuhan font dan ukuran sendiri.

## Suara dan nada

- Jelas, sopan, langsung; hindari jargon teknis dan istilah Inggris di UI.
- Error harus menyebutkan penyebab dan cara memperbaiki.
- Jangan mengarang data, testimoni, atau logo mitra.

## Non-tujuan

- Bukan SaaS multi-sekolah; identitas dan alur dioptimalkan untuk satu sekolah.
- Bukan media sosial atau platform pembelajaran dengan konten pihak ketiga.
- Bukan aplikasi native; prioritas web responsif dan PWA.

## Bukti/identitas

- Nama resmi: UPTD SDN 1 Kenanga, NPSN 20216609.
- Lokasi: Desa Kenanga, Kecamatan Sindang, Kabupaten Indramayu, Jawa Barat.
- Domain: `sdn1kenanga.sch.id`.

## Ukuran keberhasilan UX

- axe: 0 pelanggaran critical/serious pada flow utama.
- Form utama selesai tanpa error yang hanya muncul sebagai toast.
- Orang tua dapat menemukan kehadiran/tabungan anak ≤2 langkah dari beranda portal.
- Tidak ada layout shift akibat font/efek dekoratif di halaman publik.
