"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Client-side auth guard component.
 * Replaces Next.js middleware JWT check for static export.
 * Wraps protected pages to redirect unauthenticated users to /login.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if JWT cookie exists
    const hasSession = document.cookie.split(";").some(c => c.trim().startsWith("session="));

    if (!hasSession) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else {
      setVerified(true);
    }
  }, [pathname, router]);

  // Handle SSR/Initial Render safely
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
