import { describe, expect, it } from "vitest";
import {
  argbToHex,
  cellStyleCss,
  cellText,
  escapeHtml,
  extractPrintImages,
  joinPageSections,
  pageCss,
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
  }, 30000); // import exceljs lambat di mesin CI — jangan kena timeout 5s
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
