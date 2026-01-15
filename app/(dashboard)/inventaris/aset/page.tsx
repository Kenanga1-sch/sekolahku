"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Package,
    Plus,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    getAssets,
    createAsset,
    updateAsset,
    deleteAsset,
    getAllRooms,
} from "@/lib/inventory";
import type { InventoryAsset, InventoryRoom } from "@/types/inventory";

const CATEGORIES = [
    "Elektronik",
    "Furniture",
    "Alat Tulis",
    "Buku",
    "Kendaraan",
    "Lainnya",
];

export default function AsetPage() {
    const [assets, setAssets] = useState<InventoryAsset[]>([]);
    const [rooms, setRooms] = useState<InventoryRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<InventoryAsset | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        code: "",
        category: "Lainnya",
        purchase_date: "",
        price: "",
        quantity: "1",
        room: "",
        notes: "",
        // Breakdown
        condition_good: "1",
        condition_light_damaged: "0",
        condition_heavy_damaged: "0",
        condition_lost: "0",
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Load Rooms for filter/form
            const allRooms = await getAllRooms();
            setRooms(allRooms);

            let filter = "";
            if (searchQuery) {
                filter = `name ~ "${searchQuery}" || code ~ "${searchQuery}"`;
            }
            if (categoryFilter !== "all") {
                filter = filter
                    ? `(${filter}) && category = "${categoryFilter}"`
                    : `category = "${categoryFilter}"`;
            }

            const result = await getAssets(page, 20, filter);
            setAssets(result.items);
            setTotalItems(result.totalItems);
            setTotalPages(result.totalPages);
        } catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setLoading(false);
        }
    }, [page, searchQuery, categoryFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Auto-calculate total quantity when breakdown changes
    useEffect(() => {
        const total =
            (parseInt(formData.condition_good) || 0) +
            (parseInt(formData.condition_light_damaged) || 0) +
            (parseInt(formData.condition_heavy_damaged) || 0) +
            (parseInt(formData.condition_lost) || 0);

        setFormData(prev => ({ ...prev, quantity: total.toString() }));
    }, [
        formData.condition_good,
        formData.condition_light_damaged,
        formData.condition_heavy_damaged,
        formData.condition_lost
    ]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = {
                name: formData.name,
                code: formData.code,
                category: formData.category,
                purchase_date: formData.purchase_date || undefined,
                price: parseInt(formData.price) || 0,
                quantity: parseInt(formData.quantity) || 0,
                room: formData.room,
                notes: formData.notes,
                condition_good: parseInt(formData.condition_good) || 0,
                condition_light_damaged: parseInt(formData.condition_light_damaged) || 0,
                condition_heavy_damaged: parseInt(formData.condition_heavy_damaged) || 0,
                condition_lost: parseInt(formData.condition_lost) || 0,
            };

            if (editingAsset) {
                await updateAsset(editingAsset.id, data);
            } else {
                await createAsset(data);
            }

            setIsAddDialogOpen(false);
            setEditingAsset(null);
            resetForm();
            loadData();
        } catch (error) {
            console.error("Failed to save asset:", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Yakin ingin menghapus aset ini?")) {
            await deleteAsset(id);
            loadData();
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            code: "",
            category: "Lainnya",
            purchase_date: "",
            price: "",
            quantity: "1",
            room: "",
            notes: "",
            condition_good: "1",
            condition_light_damaged: "0",
            condition_heavy_damaged: "0",
            condition_lost: "0",
        });
    };

    const openEditDialog = (asset: InventoryAsset) => {
        setEditingAsset(asset);
        setFormData({
            name: asset.name,
            code: asset.code,
            category: asset.category,
            purchase_date: asset.purchase_date ? asset.purchase_date.split('T')[0] : "",
            price: asset.price.toString(),
            quantity: asset.quantity.toString(),
            room: asset.room,
            notes: asset.notes || "",
            condition_good: asset.condition_good.toString(),
            condition_light_damaged: asset.condition_light_damaged.toString(),
            condition_heavy_damaged: asset.condition_heavy_damaged.toString(),
            condition_lost: asset.condition_lost.toString(),
        });
        setIsAddDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Data Aset</h1>
                    <p className="text-muted-foreground">
                        Kelola daftar aset, kondisi, dan lokasi
                    </p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                    setIsAddDialogOpen(open);
                    if (!open) {
                        setEditingAsset(null);
                        resetForm();
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Tambah Aset
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <form onSubmit={handleSubmit}>
                            <DialogHeader>
                                <DialogTitle>
                                    {editingAsset ? "Edit Aset" : "Tambah Aset Baru"}
                                </DialogTitle>
                                <DialogDescription>
                                    Isi detail informasi aset
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Nama Aset *</Label>
                                        <Input
                                            id="name"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="code">Kode Inventaris *</Label>
                                        <Input
                                            id="code"
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                            required
                                            placeholder="INV/2026/001"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="category">Kategori</Label>
                                        <Select
                                            value={formData.category}
                                            onValueChange={(value) => setFormData({ ...formData, category: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CATEGORIES.map((cat) => (
                                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="room">Lokasi Ruangan *</Label>
                                        <Select
                                            value={formData.room}
                                            onValueChange={(value) => setFormData({ ...formData, room: value })}
                                            required
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih Ruangan" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {rooms.map((room) => (
                                                    <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="purchase_date">Tanggal Beli</Label>
                                        <Input
                                            id="purchase_date"
                                            type="date"
                                            value={formData.purchase_date}
                                            onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="price">Harga Satuan</Label>
                                        <Input
                                            id="price"
                                            type="number"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="border rounded-md p-4 bg-muted/50">
                                    <Label className="mb-2 block font-semibold">Kondisi & Jumlah</Label>
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="good" className="text-xs text-green-600">Baik</Label>
                                            <Input
                                                id="good"
                                                type="number"
                                                min="0"
                                                value={formData.condition_good}
                                                onChange={(e) => setFormData({ ...formData, condition_good: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="light" className="text-xs text-yellow-600">Rusak Ringan</Label>
                                            <Input
                                                id="light"
                                                type="number"
                                                min="0"
                                                value={formData.condition_light_damaged}
                                                onChange={(e) => setFormData({ ...formData, condition_light_damaged: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="heavy" className="text-xs text-red-600">Rusak Berat</Label>
                                            <Input
                                                id="heavy"
                                                type="number"
                                                min="0"
                                                value={formData.condition_heavy_damaged}
                                                onChange={(e) => setFormData({ ...formData, condition_heavy_damaged: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="lost" className="text-xs text-gray-500">Hilang</Label>
                                            <Input
                                                id="lost"
                                                type="number"
                                                min="0"
                                                value={formData.condition_lost}
                                                onChange={(e) => setFormData({ ...formData, condition_lost: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-2 text-right text-sm text-muted-foreground">
                                        Total: <strong>{formData.quantity}</strong> unit
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="notes">Catatan</Label>
                                    <Textarea
                                        id="notes"
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows={2}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit">
                                    {editingAsset ? "Simpan Perubahan" : "Tambah Aset"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nama aset atau kode..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Kategori" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Kategori</SelectItem>
                                {CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama Aset</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Lokasi</TableHead>
                                <TableHead>Jumlah</TableHead>
                                <TableHead>Kondisi</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        Memuat...
                                    </TableCell>
                                </TableRow>
                            ) : assets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Belum ada aset. Klik "Tambah Aset" untuk menambahkan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                assets.map((asset) => (
                                    <TableRow key={asset.id}>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{asset.name}</p>
                                                <p className="text-xs text-muted-foreground">{asset.code}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>{asset.category}</TableCell>
                                        <TableCell>{asset.expand?.room?.name || "-"}</TableCell>
                                        <TableCell>{asset.quantity} Unit</TableCell>
                                        <TableCell>
                                            <div className="flex gap-2 text-xs">
                                                {asset.condition_good > 0 && <span className="text-green-600 bg-green-100 px-2 py-0.5 rounded">{asset.condition_good} B</span>}
                                                {asset.condition_light_damaged > 0 && <span className="text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">{asset.condition_light_damaged} RR</span>}
                                                {asset.condition_heavy_damaged > 0 && <span className="text-red-600 bg-red-100 px-2 py-0.5 rounded">{asset.condition_heavy_damaged} RB</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openEditDialog(asset)}>
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={() => handleDelete(asset.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Hapus
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Paginasi sederhana jika needed */}
        </div>
    );
}
