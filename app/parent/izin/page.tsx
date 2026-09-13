"use client";

import { Suspense } from "react";
import IzinClientPage from "./client-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-muted-foreground animate-pulse text-sm">Memuat…</div>}>
      <IzinClientPage />
    </Suspense>
  );
}
