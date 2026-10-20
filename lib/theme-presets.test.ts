import { describe, it, expect } from "vitest";
import {
  LOCAL_PRESETS,
  PALETTE_PRESETS,
  PRESET_FAMILIES,
  TEAL_CLASSIC,
} from "./theme-presets";
import {
  BRAND_KEYS,
  RADIUS_OPTIONS,
  isHex,
  parseBrandTheme,
  readableInkTokens,
  softenInk,
  contrastRatio,
} from "./theme";

describe("katalog preset", () => {
  it("memuat 3 preset bawaan + 148 palet galeri", () => {
    expect(PALETTE_PRESETS).toHaveLength(148);
    expect(LOCAL_PRESETS).toHaveLength(151);
    expect(LOCAL_PRESETS.slice(0, 3).map((p) => p.id)).toEqual([
      "preset-teal-classic",
      "preset-green-classic",
      "preset-blue-fresh",
    ]);
  });

  it("id unik dan berbentuk slug", () => {
    const ids = LOCAL_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("setiap preset punya nama, deskripsi, dan keluarga yang dikenal", () => {
    const families = new Set<string>(PRESET_FAMILIES);
    for (const preset of LOCAL_PRESETS) {
      expect(preset.name.trim()).not.toBe("");
      expect(preset.description.trim()).not.toBe("");
      expect(preset.family).toBeTruthy();
      expect(families.has(preset.family as string)).toBe(true);
    }
  });

  it("semua warna valid dan radius dari whitelist", () => {
    for (const preset of LOCAL_PRESETS) {
      for (const key of BRAND_KEYS) {
        expect(isHex(preset.theme[key]), `${preset.id}.${key}`).toBe(true);
      }
      expect(RADIUS_OPTIONS).toContain(preset.theme.radius as (typeof RADIUS_OPTIONS)[number]);
    }
  });

  it("parseBrandTheme tidak mengubah preset apa pun (roundtrip)", () => {
    for (const preset of LOCAL_PRESETS) {
      expect(parseBrandTheme(JSON.stringify(preset.theme))).toEqual(preset.theme);
    }
  });

  it("teks terbaca ≥ 4.5:1 di semua peran utama", () => {
    for (const preset of LOCAL_PRESETS) {
      const t = preset.theme;
      const ink = readableInkTokens(t);
      expect(contrastRatio(t.foreground, t.background), `${preset.id} fg/bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.muted_foreground, t.background), `${preset.id} muted/bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ink.primary, t.primary), `${preset.id} ink/primary`).toBeGreaterThanOrEqual(4.5);
      // --primary dipakai juga sebagai warna teks di atas surface terang.
      expect(contrastRatio(t.primary, t.background), `${preset.id} primary/bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ink.secondary, t.secondary), `${preset.id} ink/secondary`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ink.accent, t.accent), `${preset.id} ink/accent`).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(softenInk(ink.primary, t.primary), t.primary),
        `${preset.id} soft ink/primary`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("Teal Classic tetap default dan tidak berubah", () => {
    expect(LOCAL_PRESETS[0].theme).toEqual(TEAL_CLASSIC);
  });
});
