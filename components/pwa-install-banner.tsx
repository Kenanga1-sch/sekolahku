"use client";

import { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePwaInstall } from "@/lib/hooks/use-pwa-install";

const DISMISSED_KEY = "pwa-install-dismissed";

/**
 * Banner install PWA — muncul di bagian bawah layar untuk semua pengguna.
 *
 * - Android/Chrome: tombol "Pasang" memicu native install dialog.
 * - iOS Safari: instruksi manual "Bagikan → Tambahkan ke Layar Utama".
 * - Sudah ter-install / desktop tanpa support: tidak tampil.
 * - Bisa ditutup; ditutup >7 hari baru muncul lagi.
 */
export function PwaInstallBanner() {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true); // default hidden
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMounted(true);

    // Cek kapan terakhir ditutup.
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (raw) {
      const ts = Number(raw);
      // Tampilkan lagi setelah 1 hari.
      if (Date.now() - ts < 24 * 60 * 60 * 1000) {
        return;
      }
    }
    setDismissed(false);
  }, []);

  // Jangan tampilkan jika: belum mounted, sudah ter-install, atau sudah ditutup.
  if (!mounted || isInstalled || dismissed) {
    if (typeof window !== "undefined") {
      if (isInstalled) console.log("[PWA-Banner] Hidden: already installed");
      if (dismissed) console.log("[PWA-Banner] Hidden: dismissed in localStorage");
      if (!mounted) console.log("[PWA-Banner] Hidden: not mounted yet");
    }
    return null;
  }

  // Tidak tampilkan jika bukan Android installable dan bukan iOS.
  if (!canInstall && !isIOS) {
    console.log("[PWA-Banner] Hidden: no beforeinstallprompt, not iOS");
    return null;
  }

  const handleInstall = async () => {
    if (canInstall) {
      await promptInstall();
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  };

  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 pointer-events-none",
        "sm:flex sm:justify-center",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto",
          "bg-background border rounded-xl shadow-lg p-4",
          "flex items-start gap-3",
          "sm:max-w-md w-full",
          "animate-in slide-in-from-bottom-4 fade-in duration-300",
        )}
      >
        <div className="shrink-0 mt-0.5">
          {isIOS ? (
            <Smartphone className="h-6 w-6 text-primary" />
          ) : (
            <Download className="h-6 w-6 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Pasang SDN 1 Kenanga</p>
          {canInstall ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              Akses cepat dari layar utama. Ketuk &quot;Pasang&quot; untuk menginstal aplikasi.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Buka menu <strong>Bagikan</strong> lalu pilih{" "}
              <strong>Tambahkan ke Layar Utama</strong> untuk akses cepat.
            </p>
          )}

          {canInstall && (
            <Button
              size="sm"
              className="mt-2 h-8 text-xs"
              onClick={handleInstall}
            >
              Pasang Sekarang
            </Button>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
