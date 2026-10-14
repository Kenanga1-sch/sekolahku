"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Tags,
    Plus,
    MoreHorizontal,
    Pencil,
    Trash2,
    ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from "@/lib/inventory";
import { toast } from "sonner";
import type { InventoryCategory, CategoryKind } from "@/types/inventory";
import { useAuthStore } from "@/lib/stores/auth-store";

const KIND_LABEL: Record<CategoryKind, string> = {
    ASSET: "Aset Tetap",
    ITEM: "Habis Pakai",
    BOTH: "Keduanya",
};

const EMPTY_FORM = {
    name: "",
    codePrefix: "",
    kind: "ASSET" as CategoryKind,
    sortOrder: 0,
};

export default function KategoriPage() {
    const { user } = useAuthStore();
    const isAdmin = ["admin", "superadmin"].includes(user?.role || "");

    const [categories, setCategories] = useState<InventoryCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editing, setEditing] = useState<InventoryCategory | null>(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const cats = await getCategories();
            setCategories(cats);
        } catch {
            toast.error("Gagal memuat kategori");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const resetForm = () => setFormData({ ...EMPTY_FORM });

    const openCreateDialog = () => {
        setEditing(null);
        resetForm();
        setIsDialogOpen(true);
    };

    const openEditDialog = (cat: InventoryCategory) => {
        setEditing(cat);
        setFormData({
            name: cat.name || "",
            codePrefix: cat.codePrefix || "",
            kind: (cat.kind as CategoryKind) || "ASSET",
            sortOrder: cat.sortOrder ?? 0,
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error("Nama kategori wajib diisi");
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name: formData.name.trim(),
                codePrefix: formData.codePrefix.trim().toUpperCase() || undefined,
                kind: formData.kind,
                sortOrder: formData.sortOrder || 0,
            };
            if (editing) {
                await updateCategory(editing.id, payload);
                toast.success("Kategori diperbarui");
            } else {
                await createCategory(payload);
                toast.success("Kategori ditambahkan");
            }
            setIsDialogOpen(false);
            setEditing(null);
            resetForm();
            load();
        } catch (err: any) {
            toast.error(err?.message || "Gagal menyimpan kategori");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (cat: InventoryCategory) => {
        if (!confirm(`Hapus kategori "${cat.name}"? Data aset/barang yang sudah ada tidak terpengaruh.`)) return;
        try {
            await deleteCategory(cat.id);
            toast.success("Kategori dihapus");
            load();
        } catch {
            toast.error("Gagal menghapus kategori");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <Link href="/inventaris" className="shrink-0">
                        <Button variant="outline" size="icon" aria-label="Kembali">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight truncate">Kategori Inventaris</h1>
                        <p className="text-muted-foreground text-sm">
                            Kelola kategori aset & barang, termasuk awalan kode inventaris otomatis.
                        </p>
                    </div>
                </div>
                {isAdmin && (
                    <Button className="gap-2 shrink-0" onClick={openCreateDialog}>
                        <Plus className="h-4 w-4" />
                        Tambah Kategori
                    </Button>
                )}
            </div>

            <Card>
                <CardContent className="p-4">
                    <DataTable
                        data={loading ? [] : categories}
                        getRowId={(c) => c.id}
                        loading={loading}
                        emptyTitle="Belum ada kategori"
                        emptyDescription="Tambahkan kategori agar kode inventaris dapat dibuat otomatis."
                        columns={[
                            {
                                key: "name",
                                header: "Nama Kategori",
                                card: "title",
                                render: (c) => (
                                    <div className="flex items-center gap-2">
                                        <Tags className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="font-medium">{c.name}</span>
                                    </div>
                                ),
                            },
                            {
                                key: "codePrefix",
                                header: "Awalan Kode",
                                card: "field",
                                render: (c) => c.codePrefix || "-",
                            },
                            {
                                key: "kind",
                                header: "Jenis",
                                card: "field",
                                render: (c) => (
                                    <Badge variant="outline">{KIND_LABEL[c.kind] || c.kind}</Badge>
                                ),
                            },
                            {
                                key: "sortOrder",
                                header: "Urutan",
                                card: "field",
                                render: (c) => c.sortOrder ?? 0,
                            },
                        ]}
                        actions={isAdmin ? (c) => (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon-sm" className="h-8 w-8" aria-label="Aksi">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditDialog(c)}>
                                        <Pencil className="h-4 w-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(c)}>
                                        <Trash2 className="h-4 w-4 mr-2" /> Hapus
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : undefined}
                    />
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) { setEditing(null); resetForm(); }
            }}>
                <DialogContent className="sm:max-w-[480px]">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>{editing ? "Edit Kategori" : "Tambah Kategori Baru"}</DialogTitle>
                            <DialogDescription>
                                Awalan kode dipakai menyusun kode inventaris otomatis, mis. &quot;BK&quot; → INV/BK-26-01.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="cat-name">Nama Kategori *</Label>
                                <Input
                                    id="cat-name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Mis. Buku"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="cat-prefix">Awalan Kode</Label>
                                    <Input
                                        id="cat-prefix"
                                        value={formData.codePrefix}
                                        onChange={(e) => setFormData({ ...formData, codePrefix: e.target.value.toUpperCase() })}
                                        placeholder="Mis. BK"
                                        maxLength={6}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="cat-sort">Urutan</Label>
                                    <Input
                                        id="cat-sort"
                                        type="number"
                                        value={formData.sortOrder}
                                        onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cat-kind">Jenis</Label>
                                <Select
                                    value={formData.kind}
                                    onValueChange={(v) => setFormData({ ...formData, kind: v as CategoryKind })}
                                >
                                    <SelectTrigger id="cat-kind">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ASSET">Aset Tetap</SelectItem>
                                        <SelectItem value="ITEM">Habis Pakai</SelectItem>
                                        <SelectItem value="BOTH">Keduanya</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                            <Button type="button" variant="outline" className="w-full sm:w-auto"
                                onClick={() => setIsDialogOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                                {saving ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Tambah Kategori"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
