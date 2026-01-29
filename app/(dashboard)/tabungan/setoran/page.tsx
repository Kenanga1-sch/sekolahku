"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert";
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Loader2,
    RefreshCw,
    Wallet,
    AlertCircle,
    CheckCircle2
} from "lucide-react";
import { showSuccess, showError } from "@/lib/toast";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { TabunganTransaksiWithRelations } from "@/types/tabungan";

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

function formatDateTime(date: string | Date | null): string {
    if (!date) return "-";
    return new Date(date).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function TabunganSetoranPage() {
    const { user } = useAuthStore();
    const [transactions, setTransactions] = useState<TabunganTransaksiWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/tabungan/setoran/pending?guruId=${user.id}`);
            const data = await res.json();
            if (data.items) {
                setTransactions(data.items);
            }
        } catch (error) {
            console.error("Failed to fetch pending transactions:", error);
            showError("Gagal memuat data transaksi");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totalSetor = transactions
        .filter(t => t.tipe === "setor")
        .reduce((acc, t) => acc + t.nominal, 0);

    const totalTarik = transactions
        .filter(t => t.tipe === "tarik")
        .reduce((acc, t) => acc + t.nominal, 0);

    const netAmount = totalSetor - totalTarik;
    const isNegative = netAmount < 0;
    const absAmount = Math.abs(netAmount);

    const handleSubmitSetoran = async () => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/tabungan/setoran", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    guruId: user.id,
                    catatan: `Setoran harian ${new Date().toLocaleDateString("id-ID")}`
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Gagal membuat setoran");
            }

            showSuccess("Setoran berhasil diajukan ke bendahara");
            setTransactions([]); // Clear list
            // Optionally redirect to history page
        } catch (error: any) {
            showError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Setoran Harian</h1>
                    <p className="text-muted-foreground">
                        Rekapitulasi transaksi hari ini untuk disetor ke Bendahara
                    </p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Masuk (Setor)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            + {formatRupiah(totalSetor)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Keluar (Tarik)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            - {formatRupiah(totalTarik)}
                        </div>
                    </CardContent>
                </Card>
                <Card className={isNegative ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-900">
                            {isNegative ? "Uang Harus Diambil (Reimburse)" : "Uang Fisik Disetor"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${isNegative ? "text-red-700" : "text-blue-700"}`}>
                            {formatRupiah(absAmount)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {transactions.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Rincian Transaksi Belum Disetor</CardTitle>
                        <CardDescription>Pastikan jumlah uang fisik sesuai dengan total di atas sebelum mengajukan setoran.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Waktu</TableHead>
                                    <TableHead>Siswa</TableHead>
                                    <TableHead>Tipe</TableHead>
                                    <TableHead className="text-right">Nominal</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell>{formatDateTime(t.createdAt)}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{t.siswa?.nama}</div>
                                            <div className="text-xs text-muted-foreground">{t.siswa?.nisn}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={t.tipe === "setor" ? "outline" : "destructive"} className={t.tipe === "setor" ? "text-green-600 border-green-600" : ""}>
                                                {t.tipe === "setor" ? "Setor" : "Tarik"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {formatRupiah(t.nominal)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-4 border">
                            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="font-medium">Konfirmasi Setoran</h4>
                                <p className="text-sm text-muted-foreground">
                                    Dengan menekan tombol di bawah, Anda menyatakan bahwa uang fisik senilai 
                                    <span className="font-bold text-foreground"> {formatRupiah(absAmount)} </span>
                                    {isNegative ? "telah Anda siapkan untuk diambil" : "telah siap diserahkan"} ke Bendahara.
                                </p>
                            </div>
                        </div>

                        <Button 
                            className="w-full" 
                            size="lg" 
                            onClick={handleSubmitSetoran}
                            disabled={isSubmitting}
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isNegative ? "Ajukan Pengambilan Dana" : "Ajukan Setoran ke Bendahara"}
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                     <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                        <Wallet className="h-16 w-16 mb-4 opacity-20" />
                        <h3 className="text-lg font-medium text-foreground">Tidak ada transaksi baru</h3>
                        <p>Belum ada transaksi yang perlu disetor hari ini.</p>
                     </CardContent>
                </Card>
            )}
        </div>
    );
}
