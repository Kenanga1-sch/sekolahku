"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Home, RefreshCw, AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-8 max-w-lg"
      >
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="h-24 w-24 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Terjadi Kesalahan</h1>
          <p className="text-muted-foreground">
            Maaf, terjadi kesalahan saat memuat halaman ini. 
            Tim kami telah diberitahu dan sedang menangani masalah ini.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-2 rounded-lg inline-block">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" className="gap-2" onClick={reset}>
            <RefreshCw className="h-4 w-4" />
            Coba Lagi
          </Button>
          <Link href="/">
            <Button variant="outline" size="lg" className="gap-2">
              <Home className="h-4 w-4" />
              Kembali ke Beranda
            </Button>
          </Link>
        </div>

        {/* Help */}
        <div className="pt-8 border-t">
          <p className="text-sm text-muted-foreground">
            Jika masalah berlanjut, silakan{" "}
            <Link href="/kontak" className="text-primary hover:underline">
              hubungi kami
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
