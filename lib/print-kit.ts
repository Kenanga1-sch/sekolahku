/**
 * Print-kit: peralatan cetak xlsx→PDF bersama lintas modul.
 *
 * "Cara cetak yang benar" (fit kolom, margin 10mm, centering, kode kertas,
 * normalisasi path template privat) terkunci di sini — modul lain cukup:
 *   resolveModuleTemplate → fill worksheet sendiri (+ applyPrintPageSetup)
 *   → convertXlsxToPdf → downloadPdf.
 * Panduan & jebakan yang sudah diketahui: docs/cetak-format-baru.md.
 *
 * Endpoint konversi (/api/presensi/pdf/libreoffice) dipakai apa adanya
 * lintas modul: backend soffice + qpdf (merge multi-file) netral terhadap
 * isi workbook. Ganti path bila suatu saat dipindah ke /api/pdf/libreoffice.
 */
import { resolveUploadUrl } from "./upload-url";

/** Pemetaan ukuran kertas → kode ECMA-376 untuk worksheet.pageSetup.paperSize. */
export const PAPER_SIZE_CODES: Record<string, number> = {
  A4: 9,
  F4: 14, // Folio 215,9×330,2 mm — padanan F4
  LEGAL: 5,
};

export interface PrintPageSetupTarget {
  pageSetup?: Record<string, unknown>;
}

export interface PrintPageSetupOptions {
  paperSize?: string;
  orientation?: string;
  /** Margin (mm) dari pengaturan cetak; default 10 mm seragam. */
  settings?: PrintSettings;
}

/** Pengaturan cetak per modul (tersimpan di backend, dibaca saat cetak). */
export interface PrintSettings {
  /** Margin kertas (mm) — default 10 seragam. */
  marginTopMm?: number;
  marginBottomMm?: number;
  marginLeftMm?: number;
  marginRightMm?: number;
  /** Ulang kop/header tabel di halaman lanjutan. */
  repeatHeader?: boolean;
}

export const DEFAULT_PRINT_SETTINGS: Required<PrintSettings> = {
  marginTopMm: 10,
  marginBottomMm: 10,
  marginLeftMm: 10,
  marginRightMm: 10,
  repeatHeader: false,
};

const MM_PER_INCH = 25.4;

function marginsInch(settings: PrintSettings = {}) {
  const s = { ...DEFAULT_PRINT_SETTINGS, ...settings };
  return {
    top: s.marginTopMm / MM_PER_INCH,
    bottom: s.marginBottomMm / MM_PER_INCH,
    left: s.marginLeftMm / MM_PER_INCH,
    right: s.marginRightMm / MM_PER_INCH,
    header: 0.1,
    footer: 0.1,
  };
}

/**
 * Terapkan pageSetup tervalidasi ke worksheet exceljs apa pun:
 *   - fit KOLOM saja (fitToWidth=1, fitToHeight=0) — kelas kecil 1 halaman,
 *     kelas besar lanjut seperti print Excel; jangan pernah fitToHeight=1
 *     (skala 43–50% → teks mengecil tak wajar),
 *   - margin 10mm (0,4in) seragam — margin bawaan template (mis. WPS)
 *     membuang tempat,
 *   - horizontalCentered — lebar kolom LO ≠ px exceljs; tanpa ini konten
 *     mepet kiri (insiden 2026-10-08),
 *   - paperSize kode ECMA-376 dari PAPER_SIZE_CODES.
 *
 * No-op bila paperSize kosong/tak dikenal (template tanpa meta aman).
 */
export function applyPrintPageSetup(ws: PrintPageSetupTarget, opts: PrintPageSetupOptions): void {
  if (!opts.paperSize) return;
  const paperCode = PAPER_SIZE_CODES[opts.paperSize.trim().toUpperCase()];
  if (paperCode === undefined) return;
  ws.pageSetup = {
    ...(ws.pageSetup || {}),
    paperSize: paperCode,
    orientation: (opts.orientation || "portrait").toLowerCase() === "landscape" ? "landscape" : "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    // Satuan exceljs = INCH (1 in = 25,4 mm).
    margins: marginsInch(opts.settings),
    horizontalCentered: true,
  };
}


const PAPER_MM_SIZE: Record<string, [number, number]> = {
  A4: [210, 297],
  F4: [215, 330],
  LEGAL: [216, 356],
};

