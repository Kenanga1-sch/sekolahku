"use client";

import React, { useState, useEffect } from "react";
import { getCachedInventoryStats, getCachedConsumableStats } from "@/lib/data/inventory";
import InventarisClient from "@/components/inventaris/inventaris-client";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionAction } from "@/actions/auth";

export default function InventarisPage() {
    const [data, setData] = useState<any>(null);
    const [session, setSession] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const load = async () => {
            try {
                const s = await getSessionAction();
                setSession(s);

                // Definisi admin tunggal: superadmin dan admin. Dulu hanya "admin",
                // sehingga superadmin justru kehilangan tab ATK.
                const isAdmin = ["superadmin", "admin"].includes(s?.user?.role || "");
                const [stats, consumableStats] = await Promise.all([
                    getCachedInventoryStats().catch(() => null),
                    isAdmin ? getCachedConsumableStats().catch(() => null) : Promise.resolve(null)
                ]);

                // Selalu set data dengan fallback kosong agar tidak stuck di skeleton
                setData({
                    stats: stats || {},
                    consumableStats: consumableStats || null
                });
            } catch (err) {
                console.error(err);
                // Set data kosong agar skeleton tidak muncul terus
                setData({ stats: {}, consumableStats: null });
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [refreshKey]);

    const reload = () => setRefreshKey(k => k + 1);

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

