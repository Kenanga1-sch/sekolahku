import { describe, expect, it } from "vitest";
import { pageCss, printAreaPx } from "./worksheet-print";

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
  it("A4 landscape, margin default 10mm → [1047, 718] px", () => {
    expect(printAreaPx({ paperSize: "A4", orientation: "landscape" })).toEqual([1047, 718]);
  });
  it("F4 landscape, margin default 10mm → [1172, 737] px", () => {
    expect(printAreaPx({ paperSize: "F4", orientation: "landscape" })).toEqual([1172, 737]);
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
