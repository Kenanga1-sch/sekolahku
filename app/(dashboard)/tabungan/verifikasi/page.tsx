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
import type { TabunganSetoran } from "@/db/schema/tabungan"; // Use from schema for now
import type { User } from "@/db/schema/users";

type SetoranWithRelations = TabunganSetoran & {
    guru: User;
};

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
    const [isLoading, setIsLoading] = useState(true);
    const [verifyId, setVerifyId] = useState<string | null>(null);
    const [verifyAction, setVerifyAction] = useState<"approve" | "reject" | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [nominalFisikInput, setNominalFisikInput] = useState("");
    const [catatanInternal, setCatatanInternal] = useState("");

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/tabungan/setoran?status=pending");
            const data = await res.json();
            if (data.items) {
                setSetoranList(data.items);
            }
        } catch (error) {
            console.error("Failed to fetch setoran:", error);
            showError("Gagal memuat data setoran");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleVerify = async () => {
        if (!verifyId || !user || !verifyAction) return;

        const valNominal = parseInt(nominalFisikInput.replace(/\D/g, ""), 10);

        setIsProcessing(true);
        try {
            const status = verifyAction === "approve" ? "verified" : "rejected";
            const res = await fetch(`/api/tabungan/setoran/${verifyId}/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status,
                    bendaharaId: user.id,
                    nominalFisik: verifyAction === "approve" ? valNominal : undefined,
                    catatan: catatanInternal || undefined
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Gagal memproses verifikasi");
            }

            showSuccess(
                verifyAction === "approve"
                    ? "Setoran berhasil diverifikasi"
                    : "Setoran ditolak"
            );
            setVerifyId(null);
            setVerifyAction(null);
            fetchData();
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
            setNominalFisikInput(item.totalNominal.toLocaleString("id-ID"));
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/tabungan">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Verifikasi Setoran</h1>
                        <p className="text-muted-foreground">
                            Verifikasi setoran harian dari guru kelas
                        </p>
                    </div>
                </div>
                <Button variant="outline" onClick={() => { setIsLoading(true); fetchData(); }}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-500 rounded-xl">
                            <Clock className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Menunggu Verifikasi</p>
                            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                                {isLoading ? <Skeleton className="h-8 w-12" /> : setoranList.length}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Waktu</TableHead>
                                <TableHead>Guru / Penyetor</TableHead>
                                <TableHead>Tipe</TableHead>
                                <TableHead className="text-right">Total Nominal</TableHead>
                                <TableHead>Catatan</TableHead>
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
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-32 mx-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : setoranList.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12">
                                        <CheckCircle2 className="h-16 w-16 mx-auto text-green-500/50 mb-4" />
                                        <p className="text-lg font-medium text-muted-foreground">
                                            Semua setoran sudah diverifikasi
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                setoranList.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {formatDateTime(t.createdAt)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{t.guru?.fullName || t.guru?.name || "-"}</div>
                                            <div className="text-xs text-muted-foreground">{t.guru?.email}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    t.tipe === "setor_ke_bendahara"
                                                        ? "border-green-500 text-green-600"
                                                        : "border-red-500 text-red-600"
                                                }
                                            >
                                                {t.tipe === "setor_ke_bendahara" ? (
                                                    <ArrowDownCircle className="h-3 w-3 mr-1" />
                                                ) : (
                                                    <ArrowUpCircle className="h-3 w-3 mr-1" />
                                                )}
                                                {t.tipe === "setor_ke_bendahara" ? "Setor Masuk" : "Tarik Keluar"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold">
                                            {formatRupiah(t.totalNominal)}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                            {t.catatan || "-"}
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
                                                    Terima
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
                                    <span className="font-medium">{selectedSetoran.guru?.fullName || selectedSetoran.guru?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total di Sistem:</span>
                                    <span className="font-bold">{formatRupiah(selectedSetoran.totalNominal)}</span>
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
