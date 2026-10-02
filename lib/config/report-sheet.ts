/**
 * report-sheet.ts — Model dokumen format laporan berbasis sel (schema v3).
 *
 * Konsep: modul ini adalah mesin pembuat FORMAT laporan. Admin menata grid
 * sel (ala Excel) dan menaruh variabel; modul lain memanggil format dan
 * mengisi variabel dengan data. Satu record = satu baris.
 */

import type {
  ReportPaperSize,
  ReportOrientation,
  ReportDensity,
  ReportMarginConfig,
  ReportDensityConfig,
} from "@/lib/config/report-document";

export type { ReportPaperSize, ReportOrientation, ReportDensity, ReportMarginConfig, ReportDensityConfig };

export const REPORT_SHEET_SCHEMA_VERSION = 3;

export type CellAlign = "left" | "center" | "right";
export type CellVertical = "top" | "middle" | "bottom";
export type CellFormat = "text" | "number" | "rupiah" | "date";
/**
 * Preset border sel.
 *
 * - `all`  = garis di keempat sisi sel.
 * - `none` = tanpa garis.
 * - `box`  = box = all border untuk saat ini. Model sel (SheetCell) tidak
 *   menyimpan konteks blok, sehingga "hanya sisi luar blok" tak bisa dihitung
 *   di renderer; preset ini dirender sama dengan `all`. Sisi luar blok tetap
 *   bisa dibuat manual lewat border per-sisi (`borderTop` & kawan-kawan).
 */
export type CellBorder = "none" | "all" | "box";

/**
 * Ketebalan border sel (pt). Grid editor menggambar 0.75px @96dpi = 0.5625pt;
 * nilainya dibulatkan ke 0.5pt agar garis di layar & cetak sama tebal dan
 * tidak menghasilkan garis pecahan (hairline) yang tampak "berantakan" saat
 * PDF dipotong antar halaman. Sumber kebenaran tunggal untuk PDF & pratinjau.
 */
export const BOARD_WIDTH_PT = 0.5;

/**
 * Font yang tersedia untuk sel.
 * - Tiga pertama = font bawaan PDF (tanpa registrasi).
 * - "Arial"/"Bookman Old Style" dibundel sebagai file di public/fonts
 *   (Liberation Sans = metrik kompatibel Arial; URW Bookman ≈ Bookman Old Style).
 * - "Liberation Serif" = metrik kompatibel Times New Roman.
 */
export type ReportFontFamily =
  | "Helvetica"
  | "Times-Roman"
  | "Courier"
  | "Arial"
  | "Bookman Old Style"
  | "Liberation Serif";

/**
 * Satu sel pada grid. `value` menyimpan input mentah yang bisa berupa:
 * - teks statis: "Nama"
 * - variabel scalar: "{{laporan.periode}}"
 * - variabel list: "{nama_siswa}" atau "{items.saldo}"
 * - rumus: "=SUM(C2:C5)"
 */
export interface SheetCell {
  value?: string;
  colSpan?: number;
  rowSpan?: number;
  align?: CellAlign;
  vertical?: CellVertical;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontFamily?: ReportFontFamily;
  fontSize?: number;
  format?: CellFormat;
  bg?: string;
  color?: string;
  border?: CellBorder;
  /** Border per sisi (menimpa `border` bila ada). */
  borderTop?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
  borderRight?: boolean;
  /** Warna border (default #94a3b8 bila kosong). */
  borderColor?: string;
  /** Teks panjang turun baris di dalam sel. */
  wrap?: boolean;
  /** Indentasi teks (px). */
  indent?: number;
  /** Rotasi teks (derajat, umum: 0/45/90). */
  rotation?: number;
  /** Override manual: baris ini dipaksa menjadi baris template berulang. */
  repeatZone?: boolean;
}

/** Key sparse map untuk sel: "r,c" (0-indexed). */
export type CellKey = string;

export function cellKey(r: number, c: number): CellKey {
  return `${r},${c}`;
}

export function parseCellKey(key: CellKey): { r: number; c: number } | null {
  const m = /^(\d+),(\d+)$/.exec(key);
  if (!m) return null;
  return { r: Number(m[1]), c: Number(m[2]) };
}

