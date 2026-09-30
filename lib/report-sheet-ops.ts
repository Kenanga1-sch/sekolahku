/**
 * report-sheet-ops.ts — Utilitas operasi grid ala Excel (murni, tanpa React).
 *
 * Berisi logika deret fill-handle, deteksi pola teks, dan serialisasi
 * clipboard TSV. Dipisah agar mudah diuji dan dipakai ulang oleh komponen grid.
 */

import { cellKey, parseCellKey, DEFAULT_COL_WIDTH_PX, type ReportSheet, type SheetCell, type ConditionalRule } from "./config/report-sheet";

/** Nilai bersih sebuah sel untuk evaluasi (teks numerik dikonversi). */
function numericOrText(v: string): { num: number; isNum: boolean } {
  const n = Number(v.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
  return { num: n, isNum: v.trim() !== "" && !isNaN(n) };
}

/** Evaluasi satu aturan conditional terhadap nilai sel. */
export function matchConditional(rule: ConditionalRule, raw: string): boolean {
  const { num, isNum } = numericOrText(raw);
  const target = rule.value === undefined ? "" : rule.value;
  const tNum = Number(target);
  switch (rule.op) {
    case "gt":
      return isNum && num > tNum;
    case "lt":
      return isNum && num < tNum;
    case "gte":
      return isNum && num >= tNum;
    case "lte":
      return isNum && num <= tNum;
    case "eq":
      return raw.toLowerCase() === String(target).toLowerCase();
    case "neq":
      return raw.toLowerCase() !== String(target).toLowerCase();
    case "contains":
      return raw.toLowerCase().includes(String(target).toLowerCase());
    case "notEmpty":
      return raw.trim() !== "";
    default:
      return false;
  }
}

/** Cari aturan conditional pertama untuk (r,c) yang cocok dengan nilai. */
export function conditionalStyleFor(
  sheet: ReportSheet,
  r: number,
  c: number,
  raw: string
): { bg?: string; color?: string } | null {
  const rules = sheet.conditionals;
  if (!rules || rules.length === 0) return null;
  for (const rule of rules) {
    // Aturan berlaku untuk kolom sasaran; -1 berarti semua kolom.
    if (rule.col !== -1 && rule.col !== c) continue;
    if (matchConditional(rule, raw)) return { bg: rule.bg, color: rule.color };
  }
  return null;
}

export interface Bounds {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

/** Urutkan bounds agar selalu r0<=r1, c0<=c1. */
export function normalizeBounds(b: Bounds): Bounds {
  return {
    r0: Math.min(b.r0, b.r1),
    c0: Math.min(b.c0, b.c1),
    r1: Math.max(b.r0, b.r1),
    c1: Math.max(b.c0, b.c1),
  };
}

export function patchCells(sheet: ReportSheet, bounds: Bounds, patch: Partial<SheetCell>): ReportSheet {
  const raw = normalizeBounds(bounds);
  const b = { ...raw, r0: Math.max(0, raw.r0), c0: Math.max(0, raw.c0), c1: Math.min(sheet.cols - 1, raw.c1) };
  const cells = { ...sheet.cells };
  for (let r = b.r0; r <= b.r1; r++) {
    for (let c = b.c0; c <= b.c1; c++) {
      const key = cellKey(r, c);
      const merged = { ...(cells[key] || {}), ...patch };
      if (merged.value === "" || merged.value === undefined) delete merged.value;
      if (merged.colSpan === 1) delete merged.colSpan;
      if (merged.rowSpan === 1) delete merged.rowSpan;
      if (merged.repeatZone === false) delete merged.repeatZone;
      if (Object.keys(merged).length === 0) delete cells[key];
      else cells[key] = merged;
    }
  }
  return { ...sheet, cells };
}

// ─────────────────────────────────────────────────────────────────────────
// Deteksi deret
// ─────────────────────────────────────────────────────────────────────────

/** Pisahkan string menjadi prefix, angka, dan suffix. "Item 3a" → ("Item ",3,"a"). */
export function splitNumericPattern(value: string): { prefix: string; num: number; suffix: string } | null {
  const m = /^(.*?)(-?\d+)(\D*)$/.exec(value);
  if (!m) return null;
  return { prefix: m[1], num: Number(m[2]), suffix: m[3] };
}

/** Apakah seluruh nilai pada deret angka berurutan dengan langkah sama. */
function arithmeticStep(values: number[]): number | null {
  if (values.length < 2) return null;
  const step = values[1] - values[0];
  if (step === 0) return null;
  for (let i = 2; i < values.length; i++) {
    if (values[i] - values[i - 1] !== step) return null;
  }
  return step;
}

const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * Bila seluruh nilai berupa nama hari (Indonesia) atau bulan (Indonesia),
 * lanjutkan deret siklik. Mengembalikan null bila bukan pola hari/bulan.
 */
function extrapolateNamedCycle(source: string[], count: number): string[] | null {
  const clean = source.filter((v) => v !== "");
  if (clean.length === 0) return null;
  const lower = clean.map((v) => v.toLowerCase());

  const dayIdx = lower.map((v) => DAYS_ID.findIndex((d) => d.toLowerCase() === v));
  if (dayIdx.every((i) => i >= 0)) {
    const step = dayIdx.length >= 2 ? dayIdx[1] - dayIdx[0] : 1;
    let cur = dayIdx[dayIdx.length - 1];
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      cur = (((cur + step) % 7) + 7) % 7;
      out.push(DAYS_ID[cur]);
    }
    return out;
  }

  const monIdx = lower.map((v) => MONTHS_ID.findIndex((d) => d.toLowerCase() === v));
  if (monIdx.every((i) => i >= 0)) {
    const step = monIdx.length >= 2 ? monIdx[1] - monIdx[0] : 1;
    let cur = monIdx[monIdx.length - 1];
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      cur = (((cur + step) % 12) + 12) % 12;
      out.push(MONTHS_ID[cur]);
    }
    return out;
  }

  return null;
}

