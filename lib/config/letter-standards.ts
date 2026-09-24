/**
 * letter-standards.ts — Standar baku tata naskah dinas untuk editor surat modular.
 *
 * Sumber acuan:
 *  - Permendagri No. 83 Tahun 2022 tentang Tata Naskah Dinas Instansi Pemerintah
 *    di Lingkungan Pemerintah Daerah (font, ukuran, margin).
 *  - Praktik umum tata naskah dinas satuan pendidikan (Permendikbud/SK Kepsek).
 *
 * Prinsip: aturan baku disimpan sebagai DATA (bukan hardcode di komponen),
 * sehingga dapat ditimpa lewat Pengaturan bila sekolah punya kebijakan sendiri.
 *
 * CATATAN: file ini murni data + tipe + helper, tanpa dependensi React,
 * sehingga bisa dipakai di editor (klien) maupun renderer PDF.
 */

import { LETTER_TYPES, type LetterType } from "@/lib/constants/letter-types";

/** Mirip struktur kode klasifikasi (dipakai untuk memilih standar). */
export type LetterCategory =
  | "dinas" // surat dinas resmi ke luar (kop dinas)
  | "internal" // memo/nota internal ke warga sekolah
  | "tugas" // surat tugas / perintah / SK
  | "keterangan" // surat keterangan / pernyataan (sering untuk siswa)
  | "undangan" // undangan rapat/acara
  | "berita_acara" // berita acara / daftar hadir
  | "keuangan" // SPPD & dokumen keuangan
  | "lainnya";

export interface LetterTypography {
  /** Font utama isi surat. */
  fontFamily: string;
  /** Ukuran font isi (pt). */
  fontSize: number;
  /** Ukuran font kop (pt). */
  headerFontSize: number;
  /** Tinggi baris (multiplier). */
  lineHeight: number;
  /** Spasi antar paragraf (pt). */
  paragraphSpacing: number;
}

