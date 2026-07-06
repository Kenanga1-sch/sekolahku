"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Box, 
  MapPin, 
  History,
  Info,
  Package,
  QrCode,
  Trash2,
  Pencil,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess, showError } from "@/lib/toast";
import type { InventoryRoom, InventoryAsset } from "@/types/inventory";
import { goGet } from "@/lib/api-client";

export default function RoomDetailPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const roomId = searchParams.get('id');

    const [room, setRoom] = useState<InventoryRoom | null>(null);
    const [assets, setAssets] = useState<InventoryAsset[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Add Asset State
    const [isAddingAsset, setIsAddingAsset] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (roomId) {
            fetchRoomData();
        }
    }, [roomId]);

    const fetchRoomData = async () => {
        setIsLoading(true);
        try {
            const data: any = await goGet(`/api/inventory/rooms/${roomId}`);
            if (data.error) throw new Error(data.error);
            setRoom(data.room);
            setAssets(data.assets || []);
            setHistory(data.history || []);
        } catch (error) {
            showError("Gagal memuat data ruangan");
            router.push("/inventaris/ruangan");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
    if (!room) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.back()} className="border-slate-200 bg-white shadow-sm hover:bg-slate-50">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{room.name}</h1>
                    <p className="text-muted-foreground">{room.code} • {room.location}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Aset</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{assets.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Kondisi Baik</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {assets.filter(a => a.condition === 'good').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Perlu Perbaikan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">
                            {assets.filter(a => a.condition !== 'good').length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="assets">
                <TabsList>
                    <TabsTrigger value="assets">Daftar Aset</TabsTrigger>
                    <TabsTrigger value="history">Riwayat Perpindahan</TabsTrigger>
                </TabsList>

                <TabsContent value="assets" className="pt-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="relative w-72">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Cari aset..." 
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button onClick={() => router.push(`/inventaris/stok`)}>
                            <Plus className="h-4 w-4 mr-2" /> Tambah Aset
                        </Button>
                    </div>

                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Kode Aset</TableHead>
                                    <TableHead>Nama Aset</TableHead>
                                    <TableHead>Kategori</TableHead>
                                    <TableHead>Kondisi</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {assets.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                            Tidak ada aset di ruangan ini
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    assets.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase())).map((asset) => (
                                        <TableRow key={asset.id}>
                                            <TableCell className="font-mono text-xs">{asset.code}</TableCell>
                                            <TableCell className="font-medium">{asset.name}</TableCell>
                                            <TableCell className="capitalize">{asset.category.replace('_', ' ')}</TableCell>
                                            <TableCell>
                                                <Badge variant={asset.condition === 'good' ? 'default' : 'destructive'} className="capitalize">
                                                    {asset.condition === 'good' ? 'Baik' : (asset.condition || "").replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => router.push(`/inventaris/stok/detail?id=${asset.id}`)}>
                                                    Detail
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                <TabsContent value="history" className="pt-4">
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>Aset</TableHead>
                                    <TableHead>Dari/Ke</TableHead>
                                    <TableHead>Tipe</TableHead>
                                    <TableHead>Keterangan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                            Belum ada riwayat perpindahan
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    history.map((h) => (
                                        <TableRow key={h.id}>
                                            <TableCell className="text-sm">
                                                {new Date(h.createdAt).toLocaleDateString("id-ID")}
                                            </TableCell>
                                            <TableCell className="font-medium">{h.assetName}</TableCell>
                                            <TableCell>
                                                {h.fromRoomId === roomId ? `Ke: ${h.toRoomName}` : `Dari: ${h.fromRoomName}`}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{h.type}</Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{h.notes || "-"}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
