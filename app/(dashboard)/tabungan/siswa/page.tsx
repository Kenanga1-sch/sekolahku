"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import {
    getSiswa,
    createSiswa,
    updateSiswa,
    deleteSiswa,
    getAllKelas,
    createKelas,
} from "@/lib/tabungan";
import { showSuccess, showError } from "@/lib/toast";
import type { TabunganSiswa, TabunganKelas, TabunganSiswaFormData } from "@/types/tabungan";

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

export default function TabunganSiswaPage() {
    const [siswa, setSiswa] = useState<TabunganSiswa[]>([]);
    const [kelasList, setKelasList] = useState<TabunganKelas[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [kelasFilter, setKelasFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Form state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<TabunganSiswaFormData>({
        nisn: "",
        nama: "",
        kelas_id: "",
    });

    // Kelas form
    const [isKelasDialogOpen, setIsKelasDialogOpen] = useState(false);
    const [newKelasNama, setNewKelasNama] = useState("");

    const fetchData = useCallback(async () => {
        try {
            // Build filter
            const filters: string[] = ["is_active = true"];
            if (searchQuery) {
                filters.push(`(nama ~ "${searchQuery}" || nisn ~ "${searchQuery}")`);
            }
            if (kelasFilter !== "all") {
                filters.push(`kelas_id = "${kelasFilter}"`);
            }
            const filter = filters.join(" && ");

            const [siswaResult, kelasResult] = await Promise.all([
                getSiswa(page, 20, filter),
                getAllKelas(),
            ]);

            setSiswa(siswaResult.items);
            setTotalPages(siswaResult.totalPages);
            setKelasList(kelasResult);
        } catch (error) {
            console.error("Failed to fetch data:", error);
            showError("Gagal memuat data");
        } finally {
            setIsLoading(false);
        }
    }, [page, searchQuery, kelasFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSubmit = async () => {
        if (!formData.nisn || !formData.nama || !formData.kelas_id) {
            showError("Lengkapi semua field");
            return;
        }

        setIsSaving(true);
        try {
            if (editingId) {
                await updateSiswa(editingId, formData);
                showSuccess("Data siswa berhasil diperbarui");
            } else {
                await createSiswa(formData);
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

    const handleEdit = (item: TabunganSiswa) => {
        setEditingId(item.id);
        setFormData({
            nisn: item.nisn,
            nama: item.nama,
            kelas_id: item.kelas_id,
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteSiswa(deleteId);
            showSuccess("Siswa berhasil dihapus");
            setDeleteId(null);
            fetchData();
        } catch (error) {
            console.error("Failed to delete:", error);
            showError("Gagal menghapus siswa");
        }
    };

    const handleCreateKelas = async () => {
        if (!newKelasNama) return;
        try {
            await createKelas({ nama: newKelasNama });
            showSuccess("Kelas berhasil ditambahkan");
            setNewKelasNama("");
            setIsKelasDialogOpen(false);
            fetchData();
        } catch (error) {
            console.error("Failed to create kelas:", error);
            showError("Gagal menambahkan kelas");
        }
    };

    const resetForm = () => {
        setFormData({ nisn: "", nama: "", kelas_id: "" });
        setEditingId(null);
        setIsDialogOpen(false);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Data Siswa</h1>
                    <p className="text-muted-foreground">Kelola data siswa dan saldo tabungan</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsKelasDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Tambah Kelas
                    </Button>
                    <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Tambah Siswa
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
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>NISN</TableHead>
                                <TableHead>Nama</TableHead>
                                <TableHead>Kelas</TableHead>
                                <TableHead className="text-right">Saldo</TableHead>
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
                                siswa.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-mono">{s.nisn}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{s.nama}</span>
                                                <QrCode className="h-3 w-3 text-muted-foreground" />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{s.expand?.kelas_id?.nama || "-"}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Wallet className="h-3 w-3 text-green-600" />
                                                <span className="font-medium text-green-600">
                                                    {formatRupiah(s.saldo_terakhir)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
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
                                value={formData.kelas_id}
                                onValueChange={(v) => setFormData({ ...formData, kelas_id: v })}
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

            {/* Kelas Form Dialog */}
            <Dialog open={isKelasDialogOpen} onOpenChange={setIsKelasDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tambah Kelas</DialogTitle>
                        <DialogDescription>Buat kelas baru untuk siswa</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="space-y-2">
                            <Label htmlFor="kelasNama">Nama Kelas</Label>
                            <Input
                                id="kelasNama"
                                placeholder="Contoh: 1A, 2B, 3C"
                                value={newKelasNama}
                                onChange={(e) => setNewKelasNama(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsKelasDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleCreateKelas} disabled={!newKelasNama}>Tambah</Button>
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
