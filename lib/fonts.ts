import localFont from "next/font/local";

export const plusJakarta = localFont({
  src: "../app/fonts/PlusJakartaSans-Variable.woff2",
  variable: "--font-plus-jakarta",
  weight: "200 800",
  style: "normal",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
  adjustFontFallback: "Arial",
});

export const sourceSerif = localFont({
  src: "../app/fonts/SourceSerif4-Variable.woff2",
  variable: "--font-source-serif",
  weight: "200 900",
  style: "normal",
  display: "swap",
  preload: false,
  fallback: ["Georgia", "Times New Roman", "serif"],
});
