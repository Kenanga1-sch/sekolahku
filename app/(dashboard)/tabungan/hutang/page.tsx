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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, Plus, Trash2, CreditCard, Loader2, ArrowLeft, Search, ChevronDown, ChevronUp, History, Coins, Ban } from "lucide-react";
import Link from "next/link";
import { goGet, goPost, goDelete } from "@/lib/api-client";

interface Hutang {
    id: string;
    siswaId: string;
    namaBarang: string;
    kategori: string;
    nominal: number;
    jumlah: number;
    terbayar: number;
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
    saldoTerakhir?: number;
}

interface PaymentHistoryItem {
    id: string;
    hutangId: string;
    nominal: number;
    metode: "cash" | "tabungan";
    transaksiId?: string | null;
    dicatatOleh: string;
    createdAt: number;
}

const KATEGORI_OPTIONS = [
    { value: "atribut", label: "Atribut" },
    { value: "buku", label: "Buku" },
    { value: "lks", label: "LKS" },
    { value: "seragam", label: "Seragam" },
    { value: "lainnya", label: "Lainnya" },
];

const STATUS_COLORS: Record<string, string> = {
    aktif: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/50",
    cicilan: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50",
    lunas: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/50",
    batal: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-900/50",
};

const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
};

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

const formatDateTime = (timestamp: number) => {
    // If timestamp is in milliseconds vs seconds
    const date = new Date(timestamp > 9999999999 ? timestamp : timestamp * 1000);
    return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
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

    // Payment Dialog state
    const [payDialog, setPayDialog] = useState<{ open: boolean; hutang: Hutang } | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<"cash" | "tabungan">("cash");
    const [payAmount, setPayAmount] = useState("");
    const [isPaying, setIsPaying] = useState(false);

    // Cancel Dialog state
    const [cancelDialog, setCancelDialog] = useState<{ open: boolean; hutangId: string; studentName: string; itemName: string } | null>(null);

    // Expanded rows state for payment history
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [paymentsCache, setPaymentsCache] = useState<Record<string, PaymentHistoryItem[]>>({});
    const [loadingPayments, setLoadingPayments] = useState<Record<string, boolean>>({});

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

    const handlePayHutang = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payDialog) return;

        const amount = parseInt(payAmount.replace(/\D/g, ""));
        const remaining = (payDialog.hutang.nominal * payDialog.hutang.jumlah) - payDialog.hutang.terbayar;

        if (!amount || amount <= 0) {
            toast.error("Nominal pembayaran harus lebih dari 0");
            return;
        }

        if (amount > remaining) {
            toast.error(`Nominal pembayaran tidak boleh melebihi sisa hutang (${formatRupiah(remaining)})`);
            return;
        }

        if (paymentMethod === "tabungan") {
            const balance = getStudentSavingsBalance(payDialog.hutang.siswaId);
            if (amount > balance) {
                toast.error(`Saldo tabungan tidak mencukupi (${formatRupiah(balance)})`);
                return;
            }
        }

        setIsPaying(true);
        try {
            const endpoint = paymentMethod === "cash" 
                ? `/api/tabungan/hutang/${payDialog.hutang.id}/pay-cash`
                : `/api/tabungan/hutang/${payDialog.hutang.id}/settle-savings`;

            const data: any = await goPost(endpoint, { amount });
            if (data.success) {
                toast.success(paymentMethod === "cash" ? "Berhasil membayar cicilan tunai" : "Berhasil memotong saldo tabungan");
                
                // Clear payments cache for this item to force refetch when expanded
                setPaymentsCache(prev => {
                    const next = { ...prev };
                    delete next[payDialog.hutang.id];
                    return next;
                });
                
                setPayDialog(null);
                fetchHutang();
                fetchSiswa(); // refresh balance
            } else {
                toast.error(data.error || "Gagal memproses pembayaran");
            }
        } catch (error) {
            toast.error("Terjadi kesalahan saat memproses pembayaran");
        } finally {
            setIsPaying(false);
        }
    };

    const handleCancelHutang = async () => {
        if (!cancelDialog) return;

        setIsSubmitting(true);
        try {
            const data: any = await goDelete(`/api/tabungan/hutang/${cancelDialog.hutangId}`);
            if (data.success) {
                toast.success("Hutang berhasil dibatalkan dan nominal terbayar di-refund");
                setCancelDialog(null);
                fetchHutang();
                fetchSiswa(); // refresh balance in case of refund
            } else {
                toast.error(data.error || "Gagal memproses");
            }
        } catch {
            toast.error("Terjadi kesalahan");
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleRow = async (hutangId: string) => {
        const isExpanded = !expandedRows[hutangId];
        setExpandedRows(prev => ({ ...prev, [hutangId]: isExpanded }));

        if (isExpanded && !paymentsCache[hutangId]) {
            setLoadingPayments(prev => ({ ...prev, [hutangId]: true }));
            try {
                const data = await goGet(`/api/tabungan/hutang/${hutangId}/payments`);
                if (Array.isArray(data)) {
                    setPaymentsCache(prev => ({ ...prev, [hutangId]: data }));
                } else {
                    setPaymentsCache(prev => ({ ...prev, [hutangId]: [] }));
                }
            } catch (error) {
                console.error("Failed to fetch payments:", error);
                toast.error("Gagal mengambil riwayat pembayaran");
            } finally {
                setLoadingPayments(prev => ({ ...prev, [hutangId]: false }));
            }
        }
    };

    const getStudentSavingsBalance = (siswaId: string): number => {
        const siswa = siswaList.find(s => s.id === siswaId);
        return siswa?.saldoTerakhir ?? 0;
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

    // Dynamic Stats Calculations
    const stats = {
        totalPiutangAktif: hutangList.reduce((acc, h) => {
            if (h.status === "aktif" || h.status === "cicilan") {
                return acc + ((h.nominal * h.jumlah) - h.terbayar);
            }
            return acc;
        }, 0),
        totalTerbayar: hutangList.reduce((acc, h) => acc + h.terbayar, 0),
        belumLunasCount: hutangList.filter(h => h.status === "aktif" || h.status === "cicilan").length
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild className="border-slate-200 bg-white shadow-sm hover:bg-slate-50">
                        <Link href="/tabungan">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Manajemen Hutang & Cicilan Siswa</h1>
                        <p className="text-muted-foreground">
                            Pencatatan komprehensif piutang atribut sekolah dan fasilitas pembayaran cicilan siswa
                        </p>
                    </div>
                </div>
                <Button variant="outline" onClick={() => fetchHutang()} disabled={isLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Dynamic Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white shadow-md relative overflow-hidden border-0">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-400 font-medium">Total Sisa Piutang Aktif</CardDescription>
                        <CardTitle className="text-3xl font-bold tracking-tight font-mono">{formatRupiah(stats.totalPiutangAktif)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-slate-400">
                            Dari total {stats.belumLunasCount} catatan hutang belum lunas
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium">Total Piutang Terbayar</CardDescription>
                        <CardTitle className="text-3xl font-bold tracking-tight text-emerald-600 font-mono">{formatRupiah(stats.totalTerbayar)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">
                            Akumulasi seluruh cicilan dan pelunasan terkumpul
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium">Jumlah Hutang Aktif</CardDescription>
                        <CardTitle className="text-3xl font-bold tracking-tight text-amber-600 font-mono">{stats.belumLunasCount}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">
                            Siswa aktif dengan kewajiban pembayaran tertunggak
                        </div>
                    </CardContent>
                </Card>
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
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <CardTitle>Catatan Piutang Siswa</CardTitle>
                                    <CardDescription>Gunakan tabel di bawah untuk melihat sisa tagihan, riwayat cicilan, dan melakukan pembayaran.</CardDescription>
                                </div>
                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <div className="relative w-full sm:w-[220px]">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Cari nama/NISN..."
                                            className="pl-9 w-full"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-full sm:w-[150px]">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua Status</SelectItem>
                                            <SelectItem value="aktif">Belum Dibayar (Aktif)</SelectItem>
                                            <SelectItem value="cicilan">Cicilan Parsial</SelectItem>
                                            <SelectItem value="lunas">Lunas</SelectItem>
                                            <SelectItem value="batal">Batal / Dihapus</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40px]"></TableHead>
                                        <TableHead>Siswa</TableHead>
                                        <TableHead>Barang</TableHead>
                                        <TableHead>Kategori</TableHead>
                                        <TableHead className="text-right">Total Hutang</TableHead>
                                        <TableHead className="text-right">Terbayar</TableHead>
                                        <TableHead className="text-right">Sisa Tagihan</TableHead>
                                        <TableHead>Tanggal Ambil</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="h-24 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredHutang.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                                Tidak ada data hutang ditemukan
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredHutang.map((h) => {
                                            const totalHutang = h.nominal * h.jumlah;
                                            const sisaHutang = totalHutang - h.terbayar;
                                            const isExpanded = !!expandedRows[h.id];

                                            return (
                                                <>
                                                    <TableRow key={h.id} className={isExpanded ? "bg-slate-50/40 dark:bg-slate-900/10" : ""}>
                                                        <TableCell className="p-0 text-center">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => toggleRow(h.id)}
                                                                title="Lihat Riwayat Pembayaran"
                                                            >
                                                                {isExpanded ? (
                                                                    <ChevronUp className="h-4 w-4 text-slate-500" />
                                                                ) : (
                                                                    <ChevronDown className="h-4 w-4 text-slate-500" />
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-slate-800 dark:text-slate-200">{h.siswa?.nama || "-"}</span>
                                                                <span className="text-xs text-muted-foreground">NISN: {h.siswa?.nisn || "-"} • Kelas {h.siswa?.kelas || "-"}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{h.namaBarang}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatRupiah(h.nominal)} x{h.jumlah}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary" className="capitalize text-[11px] font-normal px-2 py-0.5">
                                                                {h.kategori}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono font-semibold">
                                                            {formatRupiah(totalHutang)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-emerald-600">
                                                            {formatRupiah(h.terbayar)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono font-bold text-slate-900 dark:text-white">
                                                            {formatRupiah(sisaHutang)}
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            {formatDate(h.tanggalAmbil)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={`capitalize font-medium text-[11px] px-2 py-0.5 ${STATUS_COLORS[h.status]}`}>
                                                                {h.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end items-center gap-1.5">
                                                                {(h.status === "aktif" || h.status === "cicilan") && (
                                                                    <>
                                                                        <Button
                                                                            variant="default"
                                                                            size="sm"
                                                                            className="h-8 shadow-sm"
                                                                            onClick={() => {
                                                                                setPayDialog({ open: true, hutang: h });
                                                                                setPayAmount(sisaHutang.toString());
                                                                                setPaymentMethod("cash");
                                                                            }}
                                                                        >
                                                                            <Coins className="h-3.5 w-3.5 mr-1" />
                                                                            Bayar
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                                                            onClick={() => setCancelDialog({
                                                                                open: true,
                                                                                hutangId: h.id,
                                                                                studentName: h.siswa?.nama || "Siswa",
                                                                                itemName: h.namaBarang
                                                                            })}
                                                                            title="Batalkan Hutang"
                                                                        >
                                                                            <Ban className="h-4 w-4" />
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                    
                                                    {/* Expanded Row for Payments History */}
                                                    {isExpanded && (
                                                        <TableRow className="bg-slate-50/30 hover:bg-slate-50/30 dark:bg-slate-900/5 dark:hover:bg-slate-900/5">
                                                            <TableCell colSpan={10} className="p-4 border-t border-slate-100 dark:border-slate-800">
                                                                <div className="pl-8 pr-4 py-2 space-y-3">
                                                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                                        <History className="h-3.5 w-3.5" />
                                                                        <span>Riwayat Transaksi Pembayaran Cicilan</span>
                                                                    </div>
                                                                    
                                                                    {loadingPayments[h.id] ? (
                                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                                            Memuat data cicilan...
                                                                        </div>
                                                                    ) : !paymentsCache[h.id] || paymentsCache[h.id].length === 0 ? (
                                                                        <div className="text-sm text-muted-foreground py-2 pl-2 border-l-2 border-slate-200">
                                                                            Belum ada riwayat cicilan untuk tagihan ini.
                                                                        </div>
                                                                    ) : (
                                                                        <div className="border border-slate-100 dark:border-slate-800 rounded-md overflow-hidden bg-white dark:bg-slate-950 max-w-3xl">
                                                                            <Table>
                                                                                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                                                                                    <TableRow>
                                                                                        <TableHead className="text-xs py-2">Tanggal</TableHead>
                                                                                        <TableHead className="text-xs py-2 text-right">Nominal Cicilan</TableHead>
                                                                                        <TableHead className="text-xs py-2">Metode</TableHead>
                                                                                        <TableHead className="text-xs py-2">Operator</TableHead>
                                                                                    </TableRow>
                                                                                </TableHeader>
                                                                                <TableBody>
                                                                                    {paymentsCache[h.id].map((payment) => (
                                                                                        <TableRow key={payment.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-900/20">
                                                                                            <TableCell className="py-2 text-xs font-medium">
                                                                                                {formatDateTime(payment.createdAt)}
                                                                                            </TableCell>
                                                                                            <TableCell className="py-2 text-xs text-right font-mono font-bold text-emerald-600">
                                                                                                {formatRupiah(payment.nominal)}
                                                                                            </TableCell>
                                                                                            <TableCell className="py-2 text-xs">
                                                                                                <Badge variant="outline" className={`text-[10px] uppercase font-semibold py-0.5 px-1.5 ${
                                                                                                    payment.metode === "cash" 
                                                                                                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400" 
                                                                                                        : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400"
                                                                                                }`}>
                                                                                                    {payment.metode === "cash" ? "Tunai (Cash)" : "Tabungan"}
                                                                                                </Badge>
                                                                                            </TableCell>
                                                                                            <TableCell className="py-2 text-xs text-muted-foreground">
                                                                                                {payment.dicatatOleh || "Sistem"}
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    ))}
                                                                                </TableBody>
                                                                            </Table>
                                                                        </div>
                                                                    )}
                                                                    {h.catatan && (
                                                                        <div className="text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded border border-slate-100 dark:border-slate-800 max-w-3xl">
                                                                            <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">Catatan Internal:</span>
                                                                            {h.catatan}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </>
                                            );
                                        })
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
                                            <p className="text-2xl font-bold text-primary font-mono">
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

            {/* Comprehensive Payment Modal */}
            <Dialog open={!!payDialog} onOpenChange={(open) => !open && setPayDialog(null)}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Form Pembayaran Cicilan</DialogTitle>
                        <DialogDescription>
                            Pilih metode pembayaran (Tunai vs Potong Tabungan) dan masukkan nominal bayar.
                        </DialogDescription>
                    </DialogHeader>
                    {payDialog && (
                        <form onSubmit={handlePayHutang} className="space-y-4 pt-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Nama Siswa</Label>
                                <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                    {payDialog.hutang.siswa?.nama || "-"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    NISN: {payDialog.hutang.siswa?.nisn || "-"} • Kelas {payDialog.hutang.siswa?.kelas || "-"}
                                </div>
                            </div>

                            <div className="space-y-1.5 border-t dark:border-slate-800 pt-3">
                                <Label className="text-xs text-muted-foreground">Detail Hutang</Label>
                                <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">{payDialog.hutang.namaBarang}</div>
                                <div className="text-xs flex justify-between">
                                    <span>Total Tagihan ({payDialog.hutang.jumlah}x):</span>
                                    <span className="font-mono">{formatRupiah(payDialog.hutang.nominal * payDialog.hutang.jumlah)}</span>
                                </div>
                                <div className="text-xs flex justify-between text-emerald-600">
                                    <span>Sudah Dibayar:</span>
                                    <span className="font-mono">{formatRupiah(payDialog.hutang.terbayar)}</span>
                                </div>
                                <div className="text-xs flex justify-between font-bold text-amber-600 border-t dark:border-slate-800 pt-1.5">
                                    <span>Sisa Tagihan:</span>
                                    <span className="font-mono">{formatRupiah((payDialog.hutang.nominal * payDialog.hutang.jumlah) - payDialog.hutang.terbayar)}</span>
                                </div>
                            </div>

                            <div className="space-y-2 border-t dark:border-slate-800 pt-3">
                                <Label>Metode Pembayaran</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        type="button"
                                        variant={paymentMethod === "cash" ? "default" : "outline"}
                                        onClick={() => setPaymentMethod("cash")}
                                        className="w-full flex items-center justify-center gap-1.5 h-9"
                                    >
                                        <Coins className="h-4 w-4" />
                                        Tunai (Cash)
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={paymentMethod === "tabungan" ? "default" : "outline"}
                                        onClick={() => setPaymentMethod("tabungan")}
                                        className="w-full flex items-center justify-center gap-1.5 h-9"
                                    >
                                        <CreditCard className="h-4 w-4" />
                                        Potong Tabungan
                                    </Button>
                                </div>
                            </div>

                            {paymentMethod === "tabungan" && (
                                <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg space-y-1.5">
                                    <div className="text-xs text-muted-foreground flex justify-between items-center">
                                        <span>Saldo Tabungan Siswa:</span>
                                        {getStudentSavingsBalance(payDialog.hutang.siswaId) < ((payDialog.hutang.nominal * payDialog.hutang.jumlah) - payDialog.hutang.terbayar) && (
                                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase">Saldo Kurang untuk Pelunasan</span>
                                        )}
                                    </div>
                                    <div className="text-lg font-bold text-primary font-mono">
                                        {formatRupiah(getStudentSavingsBalance(payDialog.hutang.siswaId))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="payAmount">Nominal Pembayaran (Rp)</Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => {
                                            const remaining = (payDialog.hutang.nominal * payDialog.hutang.jumlah) - payDialog.hutang.terbayar;
                                            if (paymentMethod === "tabungan") {
                                                const balance = getStudentSavingsBalance(payDialog.hutang.siswaId);
                                                setPayAmount(Math.min(remaining, balance).toString());
                                            } else {
                                                setPayAmount(remaining.toString());
                                            }
                                        }}
                                        className="text-[11px] h-6 px-2 text-slate-500 hover:text-slate-800"
                                    >
                                        Set Maksimal / Lunas
                                    </Button>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">Rp</span>
                                    <Input
                                        id="payAmount"
                                        className="pl-9 font-mono text-sm"
                                        value={payAmount}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, "");
                                            setPayAmount(val ? parseInt(val).toLocaleString("id-ID") : "");
                                        }}
                                        placeholder="0"
                                        required
                                    />
                                </div>
                            </div>

                            <DialogFooter className="border-t dark:border-slate-800 pt-3 flex gap-2">
                                <Button type="button" variant="outline" onClick={() => setPayDialog(null)}>
                                    Batal
                                </Button>
                                <Button type="submit" disabled={isPaying}>
                                    {isPaying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Proses Bayar
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Cancel/Refund Confirmation Dialog */}
            <AlertDialog open={!!cancelDialog} onOpenChange={(open) => !open && setCancelDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Batalkan Catatan Hutang?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                            <div>
                                Apakah Anda yakin ingin membatalkan catatan hutang siswa <span className="font-semibold text-slate-800 dark:text-slate-200">{cancelDialog?.studentName}</span> untuk pembelian <span className="font-semibold text-slate-800 dark:text-slate-200">{cancelDialog?.itemName}</span>?
                            </div>
                            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-3 rounded text-xs text-rose-700 dark:text-rose-400">
                                <strong>PENTING:</strong> Menghapus/membatalkan hutang akan otomatis mengembalikan (refund) seluruh saldo tabungan yang telah dipotong dan menyunting kas brankas sekolah. Tindakan ini permanen.
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelHutang} className="bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-900 dark:hover:bg-rose-800">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Ya, Batalkan & Refund
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
