// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
    ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { showSuccess, showError } from "@/lib/toast";
import { useAuthStore } from "@/lib/stores/auth-store";
import { goGet, goPost } from "@/lib/api-client";
import type { TabunganSetoran } from "@/types/tabungan";
import type { User } from "@/types";

type SetoranWithRelations = TabunganSetoran & {
    guru: User;
    totalNominal?: number;
    selisih?: number;
};

// Add import for Tabs
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export default function TabunganVerifikasiPage() {
    const { user } = useAuthStore();
    const [setoranList, setSetoranList] = useState<SetoranWithRelations[]>([]);
    const [historyList, setHistoryList] = useState<SetoranWithRelations[]>([]); // New state for history
    const [isLoading, setIsLoading] = useState(true);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false); // New state for history loading
    const [verifyId, setVerifyId] = useState<string | null>(null);
    const [verifyAction, setVerifyAction] = useState<"approve" | "reject" | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [nominalFisikInput, setNominalFisikInput] = useState("");
    const [catatanInternal, setCatatanInternal] = useState("");

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data: any = await goGet("/api/tabungan/setoran?status=pending");
            setSetoranList(data.items || data.data || []);
        } catch (error) {
            console.error("Failed to fetch setoran:", error);
            showError("Gagal memuat data setoran");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchHistory = useCallback(async () => {
        setIsHistoryLoading(true);
        try {
            const data: any = await goGet("/api/tabungan/setoran"); 
            const items = data.items || data.data || [];
            const history = items.filter((item: any) => item.status !== "pending");
            setHistoryList(history);
        } catch (error) {
            console.error("Failed to fetch history:", error);
            showError("Gagal memuat riwayat verificasi");
        } finally {
            setIsHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        // optionally fetch history on mount or on tab change
        fetchHistory();
    }, [fetchData, fetchHistory]);

    const handleVerify = async () => {
        if (!verifyId || !user || !verifyAction) return;

        const valNominal = parseInt(nominalFisikInput.replace(/\D/g, ""), 10);

        setIsProcessing(true);
        try {
            const status = verifyAction === "approve" ? "verified" : "rejected";
            await goPost("/api/tabungan/setoran/verify", {
                setoranId: verifyId,
                status,
                bendaharaId: user.id,
                nominalFisik: verifyAction === "approve" ? valNominal : undefined,
                catatan: catatanInternal || undefined
            });

            showSuccess(
                verifyAction === "approve"
                    ? "Setoran berhasil diverifikasi"
                    : "Setoran ditolak"
            );
            setVerifyId(null);
            setVerifyAction(null);
            fetchData();
            fetchHistory();
        } catch (error: any) {
            console.error("Verification error:", error);
            showError(error.message || "Gagal memproses verifikasi");
        } finally {
            setIsProcessing(false);
        }
    };

    const openVerifyDialog = (id: string, action: "approve" | "reject") => {
        const item = setoranList.find(s => s.id === id);
        if (item) {
            setNominalFisikInput((item.totalNominal || 0).toLocaleString("id-ID"));
            setCatatanInternal(item.catatan || "");
        }
        setVerifyId(id);
        setVerifyAction(action);
    };

    const selectedSetoran = setoranList.find((t) => t.id === verifyId);

    const handleNominalChange = (value: string) => {
        const numericValue = value.replace(/\D/g, "");
        if (numericValue) {
            setNominalFisikInput(parseInt(numericValue, 10).toLocaleString("id-ID"));
        } else {
            setNominalFisikInput("");
        }
    };

    const diff = selectedSetoran ? (selectedSetoran.totalNominal - parseInt(nominalFisikInput.replace(/\D/g, "") || "0")) : 0;

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Verifikasi Setoran</h1>
                    <p className="text-muted-foreground">
                        Kelola setoran tabungan dari para guru
                    </p>
                </div>
                <Button variant="outline" onClick={() => { fetchData(); fetchHistory(); }} disabled={isLoading || isHistoryLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading || isHistoryLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            <Tabs defaultValue="pending" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="pending" className="relative">
                        Perlu Verifikasi
                        {setoranList.length > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                                {setoranList.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="history">Riwayat Verifikasi</TabsTrigger>
                </TabsList>

                <TabsContent value="pending">
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Guru</TableHead>
                                        <TableHead>Total Sistem</TableHead>
                                        <TableHead>Catatan</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : setoranList.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <CheckCircle2 className="h-8 w-8 text-green-500/50" />
                                                    <p>Semua setoran telah diverifikasi</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        setoranList.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">
                                                    {formatDateTime(item.createdAt)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{item.guru?.fullName || item.guru?.name}</span>
                                                        <span className="text-xs text-muted-foreground">Guru Wali</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-mono font-medium">
                                                        {formatRupiah(item.totalNominal)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[200px]">
                                                    <p className="truncate text-sm text-muted-foreground">
                                                        {item.catatan || "-"}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="outline" size="sm" asChild>
                                                            <Link href={`/tabungan/setoran/detail?id=${item.id}`}>
                                                                Detail
                                                            </Link>
                                                        </Button>
                                                        <Button 
                                                            variant="default" 
                                                            size="sm"
                                                            className="bg-green-600 hover:bg-green-700"
                                                            onClick={() => {
                                                                setVerifyId(item.id);
                                                                setVerifyAction("approve");
                                                                setNominalFisikInput(item.totalNominal.toString());
                                                            }}
                                                        >
                                                            Terima
                                                        </Button>
                                                        <Button 
                                                            variant="destructive" 
                                                            size="sm"
                                                            onClick={() => {
                                                                setVerifyId(item.id);
                                                                setVerifyAction("reject");
                                                                setCatatanInternal("");
                                                            }}
                                                        >
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
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Guru</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Selisih</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isHistoryLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : historyList.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                                Belum ada riwayat verifikasi
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        historyList.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">
                                                    {formatDateTime(item.createdAt)}
                                                </TableCell>
                                                <TableCell>
                                                    {item.guru?.fullName || item.guru?.name}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge 
                                                        variant={item.status === "verified" ? "default" : "destructive"}
                                                        className={item.status === "verified" ? "bg-green-600" : ""}
                                                    >
                                                        {item.status === "verified" ? "Diterima" : "Ditolak"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-mono">
                                                    {formatRupiah(item.totalNominal)}
                                                </TableCell>
                                                <TableCell className="font-mono">
                                                    {item.selisih && item.selisih !== 0 ? (
                                                        <span className="text-red-500">{formatRupiah(item.selisih)}</span>
                                                    ) : "-"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" asChild>
                                                        <Link href={`/tabungan/setoran/detail?id=${item.id}`}>
                                                            Detail
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <AlertDialog open={!!verifyId} onOpenChange={(open) => { if (!open) { setVerifyId(null); setVerifyAction(null); } }}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {verifyAction === "approve" ? "Verifikasi & Terima Uang" : "Tolak Setoran?"}
                        </AlertDialogTitle>
                        <div className="text-sm text-muted-foreground mt-2">
                            {verifyAction === "approve"
                                ? "Pastikan jumlah uang fisik yang diterima sudah sesuai dengan catatan sistem."
                                : "Setoran akan ditolak. Guru penyetor harus melakukan penyesuaian data."}
                        </div>
                    </AlertDialogHeader>

                    {selectedSetoran && (
                        <div className="space-y-4 py-4">
                            <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Penyetor:</span>
                                    <span className="font-medium">{selectedSetoran?.guru?.fullName || selectedSetoran?.guru?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total di Sistem:</span>
                                    <span className="font-bold">{formatRupiah(selectedSetoran?.totalNominal || 0)}</span>
                                </div>
                            </div>

                            {verifyAction === "approve" && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Uang Fisik Diterima</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                                            <input
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-9 py-2 text-lg font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                value={nominalFisikInput}
                                                onChange={(e) => handleNominalChange(e.target.value)}
                                                placeholder="0"
                                            />
                                        </div>
                                        {diff !== 0 && (
                                            <div className={`text-xs font-medium px-2 py-1 rounded ${diff > 0 ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                                                {diff > 0 ? `Kurang: ${formatRupiah(diff)}` : `Lebih: ${formatRupiah(Math.abs(diff))}`}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Catatan (jika ada selisih)</label>
                                        <textarea
                                            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            value={catatanInternal}
                                            onChange={(e) => setCatatanInternal(e.target.value)}
                                            placeholder="Contoh: Kurang Rp 10.000 karena salah input data..."
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <Button
                            onClick={handleVerify}
                            disabled={isProcessing || (verifyAction === "approve" && !nominalFisikInput)}
                            className={
                                verifyAction === "approve"
                                    ? "bg-green-600 hover:bg-green-700"
                                    : "bg-red-600 hover:bg-red-700"
                            }
                        >
                            {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {verifyAction === "approve" ? "Konfirmasi & Terima" : "Ya, Tolak"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

