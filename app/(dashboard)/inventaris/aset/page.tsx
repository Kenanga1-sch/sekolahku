"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Plus,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    Filter,
    ArrowLeft,
    HandHeart,
    Printer,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, TablePagination } from "@/components/data-table";
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
    createBorrowRequest,
} from "@/lib/inventory";
import type { InventoryAsset, InventoryRoom } from "@/types/inventory";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";
import { uploadPhoto } from "@/lib/inventory";

const CATEGORIES = [
    "Elektronik",
    "Furniture",
    "Alat Tulis",
    "Buku",
    "Kendaraan",
    "Lainnya",
];

export default function AsetPage() {
    const { user } = useAuthStore();
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
    const [borrowTarget, setBorrowTarget] = useState<InventoryAsset | null>(null);
    const [borrowForm, setBorrowForm] = useState({ quantity: "1", reason: "" });
    const [borrowSubmitting, setBorrowSubmitting] = useState(false);

    const isAdmin = ["admin", "superadmin"].includes(user?.role || "");
    const isMyRoom = (asset: InventoryAsset) => {
        if (isAdmin) return true;
        const picId = (asset.expand?.room as any)?.picId || (asset.expand?.room as any)?.pic?.id;
        return picId === user?.id;
    };
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
        condition_good: "1",
        condition_light_damaged: "0",
        condition_heavy_damaged: "0",
        condition_lost: "0",
        funding_source: "",
        fiscal_year: new Date().getFullYear().toString(),
        photo_url: "",
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Load Rooms for filter/form
            const allRooms = await getAllRooms();
            setRooms(allRooms);

            // Filter dikirim sebagai parameter terpisah. Sebelumnya dirakit jadi
            // string bergaya PocketBase lalu dipotong-potong lagi dengan regex,
            // dan category tidak pernah sampai ke API (dropdown berubah, daftar tidak).
            const filter = {
                search: searchQuery,
                category: categoryFilter !== "all" ? categoryFilter : "",
            };

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
        // Filter baru memulai dari halaman 1, jika tidak pengguna bisa mendarat
        // di halaman kosong di luar jangkauan.
        setPage(1);
    }, [searchQuery, categoryFilter]);

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
                fundingSource: formData.funding_source || undefined,
                fiscalYear: formData.fiscal_year ? parseInt(formData.fiscal_year) : undefined,
                photoUrl: formData.photo_url || undefined,
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
            toast.success(editingAsset ? "Aset berhasil diperbarui" : "Aset berhasil ditambahkan");
        } catch (error) {
            console.error("Failed to save asset:", error);
            toast.error("Gagal menyimpan aset");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Yakin ingin menghapus aset ini?")) return;
        try {
            await deleteAsset(id);
            toast.success("Aset dihapus");
            loadData();
        } catch (error) {
            console.error("Failed to delete asset:", error);
            toast.error("Gagal menghapus aset");
        }
    };

    const openBorrowDialog = (asset: InventoryAsset) => {
        setBorrowTarget(asset);
        setBorrowForm({ quantity: "1", reason: "" });
    };

    const handleBorrowSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!borrowTarget) return;
        setBorrowSubmitting(true);
        try {
            await createBorrowRequest(borrowTarget.id, parseInt(borrowForm.quantity) || 1, borrowForm.reason);
            toast.success(`Pengajuan peminjaman "${borrowTarget.name}" terkirim. Menunggu persetujuan admin.`);
            setBorrowTarget(null);
        } catch (err: any) {
            toast.error(err?.message || "Gagal mengirim pengajuan");
        } finally {
            setBorrowSubmitting(false);
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
            funding_source: "",
            fiscal_year: new Date().getFullYear().toString(),
            photo_url: "",
        });
    };

    const openEditDialog = (asset: InventoryAsset) => {
        setEditingAsset(asset);
        setFormData({
            name: asset.name || "",
            code: asset.code || "",
            category: asset.category,
            purchase_date: asset.purchase_date ? asset.purchase_date.split('T')[0] : "",
            price: (asset.price || 0).toString(),
            quantity: (asset.quantity || 0).toString(),
            room: asset.room ?? "",
            notes: asset.notes || "",
            condition_good: (asset.condition_good || 0).toString(),
            condition_light_damaged: (asset.condition_light_damaged || 0).toString(),
            condition_heavy_damaged: (asset.condition_heavy_damaged || 0).toString(),
            condition_lost: (asset.condition_lost || 0).toString(),
            funding_source: asset.fundingSource || "",
            fiscal_year: (asset.fiscalYear || new Date().getFullYear()).toString(),
            photo_url: asset.photoUrl || "",
        });
        setIsAddDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/inventaris">
                        <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200 bg-white shadow-sm hover:bg-slate-50" aria-label="Kembali"><ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Data Aset</h1>
                        <p className="text-muted-foreground">
                            Kelola daftar aset, kondisi, dan lokasi
                        </p>
                    </div>
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Nama Aset *</Label>
                                        <Input
                                            id="name"
                                            value={formData.name ?? ""}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="code">Kode Inventaris</Label>
                                        <Input
                                            id="code"
                                            value={formData.code ?? ""}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                            placeholder="INV/2026/001"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="category">Kategori</Label>
                                        <Select value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                                        >
                                            <SelectTrigger id="category">
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
                                            <SelectTrigger id="room">
                                                <SelectValue placeholder="Pilih Ruangan" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {rooms.filter(r => {
                                                    const isAdmin = ["superadmin", "admin"].includes(user?.role || "");
                                                    if (isAdmin) return true;
                                                    return (r.picId || r.pic?.id) === user?.id;
                                                }).map((room) => (
                                                    <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="purchase_date">Tanggal Beli</Label>
                                        <Input
                                            id="purchase_date"
                                            type="date"
                                            value={formData.purchase_date ?? ""}
                                            onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="price">Harga Satuan</Label>
                                        <Input
                                            id="price"
                                            type="number"
                                            value={formData.price ?? ""}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="border rounded-md p-4 bg-muted/50">
                                    <Label className="mb-2 block font-semibold">Kondisi & Jumlah</Label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

                                <div className="border rounded-md p-4 bg-muted/50">
                                    <Label className="mb-2 block font-semibold">Label & Sumber Dana</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="funding_source">Sumber Dana</Label>
                                            <Select
                                                value={formData.funding_source}
                                                onValueChange={(value) => setFormData({ ...formData, funding_source: value })}
                                            >
                                                <SelectTrigger id="funding_source">
                                                    <SelectValue placeholder="Pilih sumber dana" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="BOSP Reguler">BOSP Reguler</SelectItem>
                                                    <SelectItem value="BOSP Kinerja">BOSP Kinerja</SelectItem>
                                                    <SelectItem value="APBD">APBD</SelectItem>
                                                    <SelectItem value="BOSDA">BOSDA</SelectItem>
                                                    <SelectItem value="Komite Sekolah">Komite Sekolah</SelectItem>
                                                    <SelectItem value="Hibah">Hibah</SelectItem>
                                                    <SelectItem value="Swadaya">Swadaya</SelectItem>
                                                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="fiscal_year">Tahun Anggaran</Label>
                                            <Input
                                                id="fiscal_year"
                                                type="number"
                                                min="2020"
                                                max="2035"
                                                value={formData.fiscal_year}
                                                onChange={(e) => setFormData({ ...formData, fiscal_year: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Foto Barang (opsional)</Label>
                                        {formData.photo_url ? (
                                            <div className="flex items-start gap-3">
                                                <div className="w-20 h-20 rounded-md border overflow-hidden bg-muted flex-shrink-0">
                                                    <img src={formData.photo_url} alt="Preview" className="w-full h-full object-cover" />
                                                </div>
                                                <Button type="button" variant="outline" size="sm"
                                                    onClick={() => setFormData({ ...formData, photo_url: "" })}>
                                                    <Trash2 className="h-4 w-4 mr-1" /> Hapus Foto
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <Button type="button" variant="outline" size="sm">
                                                    Pilih Foto
                                                </Button>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        try {
                                                            const url = await uploadPhoto(file);
                                                            setFormData({ ...formData, photo_url: url });
                                                            toast.success("Foto berhasil diunggah");
                                                        } catch (err) {
                                                            toast.error("Gagal mengunggah foto");
                                                        }
                                                        e.target.value = "";
                                                    }}
                                                />
                                            </div>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            Opsional. Ditampilkan di halaman publik saat QR discan.
                                        </p>
                                    </div>
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
                    <div className="flex gap-2 mt-2">
                        <Button variant="default" size="sm" disabled={selectedIds.length === 0}
                            onClick={() => {
                                const ids = selectedIds.join(",");
                                window.open(`/inventaris/label?assets=${ids}`, '_blank');
                            }}>
                            Cetak Label ({selectedIds.length})
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <DataTable
                data={loading ? [] : assets}
                getRowId={(asset) => asset.id}
                loading={loading}
                selectable
                selectedIds={selectedIds}
                onToggleSelect={(id) => {
                    setSelectedIds((prev) =>
                        prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
                    );
                }}
                onToggleSelectAll={() => {
                    if (selectedIds.length === assets.length) {
                        setSelectedIds([]);
                    } else {
                        setSelectedIds(assets.map((a) => a.id));
                    }
                }}
                emptyTitle="Belum ada aset"
                emptyDescription='Belum ada aset. Klik "Tambah Aset" untuk menambahkan.'
                columns={[
                    {
                        key: "name",
                        header: "Nama Aset",
                        card: "title",
                        render: (asset) => (
                            <div>
                                <p className="font-medium">{asset.name}</p>
                                <p className="text-xs text-muted-foreground">{asset.code}</p>
                            </div>
                        ),
                    },
                    {
                        key: "category",
                        header: "Kategori",
                        card: "field",
                        render: (asset) => asset.category,
                    },
                    {
                        key: "room",
                        header: "Lokasi",
                        card: "field",
                        render: (asset) => asset.expand?.room?.name || "-",
                    },
                    {
                        key: "quantity",
                        header: "Jumlah",
                        card: "field",
                        render: (asset) => `${asset.quantity} Unit`,
                    },
                    {
                        key: "condition",
                        header: "Kondisi",
                        card: "field",
                        render: (asset) => (
                            <div className="flex gap-2 text-xs">
                                {(asset.condition_good ?? 0) > 0 && <span className="text-green-600 bg-green-100 px-2 py-0.5 rounded">{asset.condition_good ?? 0} B</span>}
                                {(asset.condition_light_damaged ?? 0) > 0 && <span className="text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">{asset.condition_light_damaged ?? 0} RR</span>}
                                {(asset.condition_heavy_damaged ?? 0) > 0 && <span className="text-red-600 bg-red-100 px-2 py-0.5 rounded">{asset.condition_heavy_damaged ?? 0} RB</span>}
                                {(asset.condition_lost ?? 0) > 0 && <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{asset.condition_lost ?? 0} H</span>}
                            </div>
                        ),
                    },
                ]}
                actions={(asset) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon-sm" className="h-8 w-8 border-slate-200 bg-white shadow-sm hover:bg-slate-50 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(asset)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(`/inventaris/label?assets=${asset.id}`, '_blank')}>
                                <Printer className="h-4 w-4 mr-2" />
                                Cetak Label
                            </DropdownMenuItem>
                            {!isMyRoom(asset) && (
                                <DropdownMenuItem onClick={() => openBorrowDialog(asset)}>
                                    <HandHeart className="h-4 w-4 mr-2" />
                                    Ajukan Peminjaman
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDelete(asset.id)}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Hapus
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            />
            <TablePagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                label={`${totalItems} aset`}
            />

            {/* Dialog Pengajuan Peminjaman Aset Ruangan Lain */}
            <Dialog open={borrowTarget !== null} onOpenChange={(open) => !open && setBorrowTarget(null)}>
                <DialogContent className="max-w-md">
                    <form onSubmit={handleBorrowSubmit}>
                        <DialogHeader>
                            <DialogTitle>Ajukan Peminjaman Aset</DialogTitle>
                            <DialogDescription>
                                {borrowTarget && (
                                    <>
                                        {borrowTarget.name}
                                        {borrowTarget.expand?.room?.name ? ` — ${borrowTarget.expand.room.name}` : ""}
                                        {" "}• Aset ini di luar tanggung jawab Anda, perlu persetujuan admin.
                                    </>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="borrow-qty">Jumlah</Label>
                                <Input
                                    id="borrow-qty"
                                    type="number"
                                    min="1"
                                    value={borrowForm.quantity}
                                    onChange={(e) => setBorrowForm({ ...borrowForm, quantity: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="borrow-reason">Alasan Peminjaman</Label>
                                <Textarea
                                    id="borrow-reason"
                                    value={borrowForm.reason}
                                    onChange={(e) => setBorrowForm({ ...borrowForm, reason: e.target.value })}
                                    placeholder="Contoh: Untuk mengajar kelas 1 minggu ini"
                                    rows={3}
                                    required
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setBorrowTarget(null)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={borrowSubmitting}>
                                {borrowSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

