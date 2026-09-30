/**
 * report-blocks.ts — Skema blok modular pembuat laporan dinamis.
 */

export type ReportBlockValue = string | number | boolean | null | undefined;
export type ReportBlockData = Record<string, any>;

export interface ReportBlockInstance {
  instanceId: string;
  blockId: string;
  enabled: boolean;
  data: ReportBlockData;
}

export type ReportBlockGroup =
  | "kop"
  | "header"
  | "kpi"
  | "tabel"
  | "penutup"
  | "tanda_tangan";

export const REPORT_BLOCK_GROUPS: { id: ReportBlockGroup; label: string }[] = [
  { id: "kop", label: "Kop & Kepala" },
  { id: "header", label: "Judul & Filter" },
  { id: "kpi", label: "Kartu Ringkasan" },
  { id: "tabel", label: "Tabel Data" },
  { id: "penutup", label: "Catatan Penutup" },
  { id: "tanda_tangan", label: "Tanda Tangan" },
];

export interface ReportColumnConfig {
  key: string;
  label: string;
  width?: number; // lebar % atau px
  align?: "left" | "center" | "right";
  format?: "text" | "number" | "rupiah" | "date" | "badge";
  autoSum?: boolean; // Tampilkan total/auto-sum di baris footer tabel
  colSpan?: number; // Gabungkan sel ke kanan (merge cell)
  rowSpan?: number; // Gabungkan sel ke bawah (merge cell)
  hidden?: boolean; // Sembunyikan kolom dari tabel
}

export interface ReportTableSection {
  id: string;
  title: string; // Judul baris header grup (spanning seluruh kolom)
  keys: string[]; // key kolom yang berada di bawah grup ini
}

export interface ReportKPIItemConfig {
  label: string;
  key: string;
  format?: "text" | "number" | "rupiah";
}

export interface ReportBlockDefinition {
  id: string;
  label: string;
  description: string;
  group: ReportBlockGroup;
  fields: {
    key: string;
    label: string;
    type: "text" | "textarea" | "select" | "number" | "columns_config" | "kpi_config" | "sections_config";
    defaultValue?: any;
    options?: { value: string; label: string }[];
  }[];
}

