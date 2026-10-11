import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import PresensiClientPage from "./client-page";

function PresensiFallback() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-7 w-24 mb-1" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-10 w-full rounded-full" />
      <div className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

export default function ParentPresensiPage() {
  return (
    <Suspense fallback={<PresensiFallback />}>
      <PresensiClientPage />
    </Suspense>
  );
}
