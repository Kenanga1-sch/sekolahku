"use client";

// Force HMR update


import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Wallet,
    Users,
    Clock,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    RefreshCw,
    AlertCircle,
} from "lucide-react";
import type { TabunganStats } from "@/types/tabungan";

// Lazy load heavy components
const TransactionTrendChart = dynamic(
    () => import("@/components/tabungan/charts").then(mod => ({ default: mod.TransactionTrendChart })),
    {
        loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>,
        ssr: false
    }
);

const ClassBalanceChart = dynamic(
    () => import("@/components/tabungan/charts").then(mod => ({ default: mod.ClassBalanceChart })),
    {
        loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>,
        ssr: false
    }
);

const RecentTransactionsFeed = dynamic(
    () => import("@/components/tabungan/recent-transactions").then(mod => ({ default: mod.RecentTransactionsFeed })),
    {
        loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[320px] w-full" /></CardContent></Card>,
        ssr: false
    }
);

const QuickActionsPanel = dynamic(
    () => import("@/components/tabungan/quick-actions").then(mod => ({ default: mod.QuickActionsPanel })),
    {
        loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[100px] w-full" /></CardContent></Card>,
        ssr: false
    }
);

const TopSaversWidget = dynamic(
    () => import("@/components/tabungan/top-savers").then(mod => ({ default: mod.TopSaversWidget })),
    {
        loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[280px] w-full" /></CardContent></Card>,
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
    const [stats, setStats] = useState<TabunganStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    async function fetchStats() {
        try {
            const res = await fetch("/api/tabungan/data");
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => {
        fetchStats();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchStats();
    };

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

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-emerald-600">
                        Tabungan Siswa
                    </h1>
                    <p className="text-muted-foreground">
                        Kelola tabungan siswa dengan mudah dan aman
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={refreshing}
                >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                                {isLoading ? <Skeleton className="h-7 w-20" /> : stat.value}
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

            {/* Today Summary */}
            <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800 group hover:shadow-lg transition-all">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-500 rounded-xl group-hover:scale-110 transition-transform">
                                <TrendingUp className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Setoran Hari Ini</p>
                                {isLoading ? (
                                    <Skeleton className="h-8 w-32" />
                                ) : (
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                        {formatRupiah(stats?.todayDeposit || 0)}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-red-200 dark:border-red-800 group hover:shadow-lg transition-all">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-500 rounded-xl group-hover:scale-110 transition-transform">
                                <TrendingDown className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Penarikan Hari Ini</p>
                                {isLoading ? (
                                    <Skeleton className="h-8 w-32" />
                                ) : (
                                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                                        {formatRupiah(stats?.todayWithdraw || 0)}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>



            {/* Charts Section */}
            <div className="grid lg:grid-cols-2 gap-6">
                <TransactionTrendChart />
                <ClassBalanceChart />
            </div>

            {/* Recent Transactions + Top Savers */}
            <div className="grid lg:grid-cols-2 gap-6">
                <RecentTransactionsFeed />
                <TopSaversWidget />
            </div>
        </div>
    );
}
