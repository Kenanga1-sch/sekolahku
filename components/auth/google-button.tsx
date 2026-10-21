"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { goGet } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * Tombol "Lanjutkan dengan Google".
 *
 * Memakai redirect satu halaman ke /api/auth/google/start (bukan Google JS
 * SDK) sehingga CSP `script-src 'self'` tidak perlu dilonggarkan dan tidak
 * ada skrip pihak ketiga yang dimuat di aplikasi.
 *
 * Bila kredensial OAuth belum diisi di server, backend melaporkan
 * `enabled: false` dan tombol tidak dirender sama sekali.
 */
export function GoogleButton({
  redirect,
  label = "Lanjutkan dengan Google",
  className,
}: {
  /** Path internal tujuan setelah pendaftaran selesai (opsional). */
  redirect?: string;
  label?: string;
  className?: string;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    goGet<{ enabled?: boolean }>("/api/auth/google/status", { skipRetry: true })
      .then((res) => {
        if (alive) setEnabled(Boolean(res?.enabled));
      })
      .catch(() => {
        if (alive) setEnabled(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!enabled) return null;

  const start = () => {
    setBusy(true);
    const qs = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
    window.location.href = `/api/auth/google/start${qs}`;
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={start}
      disabled={busy}
      aria-label="Masuk atau daftar dengan akun Google"
      className={cn("h-11 w-full gap-3 rounded-xl bg-card font-medium", className)}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <svg className="h-[18px] w-[18px]" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
        </svg>
      )}
      {label}
    </Button>
  );
}

/** Garis pemisah "atau" antar metode masuk. */
export function AuthDivider({ text = "atau" }: { text?: string }) {
  return (
    <div className="relative flex items-center gap-3 py-1" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {text}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
