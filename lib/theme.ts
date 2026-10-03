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
  muted_foreground: "#1D8B94",
  border: "#10606F",
  radius: "0.75rem",
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isHex(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
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

/** CSS injeksi untuk satu skema brand (lihat catatan strategi di atas). */
export function buildBrandThemeCss(theme: BrandTheme): string {
  const t = parseBrandTheme(JSON.stringify(theme));
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
  --primary-hover: color-mix(in srgb, var(--primary), #000 20%);
  --muted: color-mix(in srgb, var(--secondary) 20%, var(--background));
  --secondary-foreground: color-mix(in srgb, var(--primary), #000 12%);
  --accent-foreground: color-mix(in srgb, var(--primary), #000 12%);
  --public-border: color-mix(in srgb, var(--border), var(--primary) 30%);
  --chart-1: var(--primary);
  --chart-3: var(--secondary);
}
.dark {
  --primary: color-mix(in srgb, var(--brand-primary), #fff 45%);
  --ring: var(--primary);
  --sidebar-primary: var(--primary);
  --primary-hover: color-mix(in srgb, var(--primary), #000 20%);
  --chart-1: var(--primary);
}`;
}
