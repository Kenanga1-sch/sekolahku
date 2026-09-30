/**
 * report-engine-v3.ts — Engine evaluasi dokumen format laporan cell-based (schema v3).
 *
 * Fokus:
 * - Zone detection: baris dengan ≥1 variabel LIST menjadi baris template yang
 *   diulang per record (satu record = satu baris).
 * - Evaluasi rumus sederhana (=SUM, =COUNT, =AVG, =MIN, =MAX, =IF, =CONCAT, ...).
 * - Merge occupancy untuk rendering PDF (rowSpan di-akali spacer row).
 * - Migrasi dari schema lama v1/v2 (pages/blocks) ke v3 (sheets/cells).
 */

import type { ReportWorkbook, ReportSheet, CellKey, SheetCell, ReportShape, ReportImage } from "./config/report-sheet";
import {
  cellKey,
  parseCellKey,
  normalizedColWidths,
  createSheet,
  defaultColWidths,
  DEFAULT_DATASET,
  REPORT_SHEET_SCHEMA_VERSION,
} from "./config/report-sheet";
import { parseCellValue, isListValue, resolvePath } from "./report-parser";
import {
  migrateReportDocument,
  type ReportDocumentData,
  type ReportPage,
} from "./config/report-document";
import type { ReportBlockInstance } from "./config/report-blocks";
import { getReportBlockDefinition } from "./config/report-blocks";

export interface EvaluateContext {
  dataset?: Record<string, any>[]; // list data per record (dataset default)
  /**
   * Dataset bernama untuk laporan multi-sumber. Lembar memilih dataset-nya via
   * `sheet.datasetName`; baris `{ns.field}` membaca field dari dataset `ns`.
   * Bila kosong, semua lembar memakai `dataset` (perilaku lama).
   */
  datasets?: Record<string, Record<string, any>[]>;
  global?: Record<string, any>; // variabel global/scalar
}

export interface RenderedValue {
  text: string;
  isList?: boolean;
}

export interface EvaluatedSheet {
  sheetId: string;
  outputRows: number;
  /** Hasil render per koordinat OUTPUT (r,c). */
  cellMap: Map<CellKey, RenderedValue>;
  /** Sel yang tertutup karena rowSpan sel di atasnya. */
  occupied: Set<CellKey>;
  /** Peta baris OUTPUT → indeks record (untuk baris zona ulang). */
  recordIndexByRow: Record<number, number>;
  /** Peta baris OUTPUT → indeks baris INPUT (untuk mengambil gaya sel asal). */
  inputRowByOutput: number[];
  /** Baris OUTPUT yang merupakan bagian dari zona ulang. */
  repeatOutputRows: Set<number>;
}

export interface EvaluatedWorkbook {
  sheets: EvaluatedSheet[];
}

// ─────────────────────────────────────────────────────────────────────────
// Utilitas baris
// ─────────────────────────────────────────────────────────────────────────

export function sheetRowCount(sheet: ReportSheet): number {
  let max = -1;
  for (const key of Object.keys(sheet.cells || {})) {
    const addr = parseCellKey(key);
    if (addr && addr.r > max) max = addr.r;
  }
  return max + 1;
}

/** Baris (input) yang mengandung variabel LIST → zona ulang. */
export function detectRepeatRows(sheet: ReportSheet): number[] {
  const total = sheetRowCount(sheet);
  const rows: number[] = [];
  for (let r = 0; r < total; r++) {
    let repeat = false;
    for (let c = 0; c < sheet.cols; c++) {
      const cell = sheet.cells[cellKey(r, c)];
      if (!cell) continue;
      if (cell.repeatZone === true || isListValue(cell.value)) {
        repeat = true;
        break;
      }
    }
    if (repeat) rows.push(r);
  }
  return rows;
}

/** Sel (input) yang tertutup oleh rowSpan sel di atasnya. */
export function buildOccupiedInput(sheet: ReportSheet): Set<CellKey> {
  const occ = new Set<CellKey>();
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const span = cell.rowSpan ?? 1;
    if (span <= 1) continue;
    const addr = parseCellKey(key);
    if (!addr) continue;
    for (let rr = addr.r + 1; rr < addr.r + span; rr++) {
      occ.add(cellKey(rr, addr.c));
    }
  }
  return occ;
}

// ─────────────────────────────────────────────────────────────────────────
// Perencanaan ekspansi baris
// ─────────────────────────────────────────────────────────────────────────

export interface RowExpansionPlan {
  /** Urutan output: tiap entri = indeks baris INPUT. */
  outputInputRows: number[];
  /** Untuk tiap baris OUTPUT, indeks record-nya (atau -1 bila statis). */
  recordIndexByOutput: number[];
  repeatInputRows: number[];
}

/**
 * Rencana ekspansi baris. Baris zona ulang digandakan sebanyak jumlah record
 * (minimal 1 agar dokumen tetap tampil).
 */
