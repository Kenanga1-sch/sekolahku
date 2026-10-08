import { describe, expect, it } from "vitest";
import {
  argbToHex,
  buildPrintDocument,
  cellStyleCss,
  cellText,
  escapeHtml,
  extractPrintImages,
  joinPageSections,
  pageCss,
  printAreaPx,
  worksheetToHtml,
} from "./worksheet-print";

describe("escapeHtml", () => {
  it("men-escape karakter HTML", () => {
    expect(escapeHtml('<b>&"x"')).toBe("&lt;b&gt;&amp;&quot;x&quot;");
  });
});

describe("argbToHex", () => {
  it("konversi FF+RRGGBB", () => {
    expect(argbToHex("FFDC2626")).toBe("#DC2626");
  });
  it("fallback untuk nilai tak valid", () => {
    expect(argbToHex(undefined, "#000")).toBe("#000");
    expect(argbToHex("XYZ")).toBe("");
  });
});

describe("pageCss", () => {
  it("A4 portrait → 210mm 297mm", () => {
    expect(pageCss({ paperSize: "A4" })).toContain("size: 210mm 297mm");
  });
  it("F4 landscape → 330mm 215mm", () => {
    expect(pageCss({ paperSize: "F4", orientation: "landscape" })).toContain("size: 330mm 215mm");
  });
  it("default A4 + margin custom", () => {
    expect(pageCss({ marginMm: 8 })).toContain("margin: 8mm");
  });
});

describe("printAreaPx", () => {
  it("A4 landscape, margin 5mm → ~[1085, 756] px", () => {
    expect(printAreaPx({ paperSize: "A4", orientation: "landscape" })).toEqual([1085, 756]);
  });
  it("F4 landscape, margin 5mm → [1209, 775] px", () => {
    expect(printAreaPx({ paperSize: "F4", orientation: "landscape" })).toEqual([1209, 775]);
  });
  it("A4 portrait → tampil lebih tinggi dari lebar", () => {
    const [w, h] = printAreaPx({ paperSize: "A4" });
    expect(h).toBeGreaterThan(w);
  });
  it("margin memperkecil area", () => {
    const [w0] = printAreaPx({ paperSize: "A4", orientation: "landscape" });
    const [w1] = printAreaPx({ paperSize: "A4", orientation: "landscape", marginMm: 20 });
    expect(w1).toBeLessThan(w0);
  });
});

describe("cellText", () => {
  it("formula memakai result", () => {
    expect(cellText({ formula: 'COUNTIF(A1:A2,"H")', result: 7 })).toBe("7");
    expect(cellText({ formula: "SUM(A1:A2)" })).toBe("");
  });
  it("nilai primitif & richText", () => {
    expect(cellText("H")).toBe("H");
    expect(cellText(31)).toBe("31");
    expect(cellText({ richText: [{ text: "a" }, { text: "b" }] })).toBe("ab");
    expect(cellText(null)).toBe("");
  });
});

describe("cellStyleCss", () => {
  it("warna font + fill + bold", () => {
    const css = cellStyleCss({
      font: { bold: true, color: { argb: "FF15803D" }, size: 10 },
      fill: { type: "pattern", fgColor: { argb: "FFFEE2E2" } },
      alignment: { horizontal: "center" },
    });
    expect(css).toContain("color:#15803D");
    expect(css).toContain("background-color:#FEE2E2");
    expect(css).toContain("font-weight:700");
    expect(css).toContain("text-align:center");
  });
  it("border per sisi saat ada style", () => {
    const css = cellStyleCss({ border: { top: { style: "thin" } } });
    expect(css).toContain("border-top:1px solid #000000");
  });
});