/**
 * Hitung nilai lanjutan untuk fill-handle dari sekumpulan nilai sumber
 * (urutan atas→bawah atau kiri→kanan). Mengembalikan `count` nilai.
 *
 * Aturan:
 * - Angka murni: lanjutkan deret aritmetika bila pola konsisten, jika tidak copy.
 * - Teks berangka ("Item 2"): lanjutkan angka, pertahankan prefix/suffix bila sama.
 * - Lainnya: copy nilai terakhir.
 */
export function extrapolateSeries(source: string[], count: number, direction: 1 | -1 = 1): string[] {
  const out: string[] = [];
  if (count <= 0) return out;
  const clean = source.filter((v) => v !== "");

  // Nama hari/bulan Indonesia → deret siklik.
  const named = extrapolateNamedCycle(clean, count);
  if (named) return named;

  const nums = clean.map((v) => Number(v));
  const allNumeric = clean.length > 0 && nums.every((n) => !isNaN(n) && /^\s*-?\d+(\.\d+)?\s*$/.test(clean[nums.indexOf(n)] ?? ""));

  if (allNumeric && nums.length >= 2) {
    const step = arithmeticStep(nums) ?? (nums.length >= 1 ? (nums[1] - nums[0]) || 1 : 1);
    const last = nums[nums.length - 1];
    for (let i = 0; i < count; i++) {
      const value = last + step * (i + 1);
      out.push(formatLike(clean[clean.length - 1], value));
    }
    return out;
  }

  // Teks berangka: pola prefix + angka + suffix.
  if (clean.length >= 2) {
    const pats = clean.map(splitNumericPattern);
    if (pats.every((p) => p !== null)) {
      const p0 = pats[0]!;
      const sameShape = pats.every((p) => p!.prefix === p0.prefix && p!.suffix === p0.suffix);
      if (sameShape) {
        const step = (pats[1] as NonNullable<typeof p0>).num - p0.num || 1;
        const lastNum = (pats[pats.length - 1] as NonNullable<typeof p0>).num;
        for (let i = 0; i < count; i++) {
          out.push(`${p0.prefix}${lastNum + step * (i + 1)}${p0.suffix}`);
        }
        return out;
      }
    }
  }

  // Fallback: copy nilai terakhir (atau kosong bila sumber kosong).
  const fallback = source.length ? source[source.length - 1] : "";
  for (let i = 0; i < count; i++) out.push(fallback);
  void direction;
  return out;
}

/** Format angka agar bilangan bulat tidak berdesimal. */
function formatLike(template: string, n: number): string {
  if (Number.isInteger(n)) return String(n);
  const decimals = (template.split(".")[1] || "").length;
  return n.toFixed(Math.min(decimals, 6));
}

// ─────────────────────────────────────────────────────────────────────────
// Penyesuaian referensi rumus (relative references) saat copy/paste/fill
// ─────────────────────────────────────────────────────────────────────────