export function planRowExpansion(sheet: ReportSheet, recordCount: number): RowExpansionPlan {
  const total = sheetRowCount(sheet);
  const repeatSet = new Set(detectRepeatRows(sheet));
  const count = Math.max(recordCount, 1);
  const outputInputRows: number[] = [];
  const recordIndexByOutput: number[] = [];

  for (let r = 0; r < total; r++) {
    if (repeatSet.has(r)) {
      for (let i = 0; i < count; i++) {
        outputInputRows.push(r);
        recordIndexByOutput.push(i);
      }
    } else {
      outputInputRows.push(r);
      recordIndexByOutput.push(-1);
    }
  }
  return { outputInputRows, recordIndexByOutput, repeatInputRows: Array.from(repeatSet) };
}

// ─────────────────────────────────────────────────────────────────────────
// Evaluasi rumus
// ─────────────────────────────────────────────────────────────────────────

type Scalar = number | string | boolean | null;

/**
 * Lingkungan evaluasi rumus. Semua koordinat memakai koordinat EDITOR
 * (baris/kolom grid yang diketik admin), bukan koordinat output. Referensi
 * ke sel pada baris zona-ulang otomatis melebar ke seluruh record lewat
 * `getRange`.
 */
interface FormulaEnv {
  /** Nilai satu sel editor (0/1 nilai). */
  getValue: (r: number, c: number) => Scalar;
  /** Daftar nilai sel editor; >1 elemen bila baris zona-ulang punya banyak record. */
  getRange: (r: number, c: number) => Scalar[];
  /** Koordinat editor sel rumus yang sedang dievaluasi. */
  row: number;
  col: number;
}

const ERROR_DIV0 = "#DIV0!";
const ERROR_REF = "#REF!";
const ERROR_NA = "#N/A";
const ERROR_CIRC = "#CIRC!";
const ERROR_SYNTAX = "#ERR!";

/** Evaluasi ekspresi rumus terhadap lingkungan sel. */
export function evalFormula(expr: string, env: FormulaEnv): string {
  try {
    const value = evalExpr(expr.trim(), env, new Set());
    if (value === null || value === undefined) return "";
    if (typeof value === "number") {
      if (!isFinite(value)) return ERROR_DIV0;
      return formatNumberLoose(value);
    }
    return String(value);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === ERROR_DIV0 || msg === ERROR_REF || msg === ERROR_NA || msg === ERROR_CIRC || msg === ERROR_SYNTAX) {
      return msg;
    }
    return ERROR_SYNTAX;
  }
}

function formatNumberLoose(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1e6) / 1e6);
}

/** Recursive-descent sederhana: + - * / , lalu fungsi & literal. */
function evalExpr(expr: string, env: FormulaEnv, seen: Set<string>): Scalar {
  const { tokens, nextFn } = tokenize(expr);
  const parser = new ExprParser(tokens, env, seen);
  const val = parser.parseAddSub();
  if (!parser.atEnd()) throw new Error(ERROR_SYNTAX);
  void nextFn;
  return val;
}

interface Tok {
  t: "num" | "str" | "op" | "ident" | "lpar" | "rpar" | "comma" | "colon";
  v: string;
}

function tokenize(expr: string): { tokens: Tok[]; nextFn: number } {
  const tokens: Tok[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let s = "";
      i++;
      while (i < expr.length && expr[i] !== ch) {
        s += expr[i];
        i++;
      }
      i++;
      tokens.push({ t: "str", v: s });
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(expr[i + 1] || ""))) {
      let s = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        s += expr[i];
        i++;
      }
      tokens.push({ t: "num", v: s });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let s = "";
      while (i < expr.length && /[A-Za-z0-9_.$]/.test(expr[i])) {
        s += expr[i];
        i++;
      }
      tokens.push({ t: "ident", v: s });
      continue;
    }
    if ("+-*/^%".includes(ch)) {
      tokens.push({ t: "op", v: ch });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ t: "lpar", v: ch });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ t: "rpar", v: ch });
      i++;
      continue;
    }
    if (ch === "," || ch === ";") {
      tokens.push({ t: "comma", v: "," });
      i++;
      continue;
    }
    if (ch === ":") {
      tokens.push({ t: "colon", v: ch });
      i++;
      continue;
    }
    if (ch === "=") {
      tokens.push({ t: "op", v: "=" });
      i++;
      continue;
    }
    if (ch === "<" || ch === ">") {
      let s = ch;
      i++;
      if (expr[i] === "=") {
        s += "=";
        i++;
      }
      tokens.push({ t: "op", v: s });
      continue;
    }
    throw new Error(ERROR_SYNTAX);
  }
  return { tokens, nextFn: 0 };
}

class ExprParser {
  private pos = 0;
  constructor(
    private tokens: Tok[],
    private env: FormulaEnv,
    private seen: Set<string>
  ) {}

  atEnd() {
    return this.pos >= this.tokens.length;
  }

  private peek(): Tok | undefined {
    return this.tokens[this.pos];
  }

  private eat(): Tok {
    const t = this.tokens[this.pos];
    if (!t) throw new Error(ERROR_SYNTAX);
    this.pos++;
    return t;
  }

  parseAddSub(): Scalar {
    let left = this.parseMulDiv();
    while (this.peek()?.t === "op" && ["+", "-"].includes(this.peek()!.v)) {
      const op = this.eat().v;
      const right = this.parseMulDiv();
      left = op === "+" ? toNum(left) + toNum(right) : toNum(left) - toNum(right);
    }
    return left;
  }

