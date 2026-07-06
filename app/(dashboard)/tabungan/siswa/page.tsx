// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    Users,
    Loader2,
    QrCode,
    Wallet,
    ArrowLeft,
    RefreshCw, // Added RefreshCw icon
} from "lucide-react";
import Link from "next/link";
import { showSuccess, showError } from "@/lib/toast";
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import type { TabunganSiswaWithRelations, TabunganKelasWithRelations, TabunganSiswaFormData } from "@/types/tabungan";
import { useSortableData } from "@/hooks/use-sortable-data";
import { SortableTableHead } from "@/components/ui/sortable-table-head";

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

export default function TabunganSiswaPage() {
    const [siswa, setSiswa] = useState<TabunganSiswaWithRelations[]>([]);
    const [kelasList, setKelasList] = useState<TabunganKelasWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [kelasFilter, setKelasFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(1);

    // Form state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<TabunganSiswaFormData>({
        nisn: "",
        nama: "",
        kelasId: "", // Restore kelasId
    });
    
    // Sync state
    const [isSyncing, setIsSyncing] = useState(false);
    const { sortedData: sortedSiswa, sortConfig, requestSort } = useSortableData(siswa);



    const fetchData = useCallback(async () => {
        try {
            // Build query params
            const params = new URLSearchParams({
                page: page.toString(),
                perPage: perPage.toString(),
            });
            
            if (searchQuery) params.set("search", searchQuery);
            if (kelasFilter !== "all") params.set("kelasId", kelasFilter);

            const [siswaRes, kelasRes] = await Promise.all([
                goGet(`/api/tabungan/siswa?${params.toString()}`),
                goGet("/api/tabungan/kelas"),
            ]);

            if (siswaRes.error) throw new Error(siswaRes.error);
            if (kelasRes.error) throw new Error(kelasRes.error);

            setSiswa(siswaRes.items || siswaRes.data || []);
            setTotalPages(siswaRes.totalPages || siswaRes.pagination?.totalPages || 1);
            setKelasList(Array.isArray(kelasRes) ? kelasRes : kelasRes.items || kelasRes.data || []);
        } catch (error) {
            console.error("Failed to fetch data:", error);
            showError("Gagal memuat data");
        } finally {
            setIsLoading(false);
        }
    }, [page, perPage, searchQuery, kelasFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSubmit = async () => {
        if (!formData.nisn || !formData.nama || !formData.kelasId) {
            showError("Lengkapi semua field");
            return;
        }

        setIsSaving(true);
        try {
            if (editingId) {
                await goPut(`/api/tabungan/siswa/${editingId}`, formData);
                showSuccess("Data siswa berhasil diperbarui");
            } else {
                await goPost("/api/tabungan/siswa", formData);
                showSuccess("Siswa baru berhasil ditambahkan");
            }
            resetForm();
            fetchData();
        } catch (error) {
            console.error("Failed to save:", error);
            showError("Gagal menyimpan data");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (item: TabunganSiswaWithRelations) => {
        setEditingId(item.id);
        setFormData({
            nisn: item.nisn,
            nama: item.nama,
            kelasId: item.kelasId,
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await goDelete(`/api/tabungan/siswa/${deleteId}`);
            
            showSuccess("Siswa berhasil dihapus");
            setDeleteId(null);
            fetchData();
        } catch (error) {
            console.error("Failed to delete:", error);
            showError("Gagal menghapus siswa");
        }
    };



    const handleSync = async () => {
        setIsSyncing(true);
        try {
            showSuccess("Mulai sinkronisasi data siswa..."); 
            const result: any = await goPost("/api/sync/savings");
            
            if (!res.ok) throw new Error(result.details || result.error || "Sync failed");
            
            showSuccess(result.message);
            fetchData();
        } catch (error) {
            console.error("Sync error:", error);
            showError(error instanceof Error ? error.message : "Gagal sinkronisasi data");
        } finally {
            setIsSyncing(false);
        }
    };

    const resetForm = () => {
        setFormData({ nisn: "", nama: "", kelasId: "" });
        setEditingId(null);
        setIsDialogOpen(false);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/tabungan">
                        <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200 bg-white shadow-sm hover:bg-slate-50">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Data Siswa</h1>
                        <p className="text-muted-foreground">Kelola data siswa dan saldo tabungan</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                        Sinkronisasi
                    </Button>

                </div>
            </div>



            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nama atau NISN..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                            />
                        </div>
                        <Select value={kelasFilter} onValueChange={(v) => { setKelasFilter(v); setPage(1); }}>
                            <SelectTrigger className="w-full md:w-48">
                                <SelectValue placeholder="Filter Kelas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Kelas</SelectItem>
                                {kelasList.map((k) => (
                                    <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
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
                            <SelectTrigger className="w-full md:w-[120px]">
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
                                <SortableTableHead label="NISN" sortKey="nisn" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Nama" sortKey="nama" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Kelas" sortKey="kelas.nama" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableTableHead label="Saldo" sortKey="saldoTerakhir" sortConfig={sortConfig} onSort={requestSort} className="text-right" />
                                <TableHead className="w-12"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                                    </TableRow>
                                ))
                            ) : siswa.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">
                                        <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                                        <p className="text-muted-foreground">Belum ada data siswa</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedSiswa.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-mono">{s.nisn}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{s.nama}</span>
                                                <QrCode className="h-3 w-3 text-muted-foreground" />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{s.kelas?.nama || "-"}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Wallet className="h-3 w-3 text-green-600" />
                                                <span className="font-medium text-green-600">
                                                    {formatRupiah(s.saldoTerakhir)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="icon-sm" className="h-8 w-8 border-slate-200 bg-white shadow-sm hover:bg-slate-50 text-muted-foreground hover:text-foreground">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEdit(s)}>
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => setDeleteId(s.id)}
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

                    {/* Pagination */}
                    {siswa.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 dark:border-zinc-800">
                            <div className="text-sm text-muted-foreground">
                                Halaman {page} dari {totalPages}
                            </div>
                            {totalPages > 1 && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => p - 1)}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page >= totalPages}
                                        onClick={() => setPage((p) => p + 1)}
                                    >
                                        Selanjutnya
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Siswa Form Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Siswa" : "Tambah Siswa"}</DialogTitle>
                        <DialogDescription>
                            {editingId ? "Perbarui data siswa" : "Tambahkan siswa baru ke sistem tabungan"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="nisn">NISN</Label>
                            <Input
                                id="nisn"
                                placeholder="10 digit NISN"
                                value={formData.nisn}
                                onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                                maxLength={10}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nama">Nama Lengkap</Label>
                            <Input
                                id="nama"
                                placeholder="Nama siswa"
                                value={formData.nama}
                                onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="kelas">Kelas</Label>
                            <Select
                                value={formData.kelasId}
                                onValueChange={(v) => setFormData({ ...formData, kelasId: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih kelas" />
                                </SelectTrigger>
                                <SelectContent>
                                    {kelasList.map((k) => (
                                        <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={resetForm}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={isSaving}>
                            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {editingId ? "Simpan" : "Tambah"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>



            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Siswa?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Siswa akan dinonaktifkan dari sistem. Data transaksi tetap tersimpan.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

