"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showError } from "@/lib/toast";
import type { InventoryRoom, InventoryAsset } from "@/types/inventory";
import { goGet } from "@/lib/api-client";

function assetCondition(a: { condition_good: number; condition_light_damaged: number; condition_heavy_damaged: number; condition_lost: number }): "good" | "light_damage" | "heavy_damage" | "lost" {
    if (a.condition_light_damaged > 0) return "light_damage";
    if (a.condition_heavy_damaged > 0) return "heavy_damage";
    if (a.condition_lost > 0) return "lost";
    return "good";
}

export default function RoomDetailPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const roomId = searchParams.get('id');

    const [room, setRoom] = useState<InventoryRoom | null>(null);
    const [assets, setAssets] = useState<InventoryAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
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
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
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
                            {assets.filter(a => assetCondition(a) === 'good').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Perlu Perbaikan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">
                            {assets.filter(a => assetCondition(a) !== 'good').length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="assets">
                <TabsList>
                    <TabsTrigger value="assets">Daftar Aset</TabsTrigger>
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
                        <Button onClick={() => router.push(`/inventaris/aset?room=${roomId ?? ""}`)}>
                            <Plus className="h-4 w-4 mr-2" /> Tambah Aset
                        </Button>
                    </div>

                    <DataTable
                        data={assets.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))}
                        getRowId={(asset) => asset.id}
                        emptyTitle="Tidak ada aset di ruangan ini"
                        emptyDescription="Aset yang ditempatkan di ruangan ini akan muncul di sini."
                        columns={[
                            {
                                key: "code",
                                header: "Kode Aset",
                                card: "hidden",
                                render: (asset) => <span className="font-mono text-xs">{asset.code}</span>,
                            },
                            {
                                key: "name",
                                header: "Nama Aset",
                                card: "title",
                                render: (asset) => <span className="font-medium">{asset.name}</span>,
                            },
                            {
                                key: "category",
                                header: "Kategori",
                                card: "field",
                                render: (asset) => <span className="capitalize">{asset.category.replace('_', ' ')}</span>,
                            },
                            {
                                key: "condition",
                                header: "Kondisi",
                                card: "field",
                                render: (asset) => (
                                    <Badge variant={assetCondition(asset) === 'good' ? 'default' : 'destructive'} className="capitalize">
                                        {assetCondition(asset) === 'good' ? 'Baik' : assetCondition(asset).replace('_', ' ')}
                                    </Badge>
                                ),
                            },
                        ]}
                        actions={(asset) => (
                            <span className="text-xs text-muted-foreground">
                                {asset.quantity} unit {asset.expand?.room ? "" : ""}
                            </span>
                        )}
                    />
                </TabsContent>


            </Tabs>
        </div>
    );
}
