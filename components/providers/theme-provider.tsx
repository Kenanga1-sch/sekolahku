"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * Tema aplikasi dikunci ke mode TERANG.
 *
 * Dulu provider ini mendukung light/dark/system (disimpan di localStorage dan
 * class `.dark` pada <html>). Mode gelap kini dihapus total: seluruh UI hanya
 * terang. API (`theme`, `setTheme`, `resolvedTheme`) tetap disediakan agar
 * pemakai lama `useTheme` tidak pecah, tetapi nilainya konstan "light" dan
 * `setTheme` menjadi no-op.
 */
type Theme = "light";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Pastikan class `.dark` (sisa dari preferensi lama di localStorage) selalu
  // dilepas, sehingga tidak ada satu pun halaman yang jatuh ke mode gelap.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    try {
      localStorage.removeItem("theme");
    } catch {
      // localStorage tidak tersedia — abaikan.
    }
  }, []);

  const setTheme = () => {
    // No-op: mode gelap tidak lagi didukung.
  };

  return (
    <ThemeContext.Provider value={{ theme: "light", setTheme, resolvedTheme: "light" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
