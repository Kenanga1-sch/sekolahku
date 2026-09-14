import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import ParentTabunganClient from "./client-page";

function TabunganFallback() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-7 w-20 mb-1" />
        <Skeleton className="h-4 w-52" />
      </div>
      <Skeleton className="h-10 w-full rounded-full" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="rounded-lg border p-3 space-y-2">
        <Skeleton className="h-5 w-32" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ParentTabunganPage() {
  return (
    <Suspense fallback={<TabunganFallback />}>
      <ParentTabunganClient />
    </Suspense>
  );
}
