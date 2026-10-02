import { describe, it, expect } from "vitest";
import {
  DEFAULT_BRAND,
  BRAND_KEYS,
  RADIUS_OPTIONS,
  isHex,
  parseBrandTheme,
  buildBrandThemeCss,
} from "./theme";

describe("isHex", () => {
  it("hanya menerima #RRGGBB", () => {
    expect(isHex("#065F46")).toBe(true);
    expect(isHex("#065f46")).toBe(true);
    expect(isHex("065F46")).toBe(false);
    expect(isHex("#FFF")).toBe(false);
    expect(isHex("#065F467")).toBe(false);
    expect(isHex("red")).toBe(false);
    expect(isHex(null)).toBe(false);
  });
});

describe("parseBrandTheme", () => {
  it("null/undefined/kosong → default lengkap", () => {
    for (const raw of [null, undefined, "", "   "]) {
      expect(parseBrandTheme(raw)).toEqual(DEFAULT_BRAND);
    }
  });

  it("JSON rusak → default (tidak melempar)", () => {
    expect(parseBrandTheme("{tidak-valid")).toEqual(DEFAULT_BRAND);
    expect(parseBrandTheme("[1,2]")).toEqual(DEFAULT_BRAND);
  });

  it("key valid dipakai, key tidak valid jatuh ke default per-key", () => {
    const out = parseBrandTheme(
      JSON.stringify({ primary: "#123456", secondary: "bukan-hex", radius: "9rem" })
    );
    expect(out.primary).toBe("#123456");
    expect(out.secondary).toBe(DEFAULT_BRAND.secondary);
    expect(out.radius).toBe(DEFAULT_BRAND.radius);
    expect(out.background).toBe(DEFAULT_BRAND.background);
  });

  it("radius hanya dari whitelist", () => {
    for (const radius of RADIUS_OPTIONS) {
      expect(parseBrandTheme(JSON.stringify({ radius })).radius).toBe(radius);
    }
    expect(parseBrandTheme(JSON.stringify({ radius: "3rem" })).radius).toBe(DEFAULT_BRAND.radius);
  });

  it("roundtrip default identik", () => {
    expect(parseBrandTheme(JSON.stringify(DEFAULT_BRAND))).toEqual(DEFAULT_BRAND);
  });
});

describe("buildBrandThemeCss", () => {
  const css = buildBrandThemeCss(DEFAULT_BRAND);

  it("memuat tiga blok selector yang benar", () => {
    expect(css).toContain(":root {");
    expect(css).toContain("html:not(.dark) {");
    expect(css).toContain(".dark {");
  });

  it("nilai mentah --brand-* berada di :root untuk kedua mode", () => {
    for (const key of BRAND_KEYS) {
      expect(css).toContain(`--brand-${key === "public_bg" ? "public-bg" : key === "muted_foreground" ? "muted-fg" : key}: ${DEFAULT_BRAND[key]};`);
    }
  });

  it("mode terang memetakan brand ke token shadcn", () => {
    expect(css).toContain("--primary: var(--brand-primary);");
    expect(css).toContain("--public-bg: var(--brand-public-bg);");
    expect(css).toContain("--primary-hover: color-mix(in srgb, var(--primary), #000 20%);");
    expect(css).toContain("--public-border: color-mix(in srgb, var(--border), var(--primary) 30%);");
  });

  it("mode gelap HANYA meng-override primary (surface dibiarkan globals .dark)", () => {
    const darkBlock = css.slice(css.indexOf(".dark {"));
    expect(darkBlock).toContain("--primary: color-mix(in srgb, var(--brand-primary), #fff 45%);");
    expect(darkBlock).not.toContain("--background");
    expect(darkBlock).not.toContain("--foreground");
    expect(darkBlock).not.toContain("--secondary:");
    expect(darkBlock).not.toContain("--public-bg");
  });

  it("meng-skip nilai tidak valid (fallback ke default) alih-alih menyuntik mentah", () => {
    const bad = { ...DEFAULT_BRAND, primary: "javascript:alert(1)" };
    const out = buildBrandThemeCss(bad);
    expect(out).not.toContain("javascript:");
    expect(out).toContain(`--brand-primary: ${DEFAULT_BRAND.primary};`);
  });

  it("nilai default persis muncul (reset = identik globals)", () => {
    expect(css).toContain(`--brand-primary: ${DEFAULT_BRAND.primary};`);
    expect(css).toContain(`--radius: ${DEFAULT_BRAND.radius};`);
  });
});