/** Naikkan/turunkan referensi A1 sederhana sebesar (dr, dc). */
export function shiftA1(ref: string, dr: number, dc: number): string {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref);
  if (!m) return ref;
  const col = lettersToIndex(m[1]);
  const row = Number(m[2]) - 1;
  return `${indexToLetters(col + dc)}${row + dr + 1}`;
}

function lettersToIndex(letters: string): number {
  let col = 0;
  const up = letters.toUpperCase();
  for (let i = 0; i < up.length; i++) col = col * 26 + (up.charCodeAt(i) - 64);
  return col - 1;
}

function indexToLetters(c: number): string {
  let n = c + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Sesuaikan referensi sel A1 (bukan absolut dengan $) pada ekspresi rumus
 * dengan pergeseran (dr, dc). Referensi di luar batas tetap dibiarkan.
 */
export function adjustFormulaRefs(expr: string, dr: number, dc: number): string {
  if (!expr) return expr;
  // Lewati string literal agar tidak mengubah teks di dalam tanda kutip.
  const parts = expr.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g);
  return parts
    .map((part, idx) => {
      if (idx % 2 === 1) return part; // literal string
      return part.replace(/(\$?)([A-Za-z]+)(\$?)(\d+)/g, (_whole, colAbs, col, rowAbs, row) => {
        const absCol = colAbs === "$";
        const absRow = rowAbs === "$";
        const colIndex = lettersToIndex(col) + (absCol ? 0 : dc);
        const rowIndex = Number(row) - 1 + (absRow ? 0 : dr);
        if (colIndex < 0 || rowIndex < 0) return "#REF!";
        return `${absCol ? "$" : ""}${indexToLetters(colIndex)}${absRow ? "$" : ""}${rowIndex + 1}`;
      });
    })
    .join("");
}

// ─────────────────────────────────────────────────────────────────────────
// Ekstraksi blok (untuk clipboard internal & paste)
// ─────────────────────────────────────────────────────────────────────────

export type CellVisualStyle = Omit<SheetCell, "value" | "colSpan" | "rowSpan" | "repeatZone">;

export function extractVisualStyle(cell: SheetCell | undefined): CellVisualStyle | undefined {
  if (!cell) return undefined;
  const { value, colSpan, rowSpan, repeatZone, ...style } = cell;
  void value;
  void colSpan;
  void rowSpan;
  void repeatZone;
  return Object.keys(style).length ? style : undefined;
}

export interface CellBlock {
  rows: number;
  cols: number;
  source: { r: number; c: number };
  /** Value per sel (r,c) relatif blok. */
  values: (string | undefined)[][];
  /** Snapshot gaya visual per sel untuk paste format. */
  styles: (CellVisualStyle | undefined)[][];
}

export function rebaseBlockFormula(block: CellBlock, row: number, col: number, targetRow: number, targetCol: number): string | undefined {
  const value = block.values[row]?.[col];
  if (!value?.startsWith("=")) return value;
  return adjustFormulaRefs(value, targetRow - (block.source.r + row), targetCol - (block.source.c + col));
}

export function extractBlock(sheet: ReportSheet, b: Bounds): CellBlock {
  const nb = normalizeBounds(b);
  const rows = nb.r1 - nb.r0 + 1;
  const cols = nb.c1 - nb.c0 + 1;
  const values: (string | undefined)[][] = [];
  const styles: (CellVisualStyle | undefined)[][] = [];
  for (let r = 0; r < rows; r++) {
    const vRow: (string | undefined)[] = [];
    const sRow: (CellVisualStyle | undefined)[] = [];
    for (let c = 0; c < cols; c++) {
      const cell = sheet.cells[cellKey(nb.r0 + r, nb.c0 + c)];
      vRow.push(cell?.value);
      sRow.push(extractVisualStyle(cell));
    }
    values.push(vRow);
    styles.push(sRow);
  }
  return { rows, cols, source: { r: nb.r0, c: nb.c0 }, values, styles };
}

function resizeSpan(cell: SheetCell, axis: "row" | "col", index: number, delta: number, start: number): SheetCell {
  const spanKey = axis === "row" ? "rowSpan" : "colSpan";
  const span = cell[spanKey] ?? 1;
  if (span <= 1) return cell;
  const end = start + span;
  const size = delta > 0
    ? index > start && index < end ? span + delta : span
    : span - Math.max(0, Math.min(end, index - delta) - Math.max(start, index));
  if (size === span) return cell;
  const next = { ...cell };
  if (size <= 1) delete next[spanKey];
  else next[spanKey] = size;
  return next;
}

