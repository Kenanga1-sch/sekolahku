/**
 * Kamus variabel template laporan — satu sumber untuk:
 *   - `unknownVariables` (presensi-excel.ts) agar daftar variabel tak
 *     dikenal selalu sinkron,
 *   - tab Kamus Variabel di Pengaturan → Format Laporan (`/pengaturan?tab=laporan-format&sub=kamus`).
 *
 * Modul dengan status "siap" benar-benar mengeksekusi variabel saat fill
 * (presensi via scalarMap, surat via LETTER_VARIABLES). Status "rencana"
 * dicatat agar format baru tahu nama yang akan dipakai — belum dieksekusi.
 */
import { LETTER_VARIABLES } from "./letter-variables";

export type FillVariableStatus = "siap" | "rencana";

export interface FillVariable {
  /** Nama variabel tanpa kurung kurawal, mis. "kelas". */
  name: string;
  label: string;
  description: string;
  example: string;
  status: FillVariableStatus;
}

export interface FillVariableModule {
  module: string;
  label: string;
  groups: { label: string; variables: FillVariable[] }[];
}

const v = (
  name: string,
  label: string,
  description: string,
  example: string,
  status: FillVariableStatus = "siap"
): FillVariable => ({ name, label, description, example, status });

/** Modul: Daftar Hadir Bulanan (presensi-excel.ts). */
const PRESENSI: FillVariableModule = {
  module: "presensi",
  label: "Presensi (Daftar Hadir)",
  groups: [
    {
      label: "Sekolah",
      variables: [
        v("sekolah_nama", "Nama sekolah", "Nama resmi sekolah", "SDN 1 Kenanga"),
        v("sekolah_alamat", "Alamat", "Alamat lengkap sekolah", "Jl. Kenanga No. 1, Kab. …"),
        v("sekolah_telepon", "Telepon", "Nomor telepon sekolah", "0231-…"),
        v("sekolah_npsn", "NPSN", "Nomor Pokok Sekolah Nasional", "20216609"),
        v("sekolah_email", "Email", "Email sekolah", "sekolah@…"),
        v("sekolah_website", "Website", "Website sekolah", "https://…"),
      ],
    },
    {
      label: "Pejabat & Wali",
      variables: [
        v("kepala_sekolah_nama", "Kepala sekolah", "Nama kepala sekolah", "Drs. H. …"),
        v("kepala_sekolah_nip", "NIP kepala sekolah", "NIP kepala sekolah", "1965…"),
        v("wali_kelas_nama", "Wali kelas", "Nama wali kelas kelas yang dicetak", "Siti …"),
        v("wali_kelas_nip", "NIP wali kelas", "NIP wali kelas", "1980…"),
      ],
    },
    {
      label: "Kelas & Periode",
      variables: [
        v("kelas", "Kelas", "Nama kelas berawalan 'Kelas'", "Kelas 1"),
        v("kelas_upper", "Kelas (huruf besar)", "KELAS 1 — untuk judul raksasa", "KELAS 1"),
        v("jumlah_siswa", "Jumlah siswa", "Jumlah siswa pada kelas yang dicetak", "40"),
        v("bulan", "Bulan", "Nama bulan berjalan", "Oktober"),
        v("tahun", "Tahun", "Tahun berjalan", "2026"),
        v("tahun_ajaran", "Tahun ajaran", "Tahun pelajaran", "2026/2027"),
        v("hari_efektif", "Hari efektif", "Jumlah hari efektif periode ini", "20"),
      ],
    },
    {
      label: "Tanggal Cetak",
      variables: [
        v("tanggal_cetak", "Tanggal cetak", "Tanggal file dibuat", "9 Oktober 2026"),
        v("tempat_ttd", "Tempat tanda tangan", "Kota/kabupaten dari alamat sekolah", "Kab. Indramayu"),
      ],
    },
    {
      label: "Tanda Tangan (pagination)",
      variables: [
        v("ttd_mulai", "Mulai blok TTD", "Penanda baris awal blok tanda tangan — dikosongkan setelah fill; dipakai applyPagination agar blok TTD tidak terpotong", "(penanda)"),
        v("ttd_selesai", "Selesai blok TTD", "Penanda baris akhir blok tanda tangan", "(penanda)"),
      ],
    },
    {
      label: "Baris siswa (direplikasi per siswa)",
      variables: [
        v("no", "No.", "Nomor urut siswa", "1"),
        v("nama", "Nama siswa", "Nama lengkap siswa", "Budi Santoso"),
        v("nis", "NIS", "Nomor induk siswa", "100123"),
        v("nisn", "NISN", "Nomor induk nasional", "0091…"),
        v("total_h", "Total hadir", "Jumlah hari hadir", "18"),
        v("total_s", "Total sakit", "Jumlah hari sakit", "1"),
        v("total_i", "Total izin", "Jumlah hari izin", "0"),
        v("total_a", "Total alpha", "Jumlah hari alpha", "1"),
        v("persen", "Persentase siswa", "Kehadiran siswa ÷ hari efektif × 100", "90"),
      ],
    },
    {
      label: "Kolom tanggal",
      variables: [
        v("tgl_N", "Status per tanggal", "tgl_1..tgl_31 → H/S/I/A atau –", "H"),
      ],
    },
    {
      label: "Rumus Excel",
      variables: [
        v("=…", "Formula hidup", "Sel diawali = di template tetap jadi formula; referensi baris contoh digeser otomatis ke baris siswa", "=COUNTIF(D8:AH8,\"H\")"),
      ],
    },
  ],
};

