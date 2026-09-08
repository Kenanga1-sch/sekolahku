"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { verifySetoran, rejectSetoran } from "@/actions/savings-admin";
import { showSuccess, showError } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";

interface VerificationQueueProps {
  pendingSetoran: any[];
  currentUserId: string; // The Treasurer ID (current user)
  onChanged?: () => void | Promise<void>;
}

function QueueActions({ item, currentUserId, onChanged }: { item: any, currentUserId: string, onChanged?: () => void | Promise<void> }) {
    const [loading, setLoading] = useState(false);

    const handleVerify = async () => {
        if (!item.id) return;
        if (!confirm("Pastikan anda telah menerima uang fisik/transfer sesuai nominal. Lanjutkan verifikasi?")) return;
        
        setLoading(true);
        try {
            const res = await verifySetoran(item.id, currentUserId);
            if (res.success) {
                showSuccess(res.message || "Verifikasi berhasil");
                await onChanged?.();
            } else {
                showError(res.error || "Gagal verifikasi");
            }
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
            const res = await rejectSetoran(item.id, currentUserId, reason);
            if (res.success) {
                showSuccess(res.message || "Penolakan berhasil");
                await onChanged?.();
            } else {
                showError(res.error || "Gagal menolak");
            }
        } catch (error) {
            showError("Error sistem");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex justify-end gap-2">
            <Button 
                size="sm" 
                variant="outline" 
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleReject}
                disabled={loading || !currentUserId}
            >
                <XCircle className="w-4 h-4 mr-1" /> Tolak
            </Button>
            <Button 
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleVerify}
                disabled={loading || !currentUserId}
            >
                {loading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                <CheckCircle2 className="w-4 h-4 mr-1" /> Verifikasi
            </Button>
        </div>
    );
}

export function VerificationQueue({ pendingSetoran = [], currentUserId, onChanged }: VerificationQueueProps) {
    return (
        <Card className="relative overflow-hidden border-muted/40 dark:bg-zinc-900/50 backdrop-blur-sm group hover:border-primary/20 transition-all duration-300">
           <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
           
           <CardContent className="p-6">
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                    Antrian Verifikasi Setoran
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-200">{pendingSetoran.length}</Badge>
                </h3>
                <DataTable
                    data={pendingSetoran}
                    getRowId={(item) => item.id}
                    emptyTitle="Tidak ada setoran yang menunggu verifikasi"
                    emptyDescription="Antrian verifikasi akan muncul di sini."
                    columns={[
                        {
                            key: "createdAt",
                            header: "Tanggal",
                            card: "field",
                            render: (item) => new Date(item.createdAt).toLocaleDateString("id-ID", {
                                 day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                            }),
                        },
                        {
                            key: "guru.name",
                            header: "Guru/PJ",
                            card: "title",
                            render: (item) => item.guru?.name || "Unknown",
                        },
                        {
                            key: "tipe",
                            header: "Tipe",
                            card: "field",
                            render: (item) => (
                                <div className="flex items-center gap-1">
                                    {item.tipe === "setor_ke_bendahara" ? (
                                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Setor</Badge>
                                    ) : (
                                         <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-none">Tarik</Badge>
                                    )}
                                    {item.tipe === "setor_ke_bendahara" && <ArrowRight className="w-3 h-3" />}
                                </div>
                            ),
                        },
                        {
                            key: "totalNominal",
                            header: "Total Nominal",
                            card: "field",
                            render: (item) => (
                                <span className="font-medium">
                                    {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(item.totalNominal)}
                                </span>
                            ),
                        },
                        {
                            key: "catatan",
                            header: "Catatan",
                            card: "field",
                            render: (item) => (
                                <span className="max-w-[200px] truncate text-muted-foreground">{item.catatan || "-"}</span>
                            ),
                        },
                    ]}
                    actions={(item) => (
                        <QueueActions item={item} currentUserId={currentUserId} onChanged={onChanged} />
                    )}
                />
           </CardContent>
        </Card>
    );
}