describe("worksheetToHtml", () => {
  it("render nilai, merge (colspan/rowspan) & warna dari exceljs asli", async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("S");
    ws.getCell("A1").value = "JUDUL";
    ws.getCell("A1").font = { bold: true, size: 14 };
    ws.mergeCells("A1:C1");
    ws.getCell("A2").value = "H";
    ws.getCell("A2").font = { color: { argb: "FF15803D" } };
    ws.getCell("B2").value = { formula: 'COUNTIF(A2:A2,"H")', result: 1 } as never;
    ws.mergeCells("B3:C4");

    const html = worksheetToHtml(ws as never);
    expect(html).toContain("JUDUL");
    expect(html).toContain('colspan="3"');
    expect(html).toContain('rowspan="2"');
    expect(html).toContain("#15803D");
    expect(html).toContain("<td  style="); // sel formula tanpa span
    // Sel di dalam merge (bukan anchor) tidak dirender ganda.
    expect(html).not.toContain("C3");
    // Width eksplisit = jumlah colgroup (Chromium abaikan max-content).
    expect(html).toMatch(/<table class="ws" style="width:\d+px">/);
  }, 30000); // import exceljs lambat di mesin CI — jangan kena timeout 5s
});

describe("worksheetToHtml — posisi gambar (EMU→px)", () => {
  it("offset anchor exceljs (EMU) dikonversi ke px, bukan dipakai mentah", () => {
    const mockWs = {
      rowCount: 5,
      columnCount: 5,
      eachRow(_a: unknown, b?: unknown) {
        const cb = (typeof _a === "function" ? _a : b) as (r: unknown, n: number) => void;
        for (let n = 1; n <= 5; n++) cb({ getCell: () => ({ value: "" }) }, n);
      },
      getRow: () => ({ getCell: () => ({ value: "" }) }),
      getColumn: (n: number) => ({ width: n === 1 ? 10 : 5 }),
    };
    // Anchor di dalam kolom pertama, offset 9525 EMU = 1px; br 19050 = 2px.
    const images = [{
      src: "data:image/png;base64,QUJD",
      tl: { row: 0, col: 0, colOff: 9525, rowOff: 9525 },
      br: { row: 0, col: 1, colOff: 19050, rowOff: 19050 },
    }];
    const html = worksheetToHtml(mockWs as never, images);
    // Sebelum fix: left = 9525px (EMU mentah, di luar layar).
    // Sesudah: 9525/9525 = 1px.
    expect(html).toContain("left:1px;top:1px");
    // Lebar: kolom 1 (10*7+5=75px) rentang 0..0, delta 1px → 76.
    // Tinggi delta 1px → kena minimum clamp 8px.
    expect(html).toContain("width:76px;height:8px");
  });
});

describe("worksheetToHtml — fit-to-page (replikasi fitToPage Excel)", () => {
  const sheet2Cols = {
    rowCount: 2,
    columnCount: 39,
    eachRow(_a: unknown, b?: unknown) {
      const cb = (typeof _a === "function" ? _a : b) as (r: unknown, n: number) => void;
      for (let n = 1; n <= 2; n++) cb({ getCell: () => ({ value: "x" }) }, n);
    },
    getRow: () => ({ getCell: () => ({ value: "" }) }),
    getColumn: () => ({ width: 4 }),
  };

  it("membungkus skala saat tabel lebih lebar dari halaman", () => {
    // colWidth = 4*7+5 = 33px × 39 = 1287px > 1085 → scale < 1.
    const html = worksheetToHtml(sheet2Cols as never, [], { fitPagePx: [1085, 756] });
    expect(html).toContain("transform:scale(");
    expect(html).toContain("overflow:hidden");
    // Lebar wrapper = 1287 × 0.843 ≈ 1085.
    const m = /width:(\d+)px;height:(\d+)px/.exec(html);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(1085);
  });

  it("tanpa opsi fitPagePx → tanpa wrapper skala (kompatibilitas lama)", () => {
    const html = worksheetToHtml(sheet2Cols as never);
    expect(html).not.toContain("transform:scale(");
  });

  it("tabel muat → tidak diskalakan", () => {
    const narrow = { ...sheet2Cols, columnCount: 5 }; // 165px << 1085
    const html = worksheetToHtml(narrow as never, [], { fitPagePx: [1085, 756] });
    expect(html).not.toContain("transform:scale(");
  });
});

