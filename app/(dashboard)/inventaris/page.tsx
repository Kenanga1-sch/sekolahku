
import { Suspense } from "react";
import { auth } from "@/auth";
import { getCachedInventoryStats, getCachedConsumableStats } from "@/lib/data/inventory";
import InventarisClient from "@/components/inventaris/inventaris-client";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Inventaris & ATK | Sekolahku",
};

export default async function InventarisPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const isAdmin = ["superadmin", "admin"].includes(session.user.role || "");

    const [stats, consumableStats] = await Promise.all([
        getCachedInventoryStats(),
        isAdmin ? getCachedConsumableStats() : Promise.resolve(null)
    ]);

    return (
        <Suspense fallback={<InventarisSkeleton />}>
            <InventarisClient
                initialStats={stats}
                initialConsumableStats={consumableStats}
                userRole={session.user.role}
            />
        </Suspense>
    );
}

function InventarisSkeleton() {
    return (
        <div className="space-y-8 p-4">
            <Skeleton className="h-10 w-64" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
            <Skeleton className="h-[400px] w-full" />
        </div>
    );
}
