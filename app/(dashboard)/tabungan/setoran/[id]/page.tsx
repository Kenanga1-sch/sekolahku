"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit2, Save, X, RefreshCw, Send, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { showSuccess, showError } from "@/lib/toast";

interface Siswa {
    id: string;
    nama: string;
    qrCode: string;
}

interface Transaksi {
    id: string;
    siswaId: string;
    tipe: "setor" | "tarik";
    nominal: number;
    status: string;
    catatan: string | null;
    createdAt: string;
    siswa: Siswa | null;
}

interface Setoran {
    id: string;
    guruId: string;
    tipe: "setor_ke_bendahara" | "tarik_dari_bendahara";
    totalNominal: number;
    nominalFisik: number | null;
    selisih: number | null;
    status: "pending" | "verified" | "rejected";
    catatan: string | null;
    createdAt: string;
    guru: { fullName?: string; name?: string } | null;
    bendahara: { fullName?: string; name?: string } | null;
    transaksi: Transaksi[];
}

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

function formatDateTime(date: string | Date): string {
    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(date));
}

export default function SetoranDetailPage() {
    const params = useParams();
    const router = useRouter();
    const setoranId = params.id as string;

    const [setoran, setSetoran] = useState<Setoran | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editNominal, setEditNominal] = useState("");
    const [editCatatan, setEditCatatan] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resubmitCatatan, setResubmitCatatan] = useState("");

    const fetchSetoran = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/tabungan/setoran/${setoranId}`);
            const data = await res.json();
            if (data.success) {
                setSetoran(data.setoran);
            } else {
                showError(data.error || "Gagal memuat data");
            }
        } catch {
            showError("Gagal memuat data setoran");
        } finally {
            setIsLoading(false);
        }
    }, [setoranId]);

    useEffect(() => {
        fetchSetoran();
    }, [fetchSetoran]);

    const handleStartEdit = (tx: Transaksi) => {
        setEditingId(tx.id);
        setEditNominal(tx.nominal.toString());
        setEditCatatan(tx.catatan || "");
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditNominal("");
        setEditCatatan("");
    };

    const handleSaveEdit = async (txId: string) => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/tabungan/setoran/${setoranId}/transaksi/${txId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nominal: parseInt(editNominal, 10),
                    catatan: editCatatan || null
                })
            });
            const data = await res.json();
            if (data.success) {
                showSuccess("Transaksi berhasil diperbarui");
                setEditingId(null);
                fetchSetoran(); // Refresh to get updated totals
            } else {
                showError(data.error || "Gagal memperbarui transaksi");
            }
        } catch {
            showError("Gagal memperbarui transaksi");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResubmit = async () => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/tabungan/setoran/${setoranId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ catatan: resubmitCatatan || null })
            });
            const data = await res.json();
            if (data.success) {
                showSuccess("Setoran berhasil diajukan ulang");
                router.push("/tabungan/setoran");
            } else {
                showError(data.error || "Gagal mengajukan ulang setoran");
            }
        } catch {
            showError("Gagal mengajukan ulang setoran");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="container mx-auto p-6">
                <div className="flex items-center justify-center h-64">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    if (!setoran) {
        return (
            <div className="container mx-auto p-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>Setoran tidak ditemukan</AlertDescription>
                </Alert>
            </div>
        );
    }

    const isRejected = setoran.status === "rejected";
    const isPending = setoran.status === "pending";
    const isVerified = setoran.status === "verified";

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/tabungan/setoran">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Detail Setoran</h1>
                    <p className="text-muted-foreground">
                        {formatDateTime(setoran.createdAt)}
                    </p>
                </div>
                <div className="ml-auto">
                    <Badge 
                        variant={isVerified ? "default" : isRejected ? "destructive" : "secondary"}
                        className={isVerified ? "bg-green-600" : ""}
                    >
                        {isVerified && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {isRejected && <XCircle className="h-3 w-3 mr-1" />}
                        {isPending && <Clock className="h-3 w-3 mr-1" />}
                        {isVerified ? "Diterima" : isRejected ? "Ditolak" : "Menunggu"}
                    </Badge>
                </div>
            </div>

            {/* Rejection Alert */}
            {isRejected && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Setoran Ditolak</AlertTitle>
                    <AlertDescription>
                        <p><strong>Alasan:</strong> {setoran.catatan || "-"}</p>
                        {!!setoran.selisih && (
                            <p><strong>Selisih:</strong> {formatRupiah(setoran.selisih)}</p>
                        )}
                        <p className="mt-2">Anda dapat mengedit transaksi di bawah dan mengajukan ulang.</p>
                    </AlertDescription>
                </Alert>
            )}

            {/* Summary Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Ringkasan</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Tipe</p>
                            <p className="font-medium">
                                {setoran.tipe === "setor_ke_bendahara" ? "Setor ke Bendahara" : "Tarik dari Bendahara"}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Nominal</p>
                            <p className="font-mono font-medium">{formatRupiah(setoran.totalNominal)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Jumlah Transaksi</p>
                            <p className="font-medium">{setoran.transaksi?.length || 0} transaksi</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Guru</p>
                            <p className="font-medium">{setoran.guru?.fullName || setoran.guru?.name || "-"}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Daftar Transaksi</CardTitle>
                    <CardDescription>
                        {isRejected 
                            ? "Klik ikon edit untuk mengubah nominal transaksi yang salah" 
                            : "Transaksi dalam batch ini"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Siswa</TableHead>
                                <TableHead>Tipe</TableHead>
                                <TableHead>Nominal</TableHead>
                                <TableHead>Catatan</TableHead>
                                {isRejected && <TableHead className="w-[100px]">Aksi</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {setoran.transaksi?.map((tx) => (
                                <TableRow key={tx.id}>
                                    <TableCell className="font-medium">
                                        {tx.siswa?.nama || tx.siswaId}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={tx.tipe === "setor" ? "default" : "secondary"}>
                                            {tx.tipe === "setor" ? "Setor" : "Tarik"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {editingId === tx.id ? (
                                            <Input
                                                type="number"
                                                value={editNominal}
                                                onChange={(e) => setEditNominal(e.target.value)}
                                                className="w-32"
                                            />
                                        ) : (
                                            <span className="font-mono">{formatRupiah(tx.nominal)}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingId === tx.id ? (
                                            <Input
                                                value={editCatatan}
                                                onChange={(e) => setEditCatatan(e.target.value)}
                                                placeholder="Catatan..."
                                            />
                                        ) : (
                                            tx.catatan || "-"
                                        )}
                                    </TableCell>
                                    {isRejected && (
                                        <TableCell>
                                            {editingId === tx.id ? (
                                                <div className="flex gap-1">
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost"
                                                        onClick={() => handleSaveEdit(tx.id)}
                                                        disabled={isSubmitting}
                                                    >
                                                        <Save className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost"
                                                        onClick={handleCancelEdit}
                                                        disabled={isSubmitting}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost"
                                                    onClick={() => handleStartEdit(tx)}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
                
                {/* Resubmit Footer */}
                {isRejected && (
                    <CardFooter className="flex-col gap-4 border-t pt-6">
                        <div className="w-full">
                            <label className="text-sm font-medium mb-2 block">
                                Catatan untuk Pengajuan Ulang (Opsional)
                            </label>
                            <Textarea
                                value={resubmitCatatan}
                                onChange={(e) => setResubmitCatatan(e.target.value)}
                                placeholder="Contoh: Sudah diperbaiki, mohon dicek ulang"
                                rows={2}
                            />
                        </div>
                        <Button 
                            onClick={handleResubmit} 
                            disabled={isSubmitting}
                            className="w-full"
                        >
                            <Send className="h-4 w-4 mr-2" />
                            Ajukan Ulang ke Bendahara
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
