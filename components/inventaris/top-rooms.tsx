"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Home, TrendingUp } from "lucide-react";

// Types for API response
interface TopRoom {
    id: string;
    name: string;
    assetCount: number;
    totalValue: number;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(value);
}

export function TopRoomsWidget() {
    const [rooms, setRooms] = useState<TopRoom[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/inventaris/data?type=top-rooms");
                if (res.ok) {
                    const data = await res.json();
                    setRooms(data);
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
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                        Ruangan Teratas
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
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    Ruangan Nilai Tertinggi
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[280px] px-6">
                    {rooms.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground py-8">
                            <p>Belum ada data ruangan</p>
                        </div>
                    ) : (
                        <div className="space-y-1 pb-4">
                            {rooms.map((room, index) => (
                                <Link 
                                    key={room.id} 
                                    href={`/inventaris/aset?room=${room.id}`}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
                                >
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                            {room.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {room.assetCount} jenis aset
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-green-600">
                                            {formatCurrency(room.totalValue)}
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
