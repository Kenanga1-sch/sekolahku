// Pemuat pustaka pihak ketiga (vendor) untuk mesin DocStation.
//
// DocStation membutuhkan PDFLib untuk menyusun PDF, dimuat dari berkas statis
// /docstation/vendor/pdf-lib.min.js. Pemuatan dilakukan sekali (idempotent) dan
// hasilnya disimpan di window.PDFLib.

const PDFLIB_URL = "/docstation/vendor/pdf-lib.min.js";

let pdfLibPromise: Promise<void> | null = null;

/** Memuat PDFLib dari vendor bila belum tersedia. Aman dipanggil berulang. */
export function loadPdfLib(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PDFLib hanya tersedia di browser"));
  }
  if (window.PDFLib) return Promise.resolve();
  if (pdfLibPromise) return pdfLibPromise;

  pdfLibPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-docstation-vendor="pdflib"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Gagal memuat PDFLib")));
      return;
    }

    const script = document.createElement("script");
    script.src = PDFLIB_URL;
    script.async = true;
    script.dataset.docstationVendor = "pdflib";
    script.onload = () => resolve();
    script.onerror = () => {
      pdfLibPromise = null;
      reject(new Error("Gagal memuat PDFLib"));
    };
    document.head.appendChild(script);
  });

  return pdfLibPromise;
}
