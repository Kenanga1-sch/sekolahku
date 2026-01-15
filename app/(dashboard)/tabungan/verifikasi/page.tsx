"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    CheckCircle2,
    XCircle,
    Clock,
    ArrowDownCircle,
    ArrowUpCircle,
    Loader2,
    RefreshCw,
} from "lucide-react";
import { getPendingTransaksi, verifyTransaksi } from "@/lib/tabungan";
import { showSuccess, showError } from "@/lib/toast";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { TabunganTransaksi } from "@/types/tabungan";

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

function formatDateTime(date: string): string {
    return new Date(date).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function TabunganVerifikasiPage() {
    const { user } = useAuthStore();
    const [transactions, setTransactions] = useState<TabunganTransaksi[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [verifyId, setVerifyId] = useState<string | null>(null);
    const [verifyAction, setVerifyAction] = useState<"approve" | "reject" | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const result = await getPendingTransaksi();
            setTransactions(result.items);
        } catch (error) {
            console.error("Failed to fetch transactions:", error);
            showError("Gagal memuat data transaksi");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleVerify = async () => {
        if (!verifyId || !user || !verifyAction) return;

        setIsProcessing(true);
        try {
            await verifyTransaksi(verifyId, user.id, verifyAction === "approve");
            showSuccess(
                verifyAction === "approve"
                    ? "Transaksi berhasil diverifikasi"
                    : "Transaksi ditolak"
            );
            setVerifyId(null);
            setVerifyAction(null);
            fetchData();
        } catch (error) {
            console.error("Verification error:", error);
            showError("Gagal memproses verifikasi");
        } finally {
            setIsProcessing(false);
        }
    };

    const openVerifyDialog = (id: string, action: "approve" | "reject") => {
        setVerifyId(id);
        setVerifyAction(action);
    };

    const selectedTransaction = transactions.find((t) => t.id === verifyId);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Verifikasi Transaksi</h1>
                    <p className="text-muted-foreground">
                        Verifikasi transaksi setoran dan penarikan siswa
                    </p>
                </div>
                <Button variant="outline" onClick={() => { setIsLoading(true); fetchData(); }}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Pending Count */}
            <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-500 rounded-xl">
                            <Clock className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Menunggu Verifikasi</p>
                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                                {isLoading ? <Skeleton className="h-8 w-12" /> : transactions.length}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Waktu</TableHead>
                                <TableHead>Siswa</TableHead>
                                <TableHead>Tipe</TableHead>
                                <TableHead className="text-right">Nominal</TableHead>
                                <TableHead>Operator</TableHead>
                                <TableHead className="text-center">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-32 mx-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12">
                                        <CheckCircle2 className="h-16 w-16 mx-auto text-green-500/50 mb-4" />
                                        <p className="text-lg font-medium text-muted-foreground">
                                            Semua transaksi sudah diverifikasi
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Tidak ada transaksi pending saat ini
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {formatDateTime(t.created)}
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{t.expand?.siswa_id?.nama || "-"}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {t.expand?.siswa_id?.nisn}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    t.tipe === "setor"
                                                        ? "border-green-500 text-green-600"
                                                        : "border-red-500 text-red-600"
                                                }
                                            >
                                                {t.tipe === "setor" ? (
                                                    <ArrowDownCircle className="h-3 w-3 mr-1" />
                                                ) : (
                                                    <ArrowUpCircle className="h-3 w-3 mr-1" />
                                                )}
                                                {t.tipe === "setor" ? "Setor" : "Tarik"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold">
                                            {formatRupiah(t.nominal)}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {t.expand?.user_id?.name || "-"}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-green-500 text-green-600 hover:bg-green-50"
                                                    onClick={() => openVerifyDialog(t.id, "approve")}
                                                >
                                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-red-500 text-red-600 hover:bg-red-50"
                                                    onClick={() => openVerifyDialog(t.id, "reject")}
                                                >
                                                    <XCircle className="h-4 w-4 mr-1" />
                                                    Tolak
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Verify Confirmation Dialog */}
            <AlertDialog open={!!verifyId} onOpenChange={() => { setVerifyId(null); setVerifyAction(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {verifyAction === "approve" ? "Verifikasi Transaksi?" : "Tolak Transaksi?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4">
                                <p>
                                    {verifyAction === "approve"
                                        ? "Transaksi akan diverifikasi dan saldo siswa akan diperbarui."
                                        : "Transaksi akan ditolak dan tidak akan mempengaruhi saldo siswa."}
                                </p>
                                {selectedTransaction && (
                                    <div className="p-4 bg-muted rounded-lg space-y-2">
                                        <div className="flex justify-between">
                                            <span>Siswa:</span>
                                            <span className="font-medium">
                                                {selectedTransaction.expand?.siswa_id?.nama}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Tipe:</span>
                                            <Badge variant={selectedTransaction.tipe === "setor" ? "default" : "destructive"}>
                                                {selectedTransaction.tipe === "setor" ? "Setor" : "Tarik"}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Nominal:</span>
                                            <span className="font-bold">{formatRupiah(selectedTransaction.nominal)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleVerify}
                            disabled={isProcessing}
                            className={
                                verifyAction === "approve"
                                    ? "bg-green-600 hover:bg-green-700"
                                    : "bg-red-600 hover:bg-red-700"
                            }
                        >
                            {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {verifyAction === "approve" ? "Verifikasi" : "Tolak"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
