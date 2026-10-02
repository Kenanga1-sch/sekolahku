/**
 * report-paginate.ts — Perhitungan batas halaman (page break) untuk laporan
 * cell-based v3.
 *
 * Tujuan: memberi tahu editor di mana halaman fisik akan terpotong, dengan
 * perhitungan yang identik dengan renderer PDF (`report-pdf.tsx`). Semua
 * satuan di sini memakai pt (sama seperti react-pdf). Editor menampilkannya
 * dengan skala 1pt = 1px.
 *
 * Ekspansi zona ulang diperhitungkan: satu record menghasilkan satu baris
 * output, sehingga jumlah record memengaruhi jumlah halaman — persis seperti
 * PDF.
 */

import {
  cellKey,
  rowHeightAt,
  colWidthPt,
  printedColWidthsPt,
  printScaleOf,
  type ReportSheet,
  type ReportWorkbook,
  type ReportDensityConfig,
} from "./config/report-sheet";
import { evaluateSheet, type EvaluateContext } from "./report-engine-v3";
import { getPaperSizePt } from "./config/letter-document";

export const DEFAULT_TYPO: ReportDensityConfig = {
  baseFontSize: 11,
  tableFontSize: 11,
  lineHeight: 1.4,
  rowPadding: 4,
  blockGap: 8,
};

const DEFAULT_MARGIN = { top: 36, bottom: 45, left: 40, right: 40 };

export interface PaperContentSize {
  /** Lebar kertas penuh (pt). */
  widthPt: number;
  /** Tinggi kertas penuh (pt). */
  heightPt: number;
  /** Lebar area konten (kertas − margin kiri − kanan). */
  contentWidthPt: number;
  /** Tinggi area konten (kertas − margin atas − bawah). */
  contentHeightPt: number;
  margin: { top: number; bottom: number; left: number; right: number };
}

/** Dimensi kertas & area konten (pt) untuk sebuah workbook. */
export function paperContentSizePt(workbook: ReportWorkbook): PaperContentSize {
  const [widthPt, heightPt] = getPaperSizePt(workbook.paperSize, workbook.orientation);
  const margin = { ...DEFAULT_MARGIN, ...(workbook.margin || {}) };
  return {
    widthPt,
    heightPt,
    contentWidthPt: Math.max(1, widthPt - margin.left - margin.right),
    contentHeightPt: Math.max(1, heightPt - margin.top - margin.bottom),
    margin,
  };
}

/** Ukuran font efektif sebuah sel (override atau default workbook). */
export function cellFontSizePt(
  sheet: ReportSheet,
  inputR: number,
  fallback: number
): number {
  let fontSize = fallback;
  for (let c = 0; c < sheet.cols; c++) {
    fontSize = Math.max(fontSize, sheet.cells[cellKey(inputR, c)]?.fontSize ?? 0);
  }
  return fontSize;
}

/**
 * Tinggi baris input dalam pt. Rumus ini adalah sumber kebenaran tunggal yang
 * dipakai baik oleh renderer PDF maupun editor — jangan diduplikasi.
 *
 * Bila `wrapCtx` diberikan, baris yang berisi sel `wrap` ditambah tingginya
 * sesuai perkiraan jumlah baris teks (perkiraan lebar karakter ≈ 0.55em).
 */
export function rowHeightPt(
  sheet: ReportSheet,
  inputR: number,
  fontSize: number,
  typo: ReportDensityConfig = DEFAULT_TYPO,
  wrapCtx?: { contentWidthPt: number; typo?: ReportDensityConfig },
  scale = 1
): number {
  const explicit = rowHeightAt(sheet, inputR);
  if (explicit !== undefined) return explicit * scale;
  const rowFontSize = cellFontSizePt(sheet, inputR, fontSize);
  const base = Math.ceil(rowFontSize * (typo.lineHeight || 1.4) + typo.rowPadding * 2 + 2);
  if (!wrapCtx) return base * scale;

  let requiredHeight = base;
  // Lebar cetak (pt) absolut — sama dengan yang dipakai PDF agar perkiraan
  // jumlah baris wrap konsisten.
  const printed = printedColWidthsPt(sheet);
  for (let c = 0; c < sheet.cols; c++) {
    const cell = sheet.cells[cellKey(inputR, c)];
    if (!cell || !cell.value) continue;
    const cellFontSize = cell.fontSize ?? fontSize;
    const span = cell.colSpan ?? 1;
    let spanPt = 0;
    for (let cc = c; cc < c + span && cc < sheet.cols; cc++) spanPt += printed[cc] ?? colWidthPt(sheet, cc);
    const colPt = Math.max(8, spanPt - 6);
    const perLine = Math.max(1, Math.floor(colPt / (cellFontSize * 0.55)));
    const lines = cell.value.split("\n").reduce(
      (sum, line) => sum + (cell.wrap === true ? Math.max(1, Math.ceil(line.length / perLine)) : 1),
      0
    );
    requiredHeight = Math.max(
      requiredHeight,
      Math.ceil(cellFontSize * (typo.lineHeight || 1.4) * lines + typo.rowPadding * 2 + 2)
    );
  }
  return requiredHeight * scale;
}

