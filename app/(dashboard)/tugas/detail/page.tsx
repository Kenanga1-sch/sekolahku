import { Suspense } from "react";
import { TugasDetailClient } from "./client-page";

export default function TugasDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Memuat detail tugas…</p>
        </div>
      }
    >
      <TugasDetailClient />
    </Suspense>
  );
}