  private parseMulDiv(): Scalar {
    let left = this.parseCompare();
    while (this.peek()?.t === "op" && ["*", "/", "%"].includes(this.peek()!.v)) {
      const op = this.eat().v;
      const right = this.parseCompare();
      if (op === "*") left = toNum(left) * toNum(right);
      else if (op === "/") {
        const d = toNum(right);
        if (d === 0) throw new Error(ERROR_DIV0);
        left = toNum(left) / d;
      } else {
        const d = toNum(right);
        if (d === 0) throw new Error(ERROR_DIV0);
        left = toNum(left) % d;
      }
    }
    return left;
  }

  private parseCompare(): Scalar {
    let left = this.parseUnary();
    while (this.peek()?.t === "op" && ["=", "<", ">", "<=", ">="].includes(this.peek()!.v)) {
      const op = this.eat().v;
      const right = this.parseUnary();
      const a = coerceComparable(left);
      const b = coerceComparable(right);
      switch (op) {
        case "=":
          left = a === b;
          break;
        case "<":
          left = a < b;
          break;
        case ">":
          left = a > b;
          break;
        case "<=":
          left = a <= b;
          break;
        case ">=":
          left = a >= b;
          break;
      }
    }
    return left;
  }

  private parseUnary(): Scalar {
    const t = this.peek();
    if (t?.t === "op" && t.v === "-") {
      this.eat();
      return -toNum(this.parseUnary());
    }
    if (t?.t === "op" && t.v === "+") {
      this.eat();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Scalar {
    const t = this.eat();
    if (t.t === "num") return Number(t.v);
    if (t.t === "str") return t.v;
    if (t.t === "lpar") {
      const val = this.parseAddSub();
      const close = this.eat();
      if (close.t !== "rpar") throw new Error(ERROR_SYNTAX);
      return val;
    }
    if (t.t === "ident") {
      const nu = this.peek();
      if (nu?.t === "lpar") {
        this.eat(); // (
        const fnName = t.v.toUpperCase();
        if (fnName === "IF") return this.parseIf();
        const args = this.parseArgs();
        return this.callFunction(t.v, args);
      }
      // Referensi sel A1 → koordinat editor, melebar bila zona ulang.
      const ref = parseA1(t.v);
      if (ref) return this.env.getValue(ref.r, ref.c);
      throw new Error(ERROR_REF);
    }
    throw new Error(ERROR_SYNTAX);
  }

  /** IF lazy: hanya cabang terpilih yang dievaluasi (short-circuit). */
  private parseIf(): Scalar {
    const cond = this.parseAddSub();
    const chooseTrue = Boolean(cond);
    if (this.peek()?.t !== "comma") throw new Error(ERROR_SYNTAX);
    this.eat();
    const value = chooseTrue ? this.parseAddSub() : this.skipExpression();
    if (this.peek()?.t === "comma") {
      this.eat();
      if (chooseTrue) this.skipExpression();
      else return this.parseAddSub();
    }
    const close = this.eat();
    if (close.t !== "rpar") throw new Error(ERROR_SYNTAX);
    return value;
  }

  /** Lewati satu ekspresi tanpa mengevaluasinya (untuk cabang IF tak terpilih). */
  private skipExpression(): Scalar {
    const start = this.pos;
    let depth = 0;
    while (this.pos < this.tokens.length) {
      const t = this.tokens[this.pos];
      if (depth === 0 && (t.t === "comma" || t.t === "rpar")) break;
      if (t.t === "lpar") depth++;
      else if (t.t === "rpar") depth--;
      this.pos++;
    }
    if (this.pos === start) throw new Error(ERROR_SYNTAX);
    return "";
  }

  private parseArgs(): Scalar[] {
    const args: Scalar[] = [];
    if (this.peek()?.t === "rpar") {
      this.eat();
      return args;
    }
    while (true) {
      const t = this.peek();
      const nxt = this.tokens[this.pos + 1];
      const nxt2 = this.tokens[this.pos + 2];
      if (t?.t === "ident" && nxt?.t === "colon" && nxt2?.t === "ident") {
        // range seperti A1:B5 (koordinat editor, melebar per record)
        this.eat();
        this.eat();
        this.eat();
        const refs = expandRangeRefs(t.v, nxt2.v);
        if (!refs) throw new Error(ERROR_REF);
        for (const ref of refs) {
          for (const val of this.env.getRange(ref.r, ref.c)) args.push(val);
        }
        const sepAfter = this.peek();
        if (sepAfter?.t === "comma") {
          this.eat();
          continue;
        }
        break;
      }
      args.push(this.parseAddSub());
      const sep = this.peek();
      if (sep?.t === "comma") {
        this.eat();
        continue;
      }
      break;
    }
    const close = this.eat();
    if (close.t !== "rpar") throw new Error(ERROR_SYNTAX);
    return args;
  }

  private callFunction(name: string, args: Scalar[]): Scalar {
    const fn = name.toUpperCase();
    switch (fn) {
      case "SUM":
        return args.reduce<number>((a, b) => a + toNum(b), 0);
      case "COUNT":
        return args.filter((a) => a !== "" && a !== null && a !== undefined && !isNaN(Number(a))).length;
      case "AVG":
      case "AVERAGE": {
        const nums = args.map(toNum).filter((n) => !isNaN(n));
        if (nums.length === 0) return ERROR_DIV0;
        return nums.reduce((a, b) => a + b, 0) / nums.length;
      }
      case "MIN": {
        const nums = args.map(toNum);
        return nums.length ? Math.min(...nums) : 0;
      }
      case "MAX": {
        const nums = args.map(toNum);
        return nums.length ? Math.max(...nums) : 0;
      }
      case "IF": {
        // Ditangani sebagai lazy di parseIf(); fallback bila dipanggil via jalur lain.
        const cond = args[0];
        const truthy = Boolean(cond);
        return truthy ? args[1] ?? "" : args[2] ?? "";
      }
      case "CONCAT":
        return args.map((a) => (a == null ? "" : String(a))).join("");
      case "ROUND": {
        const n = toNum(args[0]);
        const d = args.length > 1 ? toNum(args[1]) : 0;
        const f = Math.pow(10, d);
        return Math.round(n * f) / f;
      }
      case "UPPER":
        return String(args[0] ?? "").toUpperCase();
      case "LOWER":
        return String(args[0] ?? "").toLowerCase();
      case "TRIM":
        return String(args[0] ?? "").trim();
      case "COUNTA":
        return args.filter((a) => a !== "" && a !== null && a !== undefined).length;
      default:
        throw new Error(ERROR_NA);
    }
  }
}

function coerceComparable(v: Scalar): number | string {
  if (typeof v === "number" || typeof v === "boolean") return Number(v);
  if (v === null || v === undefined) return "";
  const n = Number(v);
  return isNaN(n) ? String(v) : n;
}

function toNum(v: Scalar): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  if (isNaN(n)) throw new Error(ERROR_NA);
  return n;
}

/** Urai "F4" → koordinat editor { r, c } (0-indexed). */
function parseA1(ref: string): { r: number; c: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref);
  if (!m) return null;
  return { r: Number(m[2]) - 1, c: colLettersToIndex(m[1]) };
}

