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

/** Opsi render worksheet → HTML. */
export interface WorksheetRenderOptions {
  /** Lebar area cetak (px). Bila diberikan dan sheet lebih lebar, lebar
   *  kolom colgroup dikalikan skala agar selalu muat selebar halaman
   *  (replikasi fitToWidth=1 Excel). Tinggi TIDAK diklamp: konten mengalir
   *  natural ke halaman lanjutan — wrapper transform/satu-halaman sengaja
   *  tidak dipakai karena konten ter-transform hanya tergambar di hal.1. */
  fitWidthPx?: number;
}

/** Dimensi kertas (mm) yang didukung — konsisten dengan model laporan. */
export const PAPER_MM: Record<string, [number, number]> = {
  A4: [210, 297],
  F4: [215, 330],
  LEGAL: [216, 356],
};

/** EMU (English Metric Units) per pixel CSS @96dpi. exceljs melaporkan offset
 *  anchor gambar (colOff/rowOff) dalam EMU: 914400 EMU = 1 inch = 96px. */
export const EMU_PER_PX = 914400 / 96;

/** Ukuran area printable (px) dari paperSize + orientasi + margin. */
export function printAreaPx(opts: WorksheetPrintOptions = {}): [number, number] {
  const key = (opts.paperSize || "A4").trim().toUpperCase();
  const [w0, h0] = PAPER_MM[key] || PAPER_MM.A4;
  const landscape = (opts.orientation || "portrait").toLowerCase() === "landscape";
  const w = landscape ? h0 : w0;
  const h = landscape ? w0 : h0;
  const margin = opts.marginMm ?? 5;
  const px = (mm: number) => Math.round((mm * 96) / 25.4);
  return [px(w - 2 * margin), px(h - 2 * margin)];
}

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
table.ws { border-collapse: collapse; table-layout: fixed; max-width: 100%; }
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
  /** Nilai sel yang sudah ada (exceljs Row.values) — membaca TANPA membuat sel baru. */
  values?: Record<number, unknown>;
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

/** Gambar (logo kop dll) dari worksheet untuk dirender absolute di HTML. */
export interface PrintImage {
  src: string;
  tl: { row: number; col: number; colOff: number; rowOff: number };
  br: { row: number; col: number; colOff: number; rowOff: number };
}

/**
 * Ekstrak gambar worksheet (ws.getImages + wb.getImage) jadi data URI.
 * Buffer exceljs di-browser dikonversi manual ke base64 (btoa).
 */
