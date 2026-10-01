// Regresi binarisasi Otsu di worker DocStation.
//
// public/docstation/worker.js adalah skrip worker klasik (bukan modul), jadi
// fungsi dievaluasi dari teks sumber. Tes ini menjaga dua hal yang pernah
// luput: (1) arah klasifikasi Otsu (g == ambang harus HITAM — kelas gelap
// Otsu inklusif [0..t]), dan (2) fungsi tetap terpanggil lewat case BINARIZE.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type OtsuFn = (imageData: ArrayBuffer, width: number, height: number) => ArrayBuffer;

function loadOtsu(): OtsuFn {
  const src = readFileSync(join(process.cwd(), "public/docstation/worker.js"), "utf8");
  const match = src.match(/function otsuBinarizeBuffer\(imageData, width, height\) \{[\s\S]*?\n\}/);
  expect(match, "otsuBinarizeBuffer tidak ditemukan di worker.js").toBeTruthy();
  return new Function(`${match![0]}; return otsuBinarizeBuffer;`)() as OtsuFn;
}

/** px: array [r,g,b,a, ...]; hasil: nilai kanal merah per piksel. */
function run(otsu: OtsuFn, px: number[], w: number, h: number): number[] {
  const input = new Uint8ClampedArray(px);
  const out = new Uint8ClampedArray(otsu(input.buffer, w, h));
  return Array.from({ length: w * h }, (_, i) => out[i * 4]);
}

describe("otsuBinarizeBuffer (worker.js)", () => {
  const otsu = loadOtsu();

  it("dua kelas ekstrem → gelap hitam, terang putih (bukan putih semua)", () => {
    const r = run(
      otsu,
      [10, 10, 10, 255, 10, 10, 10, 255, 240, 240, 240, 255, 240, 240, 240, 255],
      4,
      1,
    );
    expect(r).toEqual([0, 0, 255, 255]);
  });

  it("cita terang merata (halaman putih) tetap putih", () => {
    const r = run(otsu, Array.from({ length: 4 }, () => [200, 200, 200, 255]).flat(), 2, 2);
    expect(r).toEqual([255, 255, 255, 255]);
  });

  it("garis teks gelap di latar putih tetap hitam", () => {
    const r = run(
      otsu,
      [60, 60, 60, 255, 245, 245, 245, 255, 245, 245, 245, 255, 60, 60, 60, 255],
      4,
      1,
    );
    expect(r).toEqual([0, 255, 255, 0]);
  });

  it("case BINARIZE terpasang di worker.js", () => {
    const src = readFileSync(join(process.cwd(), "public/docstation/worker.js"), "utf8");
    expect(src).toContain("case 'BINARIZE'");
    expect(src).toContain("otsuBinarizeBuffer(imageData, width, height)");
  });
});
