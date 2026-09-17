"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { goGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Home, LogIn, RefreshCw } from "lucide-react";

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
  const [verifyError, setVerifyError] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const checkingRef = useRef(false);

  useEffect(() => {
    if (globalVerified) {
      setVerified(true);
      return;
    }
    if (pathname.startsWith("/profil/ganti-password")) {
      globalVerified = true;
      setVerified(true);
      return;
    }
    if (checkingRef.current) return;
    checkingRef.current = true;

    const verifySession = async () => {
      try {
        const profile: any = await goGet("/api/profile", { skipRetry: true });
        if (profile?.mustChangePassword) {
          router.replace("/profil/ganti-password");
          return;
        }
        globalVerified = true;
        setVerified(true);
      } catch (error: any) {
        if (error?.status === 401) {
          document.cookie = "user_info=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        }
        setVerifyError(true);
      } finally {
        checkingRef.current = false;
      }
    };

    verifySession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (verifyError) {
    return (
      <div className="min-h-[70dvh] flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Sesi Belum Terverifikasi</h1>
            <p className="text-muted-foreground text-sm">
              Mohon masuk kembali untuk mengakses halaman dashboard.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="h-11 px-6 rounded-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Coba Lagi
            </Button>
            <Link href="/login" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto h-11 px-6 rounded-full">
                <LogIn className="h-4 w-4 mr-2" />
                Masuk
              </Button>
            </Link>
            <Link href="/" className="w-full sm:w-auto">
              <Button variant="ghost" className="w-full sm:w-auto h-11 px-6 rounded-full">
                <Home className="h-4 w-4 mr-2" />
                Beranda
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
