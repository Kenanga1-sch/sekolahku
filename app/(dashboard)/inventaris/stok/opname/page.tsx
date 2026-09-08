import { Suspense } from "react";
import { StokOpnameClient } from "./client-page";

export default function StokOpnamePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Memuat halaman pemeriksaan…</p>
        </div>
      }
    >
      <StokOpnameClient />
    </Suspense>
  );
}
