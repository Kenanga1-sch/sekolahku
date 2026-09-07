import { Suspense } from "react";
import { LabelPrintClient } from "./client-page";

export default function LabelPrintPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>Memuat label...</p></div>}>
      <LabelPrintClient />
    </Suspense>
  );
}