function adjustStructuralFormula(expr: string, axis: "row" | "col", index: number, count: number, insert: boolean): string {
  const parts = expr.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g);
  return parts.map((part, partIndex) => partIndex % 2 ? part : part.replace(/(\$?)([A-Za-z]+)(\$?)(\d+)/g, (whole, colAbs, col, rowAbs, row) => {
    const coordinate = axis === "row" ? Number(row) - 1 : lettersToIndex(col);
    if (!insert && coordinate >= index && coordinate < index + count) return "#REF!";
    if (coordinate < (insert ? index : index + count)) return whole;
    const shifted = coordinate + (insert ? count : -count);
    return axis === "row"
      ? `${colAbs}${col}${rowAbs}${shifted + 1}`
      : `${colAbs}${indexToLetters(shifted)}${rowAbs}${row}`;
  })).join("");
}

function alterAxis(sheet: ReportSheet, axis: "row" | "col", index: number, count: number, insert: boolean): ReportSheet {
  if (count <= 0 || index < 0) return sheet;
  const delta = insert ? count : -count;
  const cells: ReportSheet["cells"] = {};
  for (const [key, original] of Object.entries(sheet.cells)) {
    const pos = parseCellKey(key);
    if (!pos) continue;
    const coordinate = axis === "row" ? pos.r : pos.c;
    if (!insert && coordinate >= index && coordinate < index + count) continue;
    const shifted = coordinate >= (insert ? index : index + count) ? coordinate + delta : coordinate;
    const nextPos = axis === "row" ? { r: shifted, c: pos.c } : { r: pos.r, c: shifted };
    const cell = resizeSpan(original, axis, index, delta, coordinate);
    const value = cell.value?.startsWith("=") ? adjustStructuralFormula(cell.value, axis, index, count, insert) : cell.value;
    cells[cellKey(nextPos.r, nextPos.c)] = value === cell.value ? cell : { ...cell, value };
  }
  const next = { ...sheet, cells };
  if (axis === "row") {
    const rowHeights: Record<number, number> = {};
    for (const [raw, height] of Object.entries(sheet.rowHeights ?? {})) {
      const row = Number(raw);
      if (!insert && row >= index && row < index + count) continue;
      rowHeights[row >= (insert ? index : index + count) ? row + delta : row] = height;
    }
    next.rowHeights = rowHeights;
  } else {
    const widths = [...sheet.colWidths];
    if (insert) widths.splice(index, 0, ...Array(count).fill(widths[index] ?? widths.at(-1) ?? DEFAULT_COL_WIDTH_PX));
    else widths.splice(index, count);
    next.cols = Math.max(0, sheet.cols + delta);
    next.colWidths = widths;
    next.conditionals = sheet.conditionals?.flatMap((rule) => {
      if (rule.col < 0) return [rule];
      if (!insert && rule.col >= index && rule.col < index + count) return [];
      return [{ ...rule, col: rule.col >= (insert ? index : index + count) ? rule.col + delta : rule.col }];
    });
  }
  return next;
}

export function insertRows(sheet: ReportSheet, index: number, count = 1): ReportSheet {
  return alterAxis(sheet, "row", index, count, true);
}

export function deleteRows(sheet: ReportSheet, index: number, count = 1): ReportSheet {
  return alterAxis(sheet, "row", index, count, false);
}

export function insertColumns(sheet: ReportSheet, index: number, count = 1): ReportSheet {
  return alterAxis(sheet, "col", index, count, true);
}

export function deleteColumns(sheet: ReportSheet, index: number, count = 1): ReportSheet {
  return alterAxis(sheet, "col", index, count, false);
}

// ─────────────────────────────────────────────────────────────────────────
// Fill handle & pola merge
// ─────────────────────────────────────────────────────────────────────────

export type FillDirection = "down" | "up" | "right" | "left";

export interface FillSpan {
  /** Posisi anchor span baru. */
  r: number;
  c: number;
  colSpan: number;
  rowSpan: number;
  /** Anchor sumber yang menjadi acuan penyalinan nilai & gaya. */
  sourceR: number;
  sourceC: number;
}

export interface FillSpanPlan {
  spans: FillSpan[];
  /** Sel yang harus dihapus karena kini tertutup oleh span baru (atau konflik). */
  coveredToRemove: string[];
}

/**
 * Hitung pembentukan ulang pola merge saat fill handle ditarik, meniru Excel:
 * pola anchor merged pada seleksi sumber diulang ke area tujuan dengan jarak
 * sepanjang dimensi pola. Nilai/gaya tidak dihitung di sini (dilakukan pemanggil).
 *
 * Aturan arah:
 * - Vertikal (down/up): span horizontal (colSpan>1) diulang apa adanya; span
 *   vertikal (rowSpan>1) diulang per unit tinggi pola.
 * - Horizontal (right/left): hanya anchor yang punya rowSpan>1 yang diulang
 *   (span horizontal tidak diulang sejajar, agar tidak saling beradu).
 */
