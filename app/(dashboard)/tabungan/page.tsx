"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Wallet,
    Users,
    Clock,
    TrendingUp,
    TrendingDown,
    QrCode,
    ClipboardCheck,
    BarChart3,
    CreditCard,
    ArrowRight,
} from "lucide-react";
import { getTabunganStats } from "@/lib/tabungan";
import type { TabunganStats } from "@/types/tabungan";

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

const menuItems = [
    {
        title: "Siswa",
        description: "Kelola data siswa dan saldo",
        icon: Users,
        href: "/tabungan/siswa",
        color: "bg-blue-500",
    },
    {
        title: "Scan QR",
        description: "Transaksi setor/tarik",
        icon: QrCode,
        href: "/tabungan/scan",
        color: "bg-green-500",
    },
    {
        title: "Verifikasi",
        description: "Approve transaksi pending",
        icon: ClipboardCheck,
        href: "/tabungan/verifikasi",
        color: "bg-amber-500",
    },
    {
        title: "Riwayat",
        description: "Histori transaksi",
        icon: Clock,
        href: "/tabungan/riwayat",
        color: "bg-purple-500",
    },
    {
        title: "Laporan",
        description: "Statistik dan export",
        icon: BarChart3,
        href: "/tabungan/laporan",
        color: "bg-indigo-500",
    },
    {
        title: "Kartu QR",
        description: "Cetak kartu siswa",
        icon: CreditCard,
        href: "/tabungan/kartu",
        color: "bg-pink-500",
    },
];

export default function TabunganDashboardPage() {
    const [stats, setStats] = useState<TabunganStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await getTabunganStats();
                setStats(data);
            } catch (error) {
                console.error("Failed to fetch stats:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Tabungan Siswa</h1>
                <p className="text-muted-foreground">
                    Kelola tabungan siswa dengan mudah dan aman
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Siswa
                        </CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-20" />
                        ) : (
                            <div className="text-2xl font-bold">{stats?.totalSiswa || 0}</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Saldo
                        </CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-32" />
                        ) : (
                            <div className="text-2xl font-bold text-green-600">
                                {formatRupiah(stats?.totalSaldo || 0)}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Pending
                        </CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <div className="text-2xl font-bold text-amber-600">
                                {stats?.pendingTransactions || 0}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Transaksi Hari Ini
                        </CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <div className="text-2xl font-bold">{stats?.todayTransactions || 0}</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Today Summary */}
            <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-500 rounded-xl">
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

                <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-red-200 dark:border-red-800">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-500 rounded-xl">
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

            {/* Menu Grid */}
            <div>
                <h2 className="text-lg font-semibold mb-4">Menu</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {menuItems.map((item) => (
                        <Link key={item.href} href={item.href}>
                            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                                <CardContent className="pt-6">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 ${item.color} rounded-xl`}>
                                            <item.icon className="h-5 w-5 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold group-hover:text-primary transition-colors">
                                                {item.title}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {item.description}
                                            </p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
