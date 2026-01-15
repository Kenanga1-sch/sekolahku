"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Package,
    Home,
    ClipboardList,
    AlertTriangle,
    TrendingUp,
    DollarSign,
    ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getInventoryStats } from "@/lib/inventory";
import type { InventoryStats } from "@/types/inventory";

export default function InventarisPage() {
    const [stats, setStats] = useState<InventoryStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            try {
                const data = await getInventoryStats();
                setStats(data);
            } catch (error) {
                console.error("Failed to load stats:", error);
            } finally {
                setLoading(false);
            }
        }
        loadStats();
    }, []);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
        }).format(value);
    };

    const statCards = [
        {
            title: "Total Aset",
            value: stats?.totalAssets || 0,
            icon: Package,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
            desc: "Jenis aset terdaftar"
        },
        {
            title: "Nilai Aset",
            value: formatCurrency(stats?.totalValue || 0),
            icon: DollarSign,
            color: "text-green-500",
            bgColor: "bg-green-500/10",
            desc: "Estimasi total nilai"
        },
        {
            title: "Kondisi Baik",
            value: stats?.itemsGood || 0,
            icon: TrendingUp,
            color: "text-emerald-500",
            bgColor: "bg-emerald-500/10",
            desc: `${stats?.totalItems ? Math.round(((stats.itemsGood || 0) / stats.totalItems) * 100) : 0}% dari total barang`
        },
        {
            title: "Rusak/Hilang",
            value: (stats?.itemsDamaged || 0) + (stats?.itemsLost || 0),
            icon: AlertTriangle,
            color: "text-red-500",
            bgColor: "bg-red-500/10",
            desc: "Perlu perhatian"
        },
    ];

    const menuItems = [
        {
            title: "Data Aset",
            description: "Kelola daftar inventaris, kondisi, dan lokasi aset",
            href: "/inventaris/aset",
            icon: Package,
        },
        {
            title: "Data Ruangan",
            description: "Kelola daftar ruangan dan penanggung jawab",
            href: "/inventaris/ruangan",
            icon: Home,
        },
        {
            title: "Stok Opname",
            description: "Lakukan audit fisik aset berkala",
            href: "/inventaris/opname",
            icon: ClipboardList,
        },
        {
            title: "Riwayat Audit",
            description: "Log aktivitas perubahan data inventaris",
            href: "/inventaris/audit",
            icon: TrendingUp,
        },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Inventaris Aset</h1>
                <p className="text-muted-foreground">
                    Sistem manajemen inventaris sekolah terpadu
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => (
                    <Card key={stat.title} className="relative overflow-hidden">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                </div>
                                <p className="text-sm font-medium text-muted-foreground">
                                    {stat.title}
                                </p>
                            </div>
                            <p className="text-2xl font-bold">
                                {loading ? "-" : stat.value}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {stat.desc}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Menu Utama</h2>
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
                                    <CardTitle className="text-lg mt-2">{item.title}</CardTitle>
                                    <CardDescription>{item.description}</CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
