import { describe, it, expect } from "vitest";
import {
  DEFAULT_BRAND,
  BRAND_KEYS,
  RADIUS_OPTIONS,
  isHex,
  parseBrandTheme,
  buildBrandThemeCss,
  contrastRatio,
  mixHex,
  pickReadableInk,
  readableInkTokens,
  softenInk,
  relativeLuminance,
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

  it("warna teks token dihitung dari kontras, bukan diturunkan dari primary", () => {
    expect(css).toContain("--primary-foreground: #FFFFFF;");
    expect(css).toContain("--primary-foreground-soft: #");
    expect(css).not.toContain("--primary-foreground-soft: color-mix");
    expect(css).toContain("--secondary-foreground: #04222B;");
    expect(css).toContain("--accent-foreground: #04222B;");
    expect(css).not.toContain("--secondary-foreground: color-mix");
    expect(css).not.toContain("--accent-foreground: color-mix");
  });

  it("menurunkan border-subtle, text-soft, dan ramp chart dari brand", () => {
    expect(css).toContain("--border-subtle: color-mix(in srgb, var(--border) 45%, var(--background));");
    expect(css).toContain(`--text-soft: ${mixHex(DEFAULT_BRAND.muted_foreground, DEFAULT_BRAND.foreground, 0.5)};`);
    for (const n of [1, 2, 3, 4, 5]) {
      expect(css).toContain(`--chart-${n}: #`);
    }
    expect(css).not.toContain("--chart-3: var(--secondary);");
  });

  it("mode gelap HANYA meng-override primary (surface dibiarkan globals .dark)", () => {
    const darkBlock = css.slice(css.indexOf(".dark {"));
    expect(darkBlock).toContain(`--primary: ${mixHex(DEFAULT_BRAND.primary, "#FFFFFF", 0.45)};`);
    expect(darkBlock).toContain("--primary-foreground: #04222B;");
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

describe("mixHex", () => {
  it("weight 1/0 mengembalikan warna asli", () => {
    expect(mixHex("#123456", "#FFFFFF", 1)).toBe("#123456");
    expect(mixHex("#123456", "#FFFFFF", 0)).toBe("#ffffff");
  });

  it("menghasilkan titik tengah", () => {
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });

  it("meng-clamp weight di luar 0–1", () => {
    expect(mixHex("#000000", "#FFFFFF", -1)).toBe("#ffffff");
    expect(mixHex("#000000", "#FFFFFF", 2)).toBe("#000000");
  });
});

describe("kontras WCAG", () => {
  it("luminance ekstrem", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("rasio hitam/putih = 21", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
  });

  it("pickReadableInk memilih sisi dengan kontras lebih tinggi", () => {
    expect(pickReadableInk("#0A3D4A")).toBe("#FFFFFF");
    expect(pickReadableInk("#E2F4F0")).toBe("#04222B");
    expect(pickReadableInk("#2563EB")).toBe("#FFFFFF");
  });

  it("softenInk tetap ≥ 4.5:1 dan lebih redup dari ink asli", () => {
    const ink = readableInkTokens(DEFAULT_BRAND);
    const soft = softenInk(ink.primary, DEFAULT_BRAND.primary);
    expect(contrastRatio(soft, DEFAULT_BRAND.primary)).toBeGreaterThanOrEqual(4.5);
    expect(soft).not.toBe(ink.primary);
  });

  it("softenInk mengembalikan ink asli bila tidak ada yang lolos", () => {
    expect(softenInk("#FFFFFF", "#FFFFFF")).toBe("#FFFFFF");
  });

  it("readableInkTokens selalu ≥ 4.5:1 untuk ketiga peran", () => {
    const ink = readableInkTokens(DEFAULT_BRAND);
    expect(contrastRatio(ink.primary, DEFAULT_BRAND.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink.secondary, DEFAULT_BRAND.secondary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink.accent, DEFAULT_BRAND.accent)).toBeGreaterThanOrEqual(4.5);
  });
});
