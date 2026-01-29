"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Home,
    Plus,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    Package,
    ArrowLeft,
} from "lucide-react";
import Link from "next/link";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    getRooms,
    createRoom,
    updateRoom,
    deleteRoom,
    getUsers, // Import new helper
    type UserOption
} from "@/lib/inventory";
import type { InventoryRoom } from "@/types/inventory";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"; // Add Select imports

export default function RuanganPage() {
    const { user } = useAuthStore();
    const [rooms, setRooms] = useState<InventoryRoom[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]); // User list state
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<InventoryRoom | null>(null);

    // Form state with picId
    const [formData, setFormData] = useState({
        name: "",
        code: "",
        description: "",
        picId: "", // Add picId
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            let filter = "";
            if (searchQuery) {
                filter = `name ~ "${searchQuery}" || code ~ "${searchQuery}"`;
            }

            // Parallel fetch
            const [roomsResult, usersResult] = await Promise.all([
                 getRooms(page, 20, filter),
                 getUsers()
            ]);

            setRooms(roomsResult.items);
            setTotalItems(roomsResult.totalItems);
            setUsers(usersResult);
        } catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setLoading(false);
        }
    }, [page, searchQuery]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingRoom) {
                await updateRoom(editingRoom.id, formData);
            } else {
                await createRoom(formData);
            }

            setIsAddDialogOpen(false);
            setEditingRoom(null);
            resetForm();
            loadData();
        } catch (error) {
            console.error("Failed to save room:", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Yakin ingin menghapus ruangan ini? Aset di dalamnya mungkin menjadi yatim piatu.")) {
            await deleteRoom(id);
            loadData();
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            code: "",
            description: "",
            picId: "",
        });
    };

    const openEditDialog = (room: InventoryRoom) => {
        setEditingRoom(room);
        setFormData({
            name: room.name || "",
            code: room.code || "",
            description: room.description || "",
            picId: (room as any).picId || room.expand?.pic?.id || "",
        });
        setIsAddDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/inventaris">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Data Ruangan</h1>
                        <p className="text-muted-foreground">
                            Kelola daftar ruangan dan lokasi aset
                        </p>
                    </div>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                    setIsAddDialogOpen(open);
                    if (!open) {
                        setEditingRoom(null);
                        resetForm();
                    }
                }}>
                    {["admin", "superadmin"].includes(user?.role || "") && (
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="h-4 w-4" />
                                Tambah Ruangan
                            </Button>
                        </DialogTrigger>
                    )}
                    <DialogContent>
                        <form onSubmit={handleSubmit}>
                            <DialogHeader>
                                <DialogTitle>
                                    {editingRoom ? "Edit Ruangan" : "Tambah Ruangan Baru"}
                                </DialogTitle>
                                <DialogDescription>
                                    Isi informasi ruangan di bawah ini
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Nama Ruangan *</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="code">Kode Ruangan *</Label>
                                    <Input
                                        id="code"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        required
                                        placeholder="Contoh: R-01"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="pic">Penanggung Jawab (PIC)</Label>
                                    <Select 
                                        value={formData.picId} 
                                        onValueChange={(val) => setFormData({...formData, picId: val === "none" ? "" : val})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih Penanggung Jawab" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">-- Tidak Ada --</SelectItem>
                                            {users.filter(u => ["guru", "staff", "admin", "superadmin"].includes(u.role)).map((u) => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {u.name} ({u.role})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="description">Deskripsi</Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit">
                                    {editingRoom ? "Simpan Perubahan" : "Tambah Ruangan"}
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
                            placeholder="Cari nama atau kode ruangan..."
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
                                <TableHead>Nama Ruangan</TableHead>
                                <TableHead>Kode</TableHead>
                                <TableHead>Deskripsi</TableHead>
                                <TableHead>PJ Ruangan</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">
                                        Memuat...
                                    </TableCell>
                                </TableRow>
                            ) : rooms.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Belum ada ruangan. Klik "Tambah Ruangan" untuk menambahkan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rooms.map((room) => (
                                    <TableRow key={room.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Home className="h-4 w-4 text-muted-foreground" />
                                                {room.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <code className="bg-muted px-2 py-1 rounded text-xs">{room.code}</code>
                                        </TableCell>
                                        <TableCell>{room.description || "-"}</TableCell>
                                        <TableCell>{room.expand?.pic?.name || "-"}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={!["admin", "superadmin"].includes(user?.role || "")}>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openEditDialog(room)}>
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={() => handleDelete(room.id)}
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
        </div>
    );
}
