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
  {
    module: "inventaris",
    label: "Inventaris (rencana)",
    groups: [
      {
        label: "Umum",
        variables: [
          v("sekolah_nama", "Nama sekolah", "Belum dieksekusi — sistem template modul belum ada", "SDN 1 Kenanga", "rencana"),
          v("tahun_ajaran", "Tahun ajaran", "Belum dieksekusi", "2026/2027", "rencana"),
        ],
      },
    ],
  },
];

export const FILL_VARIABLE_MODULES: FillVariableModule[] = [PRESENSI, SURAT, ...RENCANA];

/**
 * Nama variabel presensi yang dikenali `unknownVariables` —
 * satu sumber dengan kamus, agar tidak ada daftar hardcode terpisah.
 */
export const PRESENSI_KNOWN_VARIABLES: string[] = [
  ...PRESENSI.groups.flatMap((g) => g.variables.map((x) => x.name)),
  // Varian tanggal: tgl_1..tgl_31 (kamus memakai "tgl_N").
  ...Array.from({ length: 31 }, (_, i) => `tgl_${i + 1}`),
].sort();
