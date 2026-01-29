"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
    Plus, 
    Pencil, 
    Trash2, 
    ClipboardCheck, 
    LogIn, 
    LogOut,
    Package,
    Home,
} from "lucide-react";

// Types for API response
type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "OPNAME_APPLY" | "LOGIN" | "LOGOUT";
type AuditEntity = "ASSET" | "ROOM" | "USER" | "OPNAME" | "SYSTEM";

interface RecentAuditActivity {
    id: string;
    action: AuditAction;
    entity: AuditEntity;
    entityId: string;
    userName?: string;
    note?: string;
    time: string;
}

const ACTION_ICONS: Record<AuditAction, typeof Plus> = {
    CREATE: Plus,
    UPDATE: Pencil,
    DELETE: Trash2,
    OPNAME_APPLY: ClipboardCheck,
    LOGIN: LogIn,
    LOGOUT: LogOut,
};

const ACTION_COLORS: Record<AuditAction, string> = {
    CREATE: "text-green-500 bg-green-500/10",
    UPDATE: "text-blue-500 bg-blue-500/10",
    DELETE: "text-red-500 bg-red-500/10",
    OPNAME_APPLY: "text-purple-500 bg-purple-500/10",
    LOGIN: "text-cyan-500 bg-cyan-500/10",
    LOGOUT: "text-gray-500 bg-gray-500/10",
};

const ACTION_LABELS: Record<AuditAction, string> = {
    CREATE: "Tambah",
    UPDATE: "Edit",
    DELETE: "Hapus",
    OPNAME_APPLY: "Opname",
    LOGIN: "Login",
    LOGOUT: "Logout",
};

const ENTITY_LABELS: Record<AuditEntity, string> = {
    ASSET: "Aset",
    ROOM: "Ruangan",
    USER: "User",
    OPNAME: "Opname",
    SYSTEM: "Sistem",
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

export function RecentAuditFeed() {
    const [activities, setActivities] = useState<RecentAuditActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/inventaris/data?type=recent-audit");
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
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Log Aktivitas Terbaru</CardTitle>
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
                                const ActionIcon = ACTION_ICONS[activity.action] || Pencil;
                                const colorClass = ACTION_COLORS[activity.action] || "text-gray-500 bg-gray-500/10";
                                
                                return (
                                    <div 
                                        key={activity.id} 
                                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                                    >
                                        <div className={`p-2.5 rounded-xl ${colorClass}`}>
                                            <ActionIcon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-[10px]">
                                                    {ACTION_LABELS[activity.action]}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {ENTITY_LABELS[activity.entity]}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1 truncate">
                                                {activity.userName || "System"} • {activity.note || `ID: ${activity.entityId.slice(0, 8)}`}
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
    );
}
