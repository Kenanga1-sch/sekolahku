"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Users,
    Plus,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    QrCode,
    IdCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import {
    getLibraryMembers,
    createLibraryMember,
    updateLibraryMember,
} from "@/lib/library";
import type { LibraryMember } from "@/types/library";

export default function AnggotaPage() {
    const [members, setMembers] = useState<LibraryMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<LibraryMember | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        class_name: "",
        student_id: "",
        max_borrow_limit: "3",
    });

    const loadMembers = useCallback(async () => {
        setLoading(true);
        try {
            let filter = "";
            if (searchQuery) {
                filter = `name ~ "${searchQuery}" || class_name ~ "${searchQuery}" || student_id ~ "${searchQuery}"`;
            }

            const result = await getLibraryMembers(page, 20, filter);
            setMembers(result.items);
            setTotalPages(result.totalPages);
        } catch (error) {
            console.error("Failed to load members:", error);
        } finally {
            setLoading(false);
        }
    }, [page, searchQuery]);

    useEffect(() => {
        loadMembers();
    }, [loadMembers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = {
                name: formData.name,
                class_name: formData.class_name || undefined,
                student_id: formData.student_id || undefined,
                max_borrow_limit: parseInt(formData.max_borrow_limit) || 3,
            };

            if (editingMember) {
                await updateLibraryMember(editingMember.id, data);
            } else {
                await createLibraryMember(data);
            }

            setIsAddDialogOpen(false);
            setEditingMember(null);
            resetForm();
            loadMembers();
        } catch (error) {
            console.error("Failed to save member:", error);
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            class_name: "",
            student_id: "",
            max_borrow_limit: "3",
        });
    };

    const openEditDialog = (member: LibraryMember) => {
        setEditingMember(member);
        setFormData({
            name: member.name,
            class_name: member.class_name || "",
            student_id: member.student_id || "",
            max_borrow_limit: member.max_borrow_limit?.toString() || "3",
        });
        setIsAddDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Kelola Anggota</h1>
                    <p className="text-muted-foreground">
                        Kelola anggota perpustakaan dan kartu member
                    </p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                    setIsAddDialogOpen(open);
                    if (!open) {
                        setEditingMember(null);
                        resetForm();
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Tambah Anggota
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <form onSubmit={handleSubmit}>
                            <DialogHeader>
                                <DialogTitle>
                                    {editingMember ? "Edit Anggota" : "Tambah Anggota Baru"}
                                </DialogTitle>
                                <DialogDescription>
                                    Isi data anggota perpustakaan
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Nama Lengkap *</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="class_name">Kelas</Label>
                                        <Input
                                            id="class_name"
                                            value={formData.class_name}
                                            onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                                            placeholder="5A"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="student_id">NIS/NISN</Label>
                                        <Input
                                            id="student_id"
                                            value={formData.student_id}
                                            onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="max_borrow_limit">Batas Pinjam</Label>
                                    <Input
                                        id="max_borrow_limit"
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={formData.max_borrow_limit}
                                        onChange={(e) => setFormData({ ...formData, max_borrow_limit: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Maksimal jumlah buku yang bisa dipinjam sekaligus
                                    </p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit">
                                    {editingMember ? "Simpan Perubahan" : "Tambah Anggota"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="p-4">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari nama, kelas, atau NIS..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama</TableHead>
                                <TableHead>Kelas</TableHead>
                                <TableHead>NIS</TableHead>
                                <TableHead>Batas Pinjam</TableHead>
                                <TableHead>QR Code</TableHead>
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
                            ) : members.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Belum ada anggota. Klik "Tambah Anggota" untuk menambahkan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                members.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell className="font-medium">{member.name}</TableCell>
                                        <TableCell>
                                            {member.class_name ? (
                                                <Badge variant="secondary">{member.class_name}</Badge>
                                            ) : (
                                                "-"
                                            )}
                                        </TableCell>
                                        <TableCell>{member.student_id || "-"}</TableCell>
                                        <TableCell>{member.max_borrow_limit} buku</TableCell>
                                        <TableCell>
                                            <code className="text-xs bg-muted px-2 py-1 rounded">
                                                {member.qr_code}
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openEditDialog(member)}>
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        <IdCard className="h-4 w-4 mr-2" />
                                                        Cetak Kartu
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        <QrCode className="h-4 w-4 mr-2" />
                                                        Lihat QR
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
