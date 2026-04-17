"use client";

import React, { useState, useEffect, Suspense } from "react";
import { getCachedInventoryStats, getCachedConsumableStats } from "@/lib/data/inventory";
import InventarisClient from "@/components/inventaris/inventaris-client";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionAction } from "@/actions/auth";

export default function InventarisPage() {
    const [data, setData] = useState<any>(null);
    const [session, setSession] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const s = await getSessionAction();
                setSession(s);
                
                const isAdmin = ["admin"].includes(s?.user?.role || "");
                const [stats, consumableStats] = await Promise.all([
                    getCachedInventoryStats(),
                    isAdmin ? getCachedConsumableStats() : Promise.resolve(null)
                ]);
                
                setData({ stats, consumableStats });
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    if (isLoading || !data) return <InventarisSkeleton />;

    return (
        <InventarisClient
            initialStats={data.stats}
            initialConsumableStats={data.consumableStats}
            userRole={session?.user?.role}
        />
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

