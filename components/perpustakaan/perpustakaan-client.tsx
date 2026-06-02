"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
    BookOpen,
    Users,
    BookMarked,
    TrendingUp,
    AlertTriangle,
    UserCheck,
    RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { LibraryStats } from "@/types/library";
import { useRouter } from "next/navigation";

const QuickActionsPanel = dynamic(
    () => import("@/components/perpustakaan/quick-actions").then(mod => ({ default: mod.QuickActionsPanel })),
    {
        loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[100px] w-full" /></CardContent></Card>,
        ssr: false
    }
);

interface PerpustakaanClientProps {
    initialStats: LibraryStats | null;
}

export default function PerpustakaanClient({ initialStats }: PerpustakaanClientProps) {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = () => {
        setRefreshing(true);
        router.refresh();
        setTimeout(() => setRefreshing(false), 1000);
    };

    const statCards = [
        {
            title: "Total Buku",
            value: initialStats?.totalBooks || 0,
            icon: BookOpen,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
            gradient: "from-blue-500 to-cyan-500",
        },
        {
            title: "Tersedia",
            value: initialStats?.availableBooks || 0,
            icon: BookMarked,
            color: "text-green-500",
            bgColor: "bg-green-500/10",
            gradient: "from-green-500 to-emerald-500",
        },
        {
            title: "Anggota",
            value: initialStats?.totalMembers || 0,
            icon: Users,
            color: "text-purple-500",
            bgColor: "bg-purple-500/10",
            gradient: "from-purple-500 to-pink-500",
        },
        {
            title: "Dipinjam",
            value: initialStats?.borrowedBooks || 0,
            icon: TrendingUp,
            color: "text-orange-500",
            bgColor: "bg-orange-500/10",
            gradient: "from-orange-500 to-red-500",
        },
        {
            title: "Terlambat",
            value: initialStats?.overdueLoans || 0,
            icon: AlertTriangle,
            color: initialStats?.overdueLoans ? "text-red-500" : "text-gray-400",
            bgColor: initialStats?.overdueLoans ? "bg-red-500/10" : "bg-gray-500/10",
            gradient: "from-red-500 to-pink-500",
            alert: initialStats?.overdueLoans && initialStats.overdueLoans > 0,
        },
        {
            title: "Kunjungan Hari Ini",
            value: initialStats?.todayVisits || 0,
            icon: UserCheck,
            color: "text-cyan-500",
            bgColor: "bg-cyan-500/10",
            gradient: "from-cyan-500 to-blue-500",
        },
    ];



    return (
        <div className="space-y-6 md:space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        Perpustakaan
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Kelola perpustakaan sekolah Anda
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="shrink-0"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </Button>
                    <Link href="/kiosk" className="flex-1 sm:flex-none">
                        <Button variant="outline" className="gap-2 w-full">
                            <BookMarked className="h-4 w-4" />
                            Buka Kiosk
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                {statCards.map((stat) => (
                    <Card
                        key={stat.title}
                        className={`relative overflow-hidden group hover:shadow-lg transition-all duration-300 ${stat.alert ? 'ring-2 ring-red-500/50' : ''}`}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className={`p-2.5 rounded-xl ${stat.bgColor} transition-transform duration-300 group-hover:scale-110`}>
                                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                </div>
                                <div>
                                    <span className={`text-2xl font-bold block ${stat.alert ? 'text-red-500 animate-pulse' : ''}`}>
                                        {stat.value}
                                    </span>
                                    <span className="text-xs text-muted-foreground block">{stat.title}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <QuickActionsPanel />

            {/* Overdue Alert */}
            {initialStats && initialStats.overdueLoans > 0 && (
                <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20 backdrop-blur-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-red-500/20 rounded-xl animate-pulse">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-red-700 dark:text-red-400">
                                    {initialStats.overdueLoans} buku terlambat dikembalikan
                                </p>
                                <p className="text-sm text-red-600/70 dark:text-red-400/70">
                                    Segera hubungi peminjam untuk pengembalian
                                </p>
                            </div>
                            <Link href="/perpustakaan/peminjaman?filter=overdue">
                                <Button variant="outline" size="sm" className="border-red-300 hover:bg-red-100 dark:hover:bg-red-900/20">
                                    Lihat Detail
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}



        </div>
    );
}
