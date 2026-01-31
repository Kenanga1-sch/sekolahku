"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { verifySetoran, rejectSetoran } from "@/actions/savings-admin";
import { showSuccess, showError } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";

interface VerificationQueueProps {
  pendingSetoran: any[];
  currentUserId: string; // The Treasurer ID (current user)
}

export function VerificationQueue({ pendingSetoran, currentUserId }: VerificationQueueProps) {
    if (pendingSetoran.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-card text-muted-foreground min-h-[200px]">
                <CheckCircle2 className="w-10 h-10 mb-2 text-green-500 opacity-50" />
                <p>Tidak ada setoran yang menunggu verifikasi.</p>
            </div>
        );
    }

    return (
        <Card className="relative overflow-hidden border-muted/40 dark:bg-zinc-900/50 backdrop-blur-sm group hover:border-primary/20 transition-all duration-300">
           <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
           
           <CardContent className="p-6">
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                    Antrian Verifikasi Setoran
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-200">{pendingSetoran.length}</Badge>
                </h3>
                <div className="rounded-md border bg-background/50">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Guru/PJ</TableHead>
                                <TableHead>Tipe</TableHead>
                                <TableHead className="text-right">Total Nominal</TableHead>
                                <TableHead>Catatan</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingSetoran.map((item) => (
                                <QueueItem key={item.id} item={item} currentUserId={currentUserId} />
                            ))}
                        </TableBody>
                    </Table>
                </div>
           </CardContent>
        </Card>
    );
}

function QueueItem({ item, currentUserId }: { item: any, currentUserId: string }) {
    const [loading, setLoading] = useState(false);

    const handleVerify = async () => {
        if (!item.id) return;
        if (!confirm("Pastikan anda telah menerima uang fisik/transfer sesuai nominal. Lanjutkan verifikasi?")) return;
        
        setLoading(true);
        try {
            const res = await verifySetoran(item.id, currentUserId);
            if (res.success) showSuccess(res.message || "Verifikasi berhasil");
            else showError(res.error || "Gagal verifikasi");
        } catch (error) {
            showError("Error sistem");
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!item.id) return;
        const reason = prompt("Masukan alasan penolakan (opsional):");
        if (reason === null) return; // Cancelled

        setLoading(true);
        try {
            const res = await rejectSetoran(item.id, reason);
            if (res.success) showSuccess(res.message || "Penolakan berhasil");
            else showError(res.error || "Gagal menolak");
        } catch (error) {
            showError("Error sistem");
        } finally {
            setLoading(false);
        }
    };

    return (
        <TableRow>
            <TableCell>
                {new Date(item.createdAt).toLocaleDateString("id-ID", {
                     day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                })}
            </TableCell>
            <TableCell>{item.guru?.name || "Unknown"}</TableCell>
            <TableCell>
                <div className="flex items-center gap-1">
                    {item.tipe === "setor_ke_bendahara" ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Setor</Badge>
                    ) : (
                         <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-none">Tarik</Badge>
                    )}
                    {item.tipe === "setor_ke_bendahara" && <ArrowRight className="w-3 h-3" />}
                </div>
            </TableCell>
            <TableCell className="text-right font-medium">
                {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(item.totalNominal)}
            </TableCell>
            <TableCell className="max-w-[200px] truncate text-muted-foreground">{item.catatan || "-"}</TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={handleReject}
                        disabled={loading}
                    >
                        <XCircle className="w-4 h-4 mr-1" /> Tolak
                    </Button>
                    <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleVerify}
                        disabled={loading}
                    >
                        {loading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Verifikasi
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}