/** Modul: Surat (letter-variables.ts). */
const SURAT: FillVariableModule = {
  module: "surat",
  label: "Surat (Surat & Dokumen)",
  groups: Object.entries(LETTER_VARIABLES).map(([group, vars]) => ({
    label: group,
    variables: vars.map((x) => {
      const name = x.value.replace(/^\{\{|\}\}$/g, "");
      return v(name, x.label, "Variabel surat — dieksekusi saat render surat", x.value.replace(/\{\{|\}\}/g, ""), "siap" as const);
    }),
  })),
};

/**
 * Modul: Inventaris Aset Tetap (lib/inventory/inventory-excel.ts).
 *
 * Dipakai template file .xlsx/.docx yang diunggah admin. Baris contoh yang
 * memuat variabel baris (kelompok "Baris aset") direplikasi otomatis sejumlah
 * aset, mengikuti pola presensi. Formula Excel (sel diawali "=") ikut digeser.
 */
const INVENTARIS: FillVariableModule = {
  module: "inventaris",
  label: "Inventaris (Aset Tetap)",
  groups: [
    {
      label: "Sekolah",
      variables: [
        v("sekolah_nama", "Nama sekolah", "Nama resmi sekolah", "SDN 1 Kenanga"),
        v("sekolah_alamat", "Alamat", "Alamat lengkap sekolah", "Jl. Kenanga No. 1, Kab. …"),
        v("sekolah_telepon", "Telepon", "Nomor telepon sekolah", "0231-…"),
        v("sekolah_npsn", "NPSN", "Nomor Pokok Sekolah Nasional", "20216609"),
        v("sekolah_email", "Email", "Email sekolah", "sekolah@…"),
        v("sekolah_website", "Website", "Website sekolah", "https://…"),
      ],
    },
    {
      label: "Pejabat",
      variables: [
        v("kepala_sekolah_nama", "Kepala sekolah", "Nama kepala sekolah", "Drs. H. …"),
        v("kepala_sekolah_nip", "NIP kepala sekolah", "NIP kepala sekolah", "1965…"),
        v("pengurus_inventaris_nama", "Pengurus inventaris", "Nama pengurus/penanggung jawab inventaris", "Ahmad …"),
        v("pengurus_inventaris_nip", "NIP pengurus inventaris", "NIP pengurus inventaris", "1985…"),
      ],
    },
    {
      label: "Laporan & Periode",
      variables: [
        v("periode", "Periode", "Keterangan posisi laporan", "Posisi per 9 Oktober 2026"),
        v("tanggal_cetak", "Tanggal cetak", "Tanggal file dibuat", "9 Oktober 2026"),
        v("tempat_ttd", "Tempat tanda tangan", "Kota/kabupaten dari alamat sekolah", "Kab. Indramayu"),
        v("total_unit", "Total unit aset", "Jumlah seluruh unit (quantity) aset", "128"),
        v("total_nilai_aset", "Total nilai aset", "Jumlah seluruh nilai aset (Rp)", "25.000.000"),
        v("jumlah_ruangan", "Jumlah ruangan", "Banyak ruangan berisi aset", "12"),
        v("jumlah_jenis", "Jumlah jenis aset", "Banyak baris aset", "64"),
      ],
    },
    {
      label: "Baris aset (direplikasi per aset)",
      variables: [
        v("no", "No.", "Nomor urut aset", "1"),
        v("kode", "Kode aset", "Kode inventaris", "INV/BK-2026-01"),
        v("nama", "Nama aset", "Nama barang", "Laptop"),
        v("kategori", "Kategori", "Kategori aset", "Elektronik"),
        v("ruangan", "Ruangan", "Ruangan tempat aset berada", "Ruang Guru"),
        v("jumlah", "Jumlah", "Banyak unit aset", "5"),
        v("baik", "Kondisi baik", "Jumlah unit kondisi baik", "3"),
        v("rusak_ringan", "Rusak ringan", "Jumlah unit rusak ringan", "1"),
        v("rusak_berat", "Rusak berat", "Jumlah unit rusak berat", "1"),
        v("hilang", "Hilang", "Jumlah unit hilang", "0"),
        v("belum_diklasifikasi", "Belum diklasifikasi", "Unit yang kondisinya belum diisi", "0"),
        v("harga", "Harga satuan", "Harga satuan aset (Rp)", "8.500.000"),
        v("nilai", "Nilai total", "jumlah × harga (Rp)", "42.500.000"),
        v("sumber_dana", "Sumber dana", "Sumber dana perolehan", "BOS"),
        v("tahun_anggaran", "Tahun anggaran", "Tahun anggaran perolehan", "2026"),
        v("tanggal_perolehan", "Tanggal perolehan", "Tanggal aset diperoleh", "15 Januari 2026"),
        v("penyedia", "Penyedia", "Nama penyedia/toko", "CV Maju Jaya"),
        v("no_nota", "No. nota/faktur", "Nomor nota atau faktur", "INV-2026-0001"),
        v("no_seri", "No. seri", "Nomor seri barang", "SN-12345"),
        v("merek", "Merk", "Merek barang", "Lenovo"),
        v("model", "Tipe/model", "Tipe atau model barang", "ThinkPad E14"),
        v("cara_perolehan", "Cara perolehan", "Pembelian/Hibah/Bantuan …", "Pembelian"),
      ],
    },
    {
      label: "Tanda Tangan (pagination)",
      variables: [
        v("ttd_mulai", "Mulai blok TTD", "Penanda baris awal blok tanda tangan — dikosongkan setelah fill", "(penanda)"),
        v("ttd_selesai", "Selesai blok TTD", "Penanda baris akhir blok tanda tangan", "(penanda)"),
      ],
    },
{
      label: "Rumus Excel",
      variables: [
        v("=...", "Formula hidup", "Sel diawali = di template tetap jadi formula; referensi baris contoh digeser otomatis ke baris aset", "=SUM(G8:G12)"),
      ],
    },
  ],
};

