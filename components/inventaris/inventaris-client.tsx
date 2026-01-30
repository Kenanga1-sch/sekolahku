"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
    Package,
    Home,
    ClipboardList,
    AlertTriangle,
    TrendingUp,
    DollarSign,
    ArrowRight,
    RefreshCw,
    ArrowDownRight,
    ArrowUpRight,
    History,
    Archive
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import type { InventoryStats } from "@/types/inventory";
import { useRouter } from "next/navigation";

// Lazy load heavy components
const CategoryChart = dynamic(
    () => import("@/components/inventaris/charts").then(mod => ({ default: mod.CategoryChart })),
    {
        loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>,
        ssr: false
    }
);

const ConditionChart = dynamic(
    () => import("@/components/inventaris/charts").then(mod => ({ default: mod.ConditionChart })),
    {
        loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>,
        ssr: false
    }
);

const RecentAuditFeed = dynamic(
    () => import("@/components/inventaris/recent-audit").then(mod => ({ default: mod.RecentAuditFeed })),
    {
        loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[320px] w-full" /></CardContent></Card>,
        ssr: false
    }
);

const QuickActionsPanel = dynamic(
    () => import("@/components/inventaris/quick-actions").then(mod => ({ default: mod.QuickActionsPanel })),
    {
        loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[100px] w-full" /></CardContent></Card>,
        ssr: false
    }
);

const TopRoomsWidget = dynamic(
    () => import("@/components/inventaris/top-rooms").then(mod => ({ default: mod.TopRoomsWidget })),
    {
        loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[280px] w-full" /></CardContent></Card>,
        ssr: false
    }
);

interface InventarisClientProps {
    initialStats: InventoryStats | null;
    initialConsumableStats: any | null;
    userRole?: string;
}

