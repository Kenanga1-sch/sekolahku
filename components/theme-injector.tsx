"use client";

import { useEffect } from "react";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { parseBrandTheme, buildBrandThemeCss } from "@/lib/theme";

/**
 * Menyuntik CSS tema brand (settings.brand_theme) ke <head>.
 * Dipasang di dalam SchoolSettingsProvider (lihat app/layout.tsx).
 * brand_theme kosong/tidak valid → style dilepas, globals.css berlaku.
 */
export default function ThemeInjector() {
  const { settings } = useSchoolSettings();

  useEffect(() => {
    const raw = settings?.brand_theme;
    const STYLE_ID = "brand-theme-style";
    const existing = document.getElementById(STYLE_ID);

    if (!raw || raw.trim() === "") {
      existing?.remove();
      return;
    }

    const css = buildBrandThemeCss(parseBrandTheme(raw));
    let style = existing;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }, [settings?.brand_theme]);

  return null;
}