function expandRangeRefs(from: string, to: string): { r: number; c: number }[] | null {
  const a = parseA1(from);
  const b = parseA1(to);
  if (!a || !b) return null;
  const refs: { r: number; c: number }[] = [];
  for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
    for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) {
      refs.push({ r, c });
    }
  }
  return refs;
}

function colLettersToIndex(letters: string): number {
  let col = 0;
  const up = letters.toUpperCase();
  for (let i = 0; i < up.length; i++) col = col * 26 + (up.charCodeAt(i) - 64);
  return col - 1;
}

// ─────────────────────────────────────────────────────────────────────────
// Evaluasi workbook
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ambil nilai mentah list untuk sebuah kolom pada record tertentu.
 *
 * - `{no}` (root tanpa dot) → penghitung nomor baris.
 * - `{field}` → field pada record dataset lembar ini.
 * - `{ns.field}` → jika `ns` adalah nama dataset terdaftar (selain default),
 *   diambil dari record pertama dataset itu (umumnya untuk laporan multi-sumber
 *   pada baris statis); jika bukan, diperlakukan sebagai path lama
 *   (`root.field`) pada record lembar ini.
 */
function listValueForRecord(
  cell: SheetCell,
  record: Record<string, any> | undefined,
  recordIndex: number,
  datasets?: Record<string, Record<string, any>[]>,
  defaultDatasetName?: string,
): Scalar {
  const p = parseCellValue(cell.value);
  if (p.type !== "LIST") return "";
  // {no} (root tanpa dot) adalah satu-satunya placeholder yang menjadi penghitung
  // nomor baris. Placeholder lain yang tidak ada di record harus kosong, bukan
  // nomor baris — kalau tidak, {name}/{price} yang kosong akan tercetak "1".
  if (p.field === undefined && p.root === "no") return recordIndex + 1;

  // {ns.field} dengan ns = dataset terdaftar (bukan dataset default lembar ini).
  if (p.field !== undefined && datasets && p.root !== defaultDatasetName) {
    const other = datasets[p.root];
    if (Array.isArray(other)) {
      const rec = other[0];
      if (rec && rec[p.field] !== undefined) return rec[p.field];
      return "";
    }
  }

  const field = p.field ?? p.root;
  if (record && record[field] !== undefined) return record[field];
  return "";
}

function applyFormat(value: Scalar, format: SheetCell["format"]): string {
  if (value === null || value === undefined) return "";
  if (format === "rupiah") {
    const n = Number(value);
    if (!isNaN(n)) {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(n);
    }
  }
  if (format === "number") {
    const n = Number(value);
    if (!isNaN(n)) return new Intl.NumberFormat("id-ID").format(n);
  }
  if (format === "date") {
    const d = new Date(String(value));
    if (!isNaN(d.getTime())) {
      const bulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember",
      ];
      return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
    }
  }
  return String(value);
}