/**
 * Modul: Inventaris — Stok Habis Pakai (ATK)
 * (lib/inventory/inventory-atk-excel.ts).
 *
 * Dipakai template file .xlsx yang diunggah admin. Baris contoh yang memuat
 * variabel baris (kelompok "Baris barang") direplikasi otomatis sejumlah
 * barang ATK, mengikuti pola inventaris/tabungan. Modul dipisah dari
 * "inventaris" karena default modul itu sudah dipakai laporan Aset Tetap.
 */
const INVENTARIS_ATK: FillVariableModule = {
  module: "inventaris-atk",
  label: "Inventaris — Stok Habis Pakai",
  groups: [
    {
      label: "Sekolah",
      variables: [
        v("sekolah_nama", "Nama sekolah", "Nama resmi sekolah", "SDN 1 Kenanga"),
        v("sekolah_alamat", "Alamat", "Alamat lengkap sekolah", "Jl. Kenanga No. 1, Kab. …"),
        v("sekolah_telepon", "Telepon", "Nomor telepon sekolah", "0231-…"),
        v("sekolah_npsn", "NPSN", "Nomor Pokok Sekolah Nasional", "20216609"),
        v("sekolah_email", "Email", "Email sekolah", "sekolah@…"),
        v("sekolah_website", "Website", "Website sekolah", "https://…"),
      ],
    },
    {
      label: "Pejabat",
      variables: [
        v("kepala_sekolah_nama", "Kepala sekolah", "Nama kepala sekolah", "Drs. H. …"),
        v("kepala_sekolah_nip", "NIP kepala sekolah", "NIP kepala sekolah", "1965…"),
        v("pengurus_inventaris_nama", "Pengurus inventaris", "Nama pengurus/penanggung jawab inventaris", "Ahmad …"),
        v("pengurus_inventaris_nip", "NIP pengurus inventaris", "NIP pengurus inventaris", "1985…"),
      ],
    },
    {
      label: "Laporan & Periode",
      variables: [
        v("periode", "Periode", "Keterangan posisi laporan", "Posisi per 16 Oktober 2026"),
        v("tanggal_cetak", "Tanggal cetak", "Tanggal file dibuat", "16 Oktober 2026"),
        v("tempat_ttd", "Tempat tanda tangan", "Kota/kabupaten dari alamat sekolah", "Kab. Indramayu"),
        v("total_jenis", "Total jenis barang", "Banyak jenis barang ATK", "45"),
        v("total_nilai", "Total nilai persediaan", "Jumlah seluruh nilai persediaan (Rp)", "12.500.000"),
      ],
    },
    {
      label: "Baris barang (direplikasi per barang)",
      variables: [
        v("no", "No.", "Nomor urut barang", "1"),
        v("kode", "Kode barang", "Kode ATK", "ATK-2026-01"),
        v("nama", "Nama barang", "Nama barang habis pakai", "Kertas HVS A4"),
        v("kategori", "Kategori", "Kategori barang", "Alat Tulis"),
        v("satuan", "Satuan", "Satuan barang", "Rim"),
        v("stok", "Stok saat ini", "Jumlah stok tersedia", "25"),
        v("stok_minimum", "Stok minimum", "Batas minimum stok", "10"),
        v("harga", "Harga satuan", "Harga satuan barang (Rp)", "55.000"),
        v("nilai", "Nilai persediaan", "stok × harga (Rp)", "1.375.000"),
      ],
    },
    {
      label: "Tanda Tangan (pagination)",
      variables: [
        v("ttd_mulai", "Mulai blok TTD", "Penanda baris awal blok tanda tangan — dikosongkan setelah fill", "(penanda)"),
        v("ttd_selesai", "Selesai blok TTD", "Penanda baris akhir blok tanda tangan", "(penanda)"),
      ],
    },
    {
      label: "Rumus Excel",
      variables: [
        v("=...", "Formula hidup", "Sel diawali = di template tetap jadi formula; referensi baris contoh digeser otomatis ke baris barang", "=SUM(H8:H12)"),
      ],
    },
  ],
};

