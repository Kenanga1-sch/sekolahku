import { Suspense } from "react";
import TugasSayaDetailClient from "./client-page";

export default function TugasSayaDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Memuat detail tugas…</p>
        </div>
      }
    >
      <TugasSayaDetailClient />
    </Suspense>
  );
}
