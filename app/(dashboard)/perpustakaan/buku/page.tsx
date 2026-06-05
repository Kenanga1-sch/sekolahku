"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Book,
    BookOpen,
    Plus,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    QrCode,
    Filter,
    Loader2,
    ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
// Server imports removed
import { showError, showSuccess } from "@/lib/toast";
import { 
    getBooks, 
    createBook, 
    updateBook, 
    deleteBook, 
    swapAssetQR 
} from "@/lib/library";
import type { LibraryItem, ItemCategory } from "@/types/library";
import { useSortableData } from "@/hooks/use-sortable-data";
import { SortableTableHead } from "@/components/ui/sortable-table-head";

const CATEGORIES: { value: ItemCategory; label: string }[] = [
    { value: "FICTION", label: "Fiksi" },
    { value: "NON_FICTION", label: "Non-Fiksi" },
    { value: "REFERENCE", label: "Referensi" },
    { value: "TEXTBOOK", label: "Buku Pelajaran" },
    { value: "MAGAZINE", label: "Majalah" },
    { value: "OTHER", label: "Lainnya" },
];

export default function BukuPage() {
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isSwapDialogOpen, setIsSwapDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
    const [swappingItem, setSwappingItem] = useState<LibraryItem | null>(null);
    const [newQrCode, setNewQrCode] = useState("");

    // Form state
    const [formData, setFormData] = useState({
        title: "",
        author: "",
        isbn: "",
        publisher: "",
        year: "",
        category: "OTHER" as ItemCategory,
        location: "",
        description: "",
    });
    const { sortedData: sortedItems, sortConfig, requestSort } = useSortableData(items);

    const loadItems = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getBooks({
                page,
                perPage,
                search: searchQuery,
                category: categoryFilter
            });
            setItems(result.items || []);
            setTotalPages(result.totalPages || 1);
        } catch (error) {
            console.error("Failed to load items:", error);
            showError("Gagal memuat data buku");
        } finally {
            setLoading(false);
        }
    }, [page, perPage, searchQuery, categoryFilter]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = {
                ...formData,
                year: formData.year ? parseInt(formData.year) : undefined,
            };

            if (editingItem) {
                await updateBook(editingItem.id, data);
            } else {
                await createBook(data);
            }

            showSuccess(editingItem ? "Buku berhasil diperbarui" : "Buku berhasil ditambahkan");
            setIsAddDialogOpen(false);
            setEditingItem(null);
            resetForm();
            loadItems();
        } catch (error) {
            console.error("Failed to save item:", error);
            showError("Gagal menyimpan data buku");
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Yakin ingin menghapus buku ini?")) {
            try {
                await deleteBook(id);
                showSuccess("Buku berhasil dihapus");
                loadItems();
            } catch (error) {
                console.error("Failed to delete item:", error);
                showError(error instanceof Error ? error.message : "Gagal menghapus buku");
            }
        }
    };

    const resetForm = () => {
        setFormData({
            title: "",
            author: "",
            isbn: "",
            publisher: "",
            year: "",
            category: "OTHER",
            location: "",
            description: "",
        });
    };

    const openEditDialog = (item: LibraryItem) => {
        setEditingItem(item);
        setFormData({
            title: item.title,
            author: item.author || "",
            isbn: item.isbn || "",
            publisher: item.publisher || "",
            year: item.year?.toString() || "",
            category: item.category,
            location: item.location || "",
            description: item.description || "",
        });
        setIsAddDialogOpen(true);
    };

    const handleSwapQR = async () => {
        if (!swappingItem || !newQrCode) return;
        setLoading(true);
        try {
            await swapAssetQR(swappingItem.id, newQrCode);
            showSuccess("QR Code berhasil diganti");
            setIsSwapDialogOpen(false);
            setSwappingItem(null);
            setNewQrCode("");
            loadItems();
        } catch (error) {
            showError(error instanceof Error ? error.message : "Gagal mengganti QR Code");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/perpustakaan">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Kelola Buku</h1>
                        <p className="text-muted-foreground">
                            Tambah dan kelola koleksi buku perpustakaan
                        </p>
                    </div>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                    setIsAddDialogOpen(open);
                    if (!open) {
                        setEditingItem(null);
                        resetForm();
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Tambah Buku
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <form onSubmit={handleSubmit}>
                            <DialogHeader>
                                <DialogTitle>
                                    {editingItem ? "Edit Buku" : "Tambah Buku Baru"}
                                </DialogTitle>
                                <DialogDescription>
                                    Isi informasi buku di bawah ini
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="title">Judul *</Label>
                                    <Input
                                        id="title"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="author">Penulis</Label>
                                        <Input
                                            id="author"
                                            value={formData.author}
                                            onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="isbn">ISBN</Label>
                                        <Input
                                            id="isbn"
                                            value={formData.isbn}
                                            onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="publisher">Penerbit</Label>
                                        <Input
                                            id="publisher"
                                            value={formData.publisher}
                                            onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="year">Tahun</Label>
                                        <Input
                                            id="year"
                                            type="number"
                                            value={formData.year}
                                            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="category">Kategori</Label>
                                        <Select
                                            value={formData.category}
                                            onValueChange={(value) => setFormData({ ...formData, category: value as ItemCategory })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CATEGORIES.map((cat) => (
                                                    <SelectItem key={cat.value} value={cat.value}>
                                                        {cat.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="location">Lokasi Rak</Label>
                                        <Input
                                            id="location"
                                            value={formData.location}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            placeholder="A-01"
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="description">Deskripsi</Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit">
                                    {editingItem ? "Simpan Perubahan" : "Tambah Buku"}
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
                                placeholder="Cari judul, penulis, atau ISBN..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setPage(1);
                                }}
                                className="pl-9"
                            />
                        </div>
                        <Select
                            value={categoryFilter}
                            onValueChange={(value) => {
                                setCategoryFilter(value);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[180px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Kategori" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Kategori</SelectItem>
                                {CATEGORIES.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={perPage.toString()}
                            onValueChange={(val) => {
                                setPerPage(parseInt(val));
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Baris" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10 Baris</SelectItem>
                                <SelectItem value="20">20 Baris</SelectItem>
                                <SelectItem value="50">50 Baris</SelectItem>
                                <SelectItem value="100">100 Baris</SelectItem>
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
                                <TableHead className="w-[80px]">Sampul</TableHead>
                                <SortableTableHead label="Judul" sortKey="catalog.title" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Penulis" sortKey="catalog.author" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Kategori" sortKey="catalog.category" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Lokasi" sortKey="location" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Status" sortKey="status" sortConfig={sortConfig} onSort={requestSort} />
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">
                                        Memuat...
                                    </TableCell>
                                </TableRow>
                            ) : items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        Belum ada buku. Klik &quot;Tambah Buku&quot; untuk menambahkan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedItems.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="w-12 h-16 rounded overflow-hidden border bg-muted flex items-center justify-center">
                                                {item.catalog?.cover ? (
                                                    <img 
                                                        src={item.catalog.cover} 
                                                        alt={item.catalog.title} 
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = "/images/placeholder-book.png";
                                                        }}
                                                    />
                                                ) : (
                                                    <Book className="h-6 w-6 text-muted-foreground/40" />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <p className="font-medium">{item.catalog?.title || "No Title"}</p>
                                                <div className="flex gap-2 items-center">
                                                    <Badge variant="outline" className="text-[10px] h-4 font-mono">{item.id}</Badge>
                                                    {item.catalog?.isbn && (
                                                        <p className="text-xs text-muted-foreground">ISBN: {item.catalog.isbn}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{item.catalog?.author || "-"}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {CATEGORIES.find((c) => c.value === item.catalog?.category)?.label || item.catalog?.category || "-"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{item.location || "-"}</TableCell>
                                        <TableCell>
                                            <Badge variant={item.status === "AVAILABLE" ? "default" : "destructive"}>
                                                {item.status === "AVAILABLE" ? "Tersedia" : "Dipinjam"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                     <Button variant="outline" size="icon-sm" className="h-8 w-8 text-muted-foreground hover:text-foreground bg-background/50">
                                                         <MoreHorizontal className="h-4 w-4" />
                                                     </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openEditDialog(item)}>
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => {
                                                        setSwappingItem(item);
                                                        setIsSwapDialogOpen(true);
                                                    }}>
                                                        <QrCode className="h-4 w-4 mr-2" />
                                                        Ganti QR Code
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={() => handleDelete(item.id)}
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

            {/* Swap QR Dialog */}
            <Dialog open={isSwapDialogOpen} onOpenChange={setIsSwapDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ganti QR Code</DialogTitle>
                        <DialogDescription>
                            Gunakan ini jika label QR Code pada buku rusak. Data sejarah peminjaman akan tetap terjaga.
                        </DialogDescription>
                    </DialogHeader>
                    {swappingItem && (
                        <div className="space-y-4 py-4">
                            <div className="bg-muted p-3 rounded-md">
                                <p className="text-sm font-bold">{swappingItem.catalog?.title}</p>
                                <p className="text-xs text-muted-foreground">QR Lama: {swappingItem.id}</p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="newQr">QR Code Baru</Label>
                                <Input
                                    id="newQr"
                                    placeholder="Scan atau ketik kode QR baru..."
                                    value={newQrCode}
                                    onChange={(e) => setNewQrCode(e.target.value.toUpperCase())}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSwapDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleSwapQR} disabled={loading || !newQrCode}>
                            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Simpan QR Baru
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Pagination */}
            {items.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                    <div className="text-sm text-muted-foreground">
                        Halaman {page} dari {totalPages}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                Sebelumnya
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                Selanjutnya
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

