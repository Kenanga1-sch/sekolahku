"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    BookOpen,
    Users,
    BookMarked,
    ArrowRight,
    TrendingUp,
    AlertTriangle,
    UserCheck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLibraryStats } from "@/lib/library";
import type { LibraryStats } from "@/types/library";

export default function PerpustakaanPage() {
    const [stats, setStats] = useState<LibraryStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            try {
                const data = await getLibraryStats();
                setStats(data);
            } catch (error) {
                console.error("Failed to load stats:", error);
            } finally {
                setLoading(false);
            }
        }
        loadStats();
    }, []);

    const statCards = [
        {
            title: "Total Buku",
            value: stats?.totalBooks || 0,
            icon: BookOpen,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
        },
        {
            title: "Buku Tersedia",
            value: stats?.availableBooks || 0,
            icon: BookMarked,
            color: "text-green-500",
            bgColor: "bg-green-500/10",
        },
        {
            title: "Total Anggota",
            value: stats?.totalMembers || 0,
            icon: Users,
            color: "text-purple-500",
            bgColor: "bg-purple-500/10",
        },
        {
            title: "Dipinjam",
            value: stats?.borrowedBooks || 0,
            icon: TrendingUp,
            color: "text-orange-500",
            bgColor: "bg-orange-500/10",
        },
        {
            title: "Terlambat",
            value: stats?.overdueLoans || 0,
            icon: AlertTriangle,
            color: stats?.overdueLoans ? "text-red-500" : "text-gray-400",
            bgColor: stats?.overdueLoans ? "bg-red-500/10" : "bg-gray-500/10",
        },
        {
            title: "Kunjungan Hari Ini",
            value: stats?.todayVisits || 0,
            icon: UserCheck,
            color: "text-cyan-500",
            bgColor: "bg-cyan-500/10",
        },
    ];

    const menuItems = [
        {
            title: "Kelola Buku",
            description: "Tambah, edit, dan hapus koleksi buku perpustakaan",
            href: "/perpustakaan/buku",
            icon: BookOpen,
        },
        {
            title: "Kelola Anggota",
            description: "Manajemen anggota perpustakaan dan kartu member",
            href: "/perpustakaan/anggota",
            icon: Users,
        },
        {
            title: "Peminjaman",
            description: "Kelola peminjaman dan pengembalian buku",
            href: "/perpustakaan/peminjaman",
            icon: BookMarked,
        },
        {
            title: "Laporan",
            description: "Lihat laporan dan statistik perpustakaan",
            href: "/perpustakaan/laporan",
            icon: TrendingUp,
        },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Perpustakaan</h1>
                    <p className="text-muted-foreground">
                        Kelola perpustakaan sekolah Anda
                    </p>
                </div>
                <Link href="/kiosk" target="_blank">
                    <Button variant="outline" className="gap-2">
                        <BookMarked className="h-4 w-4" />
                        Buka Kiosk
                    </Button>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {statCards.map((stat) => (
                    <Card key={stat.title} className="relative overflow-hidden">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">
                                        {loading ? "-" : stat.value}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {menuItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                        <Card className="h-full hover:shadow-md transition-all hover:border-primary/50 cursor-pointer group">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                        <item.icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                </div>
                                <CardTitle className="text-lg">{item.title}</CardTitle>
                                <CardDescription>{item.description}</CardDescription>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Overdue Alert */}
            {stats?.overdueLoans ? (
                <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            <div className="flex-1">
                                <p className="font-medium text-red-700 dark:text-red-400">
                                    {stats.overdueLoans} buku terlambat dikembalikan
                                </p>
                                <p className="text-sm text-red-600/70 dark:text-red-400/70">
                                    Segera hubungi peminjam untuk pengembalian
                                </p>
                            </div>
                            <Link href="/perpustakaan/peminjaman?filter=overdue">
                                <Button variant="outline" size="sm" className="border-red-300">
                                    Lihat Detail
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
