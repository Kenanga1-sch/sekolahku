"use client";

import { useEffect, useState, useCallback } from "react";
import {
    BookOpen,
    Plus,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    QrCode,
    Filter,
} from "lucide-react";
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
import {
    getLibraryItems,
    createLibraryItem,
    updateLibraryItem,
    deleteLibraryItem,
} from "@/lib/library";
import type { LibraryItem, ItemCategory, ITEM_CATEGORIES } from "@/types/library";

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
    const [totalPages, setTotalPages] = useState(1);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);

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

    const loadItems = useCallback(async () => {
        setLoading(true);
        try {
            let filter = "";
            if (searchQuery) {
                filter = `title ~ "${searchQuery}" || author ~ "${searchQuery}" || isbn ~ "${searchQuery}"`;
            }
            if (categoryFilter && categoryFilter !== "all") {
                filter = filter
                    ? `(${filter}) && category = "${categoryFilter}"`
                    : `category = "${categoryFilter}"`;
            }

            const result = await getLibraryItems(page, 20, filter);
            setItems(result.items);
            setTotalPages(result.totalPages);
        } catch (error) {
            console.error("Failed to load items:", error);
        } finally {
            setLoading(false);
        }
    }, [page, searchQuery, categoryFilter]);

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
                await updateLibraryItem(editingItem.id, data);
            } else {
                await createLibraryItem(data);
            }

            setIsAddDialogOpen(false);
            setEditingItem(null);
            resetForm();
            loadItems();
        } catch (error) {
            console.error("Failed to save item:", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Yakin ingin menghapus buku ini?")) {
            await deleteLibraryItem(id);
            loadItems();
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Kelola Buku</h1>
                    <p className="text-muted-foreground">
                        Tambah dan kelola koleksi buku perpustakaan
                    </p>
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
                                    <SelectItem key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </SelectItem>
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
                                <TableHead>Judul</TableHead>
                                <TableHead>Penulis</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Lokasi</TableHead>
                                <TableHead>Status</TableHead>
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
                            ) : items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Belum ada buku. Klik "Tambah Buku" untuk menambahkan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{item.title}</p>
                                                {item.isbn && (
                                                    <p className="text-xs text-muted-foreground">ISBN: {item.isbn}</p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{item.author || "-"}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
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
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openEditDialog(item)}>
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        <QrCode className="h-4 w-4 mr-2" />
                                                        QR Code
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

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <Button
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                    >
                        Sebelumnya
                    </Button>
                    <span className="py-2 px-4 text-sm text-muted-foreground">
                        Halaman {page} dari {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        disabled={page === totalPages}
                        onClick={() => setPage(page + 1)}
                    >
                        Selanjutnya
                    </Button>
                </div>
            )}
        </div>
    );
}
