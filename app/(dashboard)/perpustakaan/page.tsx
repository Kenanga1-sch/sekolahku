
import { Suspense } from "react";
import { auth } from "@/auth";
import { getCachedLibraryStats } from "@/lib/data/library";
import PerpustakaanClient from "@/components/perpustakaan/perpustakaan-client";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Perpustakaan | Sekolahku",
};

export default async function PerpustakaanPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const stats = await getCachedLibraryStats();

    return (
        <Suspense fallback={<PerpustakaanSkeleton />}>
            <PerpustakaanClient initialStats={stats} />
        </Suspense>
    );
}

function PerpustakaanSkeleton() {
    return (
        <div className="space-y-8 p-4">
            <Skeleton className="h-10 w-64" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
            <Skeleton className="h-[400px] w-full" />
        </div>
    );
}
