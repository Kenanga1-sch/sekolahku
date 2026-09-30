/**
 * report-variables.ts — Katalog variabel laporan per modul.
 *
 * Satu sumber kebenaran untuk:
 * - Tab "Variabel" di ribbon (filter modul + pencarian + klik sisip),
 * - validasi dataset saat mencetak,
 * - dokumentasi variabel yang tersedia bagi admin.
 *
 * Dua jenis variabel:
 * - `scope: "row"` — field per record; sel dirender berulang per baris dataset
 *   modul tersebut (`{field}` atau `{dataset.field}`).
 * - `scope: "rekap"` — nilai tunggal/agregat (`{{dataset.field}}`), dihitung
 *   modul penyedia lalu disuplai pemanggil via `global`/`datasets`.
 */

export type ReportVariableScope = "row" | "rekap";

export interface ReportVariableField {
  /** Nama token tanpa kurung, mis. "nama" atau "laporan.total_nilai". */
  token: string;
  label: string;
  /**
   * Untuk scope "row": field pada objek record.
   * Untuk scope "rekap": path pada namespace global (mis. "laporan.total_nilai").
   */
  key: string;
  /** Keterangan singkat yang tampil sebagai tooltip. */
  hint?: string;
  /** Contoh nilai (opsional, untuk preview pemahaman admin). */
  sample?: string;
}

export interface ReportVariableGroup {
  label: string;
  scope: ReportVariableScope;
  /** Nama dataset sumber (untuk scope row); default mengikuti modul. */
  dataset?: string;
  fields: ReportVariableField[];
}

export interface ReportVariableModule {
  /** Kode modul; "umum" untuk variabel sekolah/generik. */
  module: string;
  label: string;
  /** Kode template laporan default modul ini (bila ada). */
  reportCode?: string;
  groups: ReportVariableGroup[];
}

/** Helper: bikin field row (dataset) dari token. */
function row(dataset: string, key: string, label: string, hint?: string): ReportVariableField {
  return { token: `${dataset}.${key}`, key, label, hint };
}

/** Helper: bikin field rekap (global) dengan path lengkap. */
function rekap(key: string, label: string, hint?: string): ReportVariableField {
  return { token: key, key, label, hint };
}

