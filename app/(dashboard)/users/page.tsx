"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Plus,
    MoreHorizontal,
    Pencil,
    Trash2,
    Shield,
    ShieldCheck,
    RefreshCw,
    Loader2,
    Users,
    Search,
    UserCog,
} from "lucide-react";
import { pb } from "@/lib/pocketbase";
import type { User } from "@/types";

const roles = [
    { value: "user", label: "User", color: "bg-zinc-100 text-zinc-700" },
    { value: "staff", label: "Staff", color: "bg-blue-100 text-blue-700" },
    { value: "admin", label: "Admin", color: "bg-amber-100 text-amber-700" },
    { value: "superadmin", label: "Super Admin", color: "bg-purple-100 text-purple-700" },
];

export default function UserManagementPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        passwordConfirm: "",
        role: "user",
        phone: "",
    });

    const fetchUsers = useCallback(async () => {
        try {
            const result = await pb.collection("users").getFullList<User>({
                sort: "-created",
            });
            setUsers(result);
        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            if (editingId) {
                // Update user (without password if not provided)
                const updateData: Record<string, string> = {
                    name: formData.name,
                    role: formData.role,
                    phone: formData.phone,
                };

                if (formData.password) {
                    updateData.password = formData.password;
                    updateData.passwordConfirm = formData.passwordConfirm;
                }

                await pb.collection("users").update(editingId, updateData);
            } else {
                // Create new user
                await pb.collection("users").create({
                    ...formData,
                    emailVisibility: true,
                });
            }

            fetchUsers();
            resetForm();
        } catch (error) {
            console.error("Failed to save user:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (item: User) => {
        setEditingId(item.id);
        setFormData({
            name: item.name || "",
            email: item.email || "",
            password: "",
            passwordConfirm: "",
            role: item.role || "user",
            phone: item.phone || "",
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await pb.collection("users").delete(deleteId);
            setDeleteId(null);
            fetchUsers();
        } catch (error) {
            console.error("Failed to delete user:", error);
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            email: "",
            password: "",
            passwordConfirm: "",
            role: "user",
            phone: "",
        });
        setEditingId(null);
        setIsDialogOpen(false);
    };

    const filteredUsers = users.filter(
        (u) =>
            u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getRoleInfo = (role: string) => roles.find((r) => r.value === role) || roles[0];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Manajemen Pengguna</h1>
                    <p className="text-muted-foreground">Kelola akun pengguna dan hak akses</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setIsLoading(true); fetchUsers(); }}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Tambah User
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Total User</div>
                    <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-12" /> : users.length}</div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Admin</div>
                    <div className="text-2xl font-bold text-amber-600">
                        {isLoading ? <Skeleton className="h-8 w-12" /> : users.filter((u) => u.role === "admin" || u.role === "superadmin").length}
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Staff</div>
                    <div className="text-2xl font-bold text-blue-600">
                        {isLoading ? <Skeleton className="h-8 w-12" /> : users.filter((u) => u.role === "staff").length}
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-muted-foreground">User Biasa</div>
                    <div className="text-2xl font-bold text-zinc-600">
                        {isLoading ? <Skeleton className="h-8 w-12" /> : users.filter((u) => u.role === "user" || !u.role).length}
                    </div>
                </Card>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Cari nama atau email..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Telepon</TableHead>
                                <TableHead>Bergabung</TableHead>
                                <TableHead className="w-12"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                                        <p className="text-muted-foreground">Tidak ada pengguna ditemukan</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user) => {
                                    const roleInfo = getRoleInfo(user.role);
                                    return (
                                        <TableRow key={user.id}>
                                            <TableCell className="font-medium">{user.name || "-"}</TableCell>
                                            <TableCell className="text-muted-foreground">{user.email}</TableCell>
                                            <TableCell>
                                                <Badge className={roleInfo.color}>
                                                    {roleInfo.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{user.phone || "-"}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(user.created).toLocaleDateString("id-ID")}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleEdit(user)}>
                                                            <Pencil className="h-4 w-4 mr-2" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive"
                                                            onClick={() => setDeleteId(user.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Hapus
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Pengguna" : "Tambah Pengguna Baru"}</DialogTitle>
                        <DialogDescription>
                            {editingId ? "Perbarui informasi pengguna" : "Buat akun pengguna baru"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Lengkap</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Nama pengguna"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="email@example.com"
                                disabled={!!editingId}
                            />
                            {editingId && (
                                <p className="text-xs text-muted-foreground">Email tidak dapat diubah</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(v) => setFormData({ ...formData, role: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((role) => (
                                        <SelectItem key={role.value} value={role.value}>
                                            {role.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Nomor Telepon</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="08xxxxxxxxxx"
                            />
                        </div>
                        {!editingId && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="Minimal 8 karakter"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="passwordConfirm">Konfirmasi Password</Label>
                                    <Input
                                        id="passwordConfirm"
                                        type="password"
                                        value={formData.passwordConfirm}
                                        onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                                        placeholder="Ulangi password"
                                    />
                                </div>
                            </>
                        )}
                        {editingId && (
                            <div className="space-y-2">
                                <Label htmlFor="password">Password Baru (opsional)</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value, passwordConfirm: e.target.value })}
                                    placeholder="Kosongkan jika tidak ingin mengubah"
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={resetForm}>
                            Batal
                        </Button>
                        <Button onClick={handleSubmit} disabled={isSaving || !formData.name || !formData.email || (!editingId && !formData.password)}>
                            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {editingId ? "Simpan" : "Buat"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Pengguna?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Akun pengguna akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground"
                        >
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
