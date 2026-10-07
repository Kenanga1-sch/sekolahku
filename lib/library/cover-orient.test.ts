import { describe, expect, it } from "vitest";
import { LANDSCAPE_RATIO, needsRotation, nextRotation, rotatedSize } from "./cover-orient";

describe("needsRotation", () => {
  it("portrait tidak perlu putar", () => {
    expect(needsRotation(600, 800)).toBe(false);
  });
  it("persegi tidak perlu putar", () => {
    expect(needsRotation(800, 800)).toBe(false);
  });
  it("landscape ringan (desain) tidak dipaksa", () => {
    expect(needsRotation(1000, 900)).toBe(false);
  });
  it("landscape ekstrem (foto miring) perlu putar", () => {
    expect(needsRotation(1600, 900)).toBe(true);
  });
  it("ambang eksak tidak memicu (harus >)", () => {
    expect(needsRotation(LANDSCAPE_RATIO * 100, 100)).toBe(false);
  });
  it("dimensi invalid aman", () => {
    expect(needsRotation(0, 800)).toBe(false);
    expect(needsRotation(800, 0)).toBe(false);
  });
});

describe("nextRotation", () => {
  it("berputar 0→90→180→270→0", () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(90)).toBe(180);
    expect(nextRotation(180)).toBe(270);
    expect(nextRotation(270)).toBe(0);
  });
});

describe("rotatedSize", () => {
  it("90° menukar dimensi", () => {
    expect(rotatedSize(1600, 900, 90)).toEqual({ width: 900, height: 1600 });
  });
  it("180° tetap", () => {
    expect(rotatedSize(1600, 900, 180)).toEqual({ width: 1600, height: 900 });
  });
});
