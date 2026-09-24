// Pemuat pdf.js (mozilla/pdfjs-dist) dari berkas vendor untuk pratinjau PDF.
//
// Alasan memakai pdf.js, bukan <iframe src="blob:...pdf">:
// CSP proyek menetapkan `object-src 'none'` (hardening plugin/PDF viewer).
// Chrome merender PDF di dalam <iframe> memakai PDF viewer internal yang TUNDUK
// pada `object-src`, sehingga pratinjau diblokir ("This content is blocked").
// pdf.js me-render PDF ke <canvas> murni — tidak menyentuh object/plugin,
// sehingga tidak perlu melonggarkan CSP.
//
// Berkas vendor disajikan statis di /docstation/vendor/ (sudah dipakai modul
// DocStation). Pemuatan idempoten dan hasilnya di-cache pada window.pdfjsLib.

const PDFJS_URL = "/docstation/vendor/pdf.min.js";
const WORKER_URL = "/docstation/vendor/pdf.worker.min.js";

/** Subset API pdf.js yang kita pakai (tipe minimal, tanpa bergantung @types). */
export interface PdfRenderTask {
  promise: Promise<void>;
  cancel(): void;
}

export interface PdfPageProxy {
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    transform?: number[];
  }): PdfRenderTask;
}

export interface PdfDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  destroy(): Promise<void>;
}

export interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: ArrayBuffer } | string): {
    promise: Promise<PdfDocumentProxy>;
    destroy(): Promise<void>;
  };
}

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
  }
}

let pdfJsPromise: Promise<PdfJsLib> | null = null;

/** Memuat pdf.js dari vendor bila belum tersedia. Aman dipanggil berulang. */
export function loadPdfJs(): Promise<PdfJsLib> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("pdf.js hanya tersedia di browser"));
  }
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;
    return Promise.resolve(window.pdfjsLib);
  }
  if (pdfJsPromise) return pdfJsPromise;

  pdfJsPromise = new Promise<PdfJsLib>((resolve, reject) => {
    const finalize = () => {
      const lib = window.pdfjsLib;
      if (!lib) {
        pdfJsPromise = null;
        reject(new Error("pdf.js gagal dimuat"));
        return;
      }
      lib.GlobalWorkerOptions.workerSrc = WORKER_URL;
      resolve(lib);
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-letterbuilder-vendor="pdfjs"]`,
    );
    if (existing) {
      existing.addEventListener("load", finalize);
      existing.addEventListener("error", () => {
        pdfJsPromise = null;
        reject(new Error("Gagal memuat pdf.js"));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = PDFJS_URL;
    script.async = true;
    script.dataset.letterbuilderVendor = "pdfjs";
    script.onload = finalize;
    script.onerror = () => {
      pdfJsPromise = null;
      reject(new Error("Gagal memuat pdf.js"));
    };
    document.head.appendChild(script);
  });

  return pdfJsPromise;
}
