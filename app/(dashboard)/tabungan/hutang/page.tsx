"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { RefreshCw, Plus, Trash2, CreditCard, Loader2, ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { goGet, goPost, goDelete } from "@/lib/api-client";

interface Hutang {
    id: string;
    siswaId: string;
    namaBarang: string;
    kategori: string;
    nominal: number;
    jumlah: number;
    status: string;
    tanggalAmbil: string | null;
    catatan: string | null;
    tahunAjaran: string | null;
    siswa?: { id: string; nama: string; nisn: string; kelas: string | null } | null;
    pencatat?: { name: string; email: string } | null;
}

interface Siswa {
    id: string;
    nama: string;
    nisn: string;
    kelasId: string;
    kelas?: { nama: string } | null;
}

const KATEGORI_OPTIONS = [
    { value: "atribut", label: "Atribut" },
    { value: "buku", label: "Buku" },
    { value: "lks", label: "LKS" },
    { value: "seragam", label: "Seragam" },
    { value: "lainnya", label: "Lainnya" },
];

const STATUS_COLORS: Record<string, string> = {
    aktif: "bg-yellow-500",
    lunas: "bg-green-600",
    dibatalkan: "bg-gray-500",
};

const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
};

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

export default function HutangManagementPage() {
    const [activeTab, setActiveTab] = useState("list");
    const [hutangList, setHutangList] = useState<Hutang[]>([]);
    const [siswaList, setSiswaList] = useState<Siswa[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("aktif");
    const [searchQuery, setSearchQuery] = useState("");
    
    // Form state
    const [selectedSiswaId, setSelectedSiswaId] = useState("");
    const [namaBarang, setNamaBarang] = useState("");
    const [kategori, setKategori] = useState("lainnya");
    const [nominal, setNominal] = useState("");
    const [jumlah, setJumlah] = useState("1");
    const [catatan, setCatatan] = useState("");
    const [tahunAjaran, setTahunAjaran] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        return now.getMonth() >= 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
    });
    
    // Batch Form state
    const [batchClassId, setBatchClassId] = useState<string>("all");
    const [batchSiswaIds, setBatchSiswaIds] = useState<string[]>([]);
    const [batchNamaBarang, setBatchNamaBarang] = useState("");
    const [batchKategori, setBatchKategori] = useState("lainnya");
    const [batchNominal, setBatchNominal] = useState("");
    const [batchJumlah, setBatchJumlah] = useState("1");
    const [batchCatatan, setBatchCatatan] = useState("");

    // Dialog state
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; action: "cancel" | "pay_cash" } | null>(null);

    const fetchHutang = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
            
            const data: any = await goGet(`/api/tabungan/hutang?${params}`);
            if (data.success) {
                setHutangList(data.items || []);
            }
        } catch (error) {
            console.error("Failed to fetch hutang:", error);
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter]);

    const fetchSiswa = useCallback(async () => {
        try {
            const data: any = await goGet("/api/tabungan/siswa?perPage=1000");
            if (data.success) {
                setSiswaList(data.items || []);
            }
        } catch (error) {
            console.error("Failed to fetch siswa:", error);
        }
    }, []);

    useEffect(() => {
        fetchHutang();
        fetchSiswa();
    }, [fetchHutang, fetchSiswa]);

    // Batch Logic: Derived classes and filtering
    const classes = Array.from(new Set(siswaList.map(s => JSON.stringify({ id: s.kelasId, nama: s.kelas?.nama }))))
        .map(str => JSON.parse(str))
        .filter(c => c.id && c.nama)
        .sort((a, b) => a.nama.localeCompare(b.nama));

    const batchFilteredSiswa = siswaList.filter(s => {
        if (batchClassId !== "all" && s.kelasId !== batchClassId) return false;
        return true;
    });

    useEffect(() => {
        if (activeTab === "batch") {
            setBatchSiswaIds(batchFilteredSiswa.map(s => s.id));
        }
    }, [batchClassId, activeTab, siswaList.length]);

    const toggleBatchSiswa = (id: string) => {
        setBatchSiswaIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBatchSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (batchSiswaIds.length === 0) {
            toast.error("Pilih minimal satu siswa");
            return;
        }
        if (!batchNamaBarang || !batchNominal) {
            toast.error("Nama barang dan nominal wajib diisi");
            return;
        }

        setIsSubmitting(true);
        try {
            const data: any = await goPost("/api/tabungan/hutang/batch", {
                siswaIds: batchSiswaIds,
                namaBarang: batchNamaBarang,
                kategori: batchKategori,
                nominal: parseInt(batchNominal.replace(/\D/g, "")),
                jumlah: parseInt(batchJumlah),
                catatan: batchCatatan,
                tahunAjaran,
            });
            if (data.success) {
                toast.success(`Berhasil mencatat hutang untuk ${data.count} siswa`);
                // Reset batch form
                setBatchNamaBarang("");
                setBatchNominal("");
                setBatchJumlah("1");
                setBatchCatatan("");
                setBatchKategori("lainnya");
                setBatchClassId("all");
                setBatchSiswaIds([]);
                // Refresh list
                fetchHutang();
                setActiveTab("list");
            } else {
                toast.error(data.error || "Gagal mencatat hutang massal");
            }
        } catch {
            toast.error("Terjadi kesalahan");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSiswaId || !namaBarang || !nominal) {
            toast.error("Lengkapi semua field yang wajib diisi");
            return;
        }

        setIsSubmitting(true);
        try {
            const data: any = await goPost("/api/tabungan/hutang", {
                siswaId: selectedSiswaId,
                namaBarang,
                kategori,
                nominal: parseInt(nominal.replace(/\D/g, "")),
                jumlah: parseInt(jumlah),
                catatan,
                tahunAjaran,
            });
            if (data.success) {
                toast.success("Hutang berhasil dicatat");
                // Reset form
                setSelectedSiswaId("");
                setNamaBarang("");
                setNominal("");
                setJumlah("1");
                setCatatan("");
                setKategori("lainnya");
                // Refresh list
                fetchHutang();
                setActiveTab("list");
            } else {
                toast.error(data.error || "Gagal mencatat hutang");
            }
        } catch {
            toast.error("Terjadi kesalahan");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteDialog) return;
        
        try {
            const data: any = await goDelete(`/api/tabungan/hutang/${deleteDialog.id}?action=${deleteDialog.action}`);
            if (data.success) {
                toast.success(deleteDialog.action === "pay_cash" ? "Hutang dilunasi via cash" : "Hutang dibatalkan");
                fetchHutang();
            } else {
                toast.error(data.error || "Gagal memproses");
            }
        } catch {
            toast.error("Terjadi kesalahan");
        } finally {
            setDeleteDialog(null);
        }
    };

    const filteredHutang = hutangList.filter((h) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            h.siswa?.nama?.toLowerCase().includes(query) ||
            h.namaBarang.toLowerCase().includes(query) ||
            h.siswa?.nisn?.includes(query)
        );
    });

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/tabungan">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Manajemen Hutang Siswa</h1>
                        <p className="text-muted-foreground">
                            Catat dan kelola hutang atribut/buku siswa
                        </p>
                    </div>
                </div>
                <Button variant="outline" onClick={() => fetchHutang()} disabled={isLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="list">Daftar Hutang</TabsTrigger>
                    <TabsTrigger value="create">
                        <Plus className="mr-2 h-4 w-4" />
                        Catat Baru
                    </TabsTrigger>
                    <TabsTrigger value="batch">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Catat Massal
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="list">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Daftar Hutang</CardTitle>
                                    <CardDescription>Semua catatan hutang siswa</CardDescription>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Cari nama/NISN..."
                                            className="pl-9 w-[200px]"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-[150px]">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua</SelectItem>
                                            <SelectItem value="aktif">Aktif</SelectItem>
                                            <SelectItem value="lunas">Lunas</SelectItem>
                                            <SelectItem value="dibatalkan">Dibatalkan</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Siswa</TableHead>
                                        <TableHead>Barang</TableHead>
                                        <TableHead>Kategori</TableHead>
                                        <TableHead className="text-right">Nominal</TableHead>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-24 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredHutang.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                                Tidak ada data hutang
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredHutang.map((h) => (
                                            <TableRow key={h.id}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{h.siswa?.nama || "-"}</span>
                                                        <span className="text-xs text-muted-foreground">{h.siswa?.kelas}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{h.namaBarang}</span>
                                                        {h.jumlah > 1 && (
                                                            <span className="text-xs text-muted-foreground">x{h.jumlah}</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize">
                                                        {h.kategori}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {formatRupiah(h.nominal * h.jumlah)}
                                                </TableCell>
                                                <TableCell>{formatDate(h.tanggalAmbil)}</TableCell>
                                                <TableCell>
                                                    <Badge className={`${STATUS_COLORS[h.status]} capitalize`}>
                                                        {h.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {h.status === "aktif" && (
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setDeleteDialog({ open: true, id: h.id, action: "pay_cash" })}
                                                            >
                                                                <CreditCard className="h-3 w-3 mr-1" />
                                                                Bayar Cash
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setDeleteDialog({ open: true, id: h.id, action: "cancel" })}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="create">
                    <Card>
                        <CardHeader>
                            <CardTitle>Catat Hutang Baru</CardTitle>
                            <CardDescription>
                                Catat pengambilan barang/atribut oleh siswa yang belum dibayar
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="siswa">Siswa *</Label>
                                        <Select value={selectedSiswaId} onValueChange={setSelectedSiswaId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih siswa..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {siswaList.map((s) => (
                                                    <SelectItem key={s.id} value={s.id}>
                                                        {s.nama} ({s.nisn}) - {s.kelas?.nama}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="tahunAjaran">Tahun Ajaran</Label>
                                        <Input
                                            id="tahunAjaran"
                                            value={tahunAjaran}
                                            onChange={(e) => setTahunAjaran(e.target.value)}
                                            placeholder="2025/2026"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="namaBarang">Nama Barang *</Label>
                                        <Input
                                            id="namaBarang"
                                            value={namaBarang}
                                            onChange={(e) => setNamaBarang(e.target.value)}
                                            placeholder="Contoh: Seragam Batik, LKS Tema 5"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="kategori">Kategori</Label>
                                        <Select value={kategori} onValueChange={setKategori}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {KATEGORI_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="nominal">Harga Satuan (Rp) *</Label>
                                        <Input
                                            id="nominal"
                                            value={nominal}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, "");
                                                setNominal(val ? parseInt(val).toLocaleString("id-ID") : "");
                                            }}
                                            placeholder="0"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="jumlah">Jumlah</Label>
                                        <Input
                                            id="jumlah"
                                            type="number"
                                            min="1"
                                            value={jumlah}
                                            onChange={(e) => setJumlah(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="catatan">Catatan</Label>
                                        <Textarea
                                            id="catatan"
                                            value={catatan}
                                            onChange={(e) => setCatatan(e.target.value)}
                                            placeholder="Catatan tambahan (opsional)"
                                            rows={2}
                                        />
                                    </div>
                                </div>

                                {nominal && jumlah && (
                                    <div className="p-4 bg-muted rounded-lg">
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Total Hutang:</span>
                                            <span className="text-xl font-bold">
                                                {formatRupiah(parseInt(nominal.replace(/\D/g, "") || "0") * parseInt(jumlah || "1"))}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-4">
                                    <Button type="button" variant="outline" onClick={() => setActiveTab("list")}>
                                        Batal
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Simpan Hutang
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="batch">
                    <Card>
                        <CardHeader>
                            <CardTitle>Catat Hutang Massal</CardTitle>
                            <CardDescription>
                                Catat hutang untuk satu kelas sekaligus (misal: LKS/Seragam)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleBatchSubmit} className="space-y-8">
                                {/* Step 1: Filter & Detail Barang */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/40 p-6 rounded-lg">
                                    <div className="space-y-2">
                                        <Label>Filter Kelas</Label>
                                        <Select value={batchClassId} onValueChange={setBatchClassId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih kelas..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Semua Kelas</SelectItem>
                                                {classes.map((c: any) => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        {c.nama}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                            Pilih kelas untuk menampilkan daftar siswa
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Tahun Ajaran</Label>
                                        <Input
                                            value={tahunAjaran}
                                            onChange={(e) => setTahunAjaran(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Nama Barang *</Label>
                                        <Input
                                            value={batchNamaBarang}
                                            onChange={(e) => setBatchNamaBarang(e.target.value)}
                                            placeholder="Contoh: LKS Semester 2"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Kategori</Label>
                                        <Select value={batchKategori} onValueChange={setBatchKategori}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {KATEGORI_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Harga Satuan (Rp) *</Label>
                                        <Input
                                            value={batchNominal}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, "");
                                                setBatchNominal(val ? parseInt(val).toLocaleString("id-ID") : "");
                                            }}
                                            placeholder="0"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Jumlah</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={batchJumlah}
                                            onChange={(e) => setBatchJumlah(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Catatan</Label>
                                        <Input
                                            value={batchCatatan}
                                            onChange={(e) => setBatchCatatan(e.target.value)}
                                            placeholder="Opsional"
                                        />
                                    </div>
                                </div>

                                {/* Step 2: Select Students */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-medium">Pilih Siswa ({batchSiswaIds.length} terpilih)</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Uncheck siswa yang membayar cash atau tidak mengambil barang
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setBatchSiswaIds(batchFilteredSiswa.map(s => s.id))}
                                            >
                                                Pilih Semua
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setBatchSiswaIds([])}
                                            >
                                                Hapus Semua
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[50px]">
                                                        <div className="flex items-center justify-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={batchSiswaIds.length === batchFilteredSiswa.length && batchFilteredSiswa.length > 0}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setBatchSiswaIds(batchFilteredSiswa.map(s => s.id));
                                                                    } else {
                                                                        setBatchSiswaIds([]);
                                                                    }
                                                                }}
                                                                className="h-4 w-4 rounded border-gray-300"
                                                            />
                                                        </div>
                                                    </TableHead>
                                                    <TableHead>Nama Siswa</TableHead>
                                                    <TableHead>NISN</TableHead>
                                                    <TableHead>Kelas</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {batchFilteredSiswa.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                            Tidak ada siswa di kelas yang dipilih
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    batchFilteredSiswa.map((student) => (
                                                        <TableRow 
                                                            key={student.id} 
                                                            className="cursor-pointer hover:bg-muted/50"
                                                            onClick={() => toggleBatchSiswa(student.id)}
                                                        >
                                                            <TableCell className="text-center">
                                                                <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={batchSiswaIds.includes(student.id)}
                                                                        onChange={() => toggleBatchSiswa(student.id)}
                                                                        className="h-4 w-4 rounded border-gray-300"
                                                                    />
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="font-medium">{student.nama}</TableCell>
                                                            <TableCell>{student.nisn}</TableCell>
                                                            <TableCell>{student.kelas?.nama}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                {/* Summary & Submit */}
                                {batchNominal && batchSiswaIds.length > 0 && (
                                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Total Estimasi Piutang:</p>
                                            <p className="text-2xl font-bold text-primary">
                                                {formatRupiah(
                                                    parseInt(batchNominal.replace(/\D/g, "") || "0") * 
                                                    parseInt(batchJumlah || "1") * 
                                                    batchSiswaIds.length
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex gap-4">
                                            <Button type="button" variant="outline" onClick={() => setActiveTab("list")}>
                                                Batal
                                            </Button>
                                            <Button type="submit" disabled={isSubmitting}>
                                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Simpan {batchSiswaIds.length} Data Hutang
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {deleteDialog?.action === "pay_cash" ? "Lunasi Hutang via Cash?" : "Batalkan Hutang?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteDialog?.action === "pay_cash"
                                ? "Hutang akan ditandai lunas karena dibayar tunai (bukan dari tabungan)."
                                : "Hutang akan dibatalkan dan tidak akan dipotong dari tabungan."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>
                            {deleteDialog?.action === "pay_cash" ? "Ya, Lunasi" : "Ya, Batalkan"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

