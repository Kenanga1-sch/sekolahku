// Tes print-kit: geometry halaman, resolver template, konversi PDF, unduhan.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyPrintPageSetup,
  convertXlsxToPdf,
  downloadPdf,
  PAPER_SIZE_CODES,
  resolveModuleTemplate,
} from "./print-kit";

describe("applyPrintPageSetup", () => {
  it("A4 landscape: kode 9 + fit kolom + margin 0,4in + centering", () => {
    const ws: { pageSetup?: Record<string, unknown> } = { pageSetup: { existing: 1 } };
    applyPrintPageSetup(ws, { paperSize: "A4", orientation: "landscape" });
    expect(ws.pageSetup).toEqual({
      existing: 1,
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { top: 0.4, right: 0.4, bottom: 0.4, left: 0.4, header: 0.1, footer: 0.1 },
      horizontalCentered: true,
    });
  });

  it("F4 (kode 14), huruf besar-kecil acak + spasi di-trim, default portrait", () => {
    const ws: { pageSetup?: Record<string, unknown> } = {};
    applyPrintPageSetup(ws, { paperSize: " f4 " });
    expect(ws.pageSetup?.paperSize).toBe(PAPER_SIZE_CODES.F4);
    expect(ws.pageSetup?.orientation).toBe("portrait");
  });

  it("no-op bila paperSize kosong / tak dikenali (pageSetup tak disentuh)", () => {
    const ws1: { pageSetup?: Record<string, unknown> } = {};
    applyPrintPageSetup(ws1, { paperSize: "" });
    expect(ws1.pageSetup).toBeUndefined();
    const ws2: { pageSetup?: Record<string, unknown> } = { pageSetup: { a: 1 } };
    applyPrintPageSetup(ws2, { paperSize: "B5" });
    expect(ws2.pageSetup).toEqual({ a: 1 });
  });

  it("fitToHeight selalu 0 — regresi skala 43% (insiden 2026-10-08)", () => {
    const ws: { pageSetup?: Record<string, unknown> } = {};
    applyPrintPageSetup(ws, { paperSize: "LEGAL", orientation: "landscape" });
    expect(ws.pageSetup?.fitToHeight).toBe(0);
    expect(ws.pageSetup?.paperSize).toBe(5);
  });
});

describe("resolveModuleTemplate", () => {
  const metaFetch = (filePath?: string, extra?: Record<string, string>) =>
    (async (url: string) => {
      if (url.includes("/api/reports/templates/default/presensi")) {
        return {
          ok: true,
          json: async () => ({ success: true, data: { filePath, ...extra } }),
        };
      }
      return { ok: true };
    }) as unknown as typeof fetch;

  it("meta paperSize/orientasi ikut dikembalikan", async () => {
    const res = await resolveModuleTemplate("presensi", {
      fetchFn: metaFetch("uploads/templates/rpt-1.xlsx", { paperSize: "F4", orientation: "landscape" }),
      fallbackUrl: "/templates/bawaan.xlsx",
    });
    expect(res).toEqual({
      url: "/api/files/uploads/templates/rpt-1.xlsx",
      fromDefault: true,
      paperSize: "F4",
      orientation: "landscape",
    });
  });

  it("path privat tanpa HEAD probe; path publik di-probe dulu", async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method || "GET"} ${url}`);
      if (url.includes("/api/reports/templates/default")) {
        return { ok: true, json: async () => ({ success: true, data: { filePath: "templates/custom.xlsx" } }) };
      }
      return { ok: true };
    }) as unknown as typeof fetch;
    const res = await resolveModuleTemplate("presensi", { fetchFn: fakeFetch, fallbackUrl: "/b.xlsx" });
    expect(res.url).toBe("/templates/custom.xlsx");
    expect(calls.some((c) => c.startsWith("HEAD /templates/custom.xlsx"))).toBe(true);
  });

  it("fallback saat API error / tanpa default (fromDefault false)", async () => {
    const errFetch = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const res = await resolveModuleTemplate("presensi", { fetchFn: errFetch, fallbackUrl: "/bawaan.xlsx" });
    expect(res).toEqual({ url: "/bawaan.xlsx", fromDefault: false });
    const noneFetch = (async () => ({ ok: false, json: async () => null })) as unknown as typeof fetch;
    const res2 = await resolveModuleTemplate("tabungan", { fetchFn: noneFetch });
    expect(res2).toEqual({ url: "", fromDefault: false });
  });
});

describe("convertXlsxToPdf", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POST multipart ke endpoint LO: files[] + filename, credentials include", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen = { url: String(input), init };
      return new Response(new Blob(["%PDF"]), {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="hasil.pdf"' },
      });
    }));
    const buf = new ArrayBuffer(8);
    const res = await convertXlsxToPdf([buf], "laporan.pdf", "");
    expect(seen?.url).toBe("/api/presensi/pdf/libreoffice");
    expect(seen?.init?.method).toBe("POST");
    expect(seen?.init?.credentials).toBe("include");
    const fd = seen?.init?.body as FormData;
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get("filename")).toBe("laporan.pdf");
    const files = fd.getAll("files");
    expect(files).toHaveLength(1);
    expect(res.filename).toBe("hasil.pdf");
    expect(res.blob.size).toBeGreaterThan(0);
  });

  it("multi buffer → banyak bagian files (backend merge qpdf)", async () => {
    let fdSeen: FormData | null = null;
    vi.stubGlobal("fetch", vi.fn(async (_i: RequestInfo | URL, init?: RequestInit) => {
      fdSeen = init?.body as FormData;
      return new Response(new Blob(["%PDF"]), { status: 200 });
    }));
    const res = await convertXlsxToPdf([new ArrayBuffer(4), new ArrayBuffer(4)], "gabungan.pdf", "");
    expect(fdSeen?.getAll("files")).toHaveLength(2);
    // Tanpa Content-Disposition → nama fallback milik pemanggil.
    expect(res.filename).toBe("gabungan.pdf");
  });

  it("respons gagal → Error berisi pesan backend", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: "LibreOffice belum terpasang di server" }), { status: 503 })
    ));
    await expect(convertXlsxToPdf([], "x.pdf", "")).rejects.toThrow("LibreOffice belum terpasang di server");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 500 })));
    await expect(convertXlsxToPdf([], "x.pdf", "")).rejects.toThrow("Konversi PDF gagal");
  });

  it("apiBase diprefix ke endpoint", async () => {
    let url = "";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      url = String(input);
      return new Response(new Blob(), { status: 200 });
    }));
    await convertXlsxToPdf([], "x.pdf", "https://api.example.com");
    expect(url).toBe("https://api.example.com/api/presensi/pdf/libreoffice");
  });
});

describe("downloadPdf", () => {
  it("anchor download memakai nama hasil konversi, fallback bila kosong", () => {
    const clicks: string[] = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = () => "blob:x";
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    };
    try {
      downloadPdf({ blob: new Blob(), filename: "dari-header.pdf" }, "fallback.pdf");
      downloadPdf({ blob: new Blob(), filename: "" }, "fallback.pdf");
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      HTMLAnchorElement.prototype.click = origClick;
    }
    expect(clicks).toEqual(["dari-header.pdf", "fallback.pdf"]);
  });
});
