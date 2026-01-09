import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Skeleton */}
      <div className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <Skeleton className="h-8 w-48 mx-auto rounded-full" />
          <Skeleton className="h-16 w-full max-w-xl mx-auto" />
          <Skeleton className="h-6 w-full max-w-lg mx-auto" />
          <div className="flex justify-center gap-4 pt-4">
            <Skeleton className="h-12 w-40 rounded-full" />
            <Skeleton className="h-12 w-32 rounded-full" />
          </div>
        </div>
      </div>

      {/* Stats Skeleton */}
      <div className="container py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-lg">
              <div className="flex flex-col items-center space-y-4">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="container py-16">
        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-5 w-3/4" />
              ))}
            </div>
          </div>
          <Skeleton className="aspect-square rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