/**
 * Modul: Tabungan (lib/tabungan/tabungan-excel.ts).
 *
 * Dipakai template file .xlsx yang diunggah admin. Baris contoh yang memuat
 * variabel baris (kelompok "Baris transaksi") direplikasi otomatis sejumlah
 * transaksi, mengikuti pola presensi/inventaris. Formula Excel (sel diawali
 * "=") ikut digeser.
 */
const TABUNGAN: FillVariableModule = {
  module: "tabungan",
  label: "Tabungan",
  groups: [
    {
      label: "Sekolah",
      variables: [
        v("sekolah_nama", "Nama sekolah", "Nama resmi sekolah", "SDN 1 Kenanga"),
        v("sekolah_alamat", "Alamat", "Alamat lengkap sekolah", "Jl. Kenanga No. 1, Kab. …"),
        v("sekolah_telepon", "Telepon", "Nomor telepon sekolah", "0231-…"),
        v("sekolah_npsn", "NPSN", "Nomor Pokok Sekolah Nasional", "20216609"),
        v("sekolah_email", "Email", "Email sekolah", "sekolah@…"),
        v("sekolah_website", "Website", "Website sekolah", "https://…"),
      ],
    },
    {
      label: "Pejabat",
      variables: [
        v("kepala_sekolah_nama", "Kepala sekolah", "Nama kepala sekolah", "Drs. H. …"),
        v("kepala_sekolah_nip", "NIP kepala sekolah", "NIP kepala sekolah", "1965…"),
        v("bendahara_nama", "Bendahara", "Nama bendahara tabungan", "Siti …"),
      ],
    },
    {
      label: "Laporan & Periode",
      variables: [
        v("periode", "Periode", "Keterangan periode laporan", "Bulan Ini (1 Okt 2026 s.d. …)"),
        v("tanggal_cetak", "Tanggal cetak", "Tanggal file dibuat", "16 Oktober 2026"),
        v("tempat_ttd", "Tempat tanda tangan", "Kota/kabupaten dari alamat sekolah", "Kab. Indramayu"),
        v("total_saldo", "Total saldo", "Jumlah seluruh saldo tabungan (Rp)", "12.500.000"),
        v("total_siswa", "Total siswa", "Banyak siswa penabung", "120"),
        v("total_setoran", "Total setoran", "Jumlah setoran periode ini (Rp)", "3.000.000"),
        v("total_penarikan", "Total penarikan", "Jumlah penarikan periode ini (Rp)", "500.000"),
        v("jumlah_transaksi", "Jumlah transaksi", "Banyak transaksi periode ini", "85"),
      ],
    },
    {
      label: "Baris transaksi (direplikasi per transaksi)",
      variables: [
        v("no", "No.", "Nomor urut transaksi", "1"),
        v("tanggal", "Tanggal", "Tanggal transaksi", "16/10/2026"),
        v("siswa", "Siswa", "Nama siswa", "Budi Santoso"),
        v("kelas", "Kelas", "Nama kelas siswa", "Kelas 1"),
        v("tipe", "Tipe", "Setor atau Tarik", "Setor"),
        v("nominal", "Nominal", "Nominal transaksi (Rp)", "50.000"),
        v("status", "Status", "Status transaksi", "verified"),
        v("petugas", "Petugas", "Nama petugas pencatat", "Siti …"),
      ],
    },
    {
      label: "Tanda Tangan (pagination)",
      variables: [
        v("ttd_mulai", "Mulai blok TTD", "Penanda baris awal blok tanda tangan — dikosongkan setelah fill", "(penanda)"),
        v("ttd_selesai", "Selesai blok TTD", "Penanda baris akhir blok tanda tangan", "(penanda)"),
      ],
    },
    {
      label: "Rumus Excel",
      variables: [
        v("=…", "Formula hidup", "Sel diawali = di template tetap jadi formula; referensi baris contoh digeser otomatis ke baris transaksi", "=SUM(F8:F12)"),
      ],
    },
  ],
};

