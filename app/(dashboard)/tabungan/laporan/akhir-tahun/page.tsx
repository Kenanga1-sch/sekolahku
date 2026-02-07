"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Printer, ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Check, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface Siswa {
    id: string;
    nama: string;
    nisn: string;
    kelas?: { nama: string } | null;
}

interface Report {
    siswa: {
        id: string;
        nama: string;
        nisn: string;
        kelas: string;
    };
    tabungan: {
        monthlySummary: Record<string, { setor: number; tarik: number }>;
        totalSetor: number;
        totalTarik: number;
        saldoAkhir: number;
    };
    hutang: {
        items: Array<{
            id: string;
            namaBarang: string;
            nominal: number;
            jumlah: number;
            tanggalAmbil: string | null;
            status: string;
        }>;
        activeItems: Array<{
            id: string;
            namaBarang: string;
            nominal: number;
            jumlah: number;
            tanggalAmbil: string | null;
        }>;
        totalHutangAktif: number;
    };
    settlement: {
        netBalance: number;
        status: string;
        terbilang: string;
    };
    generatedAt: string;
}

const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
};

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};

export default function LaporanAkhirTahunPage() {
    const [siswaList, setSiswaList] = useState<Siswa[]>([]);
    const [selectedSiswaId, setSelectedSiswaId] = useState("");
    const [report, setReport] = useState<Report | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingSiswa, setIsFetchingSiswa] = useState(true);
    const [openCombobox, setOpenCombobox] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    const fetchSiswa = useCallback(async () => {
        setIsFetchingSiswa(true);
        try {
            const res = await fetch("/api/tabungan/siswa?perPage=1000");
            const data = await res.json();
            if (data.items) {
                setSiswaList(data.items || []);
            }
        } catch (error) {
            console.error("Failed to fetch siswa:", error);
        } finally {
            setIsFetchingSiswa(false);
        }
    }, []);

    const fetchReport = useCallback(async () => {
        if (!selectedSiswaId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/tabungan/laporan/akhir-tahun?siswaId=${selectedSiswaId}`);
            const data = await res.json();
            if (data.success) {
                setReport(data.report);
            } else {
                toast.error(data.error || "Gagal generate laporan");
            }
        } catch {
            toast.error("Terjadi kesalahan");
        } finally {
            setIsLoading(false);
        }
    }, [selectedSiswaId]);

    useEffect(() => {
        fetchSiswa();
    }, [fetchSiswa]);

    useEffect(() => {
        if (selectedSiswaId) {
            fetchReport();
        } else {
            setReport(null);
        }
    }, [selectedSiswaId, fetchReport]);

    const handlePrint = () => {
        window.print();
    };

    const monthlyEntries = report ? Object.entries(report.tabungan.monthlySummary).sort() : [];

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header - hidden in print */}
            <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/tabungan">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Laporan Akhir Tahun</h1>
                        <p className="text-muted-foreground">
                            Rekapitulasi keuangan siswa untuk pembagian tabungan
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openCombobox}
                                className="w-[300px] justify-between"
                                disabled={isFetchingSiswa}
                            >
                                {selectedSiswaId
                                    ? siswaList.find((s) => s.id === selectedSiswaId)?.nama
                                    : isFetchingSiswa ? "Memuat..." : "Pilih siswa..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                            <Command>
                                <CommandInput placeholder="Cari siswa..." />
                                <CommandList>
                                    <CommandEmpty>Siswa tidak ditemukan.</CommandEmpty>
                                    <CommandGroup>
                                        {siswaList.map((s) => (
                                            <CommandItem
                                                key={s.id}
                                                value={`${s.nama} ${s.nisn}`}
                                                onSelect={() => {
                                                    setSelectedSiswaId(s.id === selectedSiswaId ? "" : s.id);
                                                    setOpenCombobox(false);
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        selectedSiswaId === s.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <div className="flex flex-col">
                                                    <span>{s.nama}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {s.nisn} - {s.kelas?.nama}
                                                    </span>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    {report && (
                        <Button onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" />
                            Cetak
                        </Button>
                    )}
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !report && !selectedSiswaId && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <p>Pilih siswa untuk generate laporan</p>
                    </CardContent>
                </Card>
            )}

            {/* Report Content */}
            {report && (
                <div ref={printRef} className="print:p-8">
                    {/* Print Header */}
                    <div className="hidden print:block mb-8 text-center">
                        <h1 className="text-xl font-bold uppercase">SDN Kenanga 1 Cipondoh</h1>
                        <p className="text-sm">Jl. Kenanga Raya No. 1, Cipondoh, Tangerang</p>
                        <Separator className="my-4" />
                        <h2 className="text-lg font-bold">LAPORAN REKAPITULASI KEUANGAN SISWA</h2>
                    </div>

                    {/* Student Info */}
                    <Card className="print:shadow-none print:border-0 mb-6">
                        <CardHeader className="print:pb-2">
                            <CardTitle className="print:text-base">Data Siswa</CardTitle>
                        </CardHeader>
                        <CardContent className="print:pt-0">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Nama:</span>
                                    <span className="font-medium ml-2">{report.siswa.nama}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">NISN:</span>
                                    <span className="font-medium ml-2">{report.siswa.nisn}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Kelas:</span>
                                    <span className="font-medium ml-2">{report.siswa.kelas}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Tanggal Cetak:</span>
                                    <span className="font-medium ml-2">{formatDate(report.generatedAt)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Bagian 1: Ringkasan Tabungan */}
                    <Card className="print:shadow-none print:border-0 mb-6">
                        <CardHeader className="print:pb-2">
                            <CardTitle className="print:text-base">Bagian 1: Ringkasan Tabungan</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 print:pt-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Bulan</TableHead>
                                        <TableHead className="text-right">Setor</TableHead>
                                        <TableHead className="text-right">Tarik</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {monthlyEntries.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                Tidak ada transaksi
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        monthlyEntries.map(([month, data]) => (
                                            <TableRow key={month}>
                                                <TableCell>{formatMonth(month)}</TableCell>
                                                <TableCell className="text-right font-mono text-green-600">
                                                    {data.setor > 0 ? formatRupiah(data.setor) : "-"}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-red-600">
                                                    {data.tarik > 0 ? formatRupiah(data.tarik) : "-"}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                    <TableRow className="font-bold bg-muted/50">
                                        <TableCell>SUBTOTAL TABUNGAN</TableCell>
                                        <TableCell className="text-right font-mono text-green-600">
                                            {formatRupiah(report.tabungan.totalSetor)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-red-600">
                                            {formatRupiah(report.tabungan.totalTarik)}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="font-bold">
                                        <TableCell colSpan={2}>SALDO AKHIR</TableCell>
                                        <TableCell className="text-right font-mono text-lg">
                                            {formatRupiah(report.tabungan.saldoAkhir)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Bagian 2: Rincian Kewajiban */}
                    <Card className="print:shadow-none print:border-0 mb-6">
                        <CardHeader className="print:pb-2">
                            <CardTitle className="print:text-base">Bagian 2: Rincian Kewajiban/Hutang</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 print:pt-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Nama Barang / Keperluan</TableHead>
                                        <TableHead className="text-right">Nominal</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {report.hutang.activeItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                Tidak ada hutang aktif
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        report.hutang.activeItems.map((h) => (
                                            <TableRow key={h.id}>
                                                <TableCell>{formatDate(h.tanggalAmbil)}</TableCell>
                                                <TableCell>
                                                    {h.namaBarang}
                                                    {h.jumlah > 1 && <span className="text-muted-foreground"> x{h.jumlah}</span>}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {formatRupiah(h.nominal * h.jumlah)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                    <TableRow className="font-bold bg-muted/50">
                                        <TableCell colSpan={2}>SUBTOTAL KEWAJIBAN</TableCell>
                                        <TableCell className="text-right font-mono text-red-600">
                                            ({formatRupiah(report.hutang.totalHutangAktif)})
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Bagian 3: Kalkulasi Bersih */}
                    <Card className={`print:shadow-none print:border-2 mb-6 ${
                        report.settlement.status === "KURANG_BAYAR" ? "border-red-500" : "border-green-500"
                    }`}>
                        <CardHeader className="print:pb-2">
                            <CardTitle className="print:text-base flex items-center gap-2">
                                Bagian 3: Kalkulasi Bersih (Net Settlement)
                                {report.settlement.status === "KURANG_BAYAR" ? (
                                    <Badge variant="destructive" className="ml-2">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        TAGIHAN KEKURANGAN
                                    </Badge>
                                ) : (
                                    <Badge className="bg-green-600 ml-2">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        SIAP CAIR
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="p-4 bg-green-50 rounded-lg dark:bg-green-900/20">
                                    <p className="text-sm text-muted-foreground">Saldo Tabungan</p>
                                    <p className="text-xl font-bold text-green-600">{formatRupiah(report.tabungan.saldoAkhir)}</p>
                                </div>
                                <div className="p-4 bg-red-50 rounded-lg dark:bg-red-900/20">
                                    <p className="text-sm text-muted-foreground">Total Hutang</p>
                                    <p className="text-xl font-bold text-red-600">({formatRupiah(report.hutang.totalHutangAktif)})</p>
                                </div>
                                <div className={`p-4 rounded-lg ${
                                    report.settlement.netBalance >= 0 
                                        ? "bg-green-100 dark:bg-green-900/30" 
                                        : "bg-red-100 dark:bg-red-900/30"
                                }`}>
                                    <p className="text-sm text-muted-foreground">
                                        {report.settlement.netBalance >= 0 ? "Sisa Diterima" : "Kurang Bayar"}
                                    </p>
                                    <p className={`text-2xl font-bold ${
                                        report.settlement.netBalance >= 0 ? "text-green-600" : "text-red-600"
                                    }`}>
                                        {formatRupiah(Math.abs(report.settlement.netBalance))}
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 bg-muted rounded-lg text-center">
                                <p className="text-sm text-muted-foreground mb-1">Terbilang:</p>
                                <p className="font-medium italic">{report.settlement.terbilang}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Footer: Tanda Tangan */}
                    <Card className="print:shadow-none print:border-0">
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 gap-8 text-center">
                                <div className="space-y-16">
                                    <p className="font-medium">Orang Tua/Wali</p>
                                    <div>
                                        <div className="border-b border-gray-400 mb-2 mx-8"></div>
                                        <p className="text-sm text-muted-foreground">(Nama & Tanda Tangan)</p>
                                    </div>
                                </div>
                                <div className="space-y-16">
                                    <p className="font-medium">Bendahara</p>
                                    <div>
                                        <div className="border-b border-gray-400 mb-2 mx-8"></div>
                                        <p className="text-sm text-muted-foreground">(Nama & Tanda Tangan)</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print\\:block {
                        display: block !important;
                    }
                    [class*="print:"] {
                        visibility: visible;
                    }
                    #__next {
                        visibility: visible;
                    }
                    .container {
                        visibility: visible;
                        max-width: 100% !important;
                        padding: 0 !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    .print\\:shadow-none {
                        box-shadow: none !important;
                    }
                    .print\\:border-0 {
                        border: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
