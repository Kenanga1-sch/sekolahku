// Shared page titles for the dashboard header and breadcrumbs.
// Longest-prefix match keeps nested routes readable when an exact entry
// is not available.

export const PAGE_TITLES: Record<string, string> = {
  "/overview": "Beranda",
  "/chat": "Pesan",
  "/tugas": "Tugas",
  "/tugas-saya": "Tugas Saya",
  "/ruang-tumbuh": "Ruang Tumbuh",
  // Keuangan
  "/keuangan": "Keuangan",
  // Perpustakaan
  "/perpustakaan/buku": "Data Buku",
  "/perpustakaan/anggota": "Anggota Perpustakaan",
  "/perpustakaan/peminjaman": "Peminjaman Buku",
  "/perpustakaan/kunjungan/manual": "Kunjungan Manual",
  "/perpustakaan/binding": "Penjilidan Buku",
  "/perpustakaan/qr-generator": "Generator QR Buku",
  "/perpustakaan/laporan": "Laporan Perpustakaan",
  "/perpustakaan": "Perpustakaan",
  // Inventaris
  "/inventaris/aset": "Daftar Aset",
  "/inventaris/stok": "Barang Habis Pakai",
  "/inventaris/ruangan": "Ruangan",
  "/inventaris/kategori": "Kategori Inventaris",
  "/inventaris/peminjaman": "Peminjaman Barang",
  "/inventaris/opname": "Stok Opname",
  "/inventaris/audit": "Audit Aset",
  "/inventaris/laporan": "Laporan Inventaris",
  "/inventaris": "Inventaris",
  // Arsip
  "/arsip/surat-masuk": "Surat Masuk",
  "/arsip/surat-keluar": "Surat Keluar",
  "/arsip/dokumen": "Dokumen",
  "/arsip/laporan": "Laporan Arsip",
  "/arsip/pengaturan": "Pengaturan Arsip",
  "/arsip": "E-Arsip",
  // DocStation
  "/docstation": "DocStation",
  // Cloud Storage
  "/cloud-storage": "Cloud Storage",
  // Tabungan
  "/tabungan/riwayat": "Riwayat Transaksi",
  "/tabungan/siswa": "Tabungan Siswa",
  "/tabungan/setoran": "Setoran",
  "/tabungan/penarikan": "Penarikan",
  "/tabungan/verifikasi": "Verifikasi",
  "/tabungan/pengguna": "Pengguna Tabungan",
  "/tabungan/brankas": "Brankas",
  "/tabungan/hutang": "Hutang Siswa",
  "/tabungan/laporan": "Laporan Tabungan",
  "/tabungan/scan": "Scan Tabungan",
  "/tabungan": "Tabungan",
  // Presensi
  "/presensi/pengajuan": "Pengajuan Izin",
  "/presensi/laporan": "Laporan Presensi",
  "/presensi/scan": "Scan Presensi",
  "/presensi/scan-gtk": "Scan Presensi GTK",
  "/presensi/holidays": "Hari Libur",
  "/presensi": "Presensi",
  // Admin
  "/admin/siswa/spmb-detail": "Detail Pendaftar SPMB",
  "/admin/siswa/spmb-tambah": "Input Pendaftar SPMB",
  "/admin/siswa/spmb-bukti": "Bukti Pendaftaran SPMB",
  "/admin/siswa/buku-induk": "Buku Induk",
  "/admin/siswa/import": "Import Siswa",
  "/admin/siswa/kelulusan": "Kelulusan",
  "/admin/siswa/alumni": "Alumni",
  "/admin/siswa/cetak": "Cetak",
  "/admin/siswa/detail": "Detail Siswa",
  "/admin/siswa": "Manajemen Siswa",
  "/admin/master/gtk/cetak-kartu": "Cetak Kartu GTK",
  "/admin/master/gtk": "Direktori GTK",
  "/admin/akademik": "Akademik",
  "/admin/surat/jenis": "Jenis Surat",
  "/admin/surat/template": "Template Surat",
  "/admin/surat": "Surat",
  "/admin/konten-informasi": "Pusat Informasi",
  "/admin/halaman-depan": "Halaman Depan",
  "/admin/notifikasi": "Notifikasi",
  "/admin": "Administrasi",
  // Bank Soal
  "/bank-soal/soal/baru": "Buat Soal",
  "/bank-soal/soal/edit": "Edit Soal",
  "/bank-soal/soal": "Kelola Soal",
  "/bank-soal/bab": "Kelola Bab",
  "/bank-soal/paket": "Paket Soal",
  "/bank-soal": "Bank Soal",
  // Praktik
  "/praktik/hasil": "Hasil Praktik",
  "/praktik": "Latihan Soal",
  // Profil
  "/profil/ganti-password": "Ganti Password",
  "/profile": "Profil",
  "/pengaturan": "Pengaturan",
};

const PAGE_TITLE_KEYS = Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length);

export function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  for (const key of PAGE_TITLE_KEYS) {
    if (pathname.startsWith(key)) return PAGE_TITLES[key];
  }
  return "Dashboard";
}

export interface BreadcrumbItem {
  label: string;
  href: string;
  current?: boolean;
}

function humanizeSegment(segment: string): string {
  const decoded = decodeURIComponent(segment).replace(/[-_]+/g, " ");
  return decoded
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getBreadcrumbItems(pathname: string): BreadcrumbItem[] {
  const cleanPath = (pathname.split("?")[0].split("#")[0] || "/").replace(/\/+$/, "");
  if (!cleanPath || cleanPath === "/overview" || cleanPath === "/") return [];

  const segments = cleanPath.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: "Beranda", href: "/overview" }];
  let accumulated = "";

  segments.forEach((segment, index) => {
    accumulated += `/${segment}`;
    const isLast = index === segments.length - 1;
    const label =
      (isLast ? PAGE_TITLES[cleanPath] : undefined) ??
      PAGE_TITLES[accumulated] ??
      humanizeSegment(segment);

    if (items[items.length - 1]?.label === label) return;
    items.push({ label, href: accumulated, current: isLast });
  });

  return items;
}
