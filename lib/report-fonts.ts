/**
 * report-fonts.ts — Pemetaan font tunggal untuk Report Builder.
 *
 * Menyatukan nama font logis (dipakai model sel) ke:
 * - stack CSS untuk renderer browser (grid editor), dan
 * - nama keluarga terdaftar untuk react-pdf (PDF).
 *
 * Font tambahan dibundel di public/fonts dan diregistrasi via ensureFontsRegistered().
 */

import type { ReportFontFamily } from "@/lib/config/report-sheet";

export const REPORT_FONT_OPTIONS: { value: ReportFontFamily; label: string }[] = [
  { value: "Helvetica", label: "Helvetica (sans)" },
  { value: "Arial", label: "Arial" },
  { value: "Times-Roman", label: "Times New Roman" },
  { value: "Liberation Serif", label: "Liberation Serif" },
  { value: "Bookman Old Style", label: "Bookman Old Style" },
  { value: "Courier", label: "Courier" },
];

/** Stack CSS untuk browser. */
export function browserFontFamily(fontFamily?: ReportFontFamily): string {
  switch (fontFamily) {
    case "Times-Roman":
      return '"Times New Roman", Times, serif';
    case "Liberation Serif":
      return '"Liberation Serif", "Times New Roman", Times, serif';
    case "Bookman Old Style":
      return '"URW Bookman", "Bookman Old Style", Bookman, serif';
    case "Courier":
      return '"Courier New", Courier, monospace';
    case "Arial":
      return 'Arial, "Liberation Sans", Helvetica, sans-serif';
    default:
      return 'Helvetica, Arial, "Liberation Sans", sans-serif';
  }
}

/** Nama keluarga font untuk react-pdf, sadar bold/italic. */
export function pdfFontFamily(cell: { fontFamily?: ReportFontFamily; bold?: boolean; italic?: boolean }): string {
  const family = cell.fontFamily || "Helvetica";
  if (family === "Times-Roman") {
    return cell.bold ? (cell.italic ? "Times-BoldItalic" : "Times-Bold") : cell.italic ? "Times-Italic" : "Times-Roman";
  }
  if (family === "Courier") {
    return cell.bold ? (cell.italic ? "Courier-BoldOblique" : "Courier-Bold") : cell.italic ? "Courier-Oblique" : "Courier";
  }
  // Font terdaftar: react-pdf memilih varian berdasar fontWeight/fontStyle, jadi
  // cukup kembalikan nama keluarga yang diregistrasi.
  if (family === "Arial" || family === "Liberation Serif" || family === "Bookman Old Style") {
    return family;
  }
  return cell.bold ? (cell.italic ? "Helvetica-BoldOblique" : "Helvetica-Bold") : cell.italic ? "Helvetica-Oblique" : "Helvetica";
}

let registered = false;

/**
 * Daftarkan font tambahan ke react-pdf. Idempoten; aman dipanggil berkali-kali.
 * Menerima `Font` dari @react-pdf/renderer agar modul ini tak membuat impor
 * siklus. `base` = awalan path file font ("/fonts" di browser, "public/fonts"
 * di Node/test).
 */
export function registerReportFonts(Font: typeof import("@react-pdf/renderer").Font, base: string): void {
  if (registered) return;
  registered = true;
  Font.register({
    family: "Arial",
    fonts: [
      { src: `${base}/LiberationSans-Regular.ttf` },
      { src: `${base}/LiberationSans-Bold.ttf`, fontWeight: "bold" },
      { src: `${base}/LiberationSans-Italic.ttf`, fontStyle: "italic" },
      { src: `${base}/LiberationSans-BoldItalic.ttf`, fontWeight: "bold", fontStyle: "italic" },
    ],
  });
  Font.register({
    family: "Liberation Serif",
    fonts: [
      { src: `${base}/LiberationSerif-Regular.ttf` },
      { src: `${base}/LiberationSerif-Bold.ttf`, fontWeight: "bold" },
      { src: `${base}/LiberationSerif-Italic.ttf`, fontStyle: "italic" },
      { src: `${base}/LiberationSerif-BoldItalic.ttf`, fontWeight: "bold", fontStyle: "italic" },
    ],
  });
  Font.register({
    family: "Bookman Old Style",
    fonts: [
      { src: `${base}/URWBookman-Light.otf` },
      { src: `${base}/URWBookman-Demi.otf`, fontWeight: "bold" },
      { src: `${base}/URWBookman-LightItalic.otf`, fontStyle: "italic" },
      { src: `${base}/URWBookman-DemiItalic.otf`, fontWeight: "bold", fontStyle: "italic" },
    ],
  });
}
