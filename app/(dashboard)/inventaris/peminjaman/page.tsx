"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Package, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { getBorrowRequests, reviewBorrowRequest, type BorrowRequest } from "@/lib/inventory";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

export default function PeminjamanPage() {
    const { user } = useAuthStore();
    const [items, setItems] = useState<BorrowRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const isAdmin = ["admin", "superadmin"].includes(user?.role || "");

    const load = async () => {
        setLoading(true);
        try {
            const data = await getBorrowRequests(isAdmin ? undefined : "pending");
            setItems(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [isAdmin]);

    const handleReview = async (id: string, action: "approve" | "reject") => {
        setProcessingId(id);
        try {
            await reviewBorrowRequest(id, action);
            toast.success(action === "approve" ? "Pengajuan disetujui" : "Pengajuan ditolak");
            load();
        } catch (err: any) {
            toast.error(err?.message || "Gagal memproses pengajuan");
        } finally {
            setProcessingId(null);
        }
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case "approved": return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Disetujui</Badge>;
            case "rejected": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Ditolak</Badge>;
            default: return <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700"><Clock className="h-3 w-3 mr-1" />Menunggu</Badge>;
        }
    };

    const formatDate = (ts?: number | null) => ts ? new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/inventaris">
                    <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200 bg-white shadow-sm hover:bg-slate-50" aria-label="Kembali"><ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Pengajuan Peminjaman Aset</h1>
                    <p className="text-muted-foreground">
                        {isAdmin ? "Tinjau dan setujui pengajuan peminjaman dari guru/penanggung jawab ruangan lain" : "Pantau status pengajuan peminjaman Anda"}
                    </p>
                </div>
            </div>

            <DataTable
                data={loading ? [] : items}
                getRowId={(item) => item.id}
                loading={loading}
                emptyTitle="Belum ada pengajuan"
                emptyDescription="Pengajuan peminjaman aset akan muncul di sini."
                columns={[
                    {
                        key: "assetName",
                        header: "Aset",
                        card: "title",
                        render: (item) => (
                            <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{item.assetName}</span>
                            </div>
                        ),
                    },
                    {
                        key: "roomName",
                        header: "Ruangan Pemilik",
                        card: "field",
                        render: (item) => item.roomName,
                    },
                    {
                        key: "requesterName",
                        header: "Pemohon",
                        card: "field",
                        render: (item) => (
                            <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{item.requesterName}</span>
                            </div>
                        ),
                    },
                    {
                        key: "quantity",
                        header: "Jumlah",
                        card: "hidden",
                        render: (item) => item.quantity,
                    },
                    {
                        key: "reason",
                        header: "Alasan",
                        card: "field",
                        render: (item) => (
                            <span className="max-w-[200px] truncate text-sm text-muted-foreground block" title={item.reason || ""}>{item.reason || "-"}</span>
                        ),
                    },
                    {
                        key: "createdAt",
                        header: "Tanggal",
                        card: "field",
                        render: (item) => (
                            <span className="text-sm text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDate(item.createdAt)}
                            </span>
                        ),
                    },
                    {
                        key: "status",
                        header: "Status",
                        card: "field",
                        render: (item) => statusBadge(item.status),
                    },
                ]}
                actions={
                    isAdmin
                        ? (item) =>
                              item.status === "pending" ? (
                                  <div className="flex gap-2">
                                      <Button size="sm" variant="default" className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700" disabled={processingId === item.id} onClick={() => handleReview(item.id, "approve")}>
                                          {processingId === item.id ? "..." : "Setuju"}
                                      </Button>
                                      <Button size="sm" variant="destructive" className="h-7 px-3 text-xs" disabled={processingId === item.id} onClick={() => handleReview(item.id, "reject")}>
                                          {processingId === item.id ? "..." : "Tolak"}
                                      </Button>
                                  </div>
                              ) : (
                                  <span className="text-xs text-muted-foreground italic">Sudah diproses</span>
                              )
                        : undefined
                }
            />
        </div>
    );
}