export interface ReportSheet {
  id: string;
  name: string;
  cols: number;
  colWidths: number[];
  cells: Record<CellKey, SheetCell>;
  /**
   * Nama dataset yang mengisi baris berulang lembar ini. Default `DEFAULT_DATASET`
   * ("data"). Memungkinkan satu laporan mengambil baris dari modul berbeda per
   * lembar (mis. lembar data siswa vs lembar data aset).
   */
  datasetName?: string;
  /** Tinggi baris eksplisit (pt) per indeks baris editor; opsional. */
  rowHeights?: Record<number, number>;
  /** Aturan conditional formatting (warna berdasar nilai). */
  conditionals?: ConditionalRule[];
  /** Shape mengambang (garis, kotak, elips) — tidak terikat sel. */
  shapes?: ReportShape[];
  /** Gambar mengambang (logo, foto, materai) — tidak terikat sel, ikut tercetak. */
  images?: ReportImage[];
}

export type ReportShapeType = "line" | "rect" | "ellipse";

/**
 * Shape mengambang pada lembar. Koordinat & ukuran dalam pt relatif terhadap
 * sudut kiri-atas area konten (setelah margin), sehingga posisinya ikut saat
 * skala/pratinjau berubah. Tidak terikat sel (seperti "in front of text").
 */
export interface ReportShape {
  id: string;
  type: ReportShapeType;
  /** Posisi kiri-atas (pt) relatif area konten. */
  x: number;
  y: number;
  /** Ukuran (pt). Untuk garis, height boleh 0 (garis horizontal). */
  width: number;
  height: number;
  /** Warna isian. Kosong/transparan = tanpa isian (untuk garis pemisah). */
  fill?: string;
  /** Warna garis tepi / garis. */
  stroke?: string;
  /** Ketebalan garis (pt). */
  strokeWidth?: number;
  /** Rotasi (derajat), umum untuk garis diagonal. */
  rotation?: number;
}

/**
 * Gambar mengambang pada lembar (logo, foto, materai). Seperti shape: koordinat
 * & ukuran dalam pt relatif area konten, tidak terikat sel, dan ikut tercetak.
 */
export interface ReportImage {
  id: string;
  /** URL gambar (hasil upload atau data URL). */
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotasi (derajat). */
  rotation?: number;
}

export type ConditionalOp = "gt" | "lt" | "gte" | "lte" | "eq" | "neq" | "contains" | "notEmpty";

export interface ConditionalRule {
  /** Kolom sasaran (0-indexed). */
  col: number;
  op: ConditionalOp;
  value?: string | number;
  /** Warna latar bila terpenuhi. */
  bg?: string;
  /** Warna teks bila terpenuhi. */
  color?: string;
}

export interface ReportWorkbook {
  schemaVersion: number;
  reportCode?: string;
  reportName?: string;
  category?: string;
  /** Modul peruntukan format ("umum" bila generik). */
  module?: string;
  paperSize: ReportPaperSize;
  orientation: ReportOrientation;
  showFooter: boolean;
  density: ReportDensity;
  margin: ReportMarginConfig;
  typography: ReportDensityConfig;
  headerRepeat: boolean;
  /**
   * Skala cetak (persen, 1 = 100%). Hanya memengaruhi RENDER cetak (PDF),
   * tidak mengubah lebar kolom model — ala "Scale to fit" Excel. Bersifat
   * opsional; default 1.
   */
  printScale?: number;
  /**
   * Deklarasi dataset yang dipakai laporan (satu per modul/sumber). Data
   * sesungguhnya disuplai pemanggil saat cetak; ini hanya metadata untuk UI
   * (nama, label, modul) dan validasi.
   */
  datasets?: ReportDatasetRef[];
  sheets: ReportSheet[];
}

/**
 * Deklarasi satu dataset pada workbook. `name` dipakai sebagai namespace di
 * dalam sel (`sheet.datasetName` dan `{name.field}`), `module` menandai sumber.
 */
export interface ReportDatasetRef {
  name: string;
  label: string;
  module?: string;
}

/** Nama dataset default untuk laporan satu-sumber (backward-compatible). */
export const DEFAULT_DATASET = "data";

