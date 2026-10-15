// Tes konversi PDF → JPEG untuk cetak.
//
// Regresi yang dijaga: cetak PDF HARUS menghasilkan berkas `image/jpeg` (satu per
// halaman), bukan meneruskan PDF mentah ke printer. Printer Epson L6270 (dan
// umumnya printer rumah) tak mendukung `application/pdf`, sehingga PDF mentah
// tercetak sebagai deretan simbol acak.

import { afterEach, describe, expect, it, vi } from "vitest";

interface FakeCanvasCtx {
  fillStyle: string;
  fillRect: ReturnType<typeof vi.fn>;
}

/** Memasang stub DOM+pdf.js minimal untuk menguji alur render per halaman. */
function installMocks(numPages: number) {
  // jsdom Blob tidak punya arrayBuffer(); sediakan objek mirip-Blob untuk tes.
  const fakeBlob = {
    type: "image/jpeg",
    size: 10,
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  } as unknown as Blob;
  const toBlobMock = vi.fn((cb: BlobCallback) => {
    cb(fakeBlob);
  });
  const ctx: FakeCanvasCtx = { fillStyle: "", fillRect: vi.fn() };

  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toBlob: toBlobMock,
  };

  const pageRender = vi.fn(() => ({ promise: Promise.resolve() }));
  const destroyMock = vi.fn(() => Promise.resolve());

  const pdfDoc = {
    numPages,
    getPage: vi.fn(async () => ({
      getViewport: ({ scale }: { scale: number }) => ({
        width: 595 * scale,
        height: 842 * scale,
      }),
      render: pageRender,
    })),
    destroy: destroyMock,
  };

  const loadPdfJs = vi.fn(async () => ({
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: vi.fn(() => ({ promise: Promise.resolve(pdfDoc), destroy: destroyMock })),
  }));

  vi.doMock("@/lib/letter-pdf-vendor", () => ({ loadPdfJs }));
  vi.stubGlobal("document", {
    createElement: vi.fn((tag: string) => {
      if (tag === "canvas") return canvas;
      throw new Error(`createElement tak terduga: ${tag}`);
    }),
  });

  return { toBlobMock, pageRender, destroyMock, canvas, loadPdfJs };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.doUnmock("@/lib/letter-pdf-vendor");
});

describe("pdfBytesToJpegFiles", () => {
  it("merender tiap halaman menjadi berkas image/jpeg terpisah", async () => {
    vi.resetModules();
    installMocks(3);
    const { pdfBytesToJpegFiles: fn } = await import("./pdf-to-images");

    const files = await fn(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

    expect(files).toHaveLength(3);
    for (const f of files) {
      expect(f.contentType).toBe("image/jpeg");
      expect(f.name).toMatch(/\.jpg$/);
    }
    expect(files[0].name).toBe("Dokumen-Scan-hal1.jpg");
    expect(files[2].name).toBe("Dokumen-Scan-hal3.jpg");
  });

  it("membersihkan dokumen pdf.js setelah selesai", async () => {
    vi.resetModules();
    const mocks = installMocks(1);
    const { pdfBytesToJpegFiles: fn } = await import("./pdf-to-images");

    await fn(new Uint8Array([1, 2, 3]));
    expect(mocks.destroyMock).toHaveBeenCalled();
  });

  it("melempar error bila PDF tidak punya halaman", async () => {
    vi.resetModules();
    installMocks(0);
    const { pdfBytesToJpegFiles: fn } = await import("./pdf-to-images");

    await expect(fn(new Uint8Array([1]))).rejects.toThrow(/tidak memiliki halaman/i);
  });

  it("menurunkan DPI saat halaman melebihi ambang", async () => {
    vi.resetModules();
    const mocks = installMocks(12);
    const { pdfBytesToJpegFiles: fn } = await import("./pdf-to-images");

    const files = await fn(new Uint8Array([1]), { dpi: 200, thresholdPages: 10, lowDpi: 100 });
    expect(files).toHaveLength(12);
    // 100 DPI / 72 = 1.3889 → lebar 595 * 1.3889 ≈ 826 (bukan 200 DPI ≈ 1653)
    expect(mocks.canvas.width).toBeLessThan(1000);
  });

  it("melempar error yang jelas di lingkungan tanpa DOM", async () => {
    vi.resetModules();
    vi.stubGlobal("document", undefined);
    const { pdfBytesToJpegFiles: fn } = await import("./pdf-to-images");

    await expect(fn(new Uint8Array([1]))).rejects.toThrow(/browser/i);
  });
});