export interface PageBreakPlan {
  /** Baris OUTPUT (setelah ekspansi) setelah mana halaman berakhir. */
  breakAfterOutputRow: Set<number>;
  /** Baris INPUT (index editor) setelah mana garis batas digambar. */
  breakAfterInputRow: Set<number>;
  /** Baris input → nomor halaman (1-based) tempat baris itu dimulai. */
  pageOfInputRow: Map<number, number>;
  /** Jumlah baris output per halaman. */
  rowsPerPage: number[];
  /**
   * Rentang baris OUTPUT tiap halaman (1-based). Dipakai renderer PDF untuk
   * menggambar border horizontal eksplisit di batas halaman (baris pertama &
   * terakhir halaman) sehingga garis tabel tidak hilang/dobel saat terpotong.
   * Field ini opsional agar pemanggil lama tetap kompatibel.
   */
  pages?: PageRowRange[];
  /** Total halaman. */
  pageCount: number;
  contentWidthPt: number;
  contentHeightPt: number;
  /** Tinggi satu baris header yang diulang (0 bila headerRepeat nonaktif). */
  headerHeightPt: number;
  /** Tinggi total konten (semua baris output). */
  totalHeightPt: number;
  /** Margin kertas (pt), disalin agar grid bisa menggambar bayangan margin. */
  marginTopPt: number;
  marginRightPt: number;
  marginBottomPt: number;
  marginLeftPt: number;
  /** Tipografi efektif yang dipakai paginasi (untuk tinggi baris di editor). */
  typography: ReportDensityConfig;
}

/**
 * Rentang baris OUTPUT yang dirender pada satu halaman fisik. `firstRowIndex`
 * & `lastRowIndex` adalah indeks baris output (0-based, setelah ekspansi zona
 * ulang); nilainya -1 bila halaman tidak memuat baris output (mis. lembar
 * kosong). Baris header tetap (`headerRepeat`) tidak dihitung sebagai bagian
 * dari rentang karena dirender sebagai salinan `fixed`, bukan baris aliran.
 */
export interface PageRowRange {
  /** Nomor halaman (1-based). */
  page: number;
  /** Indeks baris OUTPUT pertama pada halaman ini (-1 bila tidak ada). */
  firstRowIndex: number;
  /** Indeks baris OUTPUT terakhir pada halaman ini (-1 bila tidak ada). */
  lastRowIndex: number;
}

/**
 * Hitung rencana batas halaman. Menjalankan engine evaluasi agar ekspansi
 * baris zona ulang ikut terhitung, lalu mengakumulasi tinggi baris.
 */