describe("extractPrintImages & render gambar", () => {
  it("konversi buffer/base64 jadi data URI + posisi absolute", () => {
    // Mock ws.getImages seperti exceljs (anchor 0-based).
    const mockWs = {
      getImages: () => [
        { imageId: 0, range: { tl: { nativeRow: 0, nativeCol: 1, nativeColOff: 0, nativeRowOff: 0 }, br: { nativeRow: 0, nativeCol: 3, nativeColOff: 30, nativeRowOff: 40 } } },
        { imageId: 1, range: { tl: { nativeRow: 6, nativeCol: 0, nativeColOff: 0, nativeRowOff: 0 }, br: { nativeRow: 8, nativeCol: 2, nativeColOff: 0, nativeRowOff: 0 } } },
      ],
    };
    const getImage = (id: number) =>
      id === 0
        ? { extension: "png", base64: "QUJD" } // langsung base64
        : { extension: "png", buffer: new Uint8Array([1, 2, 3, 4]) }; // via buffer

    const images = extractPrintImages(mockWs, getImage);
    expect(images).toHaveLength(2);
    expect(images[0].src).toContain("data:image/png;base64,QUJD");
    expect(images[1].src).toContain("data:image/png;base64,");
    expect(images[0].tl).toEqual({ row: 0, col: 1, colOff: 0, rowOff: 0 });

    // worksheetToHtml tanpa gambar → tabel polos; dengan gambar → holder absolute.
    const wblessWs = {
      rowCount: 1, columnCount: 2,
      eachRow(_a: unknown, b?: unknown) {
        const cb = (typeof _a === "function" ? _a : b) as (r: unknown, n: number) => void;
        cb({ getCell: () => ({ value: "x" }) }, 1);
      },
      getRow: () => ({ getCell: () => ({ value: "" }) }),
    };
    const plain = worksheetToHtml(wblessWs as never);
    expect(plain).not.toContain("position:absolute");
    const withImg = worksheetToHtml(wblessWs as never, images);
    expect(withImg).toContain("position:absolute");
    expect(withImg).toContain("data:image/png;base64,QUJD");
    expect(withImg).toContain("position:relative");
  });
});

describe("joinPageSections", () => {
  it("page-break antar blok kelas", () => {
    const out = joinPageSections(["<table>1</table>", "<table>2</table>"]);
    expect(out).toContain('class="page-section"');
    expect(out).toContain("<table>2</table>");
  });
});

describe("buildPrintDocument", () => {
  it("dokumen lengkap: doctype + @page F4 landscape + BASE_CSS", () => {
    const doc = buildPrintDocument(
      '<div class="page-section"><table class="ws"></table></div>',
      { paperSize: "F4", orientation: "landscape" },
      "Daftar Hadir Kelas 1A"
    );
    expect(doc).toContain("<!doctype html>");
    expect(doc).toContain("<title>Daftar Hadir Kelas 1A</title>");
    // @page harus F4 landscape — tanpa ini Chromium merender Letter portrait.
    expect(doc).toContain("@page { size: 330mm 215mm; margin: 5mm; }");
    // BASE_CSS: style tabel & page-break antar kelas.
    expect(doc).toContain("table.ws");
    expect(doc).toContain("page-break-after: always");
    expect(doc).toContain('class="page-section"');
    // Payload aman untuk filter unsafeHTML backend (tanpa <script>/on*=).
    expect(doc).not.toMatch(/<\s*script/i);
    expect(doc).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it("default A4 portrait bila opts kosong", () => {
    const doc = buildPrintDocument("<p>x</p>");
    expect(doc).toContain("@page { size: 210mm 297mm; margin: 5mm; }");
  });
});
