"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { BookMarked, RotateCcw, UserCheck, Sparkles } from "lucide-react";
import { BackgroundGradient } from "@/components/ui/background-gradient";

// Types for API response
interface RecentActivity {
    id: string;
    type: "borrow" | "return" | "visit";
    title: string;
    description: string;
    time: string;
    memberName?: string;
    itemTitle?: string;
}

const ACTIVITY_ICONS = {
    borrow: BookMarked,
    return: RotateCcw,
    visit: UserCheck,
};

const ACTIVITY_COLORS = {
    borrow: "text-blue-500 bg-blue-500/10",
    return: "text-green-500 bg-green-500/10",
    visit: "text-purple-500 bg-purple-500/10",
};

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

export function RecentActivityFeed() {
    const [activities, setActivities] = useState<RecentActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/perpustakaan/data?type=recent-activity");
                if (res.ok) {
                    const data = await res.json();
                    setActivities(data);
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
                    <CardTitle className="text-lg">Aktivitas Terbaru</CardTitle>
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
        <BackgroundGradient containerClassName="h-full" className="h-full rounded-[22px] p-0 bg-white dark:bg-zinc-900 border-none">
            <Card className="h-full border-none shadow-none bg-transparent">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Aktivitas Terbaru
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[320px] px-6">
                        {activities.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-muted-foreground py-8">
                                <p>Belum ada aktivitas</p>
                            </div>
                        ) : (
                            <div className="space-y-1 pb-4">
                                {activities.map((activity) => {
                                    const Icon = ACTIVITY_ICONS[activity.type];
                                    const colorClass = ACTIVITY_COLORS[activity.type];
                                    
                                    return (
                                        <div 
                                            key={activity.id} 
                                            className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                                        >
                                            <div className={`p-2.5 rounded-xl ${colorClass}`}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {activity.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {activity.description}
                                                </p>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                {formatTimeAgo(activity.time)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>
        </BackgroundGradient>
    );
}
