"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorkerRegistration | null>(
    null,
  );
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator))
      return;

    let active = true;

    const check = async () => {
      if (!active) return;
      try {
        const r = await navigator.serviceWorker.getRegistration();
        if (r && r.waiting) {
          setWaiting(r);
          setShow(true);
        }
      } catch {
        // abaikan
      }
    };
    check();

    // Polling lembut tiap 60s untuk menangkap update yang tidak memicu event.
    const interval = setInterval(check, 60000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (!show) return null;

  const apply = () => {
    if (!waiting || !waiting.waiting) return;
    waiting.waiting.postMessage({ type: "SKIP_WAITING" });
    setShow(false);
    window.location.reload();
  };

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2",
        "rounded-full border bg-background px-3.5 py-1.5 text-xs shadow-lg",
      )}
    >
      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      <span>Versi baru tersedia. Muat ulang untuk perbarui.</span>
      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={apply}>
        Sekarang
      </Button>
    </div>
  );
}