/** Tinggi area cetak (pt) setelah margin, sesuai orientasi. */
export function printableHeightPt(
  paperSize: string | undefined,
  orientation: string | undefined,
  settings: PrintSettings = {}
): number {
  const s = { ...DEFAULT_PRINT_SETTINGS, ...settings };
  const [w, h] = PAPER_MM_SIZE[(paperSize || "A4").trim().toUpperCase()] || PAPER_MM_SIZE.A4;
  const landscape = (orientation || "portrait").toLowerCase() === "landscape";
  const pageH = landscape ? w : h;
  const mm = pageH - s.marginTopMm - s.marginBottomMm;
  return (mm / 25.4) * 72;
}

export interface PaginationOptions {
  paperSize?: string;
  orientation?: string;
  settings?: PrintSettings;
  /** Baris (1-based) pertama dan terakhir data (siswa/item). */
  dataStartRow: number;
  dataEndRow: number;
  /** Jumlah baris data yang ikut pindah ke halaman terakhir bersama blok TTD. */
  keepRows: number;
  /** Baris (1-based) blok tanda tangan — marker {{ttd_mulai}} / {{ttd_selesai}}. */
  signatureStartRow: number;
  signatureEndRow: number;
}

interface PaginatableWorksheet {
  rowCount: number;
  getRow(n: number): { height?: number };
  rowBreaks: { id: number; max: number; man: number }[];
}

const DEFAULT_ROW_PT = 15;

/**
 * Pagination otomatis tanpa mengubah isi template:
 *   - halaman 1 berisi header + baris data (dataStart..dataEnd−keepRows),
 *     tinggi baris data DINAIKKAN agar halaman 1 terisi penuh (tidak pernah
 *     diturunkan dari tinggi asli),
 *   - halaman terakhir berisi keepRows baris data terakhir + baris Jumlah +
 *     blok TTD, dipisahkan page break manual sehingga blok TTD selalu utuh,
 *   - bila seluruh isi muat satu halaman, tidak ada perubahan.
 * Mengembalikan false bila tidak bisa diatur (blok terlalu tinggi).
 */
export function applyPagination(ws: PaginatableWorksheet, opts: PaginationOptions): boolean {
  const { dataStartRow: dStart, dataEndRow: dEnd, signatureEndRow: sEnd } = opts;
  if (!dStart || !dEnd || !sEnd || dEnd < dStart) return false;
  const keep = Math.max(0, Math.min(opts.keepRows, dEnd - dStart));
  const pageH = printableHeightPt(opts.paperSize, opts.orientation, opts.settings);
  const rowH = (n: number) => {
    const h = ws.getRow(n).height;
    return typeof h === "number" && h > 0 ? h : DEFAULT_ROW_PT;
  };
  const sumRows = (from: number, to: number) => {
    let t = 0;
    for (let n = from; n <= to; n++) t += rowH(n);
    return t;
  };

  const natural = sumRows(1, Math.max(ws.rowCount, sEnd));
  if (natural <= pageH) return true;

  const fixedTop = sumRows(1, dStart - 1);
  let lastPage1 = dEnd - keep;
  while (lastPage1 >= dStart && fixedTop + sumRows(dStart, lastPage1) > pageH) lastPage1--;
  if (lastPage1 < dStart - 1) return false;
  if (sumRows(lastPage1 + 1, sEnd) > pageH) return false;

  const page1Rows = lastPage1 - dStart + 1;
  if (page1Rows > 0) {
    const target = Math.floor(((pageH - fixedTop) / page1Rows) * 100) / 100;
    for (let n = dStart; n <= lastPage1; n++) {
      if (rowH(n) < target) ws.getRow(n).height = target;
    }
  }
  ws.rowBreaks.push({ id: lastPage1, max: 16383, man: 1 });
  return true;
}

/** Baca pengaturan cetak modul dari backend (default bila gagal). */
export async function fetchPrintSettings(
  module: string,
  apiBase: string = process.env.NEXT_PUBLIC_API_URL || ""
): Promise<Required<PrintSettings> & { keepRows: number }> {
  try {
    const res = await fetch(`${apiBase}/api/print-settings/${module}`, { credentials: "include" });
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: {
        marginTopMm: number;
        marginBottomMm: number;
        marginLeftMm: number;
        marginRightMm: number;
        repeatHeader: boolean;
        keepRows: number;
      };
    } | null;
    if (res.ok && json?.success && json.data) {
      return {
        marginTopMm: json.data.marginTopMm,
        marginBottomMm: json.data.marginBottomMm,
        marginLeftMm: json.data.marginLeftMm,
        marginRightMm: json.data.marginRightMm,
        repeatHeader: json.data.repeatHeader,
        keepRows: json.data.keepRows,
      };
    }
  } catch {
    // Abaikan: pakai default.
  }
  return { ...DEFAULT_PRINT_SETTINGS, keepRows: 0 };
}

