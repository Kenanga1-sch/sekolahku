// Konversi PDF → gambar JPEG per halaman untuk keperluan CETAK.
//
// Kenapa perlu: banyak printer rumah/kantor (mis. Epson L6270) TIDAK menerima
// PDF langsung — `document-format-supported` IPP-nya hanya `image/jpeg`,
// `image/urf`, `image/pwg-raster`, `application/vnd.epson.escpr`. Bila PDF
// dikirim mentah (baik via IPP yang ditolak, atau via RAW 9100 sebagai
// fallback), printer mencetak byte biner PDF sebagai teks sehingga keluar
// deretan simbol acak (`%PDF-1.4 … << /Type … >> stream …`).
//
// Solusi: render tiap halaman PDF ke canvas memakai pdf.js (sudah di-bundle di
// /docstation/vendor), ekspor tiap halaman sebagai JPEG, lalu kirim sebagai
// `image/jpeg` — format yang didukung hampir semua printer IPP.
//
// PDF.js dimuat lewat loader yang sudah ada (`lib/letter-pdf-vendor.ts`).

import { loadPdfJs } from "@/lib/letter-pdf-vendor";
import type { PrintableFile } from "./api";

export interface PdfToJpegOptions {
  /** DPI target render (default 200 — cukup tajam untuk teks, ukuran wajar). */
  dpi?: number;
  /** Kualitas JPEG 0..1 (default 0.92). */
  quality?: number;
  /**
   * DPI maksimum saat halaman banyak, agar total ukuran tidak melampaui batas
   * body backend (15 MB). Bila dokumen punya > thresholdPages halaman, DPI
   * diturunkan ke lowDpi.
   */
  thresholdPages?: number;
  lowDpi?: number;
}

/** DPI default render halaman PDF. */
export const DEFAULT_PRINT_DPI = 200;
/** Ambang jumlah halaman untuk menurunkan DPI demi batas ukuran. */
export const DEFAULT_DPI_DOWNGRADE_THRESHOLD = 10;
/** DPI saat halaman banyak. */
export const LOW_PRINT_DPI = 120;

/** Basis nama berkas hasil konversi (satu berkas JPEG per halaman). */
function pageFileName(base: string, page: number, total: number): string {
  const stem = base.replace(/\.pdf$/i, "") || "Dokumen";
  const width = String(total).length;
  const index = String(page).padStart(width, "0");
  return `${stem}-hal${index}.jpg`;
}

/**
 * Merender PDF (bytes) menjadi daftar berkas JPEG (satu per halaman) siap kirim
 * ke printer. Melempar error yang jelas bila PDF tak bisa dibaca.
 *
 * Catatan: memakai pdf.js yang membutuhkan DOM (canvas); hanya jalan di browser.
 */
export async function pdfBytesToJpegFiles(
  bytes: ArrayBuffer | Uint8Array,
  options: PdfToJpegOptions = {},
): Promise<PrintableFile[]> {
  if (typeof document === "undefined") {
    throw new Error("Konversi PDF ke gambar hanya tersedia di browser");
  }

  const requestedDpi = options.dpi ?? DEFAULT_PRINT_DPI;
  const quality = options.quality ?? 0.92;
  const threshold = options.thresholdPages ?? DEFAULT_DPI_DOWNGRADE_THRESHOLD;
  const lowDpi = options.lowDpi ?? LOW_PRINT_DPI;

  // pdf.js menyalin buffer; kirim ArrayBuffer eksplisit agar tak tersentuh.
  const data = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes;

  const pdfjsLib = await loadPdfJs();
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;

  try {
    if (pdfDoc.numPages < 1) {
      throw new Error("PDF tidak memiliki halaman");
    }
    const dpi = pdfDoc.numPages > threshold ? lowDpi : requestedDpi;
    const scale = dpi / 72; // pdf.js memakai satuan point (72 per inci)

    const files: PrintableFile[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Kanvas 2D tidak tersedia");

      // Latar putih: PDF transparan akan menjadi hitam bila dibiarkan.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const renderTask = page.render({ canvasContext: ctx, viewport });
      await renderTask.promise;

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!blob) throw new Error(`Gagal merender halaman ${pageNumber}`);
      files.push({
        name: pageFileName("Dokumen-Scan.pdf", pageNumber, pdfDoc.numPages),
        bytes: await blob.arrayBuffer(),
        contentType: "image/jpeg",
      });
    }
    return files;
  } finally {
    try {
      await pdfDoc.destroy();
    } catch {
      /* ignore */
    }
  }
}