export function extractPrintImages(
  ws: unknown,
  getImage: (id: number) => { extension?: string; base64?: string; buffer?: Uint8Array | ArrayBuffer } | undefined | null
): PrintImage[] {
  const wsg = ws as {
    getImages?: () => { imageId: string | number; range?: { tl?: Record<string, number>; br?: Record<string, number> } }[];
  };
  if (typeof wsg.getImages !== "function") return [];
  const toDataUri = (meta: { extension?: string; base64?: string; buffer?: Uint8Array | ArrayBuffer }): string | null => {
    const mime = `image/${meta.extension || "png"}`;
    if (meta.base64) return `data:${mime};base64,${meta.base64}`;
    if (meta.buffer && (meta.buffer as ArrayBuffer).byteLength) {
      const bytes = meta.buffer instanceof Uint8Array ? meta.buffer : new Uint8Array(meta.buffer);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      try {
        return `data:${mime};base64,${btoa(bin)}`;
      } catch {
        return null;
      }
    }
    return null;
  };
  const out: PrintImage[] = [];
  let list: ReturnType<NonNullable<typeof wsg.getImages>> = [];
  try {
    list = wsg.getImages();
  } catch {
    return [];
  }
  for (const im of list) {
    const meta = getImage(Number(im.imageId));
    if (!meta) continue;
    const src = toDataUri(meta);
    const tl = im.range?.tl;
    const br = im.range?.br;
    if (!src || !tl || !br) continue;
    out.push({
      src,
      tl: {
        row: tl.nativeRow ?? tl.row ?? 0,
        col: tl.nativeCol ?? tl.col ?? 0,
        colOff: tl.nativeColOff ?? 0,
        rowOff: tl.nativeRowOff ?? 0,
      },
      br: {
        row: br.nativeRow ?? br.row ?? 0,
        col: br.nativeCol ?? br.col ?? 0,
        colOff: br.nativeColOff ?? 0,
        rowOff: br.nativeRowOff ?? 0,
      },
    });
  }
  return out;
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
 * Gambar (images, 0-based anchor) dirender absolute di atas tabel —
 * dipakai untuk logo kop template resmi.
 */
export function worksheetToHtml(
  ws: ExcelSheetLike,
  images: PrintImage[] = [],
  renderOpts: WorksheetRenderOptions = {}
): string {
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

  const colCountRaw = Math.min(ws.columnCount || 64, 64);
  // Buang kolom hantu di ujung: sel kosong bekas loop fill (tanpa lebar
  // terdefinisi, tanpa isi, tanpa merge) jangan ikut dirender — kolom hantu
  // melebarkan naturalW sehingga skala fit-to-page runtuh dan konten hanya
  // mengisi pojok kiri atas lembar (insiden 2026-10-08: 64 kolom → scale 0.43).
  let colCount = 1;
  for (let c = 1; c <= colCountRaw; c++) {
    if (ws.getColumn?.(c)?.width !== undefined) colCount = c;
  }
  if (colCount < colCountRaw) {
    ws.eachRow((row) => {
      const vals = row.values;
      if (!vals) return;
      for (let c = colCount + 1; c <= colCountRaw; c++) {
        const v = vals[c];
        if (v !== undefined && v !== null && v !== "") colCount = c;
      }
    });
  }
  for (const mg of merges) colCount = Math.max(colCount, Math.min(mg.right + 1, colCountRaw));

  // Lebar kolom: exceljs width (satuan karakter) → px.
  const colWidths: number[] = [];
  for (let c = 1; c <= colCount; c++) {
    const w = ws.getColumn?.(c)?.width;
    colWidths.push(Math.round((w ?? 8.43) * 7 + 5));
  }
  let naturalW = colWidths.reduce((a, b) => a + b, 0);

  // Fit KOLOM (replikasi fitToWidth=1): skala lebar saja — kalikan lebar
  // kolom agar total pas selebar area cetak. Tanpa transform: tabel mengalir
  // natural & pecah halaman di browser/Chromium (transform+overflow:hidden
  // hanya menggambar konten di halaman pertama). Tinggi bebas → multi-halaman.
  const fitW = renderOpts.fitWidthPx;
  if (fitW && naturalW > fitW && colWidths.length > 0) {
    const scale = fitW / naturalW;
    let sum = 0;
    for (let i = 0; i < colWidths.length; i++) {
      colWidths[i] = Math.max(1, Math.round(colWidths[i] * scale));
      sum += colWidths[i];
    }
    // Koreksi pembulatan agar jumlah kolom PAS = fitW (pilih kolom terakhir).
    const last = colWidths.length - 1;
    colWidths[last] = Math.max(1, colWidths[last] + (fitW - sum));
    naturalW = colWidths.reduce((a, b) => a + b, 0);
  }
  const widths = colWidths.map((px) => `<col style="width:${px}px">`);

  // Tinggi baris (points → px); default Excel 15pt = 20px.
  const rowHeightPx = (rowNumber: number): number => {
    const h = ws.getRow(rowNumber)?.height;
    return h ? Math.round(h * (96 / 72)) : 20;
  };

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

  // Width eksplisit = jumlah colgroup. `width: max-content` (CSS) membuat
  // Chromium menghitung ulang lebar kolom dari konten sel; width inline ini
  // memaksa table-layout: fixed mengikuti colgroup persis.
  const table =
    `<table class="ws" style="width:${naturalW}px"><colgroup>${widths.join("")}</colgroup><tbody>` +
    rows.join("") +
    `</tbody></table>`;

  // Posisi gambar: akumulasi lebar kolom (sudah termasuk skala fit) + tinggi
  // baris (anchor 0-based). colOff/rowOff dari exceljs dalam EMU → px.
  const imgHtml = images
    .map((img) => {
      let left = 0;
      for (let c = 0; c < img.tl.col; c++) left += colWidths[c] ?? 74;
      left += img.tl.colOff / EMU_PER_PX;
      let top = 0;
      for (let r = 0; r < img.tl.row; r++) top += rowHeightPx(r + 1);
      top += img.tl.rowOff / EMU_PER_PX;
      // Lebar = jumlah kolom yang direntang + delta offset (EMU→px).
      let w = 0;
      for (let c = img.tl.col; c < img.br.col; c++) w += colWidths[c] ?? 74;
      w += (img.br.colOff - img.tl.colOff) / EMU_PER_PX;
      let h = 0;
      for (let r = img.tl.row; r < img.br.row; r++) h += rowHeightPx(r + 1);
      h += (img.br.rowOff - img.tl.rowOff) / EMU_PER_PX;
      return `<img src="${img.src}" alt="" style="position:absolute;left:${Math.round(left)}px;top:${Math.round(top)}px;width:${Math.max(8, Math.round(w))}px;height:${Math.max(8, Math.round(h))}px">`;
    })
    .join("");

  return images.length === 0
    ? table
    : `<div style="position:relative;display:inline-block;max-width:100%">${imgHtml}${table}</div>`;
}

/**
 * Bungkus HTML cetak jadi dokumen lengkap: doctype + `<title>` + `<style>`
 * berisi `@page` (ukuran kertas/orientasi) + BASE_CSS (reset, `table.ws`,
 * page-break antar blok kelas). Dipakai dialog cetak DAN kiriman ke engine
 * PDF server (Chromium) — fragment mentah tanpa dokumen membuat Chromium
 * merender di Letter portrait tanpa style → hasil rusak.
 */
export function buildPrintDocument(
  html: string,
  opts: WorksheetPrintOptions = {},
  title = "Cetak"
): string {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">` +
    `<title>${escapeHtml(title)}</title>` +
    `<style>${pageCss(opts)}${BASE_CSS}</style></head><body>${html}</body></html>`;
}

/**
 * Buka jendela cetak berisi HTML (satu blok per kelas, page-break antar
 * blok) → auto print dialog (pilih Save as PDF di sana).
 */
export function openPrintWindow(html: string, title: string, opts: WorksheetPrintOptions = {}): void {
  const w = window.open("", "_blank");
  if (!w) throw new Error("Jendela cetak diblokir browser — izinkan popup untuk situs ini.");
  const doc = buildPrintDocument(html, opts, title);
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