export function evaluateSheet(sheet: ReportSheet, ctx: EvaluateContext): EvaluatedSheet {
  const defaultDatasetName = sheet.datasetName || DEFAULT_DATASET;
  const datasets = ctx.datasets;
  // Dataset yang mengisi baris berulang lembar ini: dataset bernama bila ada,
  // jika tidak jatuh ke dataset default pemanggil (perilaku lama).
  const dataset =
    datasets && datasets[defaultDatasetName]
      ? datasets[defaultDatasetName]
      : ctx.dataset || [];
  const global = ctx.global || {};
  const plan = planRowExpansion(sheet, dataset.length);
  const occupiedInput = buildOccupiedInput(sheet);
  const outR = plan.outputInputRows.length;

  // 1) Siapkan peta baris editor → daftar baris output (untuk auto-melebar).
  const outputRowsByInput = new Map<number, number[]>();
  for (let r = 0; r < outR; r++) {
    const inputR = plan.outputInputRows[r];
    const arr = outputRowsByInput.get(inputR);
    if (arr) arr.push(r);
    else outputRowsByInput.set(inputR, [r]);
  }

  /**
   * Nilai sel editor (r,c). Rumus disimpan per-sel editor, jadi nilainya
   * berlaku untuk semua record pada baris itu.
   */
  const valueByInput = new Map<CellKey, Scalar>();
  const formulaByInput = new Map<CellKey, string>();

  const formulaCells: { r: number; c: number; inputR: number; expr: string }[] = [];
  for (let r = 0; r < outR; r++) {
    const inputR = plan.outputInputRows[r];
    for (let c = 0; c < sheet.cols; c++) {
      const cell = sheet.cells[cellKey(inputR, c)];
      if (!cell || !cell.value) continue;
      const p = parseCellValue(cell.value);
      if (p.type !== "FORMULA") continue;
      if (formulaByInput.has(cellKey(inputR, c))) continue;
      formulaByInput.set(cellKey(inputR, c), p.expr);
      formulaCells.push({ r, c, inputR, expr: p.expr });
    }
  }

  // Isi nilai non-rumus per sel editor (pakai record pertama untuk baris ulang).
  for (let r = 0; r < outR; r++) {
    const inputR = plan.outputInputRows[r];
    const recIdx = plan.recordIndexByOutput[r];
    if (recIdx > 0) continue; // cukup sekali per baris editor
    const record = recIdx >= 0 ? dataset[recIdx] : undefined;
    for (let c = 0; c < sheet.cols; c++) {
      if (occupiedInput.has(cellKey(inputR, c))) continue;
      const cell = sheet.cells[cellKey(inputR, c)];
      if (!cell || cell.value == null || cell.value === "") continue;
      const p = parseCellValue(cell.value);
      if (p.type === "FORMULA") continue;
      if (p.type === "LIST") valueByInput.set(cellKey(inputR, c), listValueForRecord(cell, record, recIdx, datasets, defaultDatasetName));
      else if (p.type === "SCALAR") valueByInput.set(cellKey(inputR, c), resolvePath(global, p.path) ?? "");
      else valueByInput.set(cellKey(inputR, c), p.raw);
    }
  }

  // Nilai sel editor untuk record ke-i (baris zona ulang → record berbeda).
  const editorValueForRecord = (inputR: number, c: number, recIdx: number): Scalar => {
    const cell = sheet.cells[cellKey(inputR, c)];
    if (!cell || cell.value == null || cell.value === "") return "";
    if (occupiedInput.has(cellKey(inputR, c))) return "";
    const p = parseCellValue(cell.value);
    if (p.type === "FORMULA") {
      return valueByInput.get(cellKey(inputR, c)) ?? "";
    }
    if (p.type === "LIST") {
      const record = recIdx >= 0 ? dataset[recIdx] : undefined;
      return listValueForRecord(cell, record, recIdx, datasets, defaultDatasetName);
    }
    return valueByInput.get(cellKey(inputR, c)) ?? "";
  };

  /** Baris output → recordIndex untuk baris input tertentu. */
  const recordsForInput = (inputR: number): number[] => {
    const rows = outputRowsByInput.get(inputR) || [];
    return rows.map((r) => plan.recordIndexByOutput[r]);
  };

  const envCache = new Map<CellKey, { getValue: FormulaEnv["getValue"]; getRange: FormulaEnv["getRange"] }>();
  const getEnvFor = (selfInputKey: CellKey) => {
    const cached = envCache.get(selfInputKey);
    if (cached) return cached;
    const editorInputR = parseCellKey(selfInputKey)!.r;
    const single: FormulaEnv["getValue"] = (rr, cc) => {
      const key = cellKey(rr, cc);
      if (formulaByInput.has(key)) return valueByInput.get(key) ?? 0;
      const recs = recordsForInput(rr);
      if (recs.length === 0) return valueByInput.get(key) ?? "";
      return editorValueForRecord(rr, cc, recs[0]);
    };
    const range: FormulaEnv["getRange"] = (rr, cc) => {
      const key = cellKey(rr, cc);
      if (formulaByInput.has(key)) return [valueByInput.get(key) ?? 0];
      const recs = recordsForInput(rr);
      if (recs.length === 0) return [valueByInput.get(key) ?? ""];
      return recs.map((rec) => editorValueForRecord(rr, cc, rec));
    };
    void editorInputR;
    const env = { getValue: single, getRange: range };
    envCache.set(selfInputKey, env);
    return env;
  };

  // Deteksi sirkularitas: graf ketergantungan antar sel rumus editor.
  const depsOf = (expr: string): CellKey[] => {
    const deps = new Set<CellKey>();
    try {
      const { tokens } = tokenize(expr);
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.t !== "ident") continue;
        const nxt = tokens[i + 1];
        const nxt2 = tokens[i + 2];
        // Lewati nama fungsi (diikuti '(').
        if (nxt?.t === "lpar") continue;
        if (nxt?.t === "colon" && nxt2?.t === "ident") {
          const refs = expandRangeRefs(t.v, nxt2.v);
          if (refs) for (const ref of refs) deps.add(cellKey(ref.r, ref.c));
          continue;
        }
        const a = parseA1(t.v);
        if (a) deps.add(cellKey(a.r, a.c));
      }
    } catch {
      /* ignore */
    }
    return Array.from(deps);
  };

  const circular = new Set<CellKey>();
  const visit = (key: CellKey, stack: Set<CellKey>): void => {
    if (stack.has(key)) {
      circular.add(key);
      return;
    }
    const expr = formulaByInput.get(key)!;
    stack.add(key);
    for (const dep of depsOf(expr)) {
      if (formulaByInput.has(dep)) {
        if (circular.has(dep)) continue;
        visit(dep, stack);
      }
    }
    stack.delete(key);
  };
  for (const key of formulaByInput.keys()) {
    if (!circular.has(key)) visit(key, new Set());
  }

  for (let pass = 0; pass < 3; pass++) {
    for (const f of formulaCells) {
      const selfKey = cellKey(f.inputR, f.c);
      if (circular.has(selfKey)) {
        valueByInput.set(selfKey, ERROR_CIRC);
        continue;
      }
      const env = getEnvFor(selfKey);
      const formulaEnv: FormulaEnv = { row: f.inputR, col: f.c, ...env };
      valueByInput.set(selfKey, evalFormula(f.expr, formulaEnv));
    }
  }

  // 3) Susun keluaran final + occupancy output.
  const cellMap = new Map<CellKey, RenderedValue>();
  const occupied = new Set<CellKey>();
  const repeatOutputRows = new Set<number>();
  const recordIndexByRow: Record<number, number> = {};

  const repeatSet = new Set(plan.repeatInputRows);
  for (let r = 0; r < outR; r++) {
    const inputR = plan.outputInputRows[r];
    recordIndexByRow[r] = plan.recordIndexByOutput[r];
    if (repeatSet.has(inputR)) repeatOutputRows.add(r);
    for (let c = 0; c < sheet.cols; c++) {
      const cell = sheet.cells[cellKey(inputR, c)];
      if (!cell) continue;
      if (occupiedInput.has(cellKey(inputR, c))) continue;
      const p = parseCellValue(cell.value);
      if (p.type !== "FORMULA" && (cell.value == null || cell.value === "")) continue;
      const raw = editorValueForRecord(inputR, c, plan.recordIndexByOutput[r]);
      if (raw === undefined) continue;
      cellMap.set(cellKey(r, c), { text: applyFormat(raw, cell.format) });
      // tandai rowSpan di output
      const span = cell.rowSpan ?? 1;
      for (let rr = r + 1; rr < r + span && rr < outR; rr++) {
        occupied.add(cellKey(rr, c));
      }
    }
  }

  return {
    sheetId: sheet.id,
    outputRows: outR,
    cellMap,
    occupied,
    recordIndexByRow,
    inputRowByOutput: plan.outputInputRows,
    repeatOutputRows,
  };
}

