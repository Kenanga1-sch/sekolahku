"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PracticeList } from "./_components/practice-list";
import { PracticeRunner } from "./_components/practice-runner";
import { PracticeResult } from "./_components/practice-result";

function PraktikContent() {
  const searchParams = useSearchParams();
  const practiceId = searchParams.get("id");
  const view = searchParams.get("view");

  // Mode hasil: ?view=hasil&id=xxx
  if (view === "hasil" && practiceId) {
    return <PracticeResult practiceId={practiceId} />;
  }

  // Mode pengerjaan: ?id=xxx
  if (practiceId) {
    return <PracticeRunner practiceId={practiceId} />;
  }

  // Mode default: daftar paket + riwayat
  return <PracticeList />;
}

export default function PraktikPage() {
  return (
    <Suspense fallback={<div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>}>
      <PraktikContent />
    </Suspense>
  );
}
