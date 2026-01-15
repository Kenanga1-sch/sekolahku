"use client";

import { useEffect, useState } from "react";
import {
    FileText,
    TrendingDown,
    TrendingUp,
    AlertTriangle,
    Package,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { getInventoryStats } from "@/lib/inventory";
import type { InventoryStats } from "@/types/inventory";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";

export default function LaporanPage() {
    const [stats, setStats] = useState<InventoryStats | null>(null);

    useEffect(() => {
        async function loadStats() {
            const data = await getInventoryStats();
            setStats(data);
        }
        loadStats();
    }, []);

    const conditionData = stats ? [
        { name: "Baik", value: stats.itemsGood, color: "#10B981" }, // green-500
        { name: "Rusak", value: stats.itemsDamaged, color: "#EF4444" }, // red-500
        { name: "Hilang", value: stats.itemsLost, color: "#6B7280" }, // gray-500
    ] : [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Laporan Inventaris</h1>
                <p className="text-muted-foreground">
                    Ringkasan statistik dan kondisi aset sekolah
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Total Aset</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalAssets || 0}</div>
                        <p className="text-xs text-muted-foreground">Unit barang terdaftar</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Total Item Fisik</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalItems || 0}</div>
                        <p className="text-xs text-muted-foreground">Jumlah keseluruhan unit</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Estimasi Nilai</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Intl.NumberFormat("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                maximumFractionDigits: 0,
                            }).format(stats?.totalValue || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Total nilai aset</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Condition Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Distribusi Kondisi</CardTitle>
                        <CardDescription>Persentase kondisi fisik aset</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={conditionData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {conditionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-6 mt-4">
                            {conditionData.map((item) => (
                                <div key={item.name} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-sm text-muted-foreground">
                                        {item.name} ({item.value})
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Action Items */}
                <Card>
                    <CardHeader>
                        <CardTitle>Perlu Perhatian</CardTitle>
                        <CardDescription>Aset yang memerlukan tindakan lanjut</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats?.itemsDamaged ? (
                                <div className="flex items-center gap-4 p-4 border rounded-lg bg-red-50 dark:bg-red-950/20">
                                    <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full">
                                        <TrendingDown className="h-4 w-4 text-red-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-red-900 dark:text-red-200">
                                            {stats.itemsDamaged} Item Rusak
                                        </p>
                                        <p className="text-sm text-red-700 dark:text-red-300">
                                            Perlu perbaikan atau penghapusan aset
                                        </p>
                                    </div>
                                </div>
                            ) : null}

                            {stats?.itemsLost ? (
                                <div className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-950/20">
                                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                                        <AlertTriangle className="h-4 w-4 text-gray-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900 dark:text-gray-200">
                                            {stats.itemsLost} Item Hilang
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Perlu investigasi atau pelaporan
                                        </p>
                                    </div>
                                </div>
                            ) : null}

                            {!stats?.itemsDamaged && !stats?.itemsLost && (
                                <div className="flex flex-col items-center justify-center h-[150px] text-center text-muted-foreground">
                                    <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full mb-3">
                                        <Package className="h-6 w-6 text-green-600" />
                                    </div>
                                    <p>Semua aset dalam kondisi baik!</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