export interface LetterMargins {
  /** Milimeter. */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LetterStandard {
  /** Kategori naskah. */
  category: LetterCategory;
  /** Nama tampilan kategori. */
  categoryLabel: string;
  /** Deskripsi singkat untuk pemilihan di UI. */
  description: string;
  /** Tipografi baku. */
  typography: LetterTypography;
  /** Margin baku (mm). */
  margins: LetterMargins;
  /**
   * Urutan blok default (id blok dari letter-blocks.ts).
   * Blok yang tidak dicantumkan = opsional / harus ditambah manual.
   */
  defaultBlocks: string[];
}

// ─────────────────────────────────────────────
// Preset tipografi
// ─────────────────────────────────────────────

/** Surat dinas resmi: Arial 12, spasi 1.5 (Permendagri 83/2022). */
const TYPO_DINAS: LetterTypography = {
  fontFamily: "Arial",
  fontSize: 12,
  headerFontSize: 14,
  lineHeight: 1.5,
  paragraphSpacing: 0,
};

/** Surat internal/memo: Arial 11, spasi 1.15, lebih ringkas. */
const TYPO_INTERNAL: LetterTypography = {
  fontFamily: "Arial",
  fontSize: 11,
  headerFontSize: 12,
  lineHeight: 1.15,
  paragraphSpacing: 6,
};

/** Dokumen berciri resmi (SK, berita acara): Bookman Old Style 12 / spasi 1. */
const TYPO_RESMI: LetterTypography = {
  fontFamily: "Bookman Old Style",
  fontSize: 12,
  headerFontSize: 14,
  lineHeight: 1.15,
  paragraphSpacing: 0,
};

/** Keterangan / pernyataan siswa: Times New Roman 12. */
const TYPO_KETERANGAN: LetterTypography = {
  fontFamily: "Times New Roman",
  fontSize: 12,
  headerFontSize: 14,
  lineHeight: 1.5,
  paragraphSpacing: 0,
};

/** Margin baku naskah dinas (mm). */
const MARGIN_DINAS: LetterMargins = { top: 20, right: 20, bottom: 20, left: 30 };
const MARGIN_INTERNAL: LetterMargins = { top: 20, right: 20, bottom: 20, left: 20 };
const MARGIN_RESMI: LetterMargins = { top: 25, right: 25, bottom: 25, left: 30 };

// ─────────────────────────────────────────────
// Standar per kategori
// ─────────────────────────────────────────────

export const LETTER_STANDARDS: Record<LetterCategory, LetterStandard> = {
  dinas: {
    category: "dinas",
    categoryLabel: "Surat Dinas",
    description: "Surat resmi keluar dengan kop dinas. Arial 12, spasi 1,5.",
    typography: TYPO_DINAS,
    margins: MARGIN_DINAS,
    defaultBlocks: [
      "kop_surat",
      "tanggal",
      "nomor_perihal_lampiran",
      "tujuan",
      "salam_pembuka",
      "isi",
      "penutup",
      "tanggal_bawah",
      "tanda_tangan",
    ],
  },
  internal: {
    category: "internal",
    categoryLabel: "Memo / Nota Internal",
    description: "Komunikasi internal warga sekolah, tanpa kop dinas penuh.",
    typography: TYPO_INTERNAL,
    margins: MARGIN_INTERNAL,
    defaultBlocks: [
      "kop_surat",
      "judul_memo",
      "nomor_perihal_lampiran",
      "tujuan",
      "isi",
      "penutup",
      "tanggal_bawah",
      "tanda_tangan",
    ],
  },
  tugas: {
    category: "tugas",
    categoryLabel: "Surat Tugas / Perintah / SK",
    description: "Penugasan resmi. Bisa memuat tabel penugasan & modul SK.",
    typography: TYPO_RESMI,
    margins: MARGIN_RESMI,
    defaultBlocks: [
      "kop_surat",
      "judul",
      "nomor_perihal_lampiran",
      "isi",
      "tabel_penugasan",
      "tanggal_bawah",
      "tanda_tangan",
    ],
  },
  keterangan: {
    category: "keterangan",
    categoryLabel: "Surat Keterangan / Pernyataan",
    description: "Menerangkan data siswa (aktif, pindah, berkelakuan baik).",
    typography: TYPO_KETERANGAN,
    margins: MARGIN_RESMI,
    defaultBlocks: [
      "kop_surat",
      "judul",
      "nomor_perihal_lampiran",
      "isi",
      "tabel_data_siswa",
      "penutup",
      "tanggal_bawah",
      "tanda_tangan",
    ],
  },
  undangan: {
    category: "undangan",
    categoryLabel: "Surat Undangan",
    description: "Undangan rapat/acara, memuat pelaksanaan hari/tanggal.",
    typography: TYPO_DINAS,
    margins: MARGIN_DINAS,
    defaultBlocks: [
      "kop_surat",
      "nomor_perihal_lampiran",
      "tujuan",
      "salam_pembuka",
      "isi",
      "pelaksanaan_acara",
      "penutup",
      "tanggal_bawah",
      "tanda_tangan",
    ],
  },
  berita_acara: {
    category: "berita_acara",
    categoryLabel: "Berita Acara",
    description: "Risalah kejadian/rapat dengan penanda tangan pihak a & b.",
    typography: TYPO_RESMI,
    margins: MARGIN_RESMI,
    defaultBlocks: [
      "kop_surat",
      "judul",
      "nomor_perihal_lampiran",
      "isi",
      "tanda_tangan_ganda",
      "tanggal_bawah",
    ],
  },
  keuangan: {
    category: "keuangan",
    categoryLabel: "Dokumen Keuangan (SPPD)",
    description: "Surat Perintah Perjalanan Dinas & lampiran biaya.",
    typography: TYPO_RESMI,
    margins: MARGIN_RESMI,
    defaultBlocks: [
      "kop_surat",
      "judul",
      "nomor_perihal_lampiran",
      "isi",
      "tabel_penugasan",
      "pelaksanaan_acara",
      "tanggal_bawah",
      "tanda_tangan",
    ],
  },
  lainnya: {
    category: "lainnya",
    categoryLabel: "Lainnya",
    description: "Naskah bebas, susun blok sesuai kebutuhan.",
    typography: TYPO_DINAS,
    margins: MARGIN_DINAS,
    defaultBlocks: ["kop_surat", "judul", "isi", "tanggal_bawah", "tanda_tangan"],
  },
};

// ─────────────────────────────────────────────
// Pemetaan kategori → daftar jenis surat (dari letter-types)
// ─────────────────────────────────────────────

/** Menebak kategori standar dari kategori jenis surat yang tersimpan. */
export function resolveLetterCategory(kategori: string): LetterCategory {
  const k = (kategori || "").toLowerCase();
  if (k.includes("kepegawaian")) return "tugas";
  if (k.includes("kesiswaan")) return "keterangan";
  if (k.includes("akademik")) return "keterangan";
  if (k.includes("kurikulum")) return "dinas";
  if (k.includes("umum")) return "dinas";
  return "lainnya";
}

export interface LetterTypeOption {
  id: number;
  jenisSurat: string;
  kodeKlasifikasi: string;
  kategori: string;
  formatNomor: string;
  /** Kategori standar yang diterapkan. */
  standardCategory: LetterCategory;
}

/** Daftar jenis surat yang sudah diperkaya dengan kategori standarnya. */
export const LETTER_TYPE_OPTIONS: LetterTypeOption[] = LETTER_TYPES.map(
  (t: LetterType) => ({
    id: t.id,
    jenisSurat: t.jenis_surat,
    kodeKlasifikasi: t.kode_klasifikasi,
    kategori: t.kategori,
    formatNomor: t.format_nomor,
    standardCategory: resolveLetterCategory(t.kategori),
  })
);

/** Mengambil standar baku untuk sebuah kategori. */
export function getLetterStandard(category: LetterCategory): LetterStandard {
  return LETTER_STANDARDS[category] ?? LETTER_STANDARDS.lainnya;
}

/** Mengambil standar baku berdasarkan jenis surat (id). */
export function getStandardForLetterType(
  letterTypeId: number | null | undefined
): LetterStandard {
  const opt = LETTER_TYPE_OPTIONS.find((o) => o.id === letterTypeId);
  return getLetterStandard(opt?.standardCategory ?? "lainnya");
}
