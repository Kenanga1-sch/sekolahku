/**
 * Tema brand runtime — sumber tunggal daftar warna yang bisa diedit admin
 * di Pengaturan → Landing Halaman, diinjeksi ke <head> oleh ThemeInjector.
 *
 * Strategi variabel (penting — jangan diubah tanpa baca catatan ini):
 * - `:root`  : hanya nilai MENTAH `--brand-*` + radius (netral mode).
 * - `html:not(.dark)` : mapping brand → token shadcn untuk mode terang,
 *   plus turunan (ring/hover/muted/foreground) yang dihitung dari token itu.
 * - `.dark`  : HANYA --primary di-lighten otomatis (color-mix + putih) agar
 *   tombol/heading brand tetap terbaca di atas surface gelap. Surface &
 *   aksen sekunder mode gelap sengaja dibiarkan milik globals `.dark`
 *   (sudah di-tuning kontrasnya) — meng-override-nya merusak dark mode.
 *
 * Selector `html:not(.dark)` (spesifikasi 0,1,1) menang atas `:root`
 * globals (0,1,0) di mode terang; di mode gelang selector tidak match,
 * sehingga surface gelap globals tidak pernah tertimpa.
 */

export interface BrandTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  public_bg: string;
  foreground: string;
  muted_foreground: string;
  border: string;
  radius: string;
}

export const BRAND_KEYS = [
  "primary",
  "secondary",
  "accent",
  "background",
  "public_bg",
  "foreground",
  "muted_foreground",
  "border",
] as const;

export type BrandKey = (typeof BRAND_KEYS)[number];

export const RADIUS_OPTIONS = ["0.5rem", "0.75rem", "1rem"] as const;

/** Nilai default = Teal Classic (rilis Opsi A — palet resmi sekolah).
 *  Green Classic tersimpan sebagai preset di tabel saved_themes. */