export default function InventarisClient({ initialStats, initialConsumableStats, userRole }: InventarisClientProps) {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);

    const isAdmin = ["superadmin", "admin"].includes(userRole || "");

    const handleRefresh = async () => {
        setRefreshing(true);
        router.refresh();
        // Give some feedback time
        setTimeout(() => setRefreshing(false), 1000);
    };

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
            value: initialStats?.totalAssets || 0,
            icon: Package,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
            gradient: "from-blue-500 to-cyan-500",
            desc: "Jenis aset terdaftar"
        },
        {
            title: "Nilai Aset",
            value: formatCurrency(initialStats?.totalValue || 0),
            icon: DollarSign,
            color: "text-green-500",
            bgColor: "bg-green-500/10",
            gradient: "from-green-500 to-emerald-500",
            desc: "Estimasi total nilai"
        },
        {
            title: "Kondisi Baik",
            value: initialStats?.itemsGood || 0,
            icon: TrendingUp,
            color: "text-emerald-500",
            bgColor: "bg-emerald-500/10",
            gradient: "from-emerald-500 to-teal-500",
            desc: `${initialStats?.totalItems ? Math.round(((initialStats.itemsGood || 0) / initialStats.totalItems) * 100) : 0}% dari total barang`
        },
        {
            title: "Rusak/Hilang",
            value: (initialStats?.itemsDamaged || 0) + (initialStats?.itemsLost || 0),
            icon: AlertTriangle,
            color: (initialStats?.itemsDamaged || 0) + (initialStats?.itemsLost || 0) > 0 ? "text-red-500" : "text-gray-400",
            bgColor: (initialStats?.itemsDamaged || 0) + (initialStats?.itemsLost || 0) > 0 ? "bg-red-500/10" : "bg-gray-500/10",
            gradient: "from-red-500 to-pink-500",
            desc: "Perlu perhatian",
            alert: (initialStats?.itemsDamaged || 0) + (initialStats?.itemsLost || 0) > 0,
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        Inventaris & ATK
                    </h1>
                    <p className="text-muted-foreground">
                        Sistem manajemen aset sekolah dan barang habis pakai (ATK)
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

            <Tabs defaultValue="aset" className="space-y-6">
                <TabsList className={`grid w-full ${isAdmin ? "grid-cols-2" : "grid-cols-1"} lg:w-[400px]`}>
                    <TabsTrigger value="aset">Aset Tetap</TabsTrigger>
                    {isAdmin && <TabsTrigger value="atk">Barang Habis Pakai</TabsTrigger>}
                </TabsList>

                {/* === TAB ASET TETAP === */}
                <TabsContent value="aset" className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {statCards.map((stat) => (
                            <Card
                                key={stat.title}
                                className={`relative overflow-hidden group hover:shadow-lg transition-all duration-300 ${stat.alert ? 'ring-2 ring-red-500/50' : ''}`}
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
                                    <span className={`text-2xl font-bold block ${stat.alert ? 'text-red-500' : ''}`}>
                                        {stat.value}
                                    </span>
                                    <span className="text-xs text-muted-foreground mt-1 block">
                                        {stat.desc}
                                    </span>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <QuickActionsPanel />

                    {initialStats && (initialStats.itemsDamaged > 0 || initialStats.itemsLost > 0) && (
                        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20 backdrop-blur-sm">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-orange-500/20 rounded-xl">
                                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-orange-700 dark:text-orange-400">
                                            {initialStats.itemsDamaged + initialStats.itemsLost} barang perlu perhatian
                                        </p>
                                        <p className="text-sm text-orange-600/70 dark:text-orange-400/70">
                                            {initialStats.itemsDamaged} rusak, {initialStats.itemsLost} hilang
                                        </p>
                                    </div>
                                    <Link href="/inventaris/aset?filter=damaged">
                                        <Button variant="outline" size="sm" className="border-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/20">
                                            Lihat Detail
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid lg:grid-cols-2 gap-6">
                        <CategoryChart />
                        <ConditionChart />
                    </div>

                    <div className="grid lg:grid-cols-2 gap-6">
                        <RecentAuditFeed />
                        <TopRoomsWidget />
                    </div>

                    {isAdmin && (
                        <div>
                            <h2 className="text-xl font-bold mb-4">Menu Aset</h2>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                {menuItems.map((item) => (
                                    <Link key={item.href} href={item.href}>
                                        <Card className="h-full hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group">
                                            <CardHeader>
                                                <div className="flex items-center justify-between">
                                                    <div className="p-2.5 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors group-hover:scale-110 duration-300">
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
                    )}
                </TabsContent>

                {/* === TAB BARANG HABIS PAKAI === */}
                {isAdmin && (
                    <TabsContent value="atk" className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="hover:shadow-lg transition-all duration-300 border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Jenis Barang
                            </CardTitle>
                            <Package className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{initialConsumableStats?.totalItems || 0}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                            Item ATK & rumah tangga
                            </p>
                        </CardContent>
                        </Card>

                        <Card className="hover:shadow-lg transition-all duration-300 border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                            Estimasi Nilai Stok
                            </CardTitle>
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(initialConsumableStats?.totalValue || 0)}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                            Total valuasi persediaan
                            </p>
                        </CardContent>
                        </Card>

                        <Card className={`hover:shadow-lg transition-all duration-300 border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm ${initialConsumableStats?.lowStockCount ? 'border-amber-500/50 dark:border-amber-500/50' : ''}`}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                            Stok Menipis
                            </CardTitle>
                            <AlertTriangle className={`h-4 w-4 ${initialConsumableStats?.lowStockCount ? 'text-amber-500' : 'text-zinc-500'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${initialConsumableStats?.lowStockCount ? 'text-amber-600 dark:text-amber-500' : ''}`}>
                            {initialConsumableStats?.lowStockCount || 0}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                            Barang perlu restock segera
                            </p>
                        </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Link href="/inventaris/stok" className="block h-full">
                            <Card className="h-full hover:shadow-lg transition-all hover:border-blue-500/50 group">
                                <CardContent className="p-6 flex flex-col items-center text-center">
                                    <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                                        <Package className="h-8 w-8" />
                                    </div>
                                    <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">Data Barang</h3>
                                    <p className="text-sm text-muted-foreground mt-2">Kelola master data ATK, harga, dan stok awal</p>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/inventaris/transaksi/masuk" className="block h-full">
                            <Card className="h-full hover:shadow-lg transition-all hover:border-emerald-500/50 group">
                                <CardContent className="p-6 flex flex-col items-center text-center">
                                    <div className="p-4 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 mb-4 group-hover:scale-110 transition-transform">
                                        <ArrowDownRight className="h-8 w-8" />
                                    </div>
                                    <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">Barang Masuk</h3>
                                    <p className="text-sm text-muted-foreground mt-2">Catat pembelian atau penambahan stok</p>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/inventaris/transaksi/keluar" className="block h-full">
                            <Card className="h-full hover:shadow-lg transition-all hover:border-rose-500/50 group">
                                <CardContent className="p-6 flex flex-col items-center text-center">
                                    <div className="p-4 rounded-full bg-rose-100 dark:bg-rose-900/20 text-rose-600 mb-4 group-hover:scale-110 transition-transform">
                                        <ArrowUpRight className="h-8 w-8" />
                                    </div>
                                    <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">Barang Keluar</h3>
                                    <p className="text-sm text-muted-foreground mt-2">Catat pemakaian barang oleh guru/staff</p>
                                </CardContent>
                            </Card>
                        </Link>

                        <Link href="/inventaris/laporan" className="block h-full">
                            <Card className="h-full hover:shadow-lg transition-all hover:border-violet-500/50 group">
                                <CardContent className="p-6 flex flex-col items-center text-center">
                                    <div className="p-4 rounded-full bg-violet-100 dark:bg-violet-900/20 text-violet-600 mb-4 group-hover:scale-110 transition-transform">
                                        <Archive className="h-8 w-8" />
                                    </div>
                                    <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">Laporan</h3>
                                    <p className="text-sm text-muted-foreground mt-2">Rekapitulasi penggunaan dan kartu stok</p>
                                </CardContent>
                            </Card>
                        </Link>
                    </div>

                    <Card className="border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <History className="h-4 w-4" />
                                Transaksi Terkini
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {initialConsumableStats?.recentTransactions?.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    Belum ada transaksi tercatat.
                                </div>
                                ) : (
                                initialConsumableStats?.recentTransactions?.map((trx: any) => (
                                    <div key={trx.id} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/5 border border-zinc-100 dark:border-white/5 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                                trx.type === 'IN' ? 'bg-emerald-100 text-emerald-600' :
                                                trx.type === 'OUT' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                                            }`}>
                                                {trx.type === 'IN' ? <ArrowDownRight className="h-4 w-4" /> :
                                                trx.type === 'OUT' ? <ArrowUpRight className="h-4 w-4" /> : <History className="h-4 w-4" />}
                                            </div>
                                            <div>
                                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                {trx.item?.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {trx.date ? format(new Date(trx.date), "dd MMM yyyy", { locale: id }) : ""} • {trx.user?.name}
                                            </p>
                                            </div>
                                        </div>
                                        <div className={`text-sm font-bold ${
                                            trx.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'
                                        }`}>
                                            {trx.type === 'IN' ? '+' : '-'}{trx.quantity} {trx.item?.unit}
                                        </div>
                                    </div>
                                ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
