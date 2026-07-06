"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Printer, ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Check, ChevronsUpDown, Eye } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { YearEndReportPDF } from "@/components/reports/YearEndReportPDF";
import { goGet } from "@/lib/api-client";

// Dynamically import PDFViewer to avoid SSR issues
const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => <div className="flex items-center justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>,
  }
);

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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface Siswa {
    id: string;
    nama: string;
    nisn: string;
    kelas: {
        id: string;
        nama: string;
    } | null;
}

interface Report {
    period: {
        year: number;
        startDate: string;
        endDate: string;
    };
    siswa: {
        nama: string;
        nisn: string;
        kelas: string;
    };
    tabungan: {
        openingBalance: number;
        monthlySummary: {
            [key: string]: {
                setor: number;
                tarik: number;
                saldo: number;
            };
        };
        totalSetor: number;
        totalTarik: number;
        saldoAkhir: number;
    };
    hutang: {
        totalHutangAktif: number;
        rincian: any[];
    };
    settlement: {
        netBalance: number;
        status: "KURANG_BAYAR" | "SIAP_CAIR";
        terbilang: string;
    };
    generatedAt: string;
}

export default function LaporanAkhirTahunPage() {
    const currentYear = new Date().getFullYear();
    const [openCombobox, setOpenCombobox] = useState(false);
    const [selectedSiswaId, setSelectedSiswaId] = useState("");
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [siswaList, setSiswaList] = useState<Siswa[]>([]);
    const [report, setReport] = useState<Report | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingSiswa, setIsFetchingSiswa] = useState(true);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Generate year options (current year + 5 years back)
    const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

    useEffect(() => {
        const fetchSiswa = async () => {
            try {
                const data: any = await goGet("/api/tabungan/siswa");
                if (data.items) {
                    setSiswaList(data.items);
                }
            } catch (error) {
                console.error("Failed to fetch siswa:", error);
                toast.error("Gagal memuat data siswa");
            } finally {
                setIsFetchingSiswa(false);
            }
        };
        fetchSiswa();
    }, []);

    const fetchReport = useCallback(async () => {
        if (!selectedSiswaId) return;

        setIsLoading(true);
        try {
            const data: any = await goGet(`/api/tabungan/laporan/akhir-tahun?siswaId=${selectedSiswaId}&year=${selectedYear}`);

            if (data.success) {
                setReport(data.report);
            } else {
                toast.error(data.error || "Gagal memuat laporan");
                setReport(null);
            }
        } catch (error) {
            console.error("Failed to fetch report:", error);
            toast.error("Terjadi kesalahan saat memuat laporan");
            setReport(null);
        } finally {
            setIsLoading(false);
        }
    }, [selectedSiswaId, selectedYear]);

    useEffect(() => {
        if (selectedSiswaId) {
            fetchReport();
        } else {
            setReport(null);
        }
    }, [selectedSiswaId, selectedYear, fetchReport]);

    const monthlyEntries = report ? Object.entries(report.tabungan.monthlySummary).sort() : [];

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
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                        {yearOptions.map((year) => (
                            <option key={year} value={year}>
                                Tahun {year}
                            </option>
                        ))}
                    </select>
                    
                    {report && (
                        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Printer className="mr-2 h-4 w-4" />
                                    Cetak PDF
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                                <DialogHeader>
                                    <DialogTitle>Pratinjau Cetak PDF</DialogTitle>
                                    <DialogDescription>
                                        Pratinjau laporan sebelum dicetak atau diunduh.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="flex-1 w-full bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                    <PDFViewer width="100%" height="100%" showToolbar={true}>
                                        <YearEndReportPDF report={report} />
                                    </PDFViewer>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {/* Report Content (Preview on Screen) */}
            {report && !isLoading && (
                <div className="space-y-6 w-full">
                    {/* Student Info */}
                    <Card>
                        <CardHeader className="pb-2 border-b">
                            <CardTitle className="text-base">Data Siswa</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
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
                    <Card>
                        <CardHeader className="pb-2 border-b">
                            <CardTitle className="text-base">
                                Bagian 1: Ringkasan Tabungan Tahun {report.period.year}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Bulan</TableHead>
                                        <TableHead className="text-right">Setor</TableHead>
                                        <TableHead className="text-right">Tarik</TableHead>
                                        <TableHead className="text-right">Saldo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {/* Opening Balance Row */}
                                    <TableRow className="bg-blue-50 dark:bg-blue-900/20">
                                        <TableCell className="font-medium">Saldo Awal</TableCell>
                                        <TableCell className="text-right">-</TableCell>
                                        <TableCell className="text-right">-</TableCell>
                                        <TableCell className="text-right font-mono font-medium">
                                            {formatRupiah(report.tabungan.openingBalance)}
                                        </TableCell>
                                    </TableRow>
                                    {monthlyEntries.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                Tidak ada transaksi di tahun {report.period.year}
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
                                                <TableCell className="text-right font-mono">
                                                    {formatRupiah(data.saldo)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                    <TableRow className="font-bold bg-muted/50 border-t">
                                        <TableCell>SUBTOTAL TABUNGAN</TableCell>
                                        <TableCell className="text-right font-mono text-green-600">
                                            {formatRupiah(report.tabungan.totalSetor)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-red-600">
                                            {formatRupiah(report.tabungan.totalTarik)}
                                        </TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                    <TableRow className="font-bold bg-muted border-t">
                                        <TableCell colSpan={3}>SALDO AKHIR TAHUN {report.period.year}</TableCell>
                                        <TableCell className="text-right font-mono text-lg">
                                            {formatRupiah(report.tabungan.saldoAkhir)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Bagian 2: Status Hutang (Hanya jika ada) */}
                    {report.hutang.totalHutangAktif > 0 && (
                        <Card>
                            <CardHeader className="pb-2 border-b">
                                <CardTitle className="text-base flex items-center">
                                    <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
                                    Bagian 2: Kewajiban / Hutang Siswa
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Keterangan</TableHead>
                                            <TableHead className="text-right">Jumlah</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {report.hutang.rincian.map((item: any, idx: number) => (
                                            <TableRow key={idx}>
                                                <TableCell>{item.keterangan}</TableCell>
                                                <TableCell className="text-right font-mono text-red-600">
                                                    {formatRupiah(item.jumlah)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="font-bold bg-muted border-t">
                                            <TableCell>TOTAL KEWAJIBAN</TableCell>
                                            <TableCell className="text-right font-mono text-xl text-red-600">
                                                {formatRupiah(report.hutang.totalHutangAktif)}
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {/* Bagian 3: Kesimpulan / Settlement */}
                    <Card>
                        <CardHeader className="pb-2 border-b">
                            <CardTitle className="text-base flex items-center justify-between">
                                <span>Bagian 3: Kesimpulan Akhir</span>
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
                        <CardContent className="space-y-4 pt-4">
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
                    <Card>
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
        </div>
    );
}

function formatRupiah(amount: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function formatMonth(monthKey: string) {
    // monthKey format: "YYYY-MM"
    const [year, month] = monthKey.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

