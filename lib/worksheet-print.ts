/**
 * worksheet-print.ts — Render worksheet ExcelJS (sudah diisi template
 * presensi) menjadi HTML siap cetak.
 *
 * Dipakai tombol Cetak → PDF pada Laporan Presensi: template Excel yang
 * sama (merge, warna status, blok merah libur, kop, tanda tangan)
 * dirender ke HTML → jendela cetak browser → "Save as PDF".
 * Dengan begini hasil PDF mengikuti format template terdaftar, bukan
 * layout hardcoded.
 *
 * Rumus Excel tidak dihitung di sini: cell formula ditampilkan dari
 * `result` yang sudah diisi oleh fillPresensiWorksheet.
 */

/** Pilihan cetak dari template. */
export interface WorksheetPrintOptions {
  /** A4 | F4 | LEGAL (default A4). */
  paperSize?: string;
  orientation?: string;
  /** Margin kertas dalam mm (default 5). */
  marginMm?: number;
}

/** Dimensi kertas (mm) yang didukung — konsisten dengan model laporan. */
export const PAPER_MM: Record<string, [number, number]> = {
  A4: [210, 297],
  F4: [215, 330],
  LEGAL: [216, 356],
};

/** Escape teks untuk disisipkan aman ke HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "FFRRGGBB" (argb exceljs) → "#RRGGBB"; null/aneh → fallback. */
export function argbToHex(argb: unknown, fallback = ""): string {
  if (typeof argb !== "string") return fallback;
  const hex = argb.length === 8 ? argb.slice(2) : argb;
  return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex.toUpperCase()}` : fallback;
}

/** CSS @page dari ukuran kertas + orientasi (mm). */
export function pageCss(opts: WorksheetPrintOptions = {}): string {
  const key = (opts.paperSize || "A4").trim().toUpperCase();
  const [w0, h0] = PAPER_MM[key] || PAPER_MM.A4;
  const landscape = (opts.orientation || "portrait").toLowerCase() === "landscape";
  const w = landscape ? h0 : w0;
  const h = landscape ? w0 : h0;
  const margin = opts.marginMm ?? 5;
  return `@page { size: ${w}mm ${h}mm; margin: ${margin}mm; }`;
}

const BASE_CSS = `
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
table.ws { border-collapse: collapse; table-layout: fixed; width: max-content; max-width: 100%; }
table.ws td { vertical-align: middle; overflow: hidden; }
.page-section { page-break-after: always; break-after: page; }
.page-section:last-child { page-break-after: auto; break-after: auto; }
@media screen {
  body { background: #e2e8f0; padding: 16px; }
  table.ws { background: #fff; margin: 0 auto 24px; box-shadow: 0 1px 6px rgb(0 0 0 / 0.18); }
}
`;

interface ExcelCellLike {
  value?: unknown;
  font?: {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean | string;
    color?: { argb?: string };
  };
  fill?: {
    type?: string;
    fgColor?: { argb?: string };
  };
  alignment?: {
    horizontal?: string;
    vertical?: string;
    wrapText?: boolean;
  };
  border?: Record<string, { style?: string; color?: { argb?: string } } | undefined>;
}

interface ExcelRowLike {
  height?: number;
  getCell(c: number): ExcelCellLike;
}

interface ExcelSheetLike {
  rowCount: number;
  columnCount?: number;
  model?: { merges?: readonly string[] };
  eachRow(
    a: ((row: ExcelRowLike, rowNumber: number) => void) | { includeEmpty?: boolean },
    b?: (row: ExcelRowLike, rowNumber: number) => void
  ): void;
  getRow(n: number): ExcelRowLike;
  getColumn?(n: number): { width?: number };
}

/** Nilai sel exceljs → teks tampil (formula memakai result). */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return value.toLocaleDateString("id-ID");
  if (typeof value === "object") {
    const v = value as {
      formula?: string;
      result?: unknown;
      richText?: { text?: string }[];
      text?: string;
      error?: string;
    };
    if (v.result !== undefined && v.result !== null) return cellText(v.result);
    if (v.formula !== undefined) return ""; // tanpa hasil → kosong
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text || "").join("");
    if (typeof v.text === "string") return v.text;
    if (typeof v.error === "string") return v.error;
  }
  return "";
}

/** Style sel exceljs → atribut style inline HTML. */
export function cellStyleCss(cell: ExcelCellLike): string {
  const parts: string[] = [];
  const f = cell.font;
  if (f?.name) parts.push(`font-family:${JSON.stringify(f.name)},Arial,sans-serif`);
  if (f?.size) parts.push(`font-size:${f.size}pt`);
  if (f?.bold) parts.push("font-weight:700");
  if (f?.italic) parts.push("font-style:italic");
  if (f?.underline) parts.push("text-decoration:underline");
  const color = argbToHex(f?.color?.argb);
  if (color) parts.push(`color:${color}`);

  const bg = argbToHex(cell.fill?.fgColor?.argb);
  if (bg && cell.fill?.type !== undefined) parts.push(`background-color:${bg}`);

  const a = cell.alignment;
  if (a?.horizontal === "center" || a?.horizontal === "middle") parts.push("text-align:center");
  else if (a?.horizontal === "right") parts.push("text-align:right");
  if (a?.vertical === "top") parts.push("vertical-align:top");
  else if (a?.vertical === "bottom") parts.push("vertical-align:bottom");
  parts.push(a?.wrapText ? "white-space:normal;word-break:break-word" : "white-space:nowrap");

  // Border per sisi (exceljs: { top: { style, color } }).
  const sides: [string, string][] = [
    ["top", "border-top"],
    ["bottom", "border-bottom"],
    ["left", "border-left"],
    ["right", "border-right"],
  ];
  for (const [key, css] of sides) {
    const b = cell.border?.[key];
    if (b?.style) {
      const c = argbToHex(b.color?.argb, "#000000");
      parts.push(`${css}:1px solid ${c}`);
    }
  }
  return parts.join(";");
}

interface MergeRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

function parseMerges(refs: readonly string[]): MergeRange[] {
  const out: MergeRange[] = [];
  for (const ref of refs) {
    const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref);
    if (!m) continue;
    const colNum = (s: string) => {
      let n = 0;
      for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
      return n;
    };
    out.push({
      left: colNum(m[1]),
      right: colNum(m[3]),
      top: Number(m[2]),
      bottom: Number(m[4]),
    });
  }
  return out;
}

/**
 * Render worksheet exceljs → string HTML `<table>` (inline style).
 * Merge → colspan/rowspan; sel di dalam merge (bukan anchor) dilewati.
 */
export function worksheetToHtml(ws: ExcelSheetLike): string {
  const merges = parseMerges(ws.model?.merges ?? []);
  const mergeAt = new Map<string, MergeRange>();
  const inside = new Set<string>();
  for (const mg of merges) {
    mergeAt.set(`${mg.top},${mg.left}`, mg);
    for (let r = mg.top; r <= mg.bottom; r++) {
      for (let c = mg.left; c <= mg.right; c++) {
        if (r !== mg.top || c !== mg.left) inside.add(`${r},${c}`);
      }
    }
  }

  const colCount = Math.min(ws.columnCount || 64, 64);

  // Lebar kolom: exceljs width (satuan karakter) → px.
  const widths: string[] = [];
  for (let c = 1; c <= colCount; c++) {
    const w = ws.getColumn?.(c)?.width;
    widths.push(`<col style="width:${Math.round((w ?? 8.43) * 7 + 5)}px">`);
  }

  const rows: string[] = [];
  // exceljs: eachRow(options, iteratee) — baris kosong tetap dirender
  // agar jarak antar blok (kop/signature) dipertahankan.
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    for (let c = 1; c <= colCount; c++) {
      const key = `${rowNumber},${c}`;
      if (inside.has(key)) continue;
      const cell = row.getCell(c);
      const mg = mergeAt.get(key);
      const span: string[] = [];
      if (mg) {
        if (mg.right > mg.left) span.push(`colspan="${mg.right - mg.left + 1}"`);
        if (mg.bottom > mg.top) span.push(`rowspan="${mg.bottom - mg.top + 1}"`);
      }
      const text = cellText(cell.value);
      const css = cellStyleCss(cell);
      cells.push(`<td ${span.join(" ")} style="${css}">${escapeHtml(text)}</td>`);
    }
    if (cells.length === 0) cells.push(`<td style="border:none"></td>`);
    const height = row.height ? ` style="height:${row.height}pt"` : "";
    rows.push(`<tr${height}>${cells.join("")}</tr>`);
  });

  return (
    `<table class="ws"><colgroup>${widths.join("")}</colgroup><tbody>` +
    rows.join("") +
    `</tbody></table>`
  );
}

/**
 * Buka jendela cetak berisi HTML (satu blok per kelas, page-break antar
 * blok) → auto print dialog (pilih Save as PDF di sana).
 */
export function openPrintWindow(html: string, title: string, opts: WorksheetPrintOptions = {}): void {
  const w = window.open("", "_blank");
  if (!w) throw new Error("Jendela cetak diblokir browser — izinkan popup untuk situs ini.");
  const doc = `<!doctype html><html lang="id"><head><meta charset="utf-8">` +
    `<title>${escapeHtml(title)}</title>` +
    `<style>${pageCss(opts)}${BASE_CSS}</style></head><body>${html}</body></html>`;
  w.document.write(doc);
  w.document.close();
  w.focus();
  // Beri waktu render layout/font sebelum dialog cetak muncul.
  setTimeout(() => w.print(), 400);
}

/** Bungkus hasil render beberapa kelas jadi satu dokumen (page-break per kelas). */
export function joinPageSections(sectionHtml: string[]): string {
  return sectionHtml
    .map((s) => `<div class="page-section">${s}</div>`)
    .join("");
}
