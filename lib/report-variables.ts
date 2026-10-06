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

import { ENGINE_FUNCTIONS } from "./report-engine-v3";

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
    reportCode: "RPT_PRESENSI_BULANAN_XLSX",
    groups: [
      {
        label: "Info Laporan (tulis persis {{...}} di sel mana pun)",
        scope: "rekap",
        fields: [
          rekap("kelas", "Kelas", "mis. Kelas 1A"),
          rekap("bulan", "Bulan", "mis. Oktober"),
          rekap("tahun", "Tahun", "mis. 2026"),
          rekap("tahun_ajaran", "Tahun Pelajaran", "mis. 2026/2027"),
          rekap("hari_efektif", "Hari Efektif", "jumlah hari efektif bulan itu"),
          rekap("tanggal_cetak", "Tanggal Cetak"),
          rekap("tempat_ttd", "Tempat TTD", "mis. Indramayu"),
          rekap("wali_kelas_nama", "Nama Wali Kelas"),
          rekap("wali_kelas_nip", "NIP Wali Kelas"),
          rekap("kepala_sekolah_nama", "Nama Kepala Sekolah", "dari pengaturan sekolah"),
          rekap("kepala_sekolah_nip", "NIP Kepala Sekolah", "dari pengaturan sekolah"),
          rekap("sekolah_nama", "Nama Sekolah", "dari pengaturan sekolah"),
          rekap("sekolah_alamat", "Alamat Sekolah", "dari pengaturan sekolah"),
          rekap("sekolah_telepon", "Telepon Sekolah", "dari pengaturan sekolah"),
        ],
      },
      {
        label: "Baris Siswa (satu baris contoh → direplikasi per siswa)",
        scope: "row",
        dataset: "siswa",
        fields: [
          row("siswa", "no", "Nomor Urut", "otomatis 1, 2, 3…"),
          row("siswa", "nama", "Nama Siswa"),
          row("siswa", "nis", "NIS"),
          row("siswa", "nisn", "NISN"),
          row("siswa", "tgl_1", "Status tgl 1 (H/S/I/A)", "tgl_1 … tgl_31 tersedia"),
          row("siswa", "total_h", "Total Hadir", "atau rumus =COUNTIF(...)"),
          row("siswa", "total_s", "Total Sakit"),
          row("siswa", "total_i", "Total Izin"),
          row("siswa", "total_a", "Total Alpha"),
          row("siswa", "persen", "% Kehadiran"),
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

// ── Formula templates (sumber tunggal) ───────────────────────────────

/** Satu entri template rumus yang bisa disisipkan dari ribbon. */
export interface FormulaTemplate {
  label: string;
  expr: string;
  hint: string;
}

/**
 * Katalog template rumus, dibangun otomatis dari ENGINE_FUNCTIONS pada
 * report-engine-v3. Dengan begitu, fungsi yang benar-benar didukung engine
 * selalu tersedia di UI tanpa duplikasi daftar manual.
 */
export const FORMULA_TEMPLATES: FormulaTemplate[] = ENGINE_FUNCTIONS.map((fn) => ({
  label: fn.name,
  expr: fn.template,
  hint: fn.hint,
}));

// ── Variabel global (umum) ───────────────────────────────────────────

/** Sampel variabel global/skala yang lazim dipakai di semua modul. */
export interface ReportVariableSample {
  label: string;
  token: string;
  hint?: string;
}

export const GENERAL_VARS: ReportVariableSample[] = [
  { label: "Nama Sekolah", token: "{{sekolah.schoolName}}", hint: "dari pengaturan sekolah" },
  { label: "Alamat", token: "{{sekolah.address}}", hint: "dari pengaturan sekolah" },
  { label: "Kepala Sekolah", token: "{{principal.nama}}", hint: "dari pengaturan sekolah" },
  { label: "NIP Kepsek", token: "{{principal.nip}}", hint: "dari pengaturan sekolah" },
  { label: "Periode", token: "{{laporan.periode}}", hint: "diisi pemanggil" },
  { label: "Total Nominal", token: "{{laporan.total_nominal}}", hint: "diisi pemanggil" },
];

/**
 * Sumber tunggal untuk katalog di ribbon: modul variabel, variabel global,
 * dan template rumus. Dipakai agar UI selalu sinkron dengan katalog modul.
 */
export function listVars(): {
  generalVars: ReportVariableSample[];
  modules: ReportVariableModule[];
  formulaTemplates: FormulaTemplate[];
} {
  return {
    generalVars: GENERAL_VARS,
    modules: REPORT_VARIABLE_MODULES,
    formulaTemplates: FORMULA_TEMPLATES,
  };
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
