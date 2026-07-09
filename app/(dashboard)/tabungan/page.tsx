"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Wallet,
    Users,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    ShieldCheck,
    BarChart3,
} from "lucide-react";
import type { TabunganStats } from "@/types/tabungan";
import { goGet } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getSavingsTreasurer } from "@/actions/savings-admin";

// Lazy load heavy components
const QuickActionsPanel = dynamic(
    () => import("@/components/tabungan/quick-actions").then(mod => ({ default: mod.QuickActionsPanel })),
    {
        loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[100px] w-full" /></CardContent></Card>,
        ssr: false
    }
);

const TabBendahara = dynamic(
    () => import("./tab-bendahara").then(mod => mod.default),
    {
        loading: () => (
            <div className="flex h-[40vh] items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        ),
        ssr: false
    }
);

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export default function TabunganDashboardPage() {
    const { user } = useAuthStore();
    const [stats, setStats] = useState<TabunganStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Auth & Otorisasi
    const [treasurer, setTreasurer] = useState<any>(null);
    const [isCheckingRights, setIsCheckingRights] = useState(true);
    const [activeTab, setActiveTab] = useState<"dashboard" | "bendahara">("dashboard");

    const fetchStats = useCallback(async () => {
        try {
            const data: any = await goGet("/api/tabungan/data");
            setStats(data.data ?? data);
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, []);

    const checkRights = useCallback(async () => {
        try {
            const res = await getSavingsTreasurer();
            const data = res?.data ?? res;
            setTreasurer(data);
        } catch (e) {
            console.error("Failed to fetch treasurer details:", e);
        } finally {
            setIsCheckingRights(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        checkRights();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        if (activeTab === "dashboard") {
            fetchStats();
        } else {
            // Let the tab bendahara re-render or handle it
            checkRights();
            setRefreshing(false);
        }
    };

    const isTreasurer = treasurer?.id === user?.id;
    const isAdmin = user?.role === "admin" || user?.role === "superadmin";
    const canManage = isAdmin || isTreasurer;

    const statCards = [
        {
            title: "Total Siswa",
            value: stats?.totalSiswa || 0,
            icon: Users,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
            gradient: "from-blue-500 to-cyan-500",
            desc: "Siswa aktif terdaftar",
        },
        {
            title: "Total Saldo",
            value: formatRupiah(stats?.totalSaldo || 0),
            icon: Wallet,
            color: "text-green-500",
            bgColor: "bg-green-500/10",
            gradient: "from-green-500 to-emerald-500",
            desc: "Akumulasi tabungan",
        },
        {
            title: "Transaksi Hari Ini",
            value: stats?.todayTransactions || 0,
            icon: TrendingUp,
            color: "text-purple-500",
            bgColor: "bg-purple-500/10",
            gradient: "from-purple-500 to-pink-500",
            desc: "Terverifikasi hari ini",
        },
    ];

    if (isLoading || isCheckingRights) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="h-10 w-10 rounded-lg" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-28 w-full rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 dark:bg-zinc-900 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-100/30 dark:border-zinc-800">
                            <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        Tabungan Siswa
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Pusat kendali tabungan siswa sekolah terintegrasi.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="border-slate-200 hover:bg-slate-50 self-end sm:self-auto"
                >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Main Tabs (only if Admin or Treasurer) */}
            {canManage && (
                <div className="flex border-b border-muted">
                    <button
                        onClick={() => setActiveTab("dashboard")}
                        className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-[2px] flex items-center gap-2 ${
                            activeTab === "dashboard"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <BarChart3 className="h-4 w-4" />
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab("bendahara")}
                        className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-[2px] flex items-center gap-2 ${
                            activeTab === "bendahara"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <ShieldCheck className="h-4 w-4" />
                        Kelola Bendahara
                    </button>
                </div>
            )}

            {/* Tab Contents */}
            <div className="pt-2">
                {activeTab === "dashboard" ? (
                    <div className="space-y-6">
                        {/* Today Summary */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-emerald-500/30 dark:hover:border-emerald-400/30 transition-colors duration-300">
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
                                            <TrendingUp className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Setoran Hari Ini</p>
                                            <p className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
                                                {formatRupiah(stats?.todayDeposit || 0)}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-rose-500/30 dark:hover:border-rose-400/30 transition-colors duration-300">
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-600 dark:text-rose-400">
                                            <TrendingDown className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Penarikan Hari Ini</p>
                                            <p className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
                                                {formatRupiah(stats?.todayWithdraw || 0)}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid gap-4 md:grid-cols-3">
                            {statCards.map((stat) => (
                                <Card
                                    key={stat.title}
                                    className={`relative overflow-hidden group hover:shadow-lg transition-all duration-300`}
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`p-2.5 rounded-xl ${stat.bgColor} transition-transform duration-300 group-hover:scale-110`}>
                                                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                            </div>
                                            <p className="text-sm font-medium text-muted-foreground">
                                                {stat.title}
                                            </p>
                                        </div>
                                        <span className={`text-2xl font-bold block`}>
                                            {stat.value}
                                        </span>
                                        <span className="text-xs text-muted-foreground mt-1 block">
                                            {stat.desc}
                                        </span>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Quick Actions */}
                        <QuickActionsPanel />
                    </div>
                ) : (
                    <TabBendahara onChanged={fetchStats} />
                )}
            </div>
        </div>
    );
}