/** Simpan pengaturan cetak modul (admin). Lempar Error bila backend menolak. */
export async function savePrintSettings(
  module: string,
  settings: Required<PrintSettings> & { keepRows: number },
  apiBase: string = process.env.NEXT_PUBLIC_API_URL || ""
): Promise<void> {
  const res = await fetch(`${apiBase}/api/print-settings/${module}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      marginTopMm: settings.marginTopMm,
      marginBottomMm: settings.marginBottomMm,
      marginLeftMm: settings.marginLeftMm,
      marginRightMm: settings.marginRightMm,
      repeatHeader: settings.repeatHeader,
      keepRows: settings.keepRows,
    }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(j?.error || "Gagal menyimpan pengaturan cetak");
  }
}

export interface ModuleTemplateResult {
  url: string;
  fromDefault: boolean;
  paperSize?: string;
  orientation?: string;
}

export interface ResolveModuleTemplateOptions {
  fetchFn?: typeof fetch;
  apiBase?: string;
  /** Dipakai bila default modul tak ada / tak bisa diunduh; "" = tanpa fallback. */
  fallbackUrl?: string;
}

/**
 * URL template terdaftar modul dari /api/reports/templates/default/<module>,
 * dinormalisasi via resolveUploadUrl (unggahan uploads/... → endpoint
 * terautentikasi /api/files/...; path lama templates/... tetap publik).
 * Path privat TIDAK di-HEAD-probe (endpoint hanya GET → HEAD 405 → dulu
 * memicu fallback diam-diam). Meta paperSize/orientasi ikut dikembalikan.
 */
export async function resolveModuleTemplate(
  module: string,
  opts: ResolveModuleTemplateOptions = {}
): Promise<ModuleTemplateResult> {
  const fetchFn = opts.fetchFn ?? fetch;
  const apiBase = opts.apiBase ?? "";
  let meta: { paperSize?: string; orientation?: string } = {};
  try {
    const res = await fetchFn(`${apiBase}/api/reports/templates/default/${module}`, {
      credentials: "include",
    });
    if (res.ok) {
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { filePath?: string; paperSize?: string; orientation?: string };
      } | null;
      const fp = json?.data?.filePath?.trim();
      if (json?.success && fp) {
        meta = { paperSize: json.data?.paperSize, orientation: json.data?.orientation };
        const normalized = resolveUploadUrl(fp) ?? (fp.startsWith("/") ? fp : `/${fp}`);
        if (normalized.startsWith("/api/files/")) {
          return { url: normalized, fromDefault: true, ...meta };
        }
        const check = await fetchFn(normalized, { method: "HEAD", credentials: "include" }).catch(() => null);
        if (!check || check.ok) return { url: normalized, fromDefault: true, ...meta };
      }
    }
  } catch {
    // Abaikan: lanjut ke bawaan.
  }
  return { url: opts.fallbackUrl ?? "", fromDefault: false, ...meta };
}

export interface PdfConversionResult {
  blob: Blob;
  filename: string;
}

/**
 * Konversi buffer xlsx → PDF lewat backend LibreOffice headless
 * (multi-file digabung qpdf oleh backend). Lempar Error berisi pesan
 * backend bila gagal / 503 (LibreOffice belum terpasang).
 */
export async function convertXlsxToPdf(
  buffers: ArrayBuffer[],
  filename: string,
  apiBase: string = process.env.NEXT_PUBLIC_API_URL || ""
): Promise<PdfConversionResult> {
  const fd = new FormData();
  buffers.forEach((b, i) => {
    fd.append(
      "files",
      new Blob([b], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `laporan-${i + 1}.xlsx`
    );
  });
  fd.append("filename", filename);
  const resp = await fetch(`${apiBase}/api/presensi/pdf/libreoffice`, {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  if (!resp.ok) {
    let msg = "Konversi PDF gagal";
    try {
      const j = await resp.json();
      if (j?.error) msg = j.error;
    } catch {
      // respons bukan JSON — pakai pesan default
    }
    throw new Error(msg);
  }
  const blob = await resp.blob();
  const cd = resp.headers.get("Content-Disposition") || "";
  const m = /filename="([^"]+)"/.exec(cd);
  return { blob, filename: m?.[1] || filename };
}

/** Unduh blob PDF via anchor (nama file dari hasil konversi atau fallback). */
export function downloadPdf(result: PdfConversionResult, fallbackName: string): void {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename || fallbackName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