export const REPORT_VARIABLE_MODULES: ReportVariableModule[] = [
  {
    module: "umum",
    label: "Umum & Sekolah",
    groups: [
      {
        label: "Identitas Sekolah",
        scope: "rekap",
        fields: [
          rekap("sekolah.schoolName", "Nama Sekolah"),
          rekap("sekolah.npsn", "NPSN"),
          rekap("sekolah.address", "Alamat"),
          rekap("sekolah.phone", "Telepon"),
          rekap("sekolah.email", "Email"),
          rekap("sekolah.website", "Website"),
          rekap("sekolah.governanceLine", "Baris Pemerintah"),
          rekap("sekolah.departmentLine", "Baris Dinas"),
          rekap("sekolah.logoUrl", "URL Logo"),
        ],
      },
      {
        label: "Kepala Sekolah & Laporan",
        scope: "rekap",
        fields: [
          rekap("principal.nama", "Nama Kepala Sekolah"),
          rekap("principal.nip", "NIP Kepala Sekolah"),
          rekap("principal.stampUrl", "URL Stempel"),
          rekap("laporan.periode", "Periode Laporan", "Diisi pemanggil saat cetak"),
          rekap("laporan.judul", "Judul Laporan", "Diisi pemanggil saat cetak"),
        ],
      },
    ],
  },
  {
    module: "inventaris",
    label: "Inventaris",
    reportCode: "RPT_INVENTARIS_HABIS_PAKAI",
    groups: [
      {
        label: "Baris Barang (ATK)",
        scope: "row",
        dataset: "data",
        fields: [
          row("data", "code", "Kode Barang"),
          row("data", "name", "Nama Barang"),
          row("data", "category", "Kategori"),
          row("data", "currentStock", "Stok Saat Ini"),
          row("data", "minStock", "Stok Minimum"),
          row("data", "unit", "Satuan"),
          row("data", "price", "Harga Satuan"),
          row("data", "nilai", "Nilai Persediaan"),
          row("data", "isLow", "Stok Rendah (boolean)"),
        ],
      },
      {
        label: "Baris Aset / Opname",
        scope: "row",
        dataset: "aset",
        fields: [
          row("aset", "code", "Kode Aset"),
          row("aset", "name", "Nama Aset"),
          row("aset", "category", "Kategori"),
          row("aset", "room", "Ruangan"),
          row("aset", "quantity", "Jumlah"),
          row("aset", "condition", "Kondisi"),
          row("aset", "unit", "Satuan"),
        ],
      },
      {
        label: "Ringkasan Inventaris",
        scope: "rekap",
        fields: [
          rekap("laporan.total_jenis", "Total Jenis Barang"),
          rekap("laporan.total_nilai", "Total Nilai Persediaan"),
          rekap("inventaris.total_aset", "Total Aset"),
        ],
      },
    ],
  },
  {
    module: "tabungan",
    label: "Tabungan",
    reportCode: "RPT_TABUNGAN_REKAP",
    groups: [
      {
        label: "Baris Transaksi",
        scope: "row",
        dataset: "data",
        fields: [
          row("data", "tanggal", "Tanggal"),
          row("data", "siswa", "Nama Siswa"),
          row("data", "kelas", "Kelas"),
          row("data", "tipe", "Jenis Transaksi"),
          row("data", "nominal", "Nominal"),
          row("data", "status", "Status"),
          row("data", "petugas", "Petugas"),
        ],
      },
      {
        label: "Mutasi Rekening Koran",
        scope: "row",
        dataset: "mutasi",
        fields: [
          row("mutasi", "tanggal", "Tanggal"),
          row("mutasi", "refId", "No. Referensi"),
          row("mutasi", "keterangan", "Keterangan"),
          row("mutasi", "debit", "Debit"),
          row("mutasi", "kredit", "Kredit"),
          row("mutasi", "saldo", "Saldo"),
        ],
      },
      {
        label: "Ringkasan Tabungan",
        scope: "rekap",
        fields: [
          rekap("laporan.total_saldo", "Total Saldo"),
          rekap("laporan.total_setoran", "Total Setoran"),
          rekap("laporan.total_penarikan", "Total Penarikan"),
          rekap("laporan.jumlah_siswa", "Jumlah Siswa"),
        ],
      },
    ],
  },
  {
    module: "siswa",
    label: "Siswa",
    groups: [
      {
        label: "Baris Siswa",
        scope: "row",
        dataset: "siswa",
        fields: [
          row("siswa", "nama", "Nama Siswa"),
          row("siswa", "nis", "NIS"),
          row("siswa", "nisn", "NISN"),
          row("siswa", "kelas", "Kelas"),
          row("siswa", "jenisKelamin", "Jenis Kelamin"),
          row("siswa", "tempatLahir", "Tempat Lahir"),
          row("siswa", "tanggalLahir", "Tanggal Lahir"),
          row("siswa", "alamat", "Alamat"),
        ],
      },
      {
        label: "Rekap per Kelas (agregat)",
        scope: "rekap",
        fields: [
          rekap("siswa.total", "Jumlah Siswa"),
          rekap("siswa.per_kelas", "Jumlah Siswa per Kelas"),
          rekap("siswa.laki_per_kelas", "Siswa Laki-laki per Kelas"),
          rekap("siswa.perempuan_per_kelas", "Siswa Perempuan per Kelas"),
        ],
      },
    ],
  },
  {
    module: "kepegawaian",
    label: "Kepegawaian",
    groups: [
      {
        label: "Baris Pegawai",
        scope: "row",
        dataset: "pegawai",
        fields: [
          row("pegawai", "nama", "Nama Pegawai"),
          row("pegawai", "nip", "NIP"),
          row("pegawai", "jabatan", "Jabatan"),
          row("pegawai", "unit", "Unit Kerja"),
          row("pegawai", "status", "Status Kepegawaian"),
          row("pegawai", "jenisKelamin", "Jenis Kelamin"),
        ],
      },
      {
        label: "Ringkasan Kepegawaian",
        scope: "rekap",
        fields: [
          rekap("kepegawaian.total", "Jumlah Pegawai"),
          rekap("kepegawaian.jumlah_guru", "Jumlah Guru"),
          rekap("kepegawaian.jumlah_staff", "Jumlah Staff"),
        ],
      },
    ],
  },
  {
    module: "presensi",
    label: "Presensi",
    reportCode: "RPT_PRESENSI_HARIAN",
    groups: [
      {
        label: "Baris Presensi Harian",
        scope: "row",
        dataset: "data",
        fields: [
          row("data", "tanggal", "Tanggal"),
          row("data", "kelas", "Kelas"),
          row("data", "nama", "Nama Siswa"),
          row("data", "nis", "NIS/NISN"),
          row("data", "status", "Status"),
          row("data", "waktu", "Waktu"),
          row("data", "metode", "Metode"),
        ],
      },
      {
        label: "Rekap Kehadiran",
        scope: "rekap",
        fields: [
          rekap("presensi.hadir", "Jumlah Hadir"),
          rekap("presensi.izin", "Jumlah Izin"),
          rekap("presensi.sakit", "Jumlah Sakit"),
          rekap("presensi.alpa", "Jumlah Alpa"),
        ],
      },
    ],
  },
  {
    module: "perpustakaan",
    label: "Perpustakaan",
    groups: [
      {
        label: "Baris Peminjaman",
        scope: "row",
        dataset: "data",
        fields: [
          row("data", "nama", "Nama Anggota"),
          row("data", "kelas", "Kelas"),
          row("data", "judul", "Judul Buku"),
          row("data", "tglPinjam", "Tanggal Pinjam"),
          row("data", "jatuhTempo", "Jatuh Tempo"),
          row("data", "tglKembali", "Tanggal Kembali"),
          row("data", "status", "Status"),
          row("data", "denda", "Denda"),
        ],
      },
      {
        label: "Ringkasan Perpustakaan",
        scope: "rekap",
        fields: [
          rekap("perpustakaan.total_pinjam", "Total Peminjaman"),
          rekap("perpustakaan.total_kunjungan", "Total Kunjungan"),
          rekap("perpustakaan.terlambat", "Jumlah Terlambat"),
        ],
      },
    ],
  },
  {
    module: "arsip",
    label: "Arsip & Surat",
    groups: [
      {
        label: "Buku Agenda Surat",
        scope: "row",
        dataset: "data",
        fields: [
          row("data", "noAgenda", "No. Agenda"),
          row("data", "noSurat", "No. Surat"),
          row("data", "tanggal", "Tanggal"),
          row("data", "asal", "Asal/Tujuan"),
          row("data", "perihal", "Perihal"),
        ],
      },
    ],
  },
  {
    module: "spmb",
    label: "SPMB (Pendaftaran)",
    groups: [
      {
        label: "Baris Pendaftar",
        scope: "row",
        dataset: "data",
        fields: [
          row("data", "noPendaftaran", "No. Pendaftaran"),
          row("data", "nama", "Nama Pendaftar"),
          row("data", "nik", "NIK"),
          row("data", "jenisKelamin", "Jenis Kelamin"),
          row("data", "sekolahAsal", "Sekolah Asal"),
          row("data", "ayah", "Nama Ayah"),
          row("data", "ibu", "Nama Ibu"),
          row("data", "status", "Status"),
        ],
      },
      {
        label: "Ringkasan SPMB",
        scope: "rekap",
        fields: [rekap("spmb.total_pendaftar", "Total Pendaftar")],
      },
    ],
  },
];