let sheetCounter = 0;
export function createSheetId(): string {
  sheetCounter += 1;
  return `sheet-${Date.now().toString(36)}-${sheetCounter}`;
}

export const DEFAULT_SHEET_COLS = 6;
export const DEFAULT_SHEET_ROWS = 30;

/** Lebar kolom default (px absolut) dan batasnya. */
export const DEFAULT_COL_WIDTH_PX = 96;
export const MIN_COL_WIDTH_PX = 40;
export const MAX_COL_WIDTH_PX = 600;

/**
 * Konversi px (CSS @96dpi) → pt (tipografi). Dipakai agar PDF mencetak kolom
 * dengan lebar sebenarnya (1px = 0.75pt), bukan dipaksa memenuhi lebar kertas.
 */
export const PX_TO_PT = 72 / 96;
export const PT_TO_PX = 96 / 72;

export function defaultColWidths(cols: number, equal = DEFAULT_COL_WIDTH_PX): number[] {
  return Array.from({ length: Math.max(1, cols) }, () => equal);
}

export function createSheet(opts?: {
  id?: string;
  name?: string;
  cols?: number;
  colWidths?: number[];
  cells?: Record<CellKey, SheetCell>;
  datasetName?: string;
  rowHeights?: Record<number, number>;
  shapes?: ReportShape[];
  images?: ReportImage[];
}): ReportSheet {
  const cols = Math.max(1, Math.floor(opts?.cols ?? DEFAULT_SHEET_COLS));
  return {
    id: opts?.id || createSheetId(),
    name: opts?.name || "Lembar 1",
    cols,
    colWidths: opts?.colWidths && opts.colWidths.length === cols ? [...opts.colWidths] : defaultColWidths(cols),
    cells: opts?.cells || {},
    ...(opts?.datasetName ? { datasetName: opts.datasetName } : {}),
    ...(opts?.rowHeights ? { rowHeights: { ...opts.rowHeights } } : {}),
    ...(opts?.shapes ? { shapes: [...opts.shapes] } : {}),
    ...(opts?.images ? { images: [...opts.images] } : {}),
  };
}

/**
 * Tinggi baris eksplisit (pt). `undefined` = belum di-set (pakai auto), `0` =
 * baris disembunyikan (ala Excel/LibreOffice), nilai > 0 = tinggi eksplisit.
 */
export function rowHeightAt(sheet: ReportSheet, r: number): number | undefined {
  const h = sheet.rowHeights?.[r];
  return typeof h === "number" ? h : undefined;
}

/** True bila baris disembunyikan (tinggi eksplisit 0). */
export function isRowHidden(sheet: ReportSheet, r: number): boolean {
  return sheet.rowHeights?.[r] === 0;
}

/** True bila kolom disembunyikan (lebar eksplisit 0). */
export function isColHidden(sheet: ReportSheet, c: number): boolean {
  return sheet.colWidths?.[c] === 0;
}

/** Satu sel teks sederhana dengan gaya bold (helper pembuatan). */
export function textCell(value: string, style?: Partial<SheetCell>): SheetCell {
  return { value, ...style };
}

let shapeCounter = 0;
/** Buat shape baru dengan id unik dan default yang masuk akal. */
export function createShape(type: ReportShapeType, pos?: Partial<ReportShape>): ReportShape {
  shapeCounter += 1;
  const defaults: Record<ReportShapeType, Omit<ReportShape, "id" | "type">> = {
    line: { x: 0, y: 0, width: 200, height: 0, stroke: "#000000", strokeWidth: 1 },
    rect: { x: 0, y: 0, width: 100, height: 60, stroke: "#000000", strokeWidth: 1, fill: "" },
    ellipse: { x: 0, y: 0, width: 80, height: 80, stroke: "#000000", strokeWidth: 1, fill: "" },
  };
  return { id: `shape-${Date.now().toString(36)}-${shapeCounter}`, type, ...defaults[type], ...pos };
}

let imageCounter = 0;
/** Buat gambar mengambang baru. */
export function createImage(src: string, pos?: Partial<ReportImage>): ReportImage {
  imageCounter += 1;
  return { id: `image-${Date.now().toString(36)}-${imageCounter}`, src, x: 0, y: 0, width: 80, height: 80, ...pos };
}

