/**
 * worksheet-print.ts — geometri cetak untuk artefak kertas halaman
 * (PrintPage): ukuran kertas (PAPER_MM), area printable (printAreaPx),
 * dan rule @page CSS (pageCss).
 *
 * Catatan: jalur render HTML untuk Chromium & dialog cetak browser sudah
 * dihapus (keputusan 2026-10-08 — LibreOffice satu-satunya mesin PDF;
 * xlsx hasil fill dikonversi server-side). Modul lain yang butuh cetak
 * lihat docs/cetak-format-baru.md (print-kit + fill → LibreOffice).
 */

/** Pilihan cetak dari template. */
export interface WorksheetPrintOptions {
  /** A4 | F4 | LEGAL (default A4). */
  paperSize?: string;
  orientation?: string;
  /** Margin kertas dalam mm (default 10 — seimbang & aman printer). */
  marginMm?: number;
}

/** Dimensi kertas (mm) yang didukung — konsisten dengan model laporan. */
export const PAPER_MM: Record<string, [number, number]> = {
  A4: [210, 297],
  F4: [215, 330],
  LEGAL: [216, 356],
};

/** Ukuran area printable (px) dari paperSize + orientasi + margin. */
export function printAreaPx(opts: WorksheetPrintOptions = {}): [number, number] {
  const key = (opts.paperSize || "A4").trim().toUpperCase();
  const [w0, h0] = PAPER_MM[key] || PAPER_MM.A4;
  const landscape = (opts.orientation || "portrait").toLowerCase() === "landscape";
  const w = landscape ? h0 : w0;
  const h = landscape ? w0 : h0;
  const margin = opts.marginMm ?? 10;
  const px = (mm: number) => Math.round((mm * 96) / 25.4);
  return [px(w - 2 * margin), px(h - 2 * margin)];
}

/** CSS @page dari ukuran kertas + orientasi (mm). */
export function pageCss(opts: WorksheetPrintOptions = {}): string {
  const key = (opts.paperSize || "A4").trim().toUpperCase();
  const [w0, h0] = PAPER_MM[key] || PAPER_MM.A4;
  const landscape = (opts.orientation || "portrait").toLowerCase() === "landscape";
  const w = landscape ? h0 : w0;
  const h = landscape ? w0 : h0;
  const margin = opts.marginMm ?? 10;
  return `@page { size: ${w}mm ${h}mm; margin: ${margin}mm; }`;
}