export function fillSpans(
  sheet: ReportSheet,
  bounds: Bounds,
  direction: FillDirection,
  count: number,
): FillSpanPlan {
  const empty: FillSpanPlan = { spans: [], coveredToRemove: [] };
  if (count <= 0) return empty;
  const b = normalizeBounds(bounds);
  const vertical = direction === "down" || direction === "up";

  // Kumpulkan anchor merged di dalam seleksi sumber.
  const pattern: { dr: number; dc: number; colSpan: number; rowSpan: number }[] = [];
  for (let r = b.r0; r <= b.r1; r++) {
    for (let c = b.c0; c <= b.c1; c++) {
      const cell = sheet.cells[cellKey(r, c)];
      const cs = cell?.colSpan ?? 1;
      const rs = cell?.rowSpan ?? 1;
      if (cs <= 1 && rs <= 1) continue;
      pattern.push({ dr: r - b.r0, dc: c - b.c0, colSpan: cs, rowSpan: rs });
    }
  }
  if (pattern.length === 0) return empty;

  // Span yang relevan menurut arah.
  const relevant = vertical ? pattern : pattern.filter((p) => p.rowSpan > 1);
  if (relevant.length === 0) return empty;

  const sourceHeight = b.r1 - b.r0 + 1;
  const sourceWidth = b.c1 - b.c0 + 1;
  const maxCol = Math.max(0, sheet.cols - 1);

  const spans: FillSpan[] = [];
  const coveredToRemove: string[] = [];
  const coveredSet = new Set<string>();

  const pushCovered = (r: number, c: number) => {
    const key = cellKey(r, c);
    if (!coveredSet.has(key)) {
      coveredSet.add(key);
      coveredToRemove.push(key);
    }
  };

  for (let unit = 1; unit <= count; unit++) {
    for (const p of relevant) {
      let anchorR: number;
      let anchorC: number;
      if (direction === "down") {
        anchorR = b.r0 + unit * sourceHeight + p.dr;
        anchorC = b.c0 + p.dc;
      } else if (direction === "up") {
        anchorR = b.r0 - (unit - 1) * sourceHeight - sourceHeight + p.dr;
        anchorC = b.c0 + p.dc;
      } else if (direction === "right") {
        anchorR = b.r0 + p.dr;
        anchorC = b.c0 + unit * sourceWidth + p.dc;
      } else {
        anchorR = b.r0 + p.dr;
        anchorC = b.c0 - (unit - 1) * sourceWidth - sourceWidth + p.dc;
      }

      if (anchorR < 0 || anchorC < 0 || anchorC > maxCol) continue;
      const endC = Math.min(anchorC + p.colSpan - 1, maxCol);
      spans.push({
        r: anchorR,
        c: anchorC,
        colSpan: endC - anchorC + 1,
        rowSpan: p.rowSpan,
        sourceR: b.r0 + p.dr,
        sourceC: b.c0 + p.dc,
      });
      // Semua sel tertutup selain anchor harus dihapus.
      for (let rr = anchorR; rr < anchorR + p.rowSpan; rr++) {
        for (let cc = anchorC; cc <= endC; cc++) {
          if (rr === anchorR && cc === anchorC) continue;
          pushCovered(rr, cc);
        }
      }
    }
  }

  // Anchor baru tidak boleh ikut terhapus oleh span lain.
  const anchorKeys = new Set(spans.map((s) => cellKey(s.r, s.c)));
  return { spans, coveredToRemove: coveredToRemove.filter((k) => !anchorKeys.has(k)) };
}

// ─────────────────────────────────────────────────────────────────────────
// Clipboard TSV (interop Excel / Google Sheets)
// ─────────────────────────────────────────────────────────────────────────

export function blockToTsv(block: { values: (string | undefined)[][] }): string {
  return block.values
    .map((row) => row.map((v) => (v ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t"))
    .join("\n");
}

/** Urai teks TSV menjadi matriks nilai. */
export function tsvToMatrix(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = normalized.split("\n");
  // Buang satu newline kosong di akhir (kebiasaan Excel).
  if (rows.length > 1 && rows[rows.length - 1] === "") rows.pop();
  return rows.map((line) => line.split("\t"));
}
