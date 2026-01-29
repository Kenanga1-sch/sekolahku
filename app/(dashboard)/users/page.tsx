"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
    ShieldCheck,
    RefreshCw,
    Loader2,
    Users,
    Search,
    UserCog,
    UserPlus,
} from "lucide-react";
import type { User } from "@/types";

interface ClassOption {
    name: string;
}

const roles = [
    { value: "user", label: "User", color: "bg-zinc-100 text-zinc-700" },
    { value: "siswa", label: "Siswa", color: "bg-green-100 text-green-700" },
    { value: "guru", label: "Guru", color: "bg-blue-100 text-blue-700" },
    { value: "staff", label: "Staff", color: "bg-cyan-100 text-cyan-700" },
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
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);

    // Generation State
    const [isGenerateOpen, setIsGenerateOpen] = useState(false);
    const [genType, setGenType] = useState<"student" | "staff">("student");
    const [generateMode, setGenerateMode] = useState<"skip" | "overwrite">("skip");
    const [selectedClass, setSelectedClass] = useState("");
    const [availableClasses, setAvailableClasses] = useState<ClassOption[]>([]);

    const [formData, setFormData] = useState({
        name: "",
        username: "",
        email: "",
        password: "",
        passwordConfirm: "",
        role: "user",
        phone: "",
    });

    const fetchUsers = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "20",
                ...(searchQuery && { search: searchQuery }),
            });

            const res = await fetch(`/api/users?${params}`);
            if (!res.ok) throw new Error("Failed to fetch");
            
            const result = await res.json();
            setUsers(result.items.map((u: any) => ({
                ...u,
                created: u.createdAt,
            })));
            setTotalPages(result.totalPages);
            setTotalUsers(result.totalItems);
        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setIsLoading(false);
        }
    }, [page, searchQuery]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Fetch classes for generation dropdown
    useEffect(() => {
        if (isGenerateOpen && genType === "student") {
             // ROMBEL FIXED: Only 1-6, no "A, B, C"
             const classList: ClassOption[] = [];
             for(let i=1; i<=6; i++) {
                classList.push({name: `${i}`});
             }
             setAvailableClasses(classList);
        }
    }, [isGenerateOpen, genType]);

    const handleGenerate = async (overrideType?: string, mode?: string) => {
        setIsSaving(true);
        try {
            let body: any = {};
            
            if (overrideType === "staff-auto") {
                body = { type: "staff-auto", mode: mode || "skip" };
            } else if (genType === "student") {
                body = { type: "student", className: selectedClass };
            } else {
                // Manual staff
                body = { 
                    type: "staff", 
                    staffData: {
                        name: formData.name,
                        email: formData.email,
                        role: formData.role,
                        phone: formData.phone,
                        password: formData.password
                    }
                  };
            }

            const res = await fetch("/api/users/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const result = await res.json();
            if (!result.success) throw new Error(result.error);
            
            alert(result.message); // Simple feedback
            setIsGenerateOpen(false);
            fetchUsers();
        } catch (error: any) {
            alert(error.message || "Gagal generate akun");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            if (editingId) {
                // Update user
                const updateData: Record<string, string> = {
                    name: formData.name,
                    username: formData.username,
                    role: formData.role,
                    phone: formData.phone,
                };
                if (formData.password) {
                    updateData.password = formData.password;
                }

                const res = await fetch(`/api/users/${editingId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updateData),
                });
                if (!res.ok) throw new Error("Failed to update");
            } else {
                // Create new user
                const res = await fetch("/api/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Failed to create");
                }
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
            username: item.username || "",
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
            const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to delete");
            }
            setDeleteId(null);
            fetchUsers();
        } catch (error: any) {
            console.error("Failed to delete user:", error);
            alert(error.message || "Gagal menghapus user");
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            username: "",
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
                    <Button variant="secondary" onClick={() => setIsGenerateOpen(true)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Generate Akun
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
                    <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-12" /> : totalUsers}</div>
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
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
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
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                                        <p className="text-muted-foreground">Tidak ada pengguna ditemukan</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => {
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

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t">
                        <p className="text-sm text-muted-foreground">
                            Halaman {page} dari {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                Sebelumnya
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Selanjutnya
                            </Button>
                        </div>
                    </div>
                )}
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
                                <p className="text-xs text-muted-foreground">Email tidak dapat diubah (gunakan sebagai ID unik)</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                placeholder="username"
                            />
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

            {/* Generate Dialog */}
            <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Generate Akun Otomatis</DialogTitle>
                        <DialogDescription>
                            Buat akun massal untuk siswa atau akun staff baru.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-4">
                            <Label className="text-base font-semibold">Tipe Akun</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div 
                                    className={`relative p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${
                                        genType === "student" 
                                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20" 
                                        : "border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                    }`}
                                    onClick={() => setGenType("student")}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`p-2 rounded-lg ${genType === "student" ? "bg-blue-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>
                                            <Users className="h-5 w-5" />
                                        </div>
                                        <div className="font-bold text-lg">Akun Siswa</div>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Otomatis generate akun dari data siswa per kelas. 
                                        <br />
                                        <span className="inline-flex items-center gap-1 mt-1 font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded text-xs">
                                            Username = NISN
                                        </span>
                                    </p>
                                    {genType === "student" && (
                                        <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                    )}
                                </div>

                                <div 
                                    className={`relative p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${
                                        genType === "staff" 
                                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20" 
                                        : "border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                    }`}
                                    onClick={() => setGenType("staff")}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`p-2 rounded-lg ${genType === "staff" ? "bg-blue-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>
                                            <UserCog className="h-5 w-5" />
                                        </div>
                                        <div className="font-bold text-lg">Akun Staff/Guru</div>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Buat akun manual untuk Guru, Staff, atau Administrator baru.
                                    </p>
                                    {genType === "staff" && (
                                        <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-1" /> {/* Spacer */}

                        {genType === "student" ? (
                             <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="space-y-2">
                                    <Label>Pilih Kelas Target</Label>
                                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                                        <SelectTrigger className="h-12 text-base">
                                            <SelectValue placeholder="-- Pilih Kelas --" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableClasses.map((c) => (
                                                <SelectItem key={c.name} value={c.name} className="py-3">Kelas {c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-r-lg">
                                    <h4 className="font-semibold text-amber-800 dark:text-amber-200 text-sm mb-1 flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4" /> Konfirmasi Generate
                                    </h4>
                                    <div className="text-sm text-amber-700 dark:text-amber-300">
                                        Sistem akan mengecek data <strong>Siswa</strong> di kelas ini. Jika belum punya akun, akan dibuatkan dengan:
                                        <ul className="list-disc list-inside mt-1 ml-1 text-xs font-mono">
                                            <li>Username: NISN</li>
                                            <li>Password: NISN</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                                {/* Bulk Generate Option */}
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl space-y-4">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div>
                                            <h4 className="flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-100">
                                                <ShieldCheck className="h-4 w-4" />
                                                Generate Akun Guru & Staff
                                            </h4>
                                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                                Sistem akan mengambil data dari <strong>Manajemen Staff</strong>.
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3 pt-2 border-t border-blue-200 dark:border-blue-800">
                                        <Label className="text-blue-900 dark:text-blue-100">Opsi Duplikasi:</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div 
                                                className={`cursor-pointer border p-3 rounded-lg flex items-center gap-3 transition-colors ${
                                                    generateMode === "skip" 
                                                    ? "bg-white dark:bg-zinc-900 border-blue-500 ring-1 ring-blue-500" 
                                                    : "bg-white/50 dark:bg-zinc-900/50 border-transparent hover:bg-white dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                                }`}
                                                onClick={() => setGenerateMode("skip")}
                                            >
                                                <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${generateMode === "skip" ? "border-blue-500" : "border-zinc-400"}`}>
                                                    {generateMode === "skip" && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-sm">Hanya yang belum punya</div>
                                                    <div className="text-xs text-muted-foreground">Akun yang sudah ada tidak akan diubah.</div>
                                                </div>
                                            </div>

                                            <div 
                                                className={`cursor-pointer border p-3 rounded-lg flex items-center gap-3 transition-colors ${
                                                    generateMode === "overwrite" 
                                                    ? "bg-white dark:bg-zinc-900 border-amber-500 ring-1 ring-amber-500" 
                                                    : "bg-white/50 dark:bg-zinc-900/50 border-transparent hover:bg-white dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                                }`}
                                                onClick={() => setGenerateMode("overwrite")}
                                            >
                                                <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${generateMode === "overwrite" ? "border-amber-500" : "border-zinc-400"}`}>
                                                    {generateMode === "overwrite" && <div className="h-2 w-2 rounded-full bg-amber-500" />}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-sm">Timpa Semua (Reset)</div>
                                                    <div className="text-xs text-muted-foreground">Semua akun staff akan di-reset ke default.</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-2">
                                        <Button 
                                            onClick={() => handleGenerate("staff-auto", generateMode)} 
                                            disabled={isSaving}
                                            className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                                        >
                                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                            Mulai Generate ({generateMode === "skip" ? "Aman" : "Reset"})
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {genType === "student" && (
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsGenerateOpen(false)}>Batal</Button>
                            <Button 
                                onClick={() => handleGenerate("student")} 
                                disabled={isSaving || !selectedClass}
                            >
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Generate Akun
                            </Button>
                        </DialogFooter>
                    )}
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
