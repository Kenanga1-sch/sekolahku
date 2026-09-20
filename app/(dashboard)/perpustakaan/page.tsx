"use client";

import React, { useState, useEffect, Suspense } from "react";
import { getCachedLibraryStats } from "@/lib/data/library";
import PerpustakaanClient from "@/components/perpustakaan/perpustakaan-client";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export default function PerpustakaanPage() {
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshSignal, setRefreshSignal] = useState(0);

    useEffect(() => {
        setIsLoading(true);
        getCachedLibraryStats()
            .then(data => {
                setStats(data);
            })
            .catch(err => {
                console.error(err);
                // Set stats kosong agar skeleton tidak muncul terus
                setStats({});
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [refreshSignal]);

    if (isLoading || !stats) return <PerpustakaanSkeleton />;

    return (
        <Suspense fallback={<PerpustakaanSkeleton />}>
            <PerpustakaanClient
                initialStats={stats}
                onRefresh={() => setRefreshSignal(s => s + 1)}
            />
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

