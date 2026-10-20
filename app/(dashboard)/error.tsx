"use client";

import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { goBackOrHome } from "@/lib/nav-fallback";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-2 sm:p-4">
      <Card className="w-full max-w-lg border-slate-200 dark:border-zinc-800">
        <CardContent className="flex flex-col items-center px-6 py-10 text-center sm:px-10">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
          </div>

          <h1 className="text-xl font-semibold text-foreground">
            Halaman gagal dimuat
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Terjadi kendala saat memuat data. Coba muat ulang halaman ini; bila
            masih gagal, kembali ke halaman sebelumnya.
          </p>

          {error.digest && (
            <p className="mt-4 rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
              Kode: {error.digest}
            </p>
          )}

          <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              onClick={() => {
                try {
                  reset();
                } catch {
                  window.location.reload();
                }
              }}
              className="min-h-11 w-full sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Coba Lagi
            </Button>
            <Button
              variant="outline"
              onClick={() => goBackOrHome()}
              className="min-h-11 w-full sm:w-auto"
            >
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Kembali
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