/**
 * Modul: Buku Induk (Word .docx).
 *
 * Template diunggah admin lewat Pengaturan → Format Laporan → Jenis Template
 * "Word". Variabel mengikuti data halaman cetak Buku Induk
 * (`app/(dashboard)/admin/siswa/buku-induk/print`). Status "rencana" sampai
 * tombol unduh Word disambungkan ke template yang diunggah.
 */
const r = (
  name: string,
  label: string,
  description: string,
  example: string
): FillVariable => v(name, label, description, example, "rencana");

const BUKU_INDUK: FillVariableModule = {
  module: "buku-induk",
  label: "Buku Induk",
  groups: [
    {
      label: "Sekolah",
      variables: [
        r("sekolah_nama", "Nama sekolah", "Nama resmi sekolah", "SDN 1 Kenanga"),
        r("sekolah_npsn", "NPSN", "Nomor Pokok Sekolah Nasional", "20216609"),
        r("sekolah_alamat", "Alamat sekolah", "Alamat lengkap sekolah", "Jl. Kenanga No. 1, Kab. …"),
        r("sekolah_telepon", "Telepon sekolah", "Nomor telepon sekolah", "0231-…"),
        r("sekolah_email", "Email sekolah", "Email sekolah", "sekolah@…"),
        r("sekolah_website", "Website sekolah", "Website sekolah", "https://…"),
        r("kepala_sekolah_nama", "Kepala sekolah", "Nama kepala sekolah", "Drs. H. …"),
        r("kepala_sekolah_nip", "NIP kepala sekolah", "NIP kepala sekolah", "1965…"),
      ],
    },
    {
      label: "Identitas siswa",
      variables: [
        r("buku_induk_no", "No. Buku Induk", "Nomor buku induk fisik", "BI-001"),
        r("register_no", "No. Register", "Nomor register siswa", "REG-2026-001"),
        r("nis", "NIS", "Nomor induk siswa", "100123"),
        r("nisn", "NISN", "Nomor induk siswa nasional", "0091…"),
        r("nik", "NIK", "Nomor induk kependudukan", "3212…"),
        r("nama_lengkap", "Nama lengkap", "Nama lengkap siswa", "Budi Santoso"),
        r("nama_panggilan", "Nama panggilan", "Nama panggilan siswa", "Budi"),
        r("jenis_kelamin", "Jenis kelamin", "Laki-laki / Perempuan", "Laki-laki"),
        r("tempat_lahir", "Tempat lahir", "Tempat lahir siswa", "Indramayu"),
        r("tanggal_lahir", "Tanggal lahir", "Tanggal lahir format Indonesia", "1 Januari 2015"),
        r("agama", "Agama", "Agama siswa", "Islam"),
        r("kewarganegaraan", "Kewarganegaraan", "Kewarganegaraan siswa", "Indonesia"),
        r("anak_ke", "Anak ke-", "Urutan kelahiran", "2"),
        r("jumlah_saudara", "Jumlah saudara", "Jumlah saudara", "3"),
        r("saudara_kandung", "Saudara kandung", "Jumlah saudara kandung", "2"),
        r("saudara_tiri", "Saudara tiri", "Jumlah saudara tiri", "1"),
        r("saudara_angkat", "Saudara angkat", "Jumlah saudara angkat", "0"),
        r("bahasa_sehari_hari", "Bahasa sehari-hari", "Bahasa yang dipakai di rumah", "Indonesia"),
        r("golongan_darah", "Golongan darah", "Golongan darah siswa", "O"),
        r("status_siswa", "Status", "Status siswa (Aktif/Lulus/Pindah/Keluar)", "Aktif"),
        r("kelas", "Kelas", "Kelas siswa saat ini / terakhir", "Kelas VI"),
        r("tahun_masuk", "Tahun masuk", "Tahun siswa masuk", "2020"),
        r("alamat_siswa", "Alamat", "Alamat lengkap siswa", "Jl. …"),
        r("telepon_siswa", "Telepon", "Telepon orang tua/wali", "0812…"),
      ],
    },
    {
      label: "Orang tua / wali",
      variables: [
        r("ayah_nama", "Nama ayah", "Nama lengkap ayah", "Santoso"),
        r("ayah_nik", "NIK ayah", "NIK ayah", "3212…"),
        r("ayah_pendidikan", "Pendidikan ayah", "Pendidikan terakhir ayah", "SMA"),
        r("ayah_pekerjaan", "Pekerjaan ayah", "Pekerjaan ayah", "Petani"),
        r("ayah_penghasilan", "Penghasilan ayah", "Penghasilan ayah per bulan", "Rp 2.000.000"),
        r("ibu_nama", "Nama ibu", "Nama lengkap ibu", "Siti"),
        r("ibu_nik", "NIK ibu", "NIK ibu", "3212…"),
        r("ibu_pendidikan", "Pendidikan ibu", "Pendidikan terakhir ibu", "SMA"),
        r("ibu_pekerjaan", "Pekerjaan ibu", "Pekerjaan ibu", "Ibu rumah tangga"),
        r("ibu_penghasilan", "Penghasilan ibu", "Penghasilan ibu per bulan", "Rp 0"),
        r("wali_nama", "Nama wali", "Nama lengkap wali", "Hartono"),
        r("wali_nik", "NIK wali", "NIK wali", "3212…"),
        r("wali_pendidikan", "Pendidikan wali", "Pendidikan terakhir wali", "S1"),
        r("wali_pekerjaan", "Pekerjaan wali", "Pekerjaan wali", "Karyawan"),
        r("wali_penghasilan", "Penghasilan wali", "Penghasilan wali per bulan", "Rp 3.000.000"),
        r("hubungan_wali", "Hubungan wali", "Hubungan wali dengan siswa", "Paman"),
        r("telepon_orang_tua", "Telepon orang tua", "Nomor telepon orang tua", "0812…"),
        r("telepon_wali", "Telepon wali", "Nomor telepon wali", "0813…"),
        r("alamat_orang_tua", "Alamat orang tua", "Alamat orang tua/wali", "Jl. …"),
      ],
    },
    {
      label: "Pendidikan sebelumnya & mutasi",
      variables: [
        r("asal_sekolah", "Asal sekolah", "Nama TK/asal sekolah", "TK Pertiwi"),
        r("nama_tk", "Nama TK", "Nama TK asal sekolah", "TK Pertiwi"),
        r("alamat_asal_sekolah", "Alamat asal sekolah", "Alamat TK/asal sekolah", "Jl. …"),
        r("no_sttb", "No. STTB/SK", "Nomor SK/STTB TK", "421.1/…"),
        r("tanggal_sttb", "Tanggal STTB/SK", "Tanggal SK/STTB TK", "20 Juni 2020"),
        r("mutasi_asal_sekolah", "Asal sekolah mutasi", "Sekolah asal saat mutasi masuk", "SDN 2 …"),
        r("mutasi_dari_kelas", "Dari kelas", "Kelas asal saat mutasi masuk", "Kelas II"),
        r("mutasi_diterima_tanggal", "Diterima tanggal", "Tanggal diterima mutasi", "1 Juli 2022"),
        r("mutasi_di_kelas", "Di kelas", "Kelas saat diterima", "Kelas III"),
      ],
    },
    {
      label: "Kesehatan",
      variables: [
        r("berat_badan", "Berat badan", "Berat badan terakhir (kg)", "32"),
        r("tinggi_badan", "Tinggi badan", "Tinggi badan terakhir (cm)", "138"),
        r("penyakit", "Penyakit", "Riwayat penyakit", "Asma"),
        r("kelainan_jasmani", "Kelainan jasmani", "Kelainan jasmani", "-"),
      ],
    },
    {
      label: "Beasiswa",
      variables: [
        r("jenis_beasiswa", "Jenis beasiswa", "Jenis beasiswa yang diterima siswa", "Beasiswa Prestasi"),
      ],
    },
    {
      label: "Kelulusan & meninggalkan sekolah",
      variables: [
        r("tamat_tahun", "Tamat tahun", "Tahun tamat", "2026"),
        r("tanggal_lulus", "Tanggal lulus", "Tanggal kelulusan", "20 Juni 2026"),
        r("kelas_terakhir", "Kelas terakhir", "Kelas terakhir", "Kelas VI"),
        r("nilai_rata_rata_akhir", "Nilai rata-rata", "Nilai rata-rata akhir", "85.5"),
        r("no_ijazah", "No. ijazah", "Nomor ijazah", "DN-…"),
        r("tanggal_ijazah", "Tanggal ijazah", "Tanggal ijazah", "20 Juni 2026"),
        r("no_skhun", "No. SKHUN", "Nomor SKHUN", "DN-…"),
        r("tanggal_skhun", "Tanggal SKHUN", "Tanggal SKHUN", "20 Juni 2026"),
        r("melanjutkan_ke", "Melanjutkan ke", "Sekolah lanjutan", "SMPN 1 …"),
        r("pindah_dari_kelas", "Pindah dari kelas", "Kelas asal saat pindah", "Kelas IV"),
        r("pindah_ke_kelas", "Pindah ke kelas", "Kelas tujuan saat pindah", "Kelas IV"),
        r("pindah_ke_sekolah", "Pindah ke sekolah", "Sekolah tujuan pindah", "SDN 3 …"),
        r("pindah_tanggal", "Pindah tanggal", "Tanggal pindah", "1 Agustus 2025"),
        r("keluar_tanggal", "Keluar tanggal", "Tanggal keluar/DO", "1 Agustus 2025"),
        r("alasan_keluar", "Alasan keluar", "Alasan keluar/DO", "Mengikuti orang tua"),
      ],
    },
    {
      label: "Lain-lain (alumni)",
      variables: [
        r("alamat_saat_ini", "Alamat saat ini", "Alamat terbaru alumni", "Jl. …"),
        r("telepon_saat_ini", "Telepon saat ini", "Telepon terbaru alumni", "0812…"),
        r("email", "Email", "Email alumni", "budi@…"),
        r("pendidikan_terakhir", "Pendidikan terakhir", "Pendidikan terakhir alumni", "SMA"),
        r("institusi_saat_ini", "Institusi saat ini", "Institusi/sekolah saat ini", "SMAN 1 …"),
        r("pekerjaan_saat_ini", "Pekerjaan saat ini", "Pekerjaan alumni", "Karyawan"),
        r("catatan", "Catatan", "Catatan bebas pada buku induk", "-"),
      ],
    },
    {
      label: "Nilai (loop {{#nilai}}…{{/nilai}})",
      variables: [
        r("kelas", "Kelas", "Kelas baris nilai", "Kelas I"),
        r("tahun_ajaran", "Tahun ajaran", "Tahun pelajaran baris nilai", "2020/2021"),
        r("mata_pelajaran", "Mata pelajaran", "Nama mata pelajaran", "Matematika"),
        r("semester", "Semester", "Ganjil / Genap", "Ganjil"),
        r("nilai", "Nilai", "Nilai angka", "88"),
        r("jumlah_nilai", "Jumlah nilai", "Jumlah nilai per mata pelajaran", "640"),
        r("nilai_rata_rata", "Nilai rata-rata mapel", "Rata-rata nilai per mata pelajaran", "85,5"),
        r("peringkat_kelas", "Peringkat kelas", "Peringkat kelas per mata pelajaran", "5"),
        r("kenaikan_kelas", "Kenaikan tingkat", "Naik / tidak naik tingkat", "Naik"),
      ],
    },
    {
      label: "Kehadiran (loop {{#kehadiran}}…{{/kehadiran}})",
      variables: [
        r("tahun_ajaran", "Tahun ajaran", "Tahun pelajaran baris kehadiran", "2025/2026"),
        r("kelas", "Kelas", "Kelas baris kehadiran", "Kelas VI"),
        r("hadir", "Hadir", "Jumlah hadir", "18"),
        r("sakit", "Sakit", "Jumlah sakit", "1"),
        r("izin", "Izin", "Jumlah izin", "0"),
        r("alpha", "Alpha", "Jumlah alpha", "1"),
      ],
    },
    {
      label: "Cetak",
      variables: [
        r("tanggal_cetak", "Tanggal cetak", "Tanggal file dibuat", "21 Oktober 2026"),
        r("tempat_ttd", "Tempat tanda tangan", "Kota/kabupaten dari alamat sekolah", "Kab. Indramayu"),
      ],
    },
  ],
};

