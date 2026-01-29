"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

// Types for API response
interface RecentTransaction {
    id: string;
    type: "setor" | "tarik";
    nominal: number;
    siswaName: string;
    kelasName: string;
    time: string;
}

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function RecentTransactionsFeed() {
    const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/tabungan/data?type=recent");
                if (res.ok) {
                    const data = await res.json();
                    setTransactions(data);
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
                    <CardTitle className="text-lg">Transaksi Terbaru</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex gap-3">
                                <Skeleton className="h-10 w-10 rounded-xl" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-48" />
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
                <CardTitle className="text-lg font-semibold">Transaksi Terbaru</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[320px] px-6">
                    {transactions.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground py-8">
                            <p>Belum ada transaksi terverifikasi</p>
                        </div>
                    ) : (
                        <div className="space-y-1 pb-4">
                            {transactions.map((tx) => (
                                <div
                                    key={tx.id}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                                >
                                    <div className={`p-2.5 rounded-xl ${tx.type === "setor" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                                        {tx.type === "setor" ? (
                                            <TrendingUp className="h-4 w-4" />
                                        ) : (
                                            <TrendingDown className="h-4 w-4" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {tx.siswaName}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {tx.kelasName}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-semibold ${tx.type === "setor" ? "text-green-600" : "text-red-600"}`}>
                                            {tx.type === "setor" ? "+" : "-"}{formatRupiah(tx.nominal)}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {formatTimeAgo(tx.time)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