export const REPORT_BLOCK_DEFINITIONS: ReportBlockDefinition[] = [
  {
    id: "kop_laporan",
    label: "Kop Laporan",
    description: "Kop instansi/sekolah (otomatis dari Pengaturan Sekolah).",
    group: "kop",
    fields: [
      {
        key: "variant",
        label: "Gaya Kop",
        type: "select",
        defaultValue: "pemerintah",
        options: [
          { value: "pemerintah", label: "Pemerintah Daerah (Pemda → Dinas → Sekolah)" },
          { value: "sekolah", label: "Nama Sekolah Saja" },
          { value: "logo_kanan", label: "Logo di Kanan" },
        ],
      },
    ],
  },
  {
    id: "judul_laporan",
    label: "Judul & Subjudul Laporan",
    description: "Header judul laporan (mis. LAPORAN REKAPITULASI TABUNGAN).",
    group: "header",
    fields: [
      { key: "judul", label: "Judul Utama", type: "text", defaultValue: "LAPORAN REKAPITULASI" },
      { key: "subjudul", label: "Subjudul / Periode", type: "text", defaultValue: "Periode Laporan" },
    ],
  },
  {
    id: "metadata_filter",
    label: "Informasi Filter / Parameter",
    description: "Daftar filter laporan (mis. Kelas: 8A, Tanggal: Jan 2026).",
    group: "header",
    fields: [
      { key: "keterangan", label: "Keterangan Filter", type: "textarea", defaultValue: "Kelas: Semua | Status: Aktif" },
    ],
  },
  {
    id: "ringkasan_kpi",
    label: "Kartu Ringkasan (KPI Cards)",
    description: "2–4 kotak statistik ringkasan di atas tabel.",
    group: "kpi",
    fields: [
      {
        key: "items",
        label: "Daftar Ringkasan KPI",
        type: "kpi_config",
        defaultValue: [
          { label: "Total Data", key: "total_items", format: "number" },
          { label: "Total Nominal", key: "total_nominal", format: "rupiah" },
        ],
      },
    ],
  },
  {
    id: "tabel_laporan",
    label: "Tabel Data Dinamis",
    description: "Tabel data berulang dengan pengatur kolom & Auto-Sum.",
    group: "tabel",
    fields: [
      {
        key: "title",
        label: "Judul Tabel (opsional)",
        type: "text",
        defaultValue: "",
      },
      {
        key: "columns",
        label: "Konfigurasi Kolom Tabel",
        type: "columns_config",
        defaultValue: [
          { key: "no", label: "No", width: 30, align: "center", format: "text" },
          { key: "nama", label: "Nama", width: 150, align: "left", format: "text" },
          { key: "jumlah", label: "Jumlah", width: 100, align: "right", format: "rupiah", autoSum: true },
        ],
      },
      {
        key: "sections",
        label: "Header Grup (Merge Cell)",
        type: "sections_config",
        defaultValue: [],
      },
      {
        key: "showFooter",
        label: "Tampilkan Baris TOTAL",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Otomatis (bila ada Auto-Sum)" },
          { value: "true", label: "Selalu" },
          { value: "false", label: "Tidak" },
        ],
      },
    ],
  },
  {
    id: "catatan_penutup",
    label: "Catatan Penutup",
    description: "Teks atau instruksi di bawah tabel.",
    group: "penutup",
    fields: [
      { key: "text", label: "Catatan", type: "textarea", defaultValue: "Laporan ini dicetak secara otomatis oleh sistem Sekolahku." },
    ],
  },
  {
    id: "tanda_tangan",
    label: "Tanda Tangan (Tunggal)",
    description: "Satu pihak penanda tangan (Kepala Sekolah/Bendahara).",
    group: "tanda_tangan",
    fields: [
      { key: "jabatan", label: "Jabatan", type: "text", defaultValue: "Kepala Sekolah" },
      { key: "nama", label: "Nama", type: "text" },
      { key: "nip", label: "NIP", type: "text" },
      { key: "show_stamp", label: "Tampilkan Stempel", type: "select", defaultValue: "false", options: [
        { value: "false", label: "Tidak" },
        { value: "true", label: "Ya" },
      ] },
    ],
  },
  {
    id: "tanda_tangan_ganda",
    label: "Tanda Tangan (Ganda)",
    description: "Dua pihak penanda tangan (Bersebelahan atau Bertingkat).",
    group: "tanda_tangan",
    fields: [
      {
        key: "layout",
        label: "Tata Letak",
        type: "select",
        defaultValue: "bersebelahan",
        options: [
          { value: "bersebelahan", label: "Bersebelahan (Sejajar Kiri - Kanan)" },
          { value: "bertingkat", label: "Bertingkat (Kiri di Atas, Mengetahui di Bawah)" },
        ],
      },
      { key: "kiri_jabatan", label: "Jabatan Kiri / Pihak I", type: "text", defaultValue: "Pengelola" },
      { key: "kiri_nama", label: "Nama Kiri", type: "text" },
      { key: "kiri_nip", label: "NIP Kiri", type: "text" },
      { key: "kanan_jabatan", label: "Jabatan Kanan / Mengetahui", type: "text", defaultValue: "Kepala Sekolah" },
      { key: "kanan_nama", label: "Nama Kanan", type: "text" },
      { key: "kanan_nip", label: "NIP Kanan", type: "text" },
      { key: "show_stamp", label: "Stempel di Kanan", type: "select", defaultValue: "false", options: [
        { value: "false", label: "Tidak" },
        { value: "true", label: "Ya" },
      ] },
    ],
  },
];

export const REPORT_BLOCK_MAP = Object.fromEntries(REPORT_BLOCK_DEFINITIONS.map((b) => [b.id, b]));

export function getReportBlockDefinition(id: string): ReportBlockDefinition | undefined {
  return REPORT_BLOCK_MAP[id];
}

let instanceCounter = 0;
export function createReportBlockInstance(blockId: string): ReportBlockInstance | null {
  const def = getReportBlockDefinition(blockId);
  if (!def) return null;
  instanceCounter += 1;
  const data: ReportBlockData = {};
  for (const f of def.fields) {
    data[f.key] = f.defaultValue !== undefined ? f.defaultValue : "";
  }
  return {
    instanceId: `${blockId}-${Date.now().toString(36)}-${instanceCounter}`,
    blockId,
    enabled: true,
    data,
  };
}