/**
 * Lebar kolom (px absolut) untuk kolom ke-i. `undefined` = default, `0` =
 * disembunyikan (ala Excel/LibreOffice), nilai > 0 = lebar eksplisit.
 */
export function colWidthPx(sheet: ReportSheet, c: number): number {
  const w = sheet.colWidths?.[c];
  return typeof w === "number" ? Math.max(0, w) : DEFAULT_COL_WIDTH_PX;
}

/** Lebar kolom (pt) untuk kolom ke-i — untuk render PDF. */
export function colWidthPt(sheet: ReportSheet, c: number): number {
  return colWidthPx(sheet, c) * PX_TO_PT;
}

/** Skala cetak efektif workbook (1 = 100%). Nilai tidak valid → 1. */
export function printScaleOf(wb: ReportWorkbook): number {
  const s = wb.printScale;
  return typeof s === "number" && s > 0 ? s : 1;
}

/** Daftar lebar kolom absolut (px) untuk seluruh kolom. */
export function absoluteColWidths(sheet: ReportSheet): number[] {
  const cols = Math.max(1, sheet.cols);
  return Array.from({ length: cols }, (_, i) => colWidthPx(sheet, i));
}

/** Total lebar seluruh kolom (px absolut). */
export function totalColWidthPx(sheet: ReportSheet): number {
  return absoluteColWidths(sheet).reduce((a, b) => a + b, 0);
}

/** Total lebar seluruh kolom (pt) — lebar tabel apa adanya (tanpa skala kertas). */
export function totalColWidthPt(sheet: ReportSheet): number {
  return totalColWidthPx(sheet) * PX_TO_PT;
}

/**
 * Lebar kolom untuk CETAK (pt), lebar absolut apa adanya (px × 0.75). Renderer
 * TIDAK meregangkan kolom: apa yang didesain = apa yang dicetak (perilaku
 * Excel/LibreOffice). Kolom yang melewati tepi kanan dipotong via
 * `visibleColumnCount`.
 */
export function printedColWidthsPt(sheet: ReportSheet): number[] {
  const cols = Math.max(1, sheet.cols);
  return Array.from({ length: cols }, (_, c) => colWidthPt(sheet, c));
}

/**
 * Jumlah kolom yang (setidaknya sebagian) muat dalam lebar konten kertas.
 * Kolom yang titik awalnya sudah melewati tepi kanan tidak dicetak — ala Print
 * Area Excel. Minimal 1 kolom agar sheet tak pernah kosong. Kolom yang
 * disembunyikan (lebar 0) dilewati dan tidak dihitung.
 */
export function visibleColumnCount(sheet: ReportSheet, contentWidthPt?: number): number {
  const cols = Math.max(1, sheet.cols);
  if (!contentWidthPt || contentWidthPt <= 0) return cols;
  let acc = 0;
  let last = 1;
  for (let c = 0; c < cols; c++) {
    const w = colWidthPt(sheet, c);
    if (acc + 1e-6 >= contentWidthPt) return Math.max(1, c);
    acc += w;
    last = c + 1;
  }
  return Math.max(1, last);
}

/**
 * @deprecated Model baru memakai px absolut (`absoluteColWidths`). Fungsi ini
 * dipertahankan sementara agar import lama tidak pecah; jangan dipakai pada
 * jalur render baru karena menormalisasi ke persen (membuat kolom saling
 * terpengaruh saat di-resize).
 */
export function normalizedColWidths(sheet: ReportSheet): number[] {
  const widths = absoluteColWidths(sheet);
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  return widths.map((w) => (w / total) * 100);
}

/** Nomor baris terbesar yang berisi sel + 1 (minimal 1). */
export function sheetRowCount(sheet: ReportSheet): number {
  let max = -1;
  for (const key of Object.keys(sheet.cells || {})) {
    const addr = parseCellKey(key);
    if (addr && addr.r > max) max = addr.r;
  }
  return max + 1;
}

/** Ambil sel (dengan default) pada koordinat tertentu. */
export function getCell(sheet: ReportSheet, r: number, c: number): SheetCell | undefined {
  return sheet.cells[cellKey(r, c)];
}
