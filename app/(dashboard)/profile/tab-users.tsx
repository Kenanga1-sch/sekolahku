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
    GraduationCap,
    Copy,
    Check,
    Eye,
    EyeOff,
} from "lucide-react";
import { goGet, goPost, goPatch, goDelete } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import type { User as UserType } from "@/types";
import { useSortableData } from "@/hooks/use-sortable-data";
import { SortableTableHead } from "@/components/ui/sortable-table-head";

interface ClassOption {
    name: string;
}

interface GtkOption {
    id: string;
    name: string;
    email: string;
    role: string;
    nip?: string;
}

const roles = [
    { value: "superadmin", label: "Super Admin", color: "bg-purple-100 text-purple-700" },
    { value: "admin", label: "Admin", color: "bg-amber-100 text-amber-700" },
    { value: "guru", label: "Guru", color: "bg-blue-100 text-blue-700" },
    { value: "staff", label: "Staff", color: "bg-cyan-100 text-cyan-700" },
    { value: "user", label: "User", color: "bg-zinc-100 text-zinc-700" },
    { value: "siswa", label: "Siswa", color: "bg-green-100 text-green-700" },
];

export default function TabUsers() {
    const [users, setUsers] = useState<UserType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);

    // GTK Dropdown State
    const [gtkOptions, setGtkOptions] = useState<GtkOption[]>([]);
    const [selectedGtkId, setSelectedGtkId] = useState<string>("");

    // Created password display
    const [createdPassword, setCreatedPassword] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [showPw, setShowPw] = useState(false);

    // Generation State
    const [isGenerateOpen, setIsGenerateOpen] = useState(false);
    const [genType, setGenType] = useState<"student" | "staff">("staff");
    const [selectedClass, setSelectedClass] = useState("");
    const [availableClasses, setAvailableClasses] = useState<ClassOption[]>([]);
    const [genResult, setGenResult] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        username: "",
        email: "",
        password: "",
        passwordConfirm: "",
        role: "user",
        phone: "",
        employeeId: "",
    });

    const fetchUsers = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(searchQuery && { search: searchQuery }),
            });

            const result: any = await goGet(`/api/users?${params}`);
            
            setUsers((result.items || []).map((u: any) => ({
                ...u,
                created: u.createdAt || u.created || "",
            })));
            setTotalPages(result.totalPages || 1);
            setTotalUsers(result.totalItems || 0);
        } catch (error) {
            console.error("Failed to fetch users:", error);
            showError("Gagal memuat daftar pengguna");
        } finally {
            setIsLoading(false);
        }
    }, [page, limit, searchQuery]);

    // Fetch GTK without accounts
    const fetchGtkWithoutAccount = useCallback(async () => {
        try {
            const data: any = await goGet("/api/master/employees/without-account");
            setGtkOptions(data.items || []);
        } catch {
            // Silently fail
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        if (isDialogOpen && !editingId) {
            fetchGtkWithoutAccount();
        }
    }, [isDialogOpen, editingId, fetchGtkWithoutAccount]);

    // Fetch classes for generation dropdown
    useEffect(() => {
        if (isGenerateOpen && genType === "student") {
             const classList: ClassOption[] = [];
             for(let i=1; i<=6; i++) {
                classList.push({name: `${i}`});
             }
             setAvailableClasses(classList);
        }
    }, [isGenerateOpen, genType]);

    const handleGtkSelect = (gtkId: string) => {
        setSelectedGtkId(gtkId);
        const gtk = gtkOptions.find((g) => g.id === gtkId);
        if (gtk) {
            setFormData((prev) => ({
                ...prev,
                name: gtk.name,
                email: gtk.email,
                role: gtk.role,
                employeeId: gtk.id,
            }));
        }
    };

    const handleGenerate = async () => {
        setIsSaving(true);
        setGenResult(null);
        try {
            let body: any = { type: "staff-auto" };

            const result: any = await goPost("/api/users/generate", body);
            setGenResult(result.message || `Berhasil generate ${result.successCount || 0} akun`);
            showSuccess(result.message || "Berhasil generate akun");
            fetchUsers();
        } catch (error: any) {
            showError(error.message || "Gagal generate akun");
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerateStudent = async () => {
        setIsSaving(true);
        try {
            const result: any = await goPost("/api/users/generate", { type: "student", className: selectedClass });
            showSuccess(result.message || "Berhasil generate akun");
            setIsGenerateOpen(false);
            fetchUsers();
        } catch (error: any) {
            showError(error.message || "Gagal generate akun");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        setCreatedPassword(null);
        try {
            if (!formData.name.trim()) {
                showError("Nama wajib diisi");
                return;
            }

            if (editingId) {
                if (formData.password && formData.password.length < 8) {
                    showError("Password minimal 8 karakter");
                    return;
                }

                const updateData: any = {
                    name: formData.name.trim(),
                    username: formData.username.trim(),
                    role: formData.role,
                    phone: formData.phone.trim(),
                };
                if (formData.password) {
                    updateData.password = formData.password;
                }

                await goPatch(`/api/users/${editingId}`, updateData);
                showSuccess("Pengguna berhasil diperbarui");
                fetchUsers();
                resetForm();
            } else {
                if (!formData.email.trim()) {
                    showError("Email wajib diisi");
                    return;
                }

                const res: any = await goPost("/api/users", {
                    name: formData.name.trim(),
                    username: formData.username.trim(),
                    email: formData.email.trim(),
                    phone: formData.phone.trim(),
                    role: formData.role,
                    password: formData.password,
                    passwordConfirm: formData.passwordConfirm,
                    employeeId: formData.employeeId,
                });
                
                if (res.password) {
                    setCreatedPassword(res.password);
                    showSuccess("Akun berhasil dibuat!");
                } else {
                    showSuccess("Pengguna baru berhasil dibuat");
                }
                fetchUsers();
            }
        } catch (error: any) {
            console.error("Failed to save user:", error);
            showError(error.message || "Gagal menyimpan pengguna");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (item: UserType) => {
        setEditingId(item.id);
        setCreatedPassword(null);
        setFormData({
            name: item.name || "",
            username: item.username || "",
            email: item.email || "",
            password: "",
            passwordConfirm: "",
            role: item.role || "user",
            phone: item.phone || "",
            employeeId: "",
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await goDelete(`/api/users/${deleteId}`);
            setDeleteId(null);
            showSuccess("Pengguna berhasil dihapus");
            fetchUsers();
        } catch (error: any) {
            console.error("Failed to delete user:", error);
            showError(error.message || "Gagal menghapus pengguna");
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
            employeeId: "",
        });
        setCreatedPassword(null);
        setSelectedGtkId("");
        setEditingId(null);
        setIsDialogOpen(false);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const visibleUsers = users.filter(
        (u) =>
            u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const { sortedData: sortedUsers, sortConfig, requestSort } = useSortableData(visibleUsers);

    const getRoleInfo = (role: string) => roles.find((r) => r.value === role) || roles.find((r) => r.value === "user") || roles[0];
    const formatCreatedDate = (value?: string) => {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("id-ID");
    };

    return (
        <div className="space-y-6 bg-white dark:bg-zinc-950 p-6 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-xs">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-zinc-800/60 pb-4 mb-4">
                <div>
                    <h3 className="text-lg font-bold">Manajemen Pengguna</h3>
                    <p className="text-muted-foreground text-xs font-normal">Buat akun login untuk GTK yang sudah terdaftar.</p>
                </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                    <Button size="sm" className="w-full sm:w-auto" variant="outline" onClick={() => { setIsLoading(true); fetchUsers(); }}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button size="sm" className="w-full sm:w-auto" variant="secondary" onClick={() => setIsGenerateOpen(true)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Generate Akun
                    </Button>
                    <Button size="sm" className="col-span-2 w-full sm:col-span-1 sm:w-auto text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Tambah User
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 border-slate-200/50 dark:border-zinc-800/50 hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-slate-50/50 dark:from-zinc-950 dark:to-zinc-900/50 relative overflow-hidden group">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total User</div>
                            <div className="text-2xl font-extrabold mt-1 text-slate-800 dark:text-white">
                                {isLoading ? <Skeleton className="h-7 w-12" /> : totalUsers}
                            </div>
                        </div>
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                            <Users className="h-5 w-5" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 border-slate-200/50 dark:border-zinc-800/50 hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-slate-50/50 dark:from-zinc-950 dark:to-zinc-900/50 relative overflow-hidden group">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</div>
                            <div className="text-2xl font-extrabold mt-1 text-amber-600 dark:text-amber-500">
                                {isLoading ? <Skeleton className="h-7 w-12" /> : users.filter((u) => u.role === "admin" || u.role === "superadmin").length}
                            </div>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                            <UserCog className="h-5 w-5" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 border-slate-200/50 dark:border-zinc-800/50 hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-slate-50/50 dark:from-zinc-950 dark:to-zinc-900/50 relative overflow-hidden group">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Staff/Guru</div>
                            <div className="text-2xl font-extrabold mt-1 text-blue-600 dark:text-blue-500">
                                {isLoading ? <Skeleton className="h-7 w-12" /> : users.filter((u) => u.role === "staff" || u.role === "guru").length}
                            </div>
                        </div>
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                            <UserPlus className="h-5 w-5" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 border-slate-200/50 dark:border-zinc-800/50 hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-slate-50/50 dark:from-zinc-950 dark:to-zinc-900/50 relative overflow-hidden group">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User/Siswa</div>
                            <div className="text-2xl font-extrabold mt-1 text-emerald-600 dark:text-emerald-500">
                                {isLoading ? <Skeleton className="h-7 w-12" /> : users.filter((u) => u.role === "user" || u.role === "siswa").length}
                            </div>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                            <GraduationCap className="h-5 w-5" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama atau email..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <Select
                        value={limit.toString()}
                        onValueChange={(val) => {
                            setLimit(parseInt(val));
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className="w-[120px] bg-background">
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
            </div>

            {/* Table */}
            <Card className="border-slate-200/80 dark:border-zinc-800/80">
                <CardContent className="p-0 overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <SortableTableHead label="Nama" sortKey="name" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Email" sortKey="email" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Role" sortKey="role" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Telepon" sortKey="phone" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Bergabung" sortKey="created" sortConfig={sortConfig} onSort={requestSort} />
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
                            ) : visibleUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                                        <p className="text-muted-foreground">Tidak ada pengguna ditemukan</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedUsers.map((user) => {
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
                                                {formatCreatedDate(user.created)}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground bg-background/50">
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
                {totalUsers > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t">
                        <div className="text-sm text-muted-foreground">
                            Halaman {page} dari {totalPages}
                        </div>
                        {totalPages > 1 && (
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
                        )}
                    </div>
                )}
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(true); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Pengguna" : "Tambah Pengguna Baru"}</DialogTitle>
                        <DialogDescription>
                            {editingId ? "Perbarui informasi pengguna" : "Buat akun login — pilih dari GTK yang sudah terdaftar"}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Show created password */}
                    {createdPassword && (
                        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold">
                                <ShieldCheck className="h-4 w-4" />
                                Akun berhasil dibuat!
                            </div>
                            <p className="text-xs text-green-600 dark:text-green-400">
                                Password hanya ditampilkan sekali. Catat dan sampaikan ke user.
                            </p>
                            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded border p-2 font-mono text-sm">
                                <span className="flex-1 select-all">{showPw ? createdPassword : "••••••••"}</span>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPw(!showPw)}>
                                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(createdPassword)}>
                                    {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                            <Button variant="outline" size="sm" className="w-full" onClick={resetForm}>
                                Tutup & Buat Baru
                            </Button>
                        </div>
                    )}

                    {!createdPassword && (
                    <div className="grid gap-4 py-4">
                        {/* GTK Dropdown (only for new users) */}
                        {!editingId && (
                            <div className="space-y-2">
                                <Label>Pilih dari GTK</Label>
                                <Select value={selectedGtkId} onValueChange={handleGtkSelect}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="-- Pilih GTK yang belum punya akun --" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {gtkOptions.length === 0 ? (
                                            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                                Semua GTK sudah punya akun
                                            </div>
                                        ) : (
                                            gtkOptions.map((gtk) => (
                                                <SelectItem key={gtk.id} value={gtk.id}>
                                                    {gtk.name} — {gtk.role} {gtk.nip ? `(NIP: ${gtk.nip})` : ""}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Pilih GTK dari direktori, atau isi manual di bawah.
                                </p>
                            </div>
                        )}

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
                                disabled={!!editingId || !!selectedGtkId}
                            />
                            {(editingId || selectedGtkId) && (
                                <p className="text-xs text-muted-foreground">Email tidak dapat diubah</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                placeholder="username (opsional)"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(v) => setFormData({ ...formData, role: v })}
                                disabled={!!selectedGtkId}
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
                            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-400">
                                Password akan dibuat otomatis. Anda bisa isi manual jika ingin.
                            </div>
                        )}
                        {!editingId && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password (opsional — auto-generate jika kosong)</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="Kosongkan untuk auto-generate"
                                    />
                                </div>
                                {formData.password && (
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
                                )}
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
                    )}
                    {!createdPassword && (
                        <DialogFooter>
                            <Button variant="outline" onClick={resetForm}>
                                Batal
                            </Button>
                            <Button onClick={handleSubmit} disabled={isSaving || !formData.name || !formData.email}>
                                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {editingId ? "Simpan" : "Buat Akun"}
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* Generate Dialog */}
            <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Generate Akun Otomatis</DialogTitle>
                        <DialogDescription>
                            Buat akun untuk GTK yang belum punya akun, atau generate akun siswa dari data kelas.
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
                                        Generate akun dari data siswa per kelas.
                                        <br />
                                        <span className="inline-flex items-center gap-1 mt-1 font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded text-xs">
                                            Username = NISN, Password = NISN
                                        </span>
                                    </p>
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
                                        <div className="font-bold text-lg">Akun GTK</div>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Generate akun untuk GTK yang belum punya akun login.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {genType === "staff" && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl space-y-4">
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    Sistem akan membuat akun untuk semua GTK di direktori yang <strong>belum punya akun login</strong>.
                                    Password dibuat acak dan user wajib ganti saat login pertama.
                                </p>
                                {genResult && (
                                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                                        <p className="text-sm font-medium text-green-700 dark:text-green-400">{genResult}</p>
                                    </div>
                                )}
                                <Button 
                                    onClick={handleGenerate} 
                                    disabled={isSaving}
                                    className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                                >
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                    Generate Akun GTK
                                </Button>
                            </div>
                        )}

                        {genType === "student" && (
                            <div className="space-y-4">
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
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsGenerateOpen(false)}>Batal</Button>
                                    <Button onClick={handleGenerateStudent} disabled={isSaving || !selectedClass}>
                                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Generate Akun
                                    </Button>
                                </DialogFooter>
                            </div>
                        )}
                    </div>
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
