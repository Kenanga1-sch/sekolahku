import type { BrandTheme } from "./theme";

/**
 * Preset tema warna — nilai JSON-nya HARUS identik dengan seed di
 * migration 000071_saved_themes.up.sql (satu sumber kebenaran dua tempat:
 * SQL untuk tabel, TS ini untuk fallback UI bila API belum termuat).
 */

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  theme: BrandTheme;
}

/** Opsi A (rilis ini): Teal Classic adalah tema aktif default. */
export const TEAL_CLASSIC: BrandTheme = {
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

/** Fallback lokal (dipakai bila /api/theme-presets belum termuat). */
export const LOCAL_PRESETS: ThemePreset[] = [
  { id: "preset-teal-classic", name: "Teal Classic", description: "Palet teal resmi sekolah — tenang, modern, kontras tinggi.", theme: TEAL_CLASSIC },
  { id: "preset-green-classic", name: "Green Classic", description: "Hijau daun klasik — hangat dan ramah untuk sekolah dasar.", theme: GREEN_CLASSIC },
  { id: "preset-blue-fresh", name: "Blue Fresh", description: "Biru segar dan profesional — cocok untuk institusi formal.", theme: BLUE_FRESH },
];