export function computePageBreaks(
  sheet: ReportSheet,
  workbook: ReportWorkbook,
  ctx: EvaluateContext = {}
): PageBreakPlan {
  const typo = workbook.typography || DEFAULT_TYPO;
  const size = paperContentSizePt(workbook);
  const ev = evaluateSheet(sheet, ctx);
  const pscale = printScaleOf(workbook);
  const wrapCtx = { contentWidthPt: size.contentWidthPt, typo };

  // Tinggi baris header tetap (bila headerRepeat aktif dan ada zona ulang).
  let headerHeightPt = 0;
  let fixedHeaderOutputRow = -1;
  if (workbook.headerRepeat && ev.repeatOutputRows.size > 0) {
    const firstRepeatOutput = Math.min(...Array.from(ev.repeatOutputRows));
    const headerInputR = (ev.inputRowByOutput[firstRepeatOutput] ?? 0) - 1;
    if (headerInputR >= 0) {
      const idx = ev.inputRowByOutput.indexOf(headerInputR);
      if (idx >= 0) {
        fixedHeaderOutputRow = idx;
        const font = cellFontSizePt(sheet, headerInputR, typo.baseFontSize);
        headerHeightPt = rowHeightPt(sheet, headerInputR, font, typo, wrapCtx, pscale);
      }
    }
  }

  const breakAfterOutputRow = new Set<number>();
  const breakAfterInputRow = new Set<number>();
  const pageOfInputRow = new Map<number, number>();
  const rowsPerPage: number[] = [];
  const pages: PageRowRange[] = [];

  let page = 1;
  let used = 0;
  let rowsOnPage = 0;
  let totalHeightPt = headerHeightPt;
  // Metadata halaman berjalan: indeks baris OUTPUT pertama & terakhir.
  let pageFirstRow = -1;
  let pageLastRow = -1;

  /** Tutup halaman berjalan dan simpan jumlah baris + rentang barisnya. */
  const closePage = () => {
    rowsPerPage.push(rowsOnPage);
    pages.push({ page, firstRowIndex: pageFirstRow, lastRowIndex: pageLastRow });
  };

  for (let r = 0; r < ev.outputRows; r++) {
    // Baris header tetap hanya dirender di halaman pertama; pada halaman
    // berikutnya ruangnya terpakai oleh salinan header.
    if (r === fixedHeaderOutputRow) continue;

    const inputR = ev.inputRowByOutput[r];
    const font = cellFontSizePt(sheet, inputR, typo.baseFontSize);
    const h = rowHeightPt(sheet, inputR, font, typo, wrapCtx, pscale);

    // Ruang efektif: halaman >1 menyediakan salinan header bila diulang.
    const capacity = size.contentHeightPt - (page > 1 ? headerHeightPt : 0);

    if (used + h > capacity && rowsOnPage > 0) {
      // Tutup halaman ini sebelum baris r.
      breakAfterOutputRow.add(r - 1);
      breakAfterInputRow.add(ev.inputRowByOutput[r - 1]);
      closePage();
      page++;
      used = 0;
      rowsOnPage = 0;
      pageFirstRow = -1;
      pageLastRow = -1;
    }

    if (pageFirstRow < 0) pageFirstRow = r;
    pageLastRow = r;
    pageOfInputRow.set(inputR, page);
    used += h;
    totalHeightPt += h;
    rowsOnPage++;
  }

  if (rowsOnPage > 0 || rowsPerPage.length === 0) closePage();

  return {
    breakAfterOutputRow,
    breakAfterInputRow,
    pageOfInputRow,
    rowsPerPage,
    pages,
    pageCount: rowsPerPage.length,
    contentWidthPt: size.contentWidthPt,
    contentHeightPt: size.contentHeightPt,
    headerHeightPt,
    totalHeightPt,
    marginTopPt: size.margin.top,
    marginRightPt: size.margin.right,
    marginBottomPt: size.margin.bottom,
    marginLeftPt: size.margin.left,
    typography: typo,
  };
}

/** Tinggi kumulatif tiap baris output (dipakai untuk indikator visual). */
export function computeRowOffsets(
  sheet: ReportSheet,
  workbook: ReportWorkbook,
  ctx: EvaluateContext = {}
): { inputR: number; heightPt: number; topPt: number }[] {
  const typo = workbook.typography || DEFAULT_TYPO;
  const ev = evaluateSheet(sheet, ctx);
  const size = paperContentSizePt(workbook);
  const wrapCtx = { contentWidthPt: size.contentWidthPt, typo };
  const pscale = printScaleOf(workbook);
  const out: { inputR: number; heightPt: number; topPt: number }[] = [];
  let top = 0;
  for (let r = 0; r < ev.outputRows; r++) {
    const inputR = ev.inputRowByOutput[r];
    const font = cellFontSizePt(sheet, inputR, typo.baseFontSize);
    const h = rowHeightPt(sheet, inputR, font, typo, wrapCtx, pscale);
    out.push({ inputR, heightPt: h, topPt: top });
    top += h;
  }
  return out;
}