/**
 * Modul lain: variabel dicatat sebagai rencana. Saat sistem template modul
 * ini dibuat, pindahkan ke status "siap" dan isi deskripsi lengkap.
 */
const RENCANA: FillVariableModule[] = [
  {
    module: "perpustakaan",
    label: "Perpustakaan (rencana)",
    groups: [
      {
        label: "Umum",
        variables: [
          v("sekolah_nama", "Nama sekolah", "Belum dieksekusi — sistem template modul belum ada", "SDN 1 Kenanga", "rencana"),
          v("tanggal_cetak", "Tanggal cetak", "Belum dieksekusi", "9 Oktober 2026", "rencana"),
        ],
      },
    ],
  },
];

export const FILL_VARIABLE_MODULES: FillVariableModule[] = [PRESENSI, SURAT, INVENTARIS, INVENTARIS_ATK, TABUNGAN, BUKU_INDUK, ...RENCANA];

/** Modul fill berdasarkan kode modul (undefined bila tak ada). */
export function getFillVariableModule(module: string | undefined): FillVariableModule | undefined {
  if (!module) return undefined;
  return FILL_VARIABLE_MODULES.find((m) => m.module === module);
}

/**
 * Nama variabel presensi yang dikenali `unknownVariables` —
 * satu sumber dengan kamus, agar tidak ada daftar hardcode terpisah.
 */
