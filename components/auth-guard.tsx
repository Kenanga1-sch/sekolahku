"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { goGet } from "@/lib/api-client";

// ponytail: single-verify guard. Session expiry caught by per-page 401 handlers.
let globalVerified = false;
export function resetAuthGuard() { globalVerified = false; }

/**
 * Client-side auth guard component.
 * Verifies session ONCE on first mount, then lets all subsequent
 * navigations render instantly (no re-blocking).
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState(globalVerified);
  const router = useRouter();
  const pathname = usePathname();
  const checkingRef = useRef(false);

  useEffect(() => {
    if (globalVerified) {
      setVerified(true);
      return;
    }
    if (checkingRef.current) return;
    checkingRef.current = true;

    const verifySession = async () => {
      try {
        await goGet("/api/profile", { skipRetry: true });
        globalVerified = true;
        setVerified(true);
      } catch {
        document.cookie = "user_info=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      } finally {
        checkingRef.current = false;
      }
    };

    verifySession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!verified) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Memverifikasi Sesi...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
