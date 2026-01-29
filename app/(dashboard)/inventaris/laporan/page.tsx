"use client";

import { useEffect, useState } from "react";
import {
    FileText,
    TrendingDown,
    TrendingUp,
    AlertTriangle,
    Package,
    ArrowLeft,
    Printer
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { InventoryStats } from "@/types/inventory";
import { RefreshCw } from "lucide-react";
import { showError } from "@/lib/toast";
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export default function LaporanPage() {
    const [stats, setStats] = useState<InventoryStats | null>(null);
    const [atkItems, setAtkItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    async function loadStats() {
        setLoading(true);
        try {
            const res = await fetch("/api/inventory/assets/reports"); // Migrated API
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
            
            // Fetch ATK Items for Report
            const resAtk = await fetch("/api/inventory/items?limit=1000"); // Fetch all for report
            if (resAtk.ok) {
                const data = await resAtk.json();
                setAtkItems(data.data);
            }

        } catch (error) {
            console.error("Failed to load inventory stats:", error);
            showError("Gagal memuat data laporan");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadStats();
    }, []);

    const handlePrint = () => {
        window.print();
    };

    const conditionData = stats ? [
        { name: "Baik", value: stats.itemsGood, color: "#10B981" }, // green-500
        { name: "Rusak", value: stats.itemsDamaged, color: "#EF4444" }, // red-500
        { name: "Hilang", value: stats.itemsLost, color: "#6B7280" }, // gray-500
    ] : [];
    
    // Calculate ATK Totals
    const totalAtkValue = atkItems.reduce((sum, item) => sum + (item.currentStock * item.price), 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 print:hidden">
                <Link href="/inventaris">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Laporan Inventaris</h1>
                    <p className="text-muted-foreground">
                        Ringkasan statistik, kondisi aset, dan stok ATK.
                    </p>
                </div>
            </div>
            
            <div className="flex justify-end gap-2 print:hidden">
                 <Button variant="outline" size="sm" onClick={loadStats} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
                 <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Cetak / Simpan PDF
                </Button>
            </div>

            <Tabs defaultValue="aset" className="space-y-6">
                <TabsList className="print:hidden">
                    <TabsTrigger value="aset">Laporan Aset Tetap</TabsTrigger>
                    <TabsTrigger value="atk">Laporan Stok ATK</TabsTrigger>
                </TabsList>

                <TabsContent value="aset" className="space-y-6">
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
                                    {formatCurrency(stats?.totalValue || 0)}
                                </div>
                                <p className="text-xs text-muted-foreground">Total nilai aset</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Condition Chart */}
                        <Card className="print:break-inside-avoid">
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
                        <Card className="print:break-inside-avoid">
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
                                        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                                            <Package className="h-8 w-8 text-green-500 mb-2 opacity-50" />
                                            <p>Semua aset dalam kondisi baik.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="atk">
                    <Card>
                        <CardHeader>
                            <CardTitle>Laporan Stok Barang Habis Pakai</CardTitle>
                            <CardDescription>
                                Posisi stok terakhir per {new Date().toLocaleDateString('id-ID')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border">
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Item</p>
                                    <p className="text-xl font-bold">{atkItems.length}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Nilai Persediaan</p>
                                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalAtkValue)}</p>
                                </div>
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Kode</TableHead>
                                        <TableHead>Nama Barang</TableHead>
                                        <TableHead>Kategori</TableHead>
                                        <TableHead className="text-right">Stok</TableHead>
                                        <TableHead className="text-right">Satuan</TableHead>
                                        <TableHead className="text-right">Harga</TableHead>
                                        <TableHead className="text-right">Total Nilai</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {atkItems.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-mono text-xs">{item.code || "-"}</TableCell>
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell>{item.category}</TableCell>
                                            <TableCell className={`text-right font-bold ${item.currentStock <= item.minStock ? "text-red-500" : ""}`}>
                                                {item.currentStock}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">{item.unit}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                {formatCurrency(item.currentStock * item.price)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {atkItems.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                Tidak ada data barang.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    header, aside, .print\\:hidden {
                        display: none !important;
                    }
                    main {
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .card {
                        border: none;
                        box-shadow: none;
                    }
                }
            `}</style>
        </div>
    );
}