export function evaluateWorkbook(workbook: ReportWorkbook, ctx: EvaluateContext): EvaluatedWorkbook {
  return { sheets: workbook.sheets.map((s) => evaluateSheet(s, ctx)) };
}

// ─────────────────────────────────────────────────────────────────────────
// Migrasi v1/v2 (pages/blocks) → v3 (sheets/cells)
// ─────────────────────────────────────────────────────────────────────────

function blockToCellValues(block: ReportBlockInstance): { value: string; bold?: boolean; fontSize?: number }[] {
  const d = block.data || {};
  switch (block.blockId) {
    case "kop_laporan":
      return [
        { value: "{{sekolah.governanceLine}}", bold: true },
        { value: "{{sekolah.departmentLine}}", bold: true },
        { value: "{{sekolah.schoolName}}", bold: true, fontSize: 13 },
        { value: "{{sekolah.address}} • Telp: {{sekolah.phone}} • {{sekolah.email}}" },
      ];
    case "judul_laporan":
      return [
        { value: String(d.judul || "LAPORAN"), bold: true, fontSize: 13 },
        { value: String(d.subjudul || "Periode Laporan") },
      ];
    case "metadata_filter":
      return [{ value: String(d.keterangan || "") }];
    case "ringkasan_kpi":
      return (Array.isArray(d.items) ? d.items : []).map((it: any) => ({
        value: `${it.label || ""}: {{${it.key || ""}}}`,
        bold: true,
      }));
    case "catatan_penutup":
      return [{ value: String(d.text || "") }];
    case "tanda_tangan":
      return [
        { value: String(d.jabatan || "Kepala Sekolah") },
        { value: `{{principal.nama}}` , bold: true },
        { value: "{{principal.nip}}" },
      ];
    case "tanda_tangan_ganda":
      return [
        { value: String(d.kiri_jabatan || "Pihak I") },
        { value: String(d.kiri_nama || "") , bold: true },
        { value: String(d.kanan_jabatan || "Kepala Sekolah") },
        { value: String(d.kanan_nama || "") , bold: true },
      ];
    default:
      return [];
  }
}

