"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, CheckCircle, Smartphone, Monitor, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Tombol "Pasang Aplikasi" PWA universal.
 *
 * - Android Chrome/Edge/Samsung: panggil beforeinstallprompt prompt().
 * - iOS Safari: tampilkan dialog instruksi "Bagikan → Tambahkan ke Layar Utama".
 * - Desktop Chrome/Edge: panggil prompt atau tampilkan dialog instruksi.
 * - Sudah ter-install: tampilkan status "Aplikasi sudah terpasang".
 */
export function PwaInstallButton({ className }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(standalone);

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === "accepted") setIsInstalled(true);
    } else {
      setShowDialog(true);
    }
  }, [deferredPrompt]);

  if (isInstalled) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-green-600 dark:text-green-400", className)}>
        <CheckCircle className="h-4 w-4" />
        Aplikasi sudah terpasang
      </div>
    );
  }

  // iOS: always show instructions dialog
  if (isIOS) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setShowDialog(true)} className={className}>
          <ArrowDownToLine className="mr-2 h-4 w-4" />
          Pasang Aplikasi
        </Button>
        {showDialog && <InstallInstructionsDialog onClose={() => setShowDialog(false)} isIOS />}
      </>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleInstall} className={className}>
        <Download className="mr-2 h-4 w-4" />
        {deferredPrompt ? "Pasang Sekarang" : "Pasang Aplikasi"}
      </Button>
      {showDialog && <InstallInstructionsDialog onClose={() => setShowDialog(false)} />}
    </>
  );
}

/**
 * Dialog instruksi manual — ditampilkan untuk iOS atau ketika
 * beforeinstallprompt tidak tersedia (browser tanpa prompt support).
 */
function InstallInstructionsDialog({ onClose, isIOS }: { onClose: () => void; isIOS?: boolean }) {
  const steps = isIOS
    ? [
        { icon: <Smartphone className="h-5 w-5" />, text: 'Ketuk tombol **Bagikan** (kotak dengan panah ke atas) di Safari.' },
        { icon: <ArrowDownToLine className="h-5 w-5" />, text: 'Pilih **Tambahkan ke Layar Utama**.' },
        { icon: <CheckCircle className="h-5 w-5" />, text: 'Ketuk **Tambah** untuk mengonfirmasi.' },
      ]
    : [
        { icon: <Monitor className="h-5 w-5" />, text: 'Ketuk ikon **⋮** (tiga titik) di pojok kanan atas browser.' },
        { icon: <ArrowDownToLine className="h-5 w-5" />, text: 'Pilih **Pasang aplikasi** atau **Install app**.' },
        { icon: <CheckCircle className="h-5 w-5" />, text: 'Ketuk **Pasang** untuk mengonfirmasi.' },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-background rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Pasang SDN 1 Kenanga</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
        </div>
        <div className="space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 text-primary">{s.icon}</div>
              <p className="text-sm" dangerouslySetInnerHTML={{ __html: s.text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
            </div>
          ))}
        </div>
        <Button onClick={onClose} className="w-full" size="sm">Mengerti</Button>
      </div>
    </div>
  );
}
