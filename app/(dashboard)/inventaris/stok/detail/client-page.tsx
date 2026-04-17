"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ArrowLeft, 
  History,
  QrCode,
  Trash2,
  Pencil,
  Loader2,
  Package,
  Calendar,
  User,
  Tool,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showSuccess, showError } from "@/lib/toast";
import type { InventoryAsset } from "@/types/inventory";
import { QRCodeSVG } from "qrcode.react";
import { goGet, goDelete } from "@/lib/api-client";

export default function AssetDetailPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const assetId = searchParams.get('id');

    const [asset, setAsset] = useState<InventoryAsset | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (assetId) {
            fetchAssetData();
        }
    }, [assetId]);

    const fetchAssetData = async () => {
        setIsLoading(true);
        try {
            const data: any = await goGet(`/api/inventory/assets/${assetId}`);
            if (data.error) throw new Error(data.error);
            setAsset(data.asset);
            setHistory(data.history || []);
        } catch (error) {
            showError("Gagal memuat data aset");
            router.push("/inventaris/stok");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Hapus aset ini secara permanen?")) return;
        try {
            const res: any = await goDelete(`/api/inventory/assets/${assetId}`);
            if (!res.error) {
                showSuccess("Aset berhasil dihapus");
                router.push("/inventaris/stok");
            } else {
                throw new Error(res.error);
            }
        } catch (e) { showError("Gagal menghapus aset"); }
    };

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
    if (!asset) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">{asset.name}</h1>
                        <p className="font-mono text-sm text-muted-foreground">{asset.code}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.push(`/inventaris/stok/detail?id=${asset.id}/edit`)}>
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                    </Button>
                    <Button variant="destructive" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4 mr-2" /> Hapus
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Informasi Aset</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Kategori</p>
                                <p className="font-semibold capitalize">{asset.category.replace('_', ' ')}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Kondisi Saat Ini</p>
                                <Badge variant={asset.condition === 'good' ? 'default' : 'destructive'} className="capitalize">
                                    {asset.condition === 'good' ? 'Baik' : asset.condition.replace('_', ' ')}
                                </Badge>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Ruangan</p>
                                <p className="font-semibold">{asset.roomName || "Bursa / Gudang Utama"}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Tanggal Pengadaan</p>
                                <p className="font-semibold">{new Date(asset.receivedAt).toLocaleDateString("id-ID")}</p>
                            </div>
                            <div className="col-span-full space-y-1">
                                <p className="text-sm text-muted-foreground">Spesifikasi / Keterangan</p>
                                <p className="text-sm">{asset.specifications || "-"}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Riwayat Perpindahan & Perawatan</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Tipe</TableHead>
                                        <TableHead>Keterangan</TableHead>
                                        <TableHead>Oleh</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                                                Belum ada riwayat
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        history.map((h) => (
                                            <TableRow key={h.id}>
                                                <TableCell className="text-sm">
                                                    {new Date(h.createdAt).toLocaleDateString("id-ID")}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{h.type}</Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">{h.notes || "-"}</TableCell>
                                                <TableCell className="text-sm">{h.performedBy || "Sistem"}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-center">QR Code Aset</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-4">
                            <div className="p-4 bg-white rounded-xl shadow-inner border">
                                <QRCodeSVG value={asset.code} size={200} level="H" />
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                Tempelkan kode ini pada fisik aset untuk memudahkan inventarisasi digital.
                            </p>
                            <Button variant="outline" className="w-full" onClick={() => window.print()}>
                                <Printer className="h-4 w-4 mr-2" /> Cetak Label
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

const Printer = ({ className }: { className?: string }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
    </svg>
);
