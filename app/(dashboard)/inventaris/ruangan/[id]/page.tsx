"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { 
    ArrowLeft, 
    Package, 
    Plus, 
    Search, 
    MoreHorizontal, 
    Pencil, 
    Trash2, 
    ShieldCheck, 
    Lock,
    UserCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getRoom, getAssets, createAsset, updateAsset, deleteAsset } from "@/lib/inventory";
import type { InventoryRoom, InventoryAsset } from "@/types/inventory";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { user } = useAuthStore();
    
    // Unwrap params
    const resolvedParams = use(params);
    const roomId = resolvedParams.id;

    const [room, setRoom] = useState<InventoryRoom | null>(null);
    const [assets, setAssets] = useState<InventoryAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    
    // Permission Logic
    const isAdmin = ["admin", "superadmin"].includes(user?.role || "");
    const isOwner = room?.expand?.pic?.id === user?.id; // Assuming expand.pic contains fully expanded user object or just check picId if available in base
    // Note: getRoom implementation maps data.pic (fetch response) to expand.pic. 
    // Drizzle response likely returns `picId` in the root object too.
    // Let's rely on `room.picId` if available or `room.expand.pic.id`. Note that my API returns flat object + relation.
    // Ideally I should update type to include picId. Let's assume generic loose typing or check implementation.
    const isSpecificOwner = room && (room as any).picId === user?.id;
    
    const canManage = isAdmin || isSpecificOwner;

    // Asset Form State
    const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<InventoryAsset | null>(null);
    const [assetForm, setAssetForm] = useState({
        name: "",
        quantity: 1,
        price: 0,
        category: "OTHER",
        conditionGood: 1,
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const roomData = await getRoom(roomId);
            if (!roomData) {
                // Room not found
                return;
            }
            setRoom(roomData);

            const assetsData = await getAssets(1, 100, `room = "${roomId}"`);
            setAssets(assetsData.items);
        } catch (error) {
            console.error("Failed to load room details:", error);
        } finally {
            setLoading(false);
        }
    }, [roomId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSaveAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...assetForm,
                room: roomId, // For create
                roomId,      // For backend compatibility if needed
            };

            if (editingAsset) {
                await updateAsset(editingAsset.id, payload);
            } else {
                await createAsset(payload);
            }
            setIsAssetDialogOpen(false);
            setEditingAsset(null);
            resetAssetForm();
            loadData();
        } catch (error) {
            console.error("Failed to save asset:", error);
            alert("Gagal menyimpan aset. Pastikan Anda memiliki akses.");
        }
    };

    const handleDeleteAsset = async (id: string) => {
        if (!confirm("Hapus aset ini permanen?")) return;
        try {
            await deleteAsset(id);
            loadData();
        } catch (error) {
            console.error("Failed to delete asset:", error);
            alert("Gagal menghapus aset.");
        }
    };

    const resetAssetForm = () => {
        setAssetForm({
            name: "",
            quantity: 1,
            price: 0,
            category: "OTHER",
            conditionGood: 1,
        });
    };

    const openEditAsset = (asset: InventoryAsset) => {
        setEditingAsset(asset);
        setAssetForm({
            name: asset.name,
            quantity: asset.quantity,
            price: asset.price,
            category: asset.category,
            conditionGood: asset.condition_good || asset.quantity,
        });
        setIsAssetDialogOpen(true);
    };

    if (loading && !room) {
        return <div className="p-8 text-center">Memuat data ruangan...</div>;
    }

    if (!room) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <h2 className="text-xl font-bold">Ruangan Tidak Ditemukan</h2>
                <Link href="/inventaris/ruangan">
                    <Button>Kembali ke Daftar Ruangan</Button>
                </Link>
            </div>
        );
    }

    const filteredAssets = assets.filter(a => 
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header / Breadcrumb */}
            <div className="flex items-center gap-4">
                <Link href="/inventaris/ruangan">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{room.name}</h1>
                        <Badge variant="outline" className="text-xs">{room.code}</Badge>
                    </div>
                    <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
                        <UserCircle className="h-4 w-4" />
                        PJ: {room.expand?.pic?.name || "Belum ada PIC"}
                    </p>
                </div>
                
                <div className="ml-auto">
                    {canManage ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200">
                             <ShieldCheck className="h-4 w-4" />
                             {isSpecificOwner ? "Anda Pengelola (PIC)" : "Akses Admin"}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold border border-gray-200">
                            <Lock className="h-4 w-4" />
                            Read Only
                        </div>
                    )}
                </div>
            </div>

            {/* Stats / Info */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Aset</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{assets.length} Item</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Nilai</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(assets.reduce((sum, a) => sum + ((a.price || 0) * (a.quantity || 1)), 0))}
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Lokasi</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-medium">
                            {(room as any).location || room.description || "-"}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Asset Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Daftar Barang</CardTitle>
                        <CardDescription>Aset yang tercatat di ruangan ini</CardDescription>
                    </div>
                    {canManage && (
                        <Button onClick={() => { resetAssetForm(); setEditingAsset(null); setIsAssetDialogOpen(true); }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Tambah Barang
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="relative max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Cari barang..." 
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama Barang</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Jumlah</TableHead>
                                <TableHead>Kondisi (Baik)</TableHead>
                                <TableHead>Harga Satuan</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAssets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Tidak ada data aset.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredAssets.map((asset) => (
                                    <TableRow key={asset.id}>
                                        <TableCell className="font-medium">{asset.name}</TableCell>
                                        <TableCell><Badge variant="outline">{asset.category}</Badge></TableCell>
                                        <TableCell>{asset.quantity}</TableCell>
                                        <TableCell className="text-green-600 font-medium">
                                            {asset.condition_good || asset.quantity}
                                        </TableCell>
                                        <TableCell>{formatCurrency(asset.price || 0)}</TableCell>
                                        <TableCell>
                                            {canManage && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => openEditAsset(asset)}>
                                                            <Pencil className="h-4 w-4 mr-2" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteAsset(asset.id)}>
                                                            <Trash2 className="h-4 w-4 mr-2" /> Hapus
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            
            {/* Create/Edit Helper Dialog */}
            <Dialog open={isAssetDialogOpen} onOpenChange={setIsAssetDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingAsset ? "Edit Barang" : "Tambah Barang Baru"}</DialogTitle>
                        <DialogDescription>
                            Pastikan data inventaris akurat.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveAsset}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Nama Barang</Label>
                                <Input 
                                    value={assetForm.name} 
                                    onChange={e => setAssetForm({...assetForm, name: e.target.value})}
                                    required 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Jumlah Total</Label>
                                    <Input 
                                        type="number" 
                                        min="1"
                                        value={assetForm.quantity} 
                                        onChange={e => setAssetForm({...assetForm, quantity: parseInt(e.target.value) || 0})}
                                        required 
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Kondisi Baik</Label>
                                    <Input 
                                        type="number" 
                                        min="0"
                                        value={assetForm.conditionGood} 
                                        onChange={e => setAssetForm({...assetForm, conditionGood: parseInt(e.target.value) || 0})}
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Kategori</Label>
                                <Select 
                                    value={assetForm.category} 
                                    onValueChange={v => setAssetForm({...assetForm, category: v})}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ELECTRONIC">Elektronik</SelectItem>
                                        <SelectItem value="FURNITURE">Mebel</SelectItem>
                                        <SelectItem value="BOOK">Buku</SelectItem>
                                        <SelectItem value="OTHER">Lainnya</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Harga Satuan (Rp)</Label>
                                <Input 
                                    type="number" 
                                    min="0"
                                    value={assetForm.price} 
                                    onChange={e => setAssetForm({...assetForm, price: parseInt(e.target.value) || 0})}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAssetDialogOpen(false)}>Batal</Button>
                            <Button type="submit">Simpan</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
