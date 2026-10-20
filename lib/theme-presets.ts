import type { BrandTheme } from "./theme";
import paletteData from "./theme-palettes.json";

/**
 * Preset tema warna.
 *
 * Sumber:
 * - 3 preset bawaan (seed migration 000071_saved_themes.up.sql) — nilainya
 *   HARUS identik dengan seed SQL karena dipakai sebagai fallback UI.
 * - 148 palet galeri di `theme-palettes.json`, snapshot dari katalog
 *   nextlevelbuilder/data/colors.csv (palet berlatar terang). File JSON
 *   sengaja di-vendor agar build/CI tidak bergantung pada folder `.agents/`
 *   yang di-gitignore.
 *
 * Preset galeri hanya ada di sisi klien (bukan baris `saved_themes`) supaya
 * tabel tetap menjadi tempat preset kustom admin — satu sumber kebenaran.
 */

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  theme: BrandTheme;
  /** Keluarga warna untuk filter galeri (mis. "Biru", "Teal"). */
  family?: string;
}

/** Opsi A (rilis ini): Teal Classic adalah tema aktif default. */
export const TEAL_CLASSIC: BrandTheme = {
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

const GREEN_CLASSIC: BrandTheme = {
  primary: "#065F46",
  secondary: "#A7F3D0",
  accent: "#A7F3D0",
  background: "#FFF8E7",
  public_bg: "#F7EBD5",
  foreground: "#1a2e1a",
  muted_foreground: "#4b6b4b",
  border: "#d1e7dd",
  radius: "0.75rem",
};

const BLUE_FRESH: BrandTheme = {
  primary: "#1E40AF",
  secondary: "#BFDBFE",
  accent: "#60A5FA",
  background: "#EFF6FF",
  public_bg: "#EFF6FF",
  foreground: "#0F172A",
  muted_foreground: "#475569",
  border: "#93C5FD",
  radius: "0.75rem",
};

interface PaletteEntry {
  id: string;
  name: string;
  family: string;
  description: string;
  theme: BrandTheme;
}

/** 148 palet galeri (hanya mode terang). */
export const PALETTE_PRESETS: ThemePreset[] = (paletteData.palettes as PaletteEntry[]).map(
  (p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    theme: p.theme,
    family: p.family,
  }),
);

/** Fallback lokal (dipakai bila /api/theme-presets belum termuat). */
export const LOCAL_PRESETS: ThemePreset[] = [
  {
    id: "preset-teal-classic",
    name: "Teal Classic",
    description: "Palet teal resmi sekolah — tenang, modern, kontras tinggi.",
    theme: TEAL_CLASSIC,
    family: "Teal",
  },
  {
    id: "preset-green-classic",
    name: "Green Classic",
    description: "Hijau daun klasik — hangat dan ramah untuk sekolah dasar.",
    theme: GREEN_CLASSIC,
    family: "Hijau",
  },
  {
    id: "preset-blue-fresh",
    name: "Blue Fresh",
    description: "Biru segar dan profesional — cocok untuk institusi formal.",
    theme: BLUE_FRESH,
    family: "Biru",
  },
  ...PALETTE_PRESETS,
];

/** Urutan keluarga warna untuk filter galeri. */
export const PRESET_FAMILIES = [
  "Teal",
  "Hijau",
  "Biru",
  "Indigo",
  "Amber",
  "Merah",
  "Pink",
  "Netral",
  "Kuning",
  "Lain",
] as const;
