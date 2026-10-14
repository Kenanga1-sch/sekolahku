/**
 * Kamus variabel template laporan — satu sumber untuk:
 *   - `unknownVariables` (presensi-excel.ts) agar daftar variabel tak
 *     dikenal selalu sinkron,
 *   - halaman admin `/admin/kamus-variabel` (tab per modul).
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
        v("=…", "Formula hidup", "Sel diawali = di template tetap jadi formula; referensi baris contoh digeser otomatis ke baris aset", "=SUM(G8:G12)"),
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
    module: "tabungan",
    label: "Tabungan (rencana)",
    groups: [
      {
        label: "Umum",
        variables: [
          v("sekolah_nama", "Nama sekolah", "Belum dieksekusi — sistem template modul belum ada", "SDN 1 Kenanga", "rencana"),
          v("bulan", "Bulan", "Belum dieksekusi", "Oktober", "rencana"),
          v("siswa_nama", "Nama siswa", "Belum dieksekusi", "Budi Santoso", "rencana"),
          v("nis", "NIS", "Belum dieksekusi", "100123", "rencana"),
        ],
      },
    ],
  },
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

export const FILL_VARIABLE_MODULES: FillVariableModule[] = [PRESENSI, SURAT, INVENTARIS, ...RENCANA];

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