export const DEFAULT_BRAND: BrandTheme = {
  primary: "#0A3D4A",
  secondary: "#98D8D0",
  accent: "#4FB8B4",
  background: "#E2F4F0",
  public_bg: "#E2F4F0",
  foreground: "#04222B",
  muted_foreground: "#0F6B72",
  border: "#10606F",
  radius: "0.75rem",
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isHex(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

/** #RRGGBB → [r, g, b] (0–255). Nilai tidak valid → hitam. */
function hexToRgb(hex: string): [number, number, number] {
  const raw = isHex(hex) ? hex.slice(1) : "000000";
  return [
    parseInt(raw.slice(0, 2), 16),
    parseInt(raw.slice(2, 4), 16),
    parseInt(raw.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Campur dua hex: weight = porsi warna pertama (0–1). */
export function mixHex(a: string, b: string, weight: number): string {
  const w = Math.max(0, Math.min(1, weight));
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar * w + br * (1 - w), ag * w + bg * (1 - w), ab * w + bb * (1 - w));
}

/** Luminance relatif WCAG 2.1. */
export function relativeLuminance(hex: string): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Rasio kontras WCAG antara dua hex (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const INK_LIGHT = "#FFFFFF";
const INK_DARK = "#04222B";
const INK_FALLBACK = "#000000";

/**
 * Pilih warna teks yang paling terbaca di atas `background`.
 * Dipakai untuk primary/secondary/accent agar setiap preset tetap lolos AA
 * tanpa admin harus memilih warna teks secara manual.
 *
 * Urutan: ink gelap brand → putih → hitam. Dua kandidat pertama menjaga
 * karakter visual; hitam hanya dipakai pada warna yang berada tepat di
 * ambang kontras (mis. biru sedang) di mana keduanya belum mencapai 4.5:1.
 */
export function pickReadableInk(background: string): string {
  if (contrastRatio(INK_DARK, background) >= 4.5) return INK_DARK;
  if (contrastRatio(INK_LIGHT, background) >= 4.5) return INK_LIGHT;
  return INK_FALLBACK;
}

/** Parse JSON brand_theme; setiap key tidak valid jatuh ke default-nya. */
export function parseBrandTheme(raw: string | null | undefined): BrandTheme {
  let data: unknown = null;
  if (typeof raw === "string" && raw.trim() !== "") {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_BRAND };
  for (const key of BRAND_KEYS) {
    if (isHex(obj[key])) out[key] = obj[key];
  }
  if (typeof obj.radius === "string" && (RADIUS_OPTIONS as readonly string[]).includes(obj.radius)) {
    out.radius = obj.radius;
  }
  return out;
}

/**
 * Warna teks untuk primary/secondary/accent. Dihitung dari kontras, bukan
 * diturunkan dari primary, supaya preset apa pun tetap lolos WCAG AA.
 */
export function readableInkTokens(theme: BrandTheme): {
  primary: string;
  secondary: string;
  accent: string;
} {
  return {
    primary: pickReadableInk(theme.primary),
    secondary: pickReadableInk(theme.secondary),
    accent: pickReadableInk(theme.accent),
  };
}

/**
 * Versi redup dari `ink` di atas `surface` yang tetap lolos 4.5:1.
 * Dipakai untuk teks sekunder di dalam kartu ber-primary (mis. deskripsi
 * "Kuota SPMB") agar tidak cukup hanya menurunkan opacity ke 70%.
 */
export function softenInk(ink: string, surface: string, minRatio = 4.5): string {
  for (let weight = 0.85; weight >= 0.3; weight -= 0.05) {
    const candidate = mixHex(ink, surface, weight);
    if (contrastRatio(candidate, surface) >= minRatio) return candidate;
  }
  return ink;
}

/** CSS injeksi untuk satu skema brand (lihat catatan strategi di atas). */
export function buildBrandThemeCss(theme: BrandTheme): string {
  const t = parseBrandTheme(JSON.stringify(theme));
  const ink = readableInkTokens(t);
  const darkPrimary = mixHex(t.primary, "#FFFFFF", 0.45);
  const darkInk = pickReadableInk(darkPrimary);
  const softText = mixHex(t.muted_foreground, t.foreground, 0.5);
  const chart = [
    t.primary,
    mixHex(t.primary, t.foreground, 0.35),
    t.accent,
    mixHex(t.accent, t.foreground, 0.35),
    mixHex(t.primary, t.background, 0.55),
  ];
  return `:root {
  --brand-primary: ${t.primary};
  --brand-secondary: ${t.secondary};
  --brand-accent: ${t.accent};
  --brand-background: ${t.background};
  --brand-public-bg: ${t.public_bg};
  --brand-foreground: ${t.foreground};
  --brand-muted-fg: ${t.muted_foreground};
  --brand-border: ${t.border};
  --radius: ${t.radius};
}
html:not(.dark) {
  --primary: var(--brand-primary);
  --secondary: var(--brand-secondary);
  --accent: var(--brand-accent);
  --background: var(--brand-background);
  --public-bg: var(--brand-public-bg);
  --foreground: var(--brand-foreground);
  --muted-foreground: var(--brand-muted-fg);
  --border: var(--brand-border);
  --ring: var(--primary);
  --input: var(--border);
  --sidebar: var(--background);
  --sidebar-primary: var(--primary);
  --sidebar-accent: var(--secondary);
  --primary-foreground: ${ink.primary};
  --primary-foreground-soft: ${softenInk(ink.primary, t.primary)};
  --secondary-foreground: ${ink.secondary};
  --accent-foreground: ${ink.accent};
  --sidebar-primary-foreground: ${ink.primary};
  --sidebar-accent-foreground: ${ink.secondary};
  --primary-hover: color-mix(in srgb, var(--primary), #000 20%);
  --muted: color-mix(in srgb, var(--secondary) 20%, var(--background));
  --canvas: color-mix(in srgb, var(--background) 34%, #fff);
  --surface-muted: color-mix(in srgb, var(--secondary) 22%, #fff);
  --border-subtle: color-mix(in srgb, var(--border) 45%, var(--background));
  --text-soft: ${softText};
  --public-border: color-mix(in srgb, var(--border), var(--primary) 30%);
  --chart-1: ${chart[0]};
  --chart-2: ${chart[1]};
  --chart-3: ${chart[2]};
  --chart-4: ${chart[3]};
  --chart-5: ${chart[4]};
}
.dark {
  --primary: ${darkPrimary};
  --primary-foreground: ${darkInk};
  --ring: var(--primary);
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: ${darkInk};
  --primary-hover: color-mix(in srgb, var(--primary), #000 20%);
  --chart-1: var(--primary);
}`;
}
