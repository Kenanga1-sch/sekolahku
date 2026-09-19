import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import PerkembanganClientPage from "./client-page";

function PerkembanganFallback() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-7 w-40 mb-1" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-10 w-full rounded-full" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}

export default function ParentPerkembanganPage() {
  return (
    <Suspense fallback={<PerkembanganFallback />}>
      <PerkembanganClientPage />
    </Suspense>
  );
}
