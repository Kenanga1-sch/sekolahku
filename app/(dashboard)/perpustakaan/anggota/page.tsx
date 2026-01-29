"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    Users,
    Plus,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    QrCode,
    IdCard,
    ArrowLeft,
    Printer,
    Download,
    FileSpreadsheet,
    CreditCard,
    School,
    Upload,
    RefreshCw 
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    DropdownMenuLabel,
    DropdownMenuSeparator,
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

import type { LibraryMember } from "@/types/library";

// --- Components ---

// ID Card Preview Component
const MemberCardPreview = ({ member }: { member: LibraryMember }) => {
    return (
        <div className="w-[350px] h-[220px] bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200 relative print:shadow-none print:border-black">
            {/* Header Pattern */}
            <div className="absolute top-0 w-full h-24 bg-gradient-to-r from-blue-600 to-indigo-700">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] bg-[length:10px_10px]"></div>
            </div>
            
            <div className="relative z-10 p-5 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                        <School className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="text-right text-white">
                        <h3 className="font-bold text-sm">PERPUSTAKAAN</h3>
                        <p className="text-[10px] opacity-90">SD Negeri 1 Kenanga</p>
                    </div>
                </div>

                <div className="flex gap-4 items-end mt-auto">
                    <div className="bg-white p-1 rounded-lg">
                        {/* Mock QR if real one not renderable easily here without lib, but text serves purpose */}
                        <div className="h-20 w-20 bg-slate-900 text-white text-[8px] flex items-center justify-center text-center p-1">
                            {member.qrCode}
                        </div>
                    </div>
                    <div className="mb-1">
                        <h2 className="font-bold text-lg text-slate-800 leading-tight">{member.name}</h2>
                        <div className="flex items-center gap-2 text-slate-500 text-xs mt-1">
                            {member.className && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                    {member.className}
                                </span>
                            )}
                            <span>{member.studentId || "No ID"}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Footer Strip */}
            <div className="absolute bottom-0 w-full h-1.5 bg-yellow-400"></div>
        </div>
    );
};