/** Ambil definisi modul berdasarkan kode; fallback ke "umum". */
export function getVariableModule(module: string | undefined): ReportVariableModule {
  return REPORT_VARIABLE_MODULES.find((m) => m.module === module) ?? REPORT_VARIABLE_MODULES[0];
}

/** Ambil modul yang cocok dengan kategori template (case-insensitive). */
export function findModuleByLabel(label: string | undefined): ReportVariableModule | undefined {
  if (!label) return undefined;
  const norm = label.trim().toLowerCase();
  return REPORT_VARIABLE_MODULES.find(
    (m) => m.module === norm || m.label.toLowerCase() === norm,
  );
}

/** Semua token yang tersedia untuk sebuah modul (row + rekap). */
export function tokensForModule(module: string | undefined): string[] {
  const def = getVariableModule(module);
  const out: string[] = [];
  for (const g of def.groups) {
    for (const f of g.fields) {
      out.push(g.scope === "row" ? `{${f.token}}` : `{{${f.token}}}`);
    }
  }
  return out;
}

/** Semua nama dataset yang dipakai sebuah modul (untuk validasi saat cetak). */
export function datasetNamesForModule(module: string | undefined): string[] {
  const def = getVariableModule(module);
  const names = new Set<string>();
  for (const g of def.groups) {
    if (g.scope === "row") names.add(g.dataset || "data");
  }
  return Array.from(names);
}