/** Konversi satu blok tabel lama menjadi header + baris template + footer. */
function migrateTableBlock(sheet: ReportSheet, block: ReportBlockInstance, startRow: number, cols: number): number {
  const d = block.data || {};
  const columns: any[] = Array.isArray(d.columns) ? d.columns : [];
  let r = startRow;
  const visible = columns.filter((c) => !c.hidden);
  if (visible.length === 0) return r;

  // Header kolom
  for (let i = 0; i < visible.length && i < cols; i++) {
    sheet.cells[cellKey(r, i)] = { value: String(visible[i].label || visible[i].key), bold: true, border: "all", align: visible[i].align || "left" };
  }
  r++;

  // Baris template berulang
  for (let i = 0; i < visible.length && i < cols; i++) {
    const col = visible[i];
    const isNo = col.key === "no";
    sheet.cells[cellKey(r, i)] = {
      value: isNo ? "{no}" : `{${col.key}}`,
      border: "all",
      align: col.align || "left",
      format: col.format || "text",
    };
  }
  r++;

  // Footer total manual (rumus SUM) jika ada autoSum
  const anySum = visible.some((c) => c.autoSum);
  if (anySum) {
    sheet.cells[cellKey(r, 0)] = { value: "TOTAL", bold: true, border: "all", align: "center" };
    const templateRowA1 = startRow + 2; // baris template (1-indexed +1)
    for (let i = 0; i < visible.length && i < cols; i++) {
      if (!visible[i].autoSum) continue;
      const colLetter = indexToColLetters(i);
      // Range mengacu baris template; saat output, pengguna dapat menyesuaikan rumus.
      sheet.cells[cellKey(r, i)] = {
        value: `=SUM(${colLetter}${templateRowA1}:${colLetter}${templateRowA1})`,
        bold: true,
        border: "all",
        align: visible[i].align || "right",
        format: visible[i].format || "text",
      };
    }
    r++;
  }
  return r;
}