export default function AnggotaPage() {
    // Data State
    const [members, setMembers] = useState<LibraryMember[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    
    // Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // UI State
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<LibraryMember | null>(null);
    const [memberToDelete, setMemberToDelete] = useState<LibraryMember | null>(null);
    const [memberToPrint, setMemberToPrint] = useState<LibraryMember | null>(null);
    const [memberQR, setMemberQR] = useState<LibraryMember | null>(null);

    // Import/Export UI State
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false); // Sync state
    
    // Form state
    const [formData, setFormData] = useState({
        name: "",
        className: "",
        studentId: "",
        maxBorrowLimit: "3",
    });

    // --- Actions ---

    const loadMembers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                perPage: "20",
            });
            if (searchQuery) params.append("search", searchQuery);
            
            const res = await fetch(`/api/library/members?${params}`);
            if (!res.ok) throw new Error("Failed to fetch");
            
            const result = await res.json();
            setMembers(result.items);
            setTotalPages(result.totalPages);
            setTotalItems(result.totalItems);
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
                className: formData.className || undefined,
                studentId: formData.studentId || undefined,
                maxBorrowLimit: parseInt(formData.maxBorrowLimit) || 3,
            };

            let res;
            if (editingMember) {
                res = await fetch(`/api/library/members/${editingMember.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
            } else {
                res = await fetch("/api/library/members", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
            }

            if (!res.ok) throw new Error("Failed to save");

            setIsAddDialogOpen(false);
            setEditingMember(null);
            resetForm();
            loadMembers();
            toast.success(editingMember ? "Data anggota diperbarui" : "Anggota baru ditambahkan");
        } catch (error) {
            console.error("Failed to save member:", error);
            toast.error("Gagal menyimpan data");
        }
    };

    const handleDelete = async () => {
        if (!memberToDelete) return;
        try {
            const res = await fetch(`/api/library/members/${memberToDelete.id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete");
            
            loadMembers();
            setMemberToDelete(null);
            toast.success("Anggota berhasil dihapus");
        } catch (error) {
            console.error(error);
            toast.error("Gagal menghapus anggota");
        }
    };

    const handleExport = async () => {
        try {
            toast.message("Mempersiapkan data export...");
            // Fetch all members (limit high enough to get all)
            const res = await fetch(`/api/library/members?perPage=2000`);
            const result = await res.json();
            const items = result.items as LibraryMember[];

            // Convert to CSV
            const headers = ["Nama Lengkap,Kelas,NIS,Batas Pinjam,QR Code"];
            const rows = items.map(m => 
                `"${m.name}","${m.className || ""}","${m.studentId || ""}","${m.maxBorrowLimit}","${m.qrCode}"`
            );
            const csvContent = [headers, ...rows].join("\n");

            // Download
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `anggota_perpustakaan_${new Date().toISOString().split("T")[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Export berhasil!");
        } catch (error) {
            console.error(error);
            toast.error("Gagal export data");
        }
    };

    const handleImport = async () => {
        if (!importFile) return;
        setImporting(true);
        setImportProgress(0);

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            const lines = text.split("\n");
            // Skip header if present (assuming row 0 is header "Nama,Kelas...")
            const startIdx = lines[0].toLowerCase().includes("nama") ? 1 : 0;
            
            const total = lines.length - startIdx;
            let successCount = 0;

            for (let i = startIdx; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Simple CSV parse (handling quotes roughly)
                const cleanLine = line.replace(/"/g, ""); 
                const cols = cleanLine.split(",");
                
                if (cols.length < 1) continue;

                const data = {
                    name: cols[0]?.trim(),
                    className: cols[1]?.trim() || undefined,
                    studentId: cols[2]?.trim() || undefined,
                    maxBorrowLimit: parseInt(cols[3]) || 3,
                };

                if (!data.name) continue;

                try {
                    await fetch("/api/library/members", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(data),
                    });
                    successCount++;
                } catch (err) {
                    console.error("Failed import row", i);
                }
                
                setImportProgress(Math.round(((i - startIdx + 1) / total) * 100));
            }

            setImporting(false);
            setIsImportDialogOpen(false);
            setImportFile(null);
            loadMembers();
            toast.success(`${successCount} anggota berhasil diimport`);
        };
        reader.readAsText(importFile);
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            toast.message("Mulai sinkronisasi data siswa...");
            const res = await fetch("/api/sync/library", { method: "POST" });
            const result = await res.json();
            
            if (!res.ok) throw new Error(result.details || result.error || "Sync failed");
            
            toast.success(result.message);
            loadMembers();
        } catch (error) {
            console.error("Sync error:", error);
            toast.error(error instanceof Error ? error.message : "Gagal sinkronisasi data");
        } finally {
            setIsSyncing(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: "", className: "", studentId: "", maxBorrowLimit: "3" });
    };

    const openEditDialog = (member: LibraryMember) => {
        setEditingMember(member);
        setFormData({
            name: member.name,
            className: member.className || "",
            studentId: member.studentId || "",
            maxBorrowLimit: member.maxBorrowLimit?.toString() || "3",
        });
        setIsAddDialogOpen(true);
    };

    // --- Render ---

    return (
        <div className="space-y-6 pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/perpustakaan">
                        <Button variant="outline" size="icon" className="h-10 w-10 border-border bg-background shadow-sm hover:bg-muted transition-all rounded-xl">
                            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                        </Button>
                    </Link>
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl hidden sm:block">
                        <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Anggota Perpustakaan</h1>
                        <p className="text-muted-foreground text-sm">
                            Manajemen data anggota, kartu pelajar, dan hak akses.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        onClick={handleSync} 
                        disabled={isSyncing}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                        Sinkronisasi
                    </Button>
                    <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="hidden sm:flex gap-2">
                        <Upload className="h-4 w-4" />
                        Import
                    </Button>
                    <Button variant="outline" onClick={handleExport} className="hidden sm:flex gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Export
                    </Button>
                    <Button variant="outline" onClick={handleExport} className="hidden sm:flex gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Import Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import Data Anggota</DialogTitle>
                        <DialogDescription>
                            Upload file CSV dengan format: <code>Nama, Kelas, NIS, Batas Pinjam</code>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                         <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="csv">File CSV</Label>
                            <Input id="csv" type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                        </div>
                        {importing && (
                             <div className="w-full bg-slate-100 rounded-full h-2.5">
                                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${importProgress}%` }}></div>
                                <p className="text-xs text-center mt-1 text-muted-foreground">{importProgress}%</p>
                            </div>
                        )}
                        <div className="text-xs text-muted-foreground bg-slate-50 p-2 rounded border">
                            Contoh isi file csv:<br/>
                            <code>Budi Santoso, 5A, 12345, 3</code><br/>
                            <code>Siti Aminah, 6B, 12346, 5</code>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsImportDialogOpen(false)} disabled={importing}>Batal</Button>
                        <Button onClick={handleImport} disabled={!importFile || importing}>
                            {importing ? "Mengimport..." : "Mulai Import"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Stats Cards (Simple) */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Anggota</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalItems}</div>
                        <p className="text-xs text-muted-foreground">Siswa & Guru terdaftar</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Buku Dipinjam</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">-</div>
                        <p className="text-xs text-muted-foreground">Sedang dipinjam oleh anggota</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Akses Kiosk</CardTitle>
                        <QrCode className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Aktif</div>
                        <p className="text-xs text-muted-foreground">Support QR Code Scan</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-xl border shadow-sm">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama, kelas, atau NIS..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-background border-input"
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Add filters here later if needed */}
                </div>
            </div>

            {/* Data Table */}
            <Card className="overflow-hidden border-border shadow-sm">
                <div className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="font-semibold text-muted-foreground">Nama Anggota</TableHead>
                                <TableHead className="font-semibold text-muted-foreground">Kelas / Posisi</TableHead>
                                <TableHead className="font-semibold text-muted-foreground">NIS / ID</TableHead>
                                <TableHead className="font-semibold text-muted-foreground text-center">Limit Pinjam</TableHead>
                                <TableHead className="font-semibold text-muted-foreground">Kode QR</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        Memuat data anggota...
                                    </TableCell>
                                </TableRow>
                            ) : members.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Users className="h-8 w-8 opacity-20" />
                                            <p>Belum ada data anggota.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                members.map((member) => (
                                    <TableRow key={member.id} className="hover:bg-muted/50">
                                        <TableCell>
                                            <div className="font-medium text-foreground">{member.name}</div>
                                            <div className="text-xs text-muted-foreground hidden sm:block md:hidden">
                                                {member.studentId}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {member.className ? (
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                                                    {member.className}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground font-mono text-xs">
                                            {member.studentId || "-"}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                                                {member.maxBorrowLimit} Buku
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors" onClick={() => setMemberQR(member)}>
                                                <QrCode className="h-4 w-4 text-muted-foreground" />
                                                <code className="text-xs text-muted-foreground hover:text-primary transition-colors">
                                                    {member.qrCode.substring(0, 8)}...
                                                </code>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                                                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => openEditDialog(member)}>
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        Edit Data
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setMemberToPrint(member)}>
                                                        <IdCard className="h-4 w-4 mr-2 text-primary" />
                                                        Cetak Kartu
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setMemberQR(member)}>
                                                        <QrCode className="h-4 w-4 mr-2" />
                                                        Lihat QR Code
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem 
                                                        onClick={() => setMemberToDelete(member)}
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10"
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Hapus Anggota
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                    >
                        Sebelumnya
                    </Button>
                    <span className="text-sm font-medium text-slate-600 mx-2">
                        {page} / {totalPages}
                    </span>
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

            {/* --- DIALOGS --- */}

            {/* Add/Edit Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                setIsAddDialogOpen(open);
                if (!open) {
                    setEditingMember(null);
                    resetForm();
                }
            }}>
                <DialogContent className="max-w-md">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>
                                {editingMember ? "Edit Anggota" : "Tambah Anggota Baru"}
                            </DialogTitle>
                            <DialogDescription>
                                Masukkan informasi lengkap anggota perpustakaan.
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
                                    placeholder="Contoh: Budi Santoso"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="className">Kelas / Jabatan</Label>
                                    <Input
                                        id="className"
                                        value={formData.className}
                                        onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                                        placeholder="Contoh: 5A / Guru"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="studentId">NIS / NIP</Label>
                                    <Input
                                        id="studentId"
                                        value={formData.studentId}
                                        onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                                        placeholder="Nomor Induk"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="maxBorrowLimit">Batas Peminjaman</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="maxBorrowLimit"
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={formData.maxBorrowLimit}
                                        onChange={(e) => setFormData({ ...formData, maxBorrowLimit: e.target.value })}
                                        className="w-20"
                                    />
                                    <span className="text-sm text-muted-foreground">Buku sekaligus</span>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsAddDialogOpen(false)}>Batal</Button>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                                {editingMember ? "Simpan Perubahan" : "Simpan Anggota"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Alert */}
            <AlertDialog open={!!memberToDelete} onOpenChange={(open) => !open && setMemberToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Anggota?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Anda akan menghapus anggota <strong>{memberToDelete?.name}</strong>.
                            Tindakan ini tidak dapat dibatalkan dan akan menghapus riwayat peminjaman terkait.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Hapus Permanen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* QR Code View */}
            <Dialog open={!!memberQR} onOpenChange={(open) => !open && setMemberQR(null)}>
                <DialogContent className="max-w-sm text-center">
                    <DialogHeader>
                        <DialogTitle>QR Code Anggota</DialogTitle>
                        <DialogDescription>{memberQR?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center py-6">
                        <div className="bg-white p-4 rounded-xl border-2 border-slate-900 shadow-sm">
                            {/* In a real app, use a QRCode library here. For now, we simulate visual */}
                            <div className="h-48 w-48 bg-slate-100 flex items-center justify-center text-slate-500 text-xs text-center p-4">
                                [QR CODE: {memberQR?.qrCode}]
                                <br/>
                                (Install library like 'react-qr-code' to render actual QR)
                            </div>
                        </div>
                    </div>
                    <div className="text-center text-xs text-muted-foreground font-mono">
                        {memberQR?.qrCode}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Print Card Preview */}
            <Dialog open={!!memberToPrint} onOpenChange={(open) => !open && setMemberToPrint(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Cetak Kartu Anggota</DialogTitle>
                        <DialogDescription>Preview desain kartu untuk {memberToPrint?.name}</DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex flex-col items-center justify-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        {memberToPrint && <MemberCardPreview member={memberToPrint} />}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setMemberToPrint(null)}>
                            Tutup
                        </Button>
                        <Button className="gap-2" onClick={() => window.print()}>
                            <Printer className="h-4 w-4" />
                            Cetak Sekarang
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
