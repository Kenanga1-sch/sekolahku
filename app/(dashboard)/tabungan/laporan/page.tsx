"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    Wallet,
    Download,
    Calendar,
    ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { showSuccess, showError } from "@/lib/toast";
import type { TabunganStats, TabunganTransaksiWithRelations, TabunganKelas } from "@/types/tabungan";

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

type PeriodType = "today" | "week" | "month" | "year";

function getDateRange(period: PeriodType): { start: string; end: string } {
    const now = new Date();
    const end = now.toISOString();
    let start: Date;

    switch (period) {
        case "today":
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case "week":
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case "month":
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case "year":
            start = new Date(now.getFullYear(), 0, 1);
            break;
        default:
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    return { start: start.toISOString(), end };
}

export default function TabunganLaporanPage() {
    const [stats, setStats] = useState<TabunganStats | null>(null);
    const [transactions, setTransactions] = useState<TabunganTransaksiWithRelations[]>([]);
    const [kelasList, setKelasList] = useState<TabunganKelas[]>([]);
    const [period, setPeriod] = useState<PeriodType>("month");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const { start, end } = getDateRange(period);
                
                const statsPromise = fetch("/api/tabungan/stats").then(r => r.json());
                
                const transParams = new URLSearchParams({
                    startDate: start,
                    endDate: end,
                    perPage: "10000", // Fetch all for report
                });
                const transPromise = fetch(`/api/tabungan/transaksi?${transParams.toString()}`).then(r => r.json());
                
                const kelasPromise = fetch("/api/tabungan/kelas").then(r => r.json());

                const [statsData, transRes, kelasRes] = await Promise.all([
                    statsPromise,
                    transPromise,
                    kelasPromise,
                ]);

                if (statsData.error) throw new Error(statsData.error);
                if (transRes.error) throw new Error(transRes.error);
                if (kelasRes.error) throw new Error(kelasRes.error);

                setStats(statsData);
                setTransactions(transRes.items || []);
                setKelasList(Array.isArray(kelasRes) ? kelasRes : []);
            } catch (error) {
                console.error("Failed to fetch report data:", error);
                showError("Gagal memuat data laporan");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [period]);

    // Calculate period stats
    const periodStats = {
        totalSetor: transactions
            .filter((t) => t.tipe === "setor")
            .reduce((sum, t) => sum + t.nominal, 0),
        totalTarik: transactions
            .filter((t) => t.tipe === "tarik")
            .reduce((sum, t) => sum + t.nominal, 0),
        jumlahTransaksi: transactions.length,
    };

    const handleExport = () => {
        // Simple CSV export
        const headers = ["Tanggal", "Siswa", "Kelas", "Tipe", "Nominal", "Status"];
        const rows = transactions.map((t) => [
            new Date(t.createdAt || "").toLocaleDateString("id-ID"),
            t.siswa?.nama || "-",
            t.siswa?.kelas?.nama || "-",
            t.tipe,
            t.nominal.toString(),
            t.status,
        ]);

        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `laporan-tabungan-${period}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        showSuccess("Laporan berhasil diunduh");
    };

    const periodLabels: Record<PeriodType, string> = {
        today: "Hari Ini",
        week: "Minggu Ini",
        month: "Bulan Ini",
        year: "Tahun Ini",
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/tabungan">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Laporan Tabungan</h1>
                        <p className="text-muted-foreground">
                            Statistik dan analisis tabungan siswa
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                        <SelectTrigger className="w-40">
                            <Calendar className="h-4 w-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Hari Ini</SelectItem>
                            <SelectItem value="week">Minggu Ini</SelectItem>
                            <SelectItem value="month">Bulan Ini</SelectItem>
                            <SelectItem value="year">Tahun Ini</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={handleExport} disabled={transactions.length === 0}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Overall Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                            Total Siswa
                        </CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <div className="text-2xl font-bold">{stats?.totalSiswa || 0}</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Kelas
                        </CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <div className="text-2xl font-bold">{kelasList.length}</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Rata-rata Saldo
                        </CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <div className="text-2xl font-bold text-blue-600">
                                {formatRupiah(
                                    stats?.totalSiswa ? Math.round(stats.totalSaldo / stats.totalSiswa) : 0
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Period Stats */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Laporan {periodLabels[period]}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="p-6 bg-green-50 dark:bg-green-950/30 rounded-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <TrendingUp className="h-5 w-5 text-green-600" />
                                <span className="text-sm text-muted-foreground">Total Setoran</span>
                            </div>
                            {isLoading ? (
                                <Skeleton className="h-10 w-32" />
                            ) : (
                                <p className="text-3xl font-bold text-green-600">
                                    {formatRupiah(periodStats.totalSetor)}
                                </p>
                            )}
                        </div>

                        <div className="p-6 bg-red-50 dark:bg-red-950/30 rounded-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <TrendingDown className="h-5 w-5 text-red-600" />
                                <span className="text-sm text-muted-foreground">Total Penarikan</span>
                            </div>
                            {isLoading ? (
                                <Skeleton className="h-10 w-32" />
                            ) : (
                                <p className="text-3xl font-bold text-red-600">
                                    {formatRupiah(periodStats.totalTarik)}
                                </p>
                            )}
                        </div>

                        <div className="p-6 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <BarChart3 className="h-5 w-5 text-blue-600" />
                                <span className="text-sm text-muted-foreground">Jumlah Transaksi</span>
                            </div>
                            {isLoading ? (
                                <Skeleton className="h-10 w-16" />
                            ) : (
                                <p className="text-3xl font-bold text-blue-600">
                                    {periodStats.jumlahTransaksi}
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Net Change */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Perubahan Bersih ({periodLabels[period]})</p>
                            {isLoading ? (
                                <Skeleton className="h-10 w-40 mt-2" />
                            ) : (
                                <p
                                    className={`text-3xl font-bold ${periodStats.totalSetor - periodStats.totalTarik >= 0
                                            ? "text-green-600"
                                            : "text-red-600"
                                        }`}
                                >
                                    {periodStats.totalSetor - periodStats.totalTarik >= 0 ? "+" : ""}
                                    {formatRupiah(periodStats.totalSetor - periodStats.totalTarik)}
                                </p>
                            )}
                        </div>
                        <div
                            className={`p-4 rounded-full ${periodStats.totalSetor - periodStats.totalTarik >= 0
                                    ? "bg-green-100 dark:bg-green-900/30"
                                    : "bg-red-100 dark:bg-red-900/30"
                                }`}
                        >
                            {periodStats.totalSetor - periodStats.totalTarik >= 0 ? (
                                <TrendingUp className="h-8 w-8 text-green-600" />
                            ) : (
                                <TrendingDown className="h-8 w-8 text-red-600" />
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