function indexToColLetters(c: number): string {
  let n = c + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/**
 * Migrasi dokumen apapun (v1/v2) menjadi workbook v3. Menggunakan
 * migrateReportDocument untuk menormalkan dulu ke v2, lalu konversi ke sel.
 */
export function migrateReportWorkbook(input: any): ReportWorkbook {
  const doc: ReportDocumentData = migrateReportDocument(input);
  const cols = Math.max(6, 1);
  const sheet = createSheet({ name: "Lembar 1", cols, colWidths: defaultColWidths(cols) });

  let r = 0;
  for (const page of doc.pages || []) {
    r = migratePageToCells(sheet, page, r, cols);
    r += 1;
  }

  return {
    schemaVersion: REPORT_SHEET_SCHEMA_VERSION,
    reportCode: doc.reportCode,
    reportName: doc.reportName,
    category: doc.category,
    paperSize: doc.paperSize,
    orientation: doc.orientation,
    showFooter: doc.showFooter,
    density: doc.density,
    margin: doc.margin,
    typography: doc.typography,
    headerRepeat: doc.headerRepeat,
    sheets: [sheet],
  };
}

function migratePageToCells(sheet: ReportSheet, page: ReportPage, startRow: number, cols: number): number {
  let r = startRow;
  for (const row of page.rows || []) {
    const blocks: ReportBlockInstance[] = [];
    for (const col of row.columns || []) blocks.push(...(col.blocks || []));
    for (const block of blocks) {
      if (block.enabled === false) continue;
      if (block.blockId === "tabel_laporan") {
        r = migrateTableBlock(sheet, block, r, cols);
        continue;
      }
      const values = blockToCellValues(block);
      for (const v of values) {
        sheet.cells[cellKey(r, 0)] = { value: v.value, bold: v.bold, fontSize: v.fontSize };
        r++;
      }
      r++;
    }
  }
  return r;
}

// ─────────────────────────────────────────────────────────────────────────
// Serialisasi
// ─────────────────────────────────────────────────────────────────────────

/** Normalisasi gambar dari input tak tepercaya; buang entri tanpa src valid. */
function normalizeImages(raw: unknown[]): ReportImage[] {
  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && isFinite(v) ? v : fallback;
  return raw.flatMap((s, i): ReportImage[] => {
    if (!s || typeof s !== "object" || Array.isArray(s)) return [];
    const img = s as Record<string, unknown>;
    if (typeof img.src !== "string" || !img.src) return [];
    return [{
      id: typeof img.id === "string" && img.id ? img.id : `image-${i}`,
      src: img.src,
      x: num(img.x, 0),
      y: num(img.y, 0),
      width: Math.max(1, num(img.width, 80)),
      height: Math.max(1, num(img.height, 80)),
      rotation: img.rotation === undefined ? undefined : num(img.rotation, 0),
    }];
  });
}

export function serializeWorkbook(wb: ReportWorkbook): string {
  return JSON.stringify(wb);
}

/** Normalisasi shape dari input tak tepercaya; buang entri yang tidak valid. */
function normalizeShapes(raw: unknown[]): ReportShape[] {
  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && isFinite(v) ? v : fallback;
  const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
  return raw.flatMap((s, i): ReportShape[] => {
    if (!s || typeof s !== "object" || Array.isArray(s)) return [];
    const shape = s as Record<string, unknown>;
    const type = shape.type;
    if (type !== "line" && type !== "rect" && type !== "ellipse") return [];
    return [{
      id: typeof shape.id === "string" && shape.id ? shape.id : `shape-${i}`,
      type,
      x: num(shape.x, 0),
      y: num(shape.y, 0),
      width: Math.max(0, num(shape.width, 100)),
      height: Math.max(0, num(shape.height, 0)),
      fill: str(shape.fill),
      stroke: str(shape.stroke),
      strokeWidth: shape.strokeWidth === undefined ? undefined : Math.max(0, num(shape.strokeWidth, 1)),
      rotation: shape.rotation === undefined ? undefined : num(shape.rotation, 0),
    }];
  });
}

export function deserializeWorkbook(jsonStr: string): ReportWorkbook {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("JSON template tidak valid");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Struktur template tidak dikenali");
  }
  if (parsed.schemaVersion === REPORT_SHEET_SCHEMA_VERSION) {
    if (!Array.isArray(parsed.sheets)) throw new Error("Struktur sheet v3 tidak valid");
    const sheets = parsed.sheets.map((sheet: any, index: number): ReportSheet => {
      if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) throw new Error("Struktur sheet v3 tidak valid");
      const cols = Number(sheet.cols);
      if (!Number.isInteger(cols) || cols < 1 || cols > 1000) throw new Error("Jumlah kolom sheet v3 tidak valid");
      if (!sheet.cells || typeof sheet.cells !== "object" || Array.isArray(sheet.cells)) throw new Error("Sel sheet v3 tidak valid");
      for (const [key, cell] of Object.entries(sheet.cells)) {
        const address = parseCellKey(key);
        if (!address || address.c >= cols || !cell || typeof cell !== "object" || Array.isArray(cell)) {
          throw new Error("Sel sheet v3 tidak valid");
        }
      }
      return {
        ...sheet,
        id: typeof sheet.id === "string" && sheet.id ? sheet.id : `sheet-${index + 1}`,
        name: typeof sheet.name === "string" && sheet.name ? sheet.name : `Lembar ${index + 1}`,
        cols,
        colWidths: Array.isArray(sheet.colWidths) && sheet.colWidths.length === cols
          ? sheet.colWidths.map((width: unknown) => typeof width === "number" && isFinite(width) && width > 0 ? width : 96)
          : defaultColWidths(cols),
        cells: sheet.cells,
        ...(Array.isArray(sheet.shapes) ? { shapes: normalizeShapes(sheet.shapes) } : {}),
        ...(Array.isArray(sheet.images) ? { images: normalizeImages(sheet.images) } : {}),
      };
    });
    return { ...createDefaultWorkbook(), ...parsed, sheets };
  }
  if (Object.prototype.hasOwnProperty.call(parsed, "sheets")) {
    throw new Error("Versi schema sheet tidak didukung");
  }
  if (Array.isArray(parsed.pages)) return migrateReportWorkbook(parsed);
  throw new Error("Struktur template tidak dikenali");
}

export function createDefaultWorkbook(opts?: { reportCode?: string; reportName?: string; category?: string; module?: string }): ReportWorkbook {
  const cols = 6;
  // Kertas kerja default KOSONG: admin mulai dari lembar kosong.
  const sheet = createSheet({ name: "Lembar 1", cols, colWidths: defaultColWidths(cols) });
  return {
    schemaVersion: REPORT_SHEET_SCHEMA_VERSION,
    reportCode: opts?.reportCode || "RPT_CUSTOM",
    reportName: opts?.reportName || "Laporan Custom",
    category: opts?.category || "Umum",
    module: opts?.module || "umum",
    paperSize: "A4",
    orientation: "portrait",
    showFooter: true,
    density: "normal",
    margin: { top: 36, bottom: 45, left: 40, right: 40 },
    typography: { baseFontSize: 11, tableFontSize: 11, lineHeight: 1.4, rowPadding: 4, blockGap: 8 },
    headerRepeat: true,
    datasets: [{ name: DEFAULT_DATASET, label: "Data Utama", module: opts?.module || "umum" }],
    sheets: [sheet],
  };
}

export { normalizedColWidths };
