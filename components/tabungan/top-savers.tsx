"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";

// Types for API response
interface TopSaver {
    id: string;
    name: string;
    kelas: string;
    saldo: number;
}

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

const RANK_COLORS = [
    "bg-yellow-500",
    "bg-gray-400",
    "bg-amber-600",
    "bg-blue-500",
    "bg-purple-500",
];

export function TopSaversWidget() {
    const [savers, setSavers] = useState<TopSaver[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/tabungan/data?type=top-savers");
                if (res.ok) {
                    const data = await res.json();
                    setSavers(data);
                }
            } catch {
                // Fail silently
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    if (loading) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        Top Penabung
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex gap-3">
                                <Skeleton className="h-10 w-10 rounded-xl" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    Top Penabung
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[280px] px-6">
                    {savers.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground py-8">
                            <p>Belum ada data penabung</p>
                        </div>
                    ) : (
                        <div className="space-y-1 pb-4">
                            {savers.map((saver, index) => (
                                <Link
                                    key={saver.id}
                                    href={`/tabungan/siswa?id=${saver.id}`}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
                                >
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${RANK_COLORS[index] || 'bg-gray-500'} text-white font-bold text-sm`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                            {saver.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {saver.kelas}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-green-600">
                                            {formatRupiah(saver.saldo)}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
