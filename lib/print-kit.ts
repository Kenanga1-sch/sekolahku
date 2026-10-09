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
    // Satuan exceljs = INCH (0,4in ≈ 10mm).
    margins: { top: 0.4, right: 0.4, bottom: 0.4, left: 0.4, header: 0.1, footer: 0.1 },
    horizontalCentered: true,
  };
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
