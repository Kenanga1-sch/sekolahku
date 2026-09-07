import { Suspense } from "react";
import { PublicLabelDetailClient } from "./client-page";

export default function PublicLabelDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">Memuat data...</p></div>}>
      <PublicLabelDetailClient />
    </Suspense>
  );
}