export const PRESENSI_KNOWN_VARIABLES: string[] = [
  ...PRESENSI.groups.flatMap((g) => g.variables.map((x) => x.name)),
  // Varian tanggal: tgl_1..tgl_31 (kamus memakai "tgl_N").
  ...Array.from({ length: 31 }, (_, i) => `tgl_${i + 1}`),
].sort();

/**
 * Nama variabel inventaris yang dikenali `unknownVariables` pada pengisian
 * template aset (.xlsx/.docx). Satu sumber dengan kamus.
 */
export const INVENTARIS_KNOWN_VARIABLES: string[] = [
  ...INVENTARIS.groups.flatMap((g) => g.variables.map((x) => x.name)),
].sort();

/**
 * Nama variabel tabungan yang dikenali `unknownTabunganVariables` pada
 * pengisian template (.xlsx). Satu sumber dengan kamus.
 */
export const TABUNGAN_KNOWN_VARIABLES: string[] = [
  ...TABUNGAN.groups.flatMap((g) => g.variables.map((x) => x.name)),
].sort();

/**
 * Nama variabel Inventaris ATK yang dikenali pada pengisian template (.xlsx).
 * Satu sumber dengan kamus.
 */
export const INVENTARIS_ATK_KNOWN_VARIABLES: string[] = [
  ...INVENTARIS_ATK.groups.flatMap((g) => g.variables.map((x) => x.name)),
].sort();
