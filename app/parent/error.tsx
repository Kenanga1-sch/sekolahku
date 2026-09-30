"use client";

import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { goBackOrHome } from "@/lib/nav-fallback";

export default function ParentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold mb-1">Terjadi Kesalahan</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        {error.message || "Sistem mengalami kendala. Silakan coba lagi."}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} size="sm">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={() => goBackOrHome()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
      </div>
    </div>
  );
}
