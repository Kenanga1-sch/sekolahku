// Tes murni geometri bingkai crop 8-handle (tanpa DOM).

import { describe, expect, it } from "vitest";

import {
  FULL_FRAME,
  MIN_FRAME_PX,
  frameToArea,
  pxRectToFrame,
  resizePxRect,
} from "./scan-crop-frame";

describe("frameToArea", () => {
  it("frame penuh = seluruh gambar (dibulatkan ke piksel)", () => {
    expect(frameToArea(FULL_FRAME, { w: 620, h: 877 })).toEqual({
      x: 0,
      y: 0,
      width: 620,
      height: 877,
    });
  });

  it("frame setengah kanan-bawah dikonversi proporsional", () => {
    expect(frameToArea({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, { w: 1000, h: 2000 })).toEqual({
      x: 500,
      y: 1000,
      width: 500,
      height: 1000,
    });
  });
});

describe("resizePxRect (handle tepi/sudut)", () => {
  const bounds = { x: 0, y: 0, w: 800, h: 600 };
  const start = { x: 100, y: 100, w: 400, h: 300 };

  it("handle 'e' menggeser tepi kanan, kiri tetap sebagai jangkar", () => {
    const r = resizePxRect(start, "e", 50, 0, bounds);
    expect(r).toEqual({ x: 100, y: 100, w: 450, h: 300 });
  });

  it("handle 'w' memindahkan kiri sambil menjaga tepi kanan", () => {
    const r = resizePxRect(start, "w", -80, 0, bounds);
    expect(r.x).toBe(20);
    expect(r.x + r.w).toBe(500); // right lama = 100+400
  });

  it("handle 'nw' mengubah dua sumbu sekaligus", () => {
    const r = resizePxRect(start, "nw", 30, 40, bounds);
    expect(r).toEqual({ x: 130, y: 140, w: 370, h: 260 });
  });

  it("dibatasi ukuran minimum (tidak menyusut di bawah MIN_FRAME_PX)", () => {
    const r = resizePxRect(start, "e", -10000, 0, bounds);
    expect(r.w).toBe(MIN_FRAME_PX);
    const r2 = resizePxRect(start, "s", 0, -10000, bounds);
    expect(r2.h).toBe(MIN_FRAME_PX);
  });

  it("tidak boleh keluar bounds", () => {
    const r = resizePxRect(start, "e", 10000, 0, bounds);
    expect(r.x + r.w).toBeLessThanOrEqual(bounds.x + bounds.w);
    const r2 = resizePxRect(start, "n", 0, -10000, bounds);
    expect(r2.y).toBeGreaterThanOrEqual(bounds.y);
  });
});

describe("pxRectToFrame", () => {
  it("mengonversi rect piksel relatif bounds menjadi pecahan", () => {
    const bounds = { x: 50, y: 20, w: 400, h: 600 };
    const f = pxRectToFrame({ x: 250, y: 320, w: 200, h: 300 }, bounds);
    expect(f).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
  });
});
