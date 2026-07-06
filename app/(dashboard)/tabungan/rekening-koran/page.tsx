"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Printer, Loader2, FileText, Download, Check, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { goGet } from "@/lib/api-client";
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
    kelasId: string;
    kelas?: { nama: string } | null;
}

interface StatementMutation {
    date: string;
    refId: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    category: string;
}

interface StatementData {
    student: {
        id: string;
        nama: string;
        nisn: string;
        kelas: string | null;
    };
    period: {
        start: string;
        end: string;
    };
    openingBalance: number;
    mutations: StatementMutation[];
    summary: {
        totalCredit: number;
        totalDebit: number;
        closingBalance: number;
    };
    verificationHash: string;
    generatedAt: string;
}

const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
};

const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", { 
        day: "numeric", 
        month: "short", 
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};

export default function RekeningKoranPage() {
    const [siswaList, setSiswaList] = useState<Siswa[]>([]);
    const [selectedSiswaId, setSelectedSiswaId] = useState("");
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1); // First day of current month
        return d.toISOString().split("T")[0];
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split("T")[0];
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [statement, setStatement] = useState<StatementData | null>(null);
    const [openCombobox, setOpenCombobox] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    const fetchSiswa = useCallback(async () => {
        setIsFetching(true);
        try {
            const data: any = await goGet("/api/tabungan/siswa?perPage=1000");
            if (data.items) {
                setSiswaList(data.items || []);
            }
        } catch (error) {
            console.error("Failed to fetch siswa:", error);
        } finally {
            setIsFetching(false);
        }
    }, []);

    useEffect(() => {
        fetchSiswa();
    }, [fetchSiswa]);

    const handleGenerate = async () => {
        if (!selectedSiswaId || !startDate || !endDate) {
            toast.error("Pilih siswa dan periode terlebih dahulu");
            return;
        }

        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                siswaId: selectedSiswaId,
                startDate,
                endDate,
            });
            const data: any = await goGet(`/api/tabungan/rekening-koran?${params}`);
            
            if (data.success) {
                setStatement(data.data);
                toast.success("Rekening koran berhasil digenerate");
            } else {
                toast.error(data.error || "Gagal generate rekening koran");
            }
        } catch {
            toast.error("Terjadi kesalahan");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const getVerificationUrl = () => {
        if (!statement) return "";
        const params = new URLSearchParams({
            s: statement.student.id,
            sd: statement.period.start,
            ed: statement.period.end,
            cb: statement.summary.closingBalance.toString(),
        });
        return `${typeof window !== "undefined" ? window.location.origin : ""}/api/tabungan/rekening-koran/verify/detail?hash=${statement.verificationHash}?${params}`;
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header - Hidden on print */}
            <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild className="border-slate-200 bg-white shadow-sm hover:bg-slate-50">
                        <Link href="/tabungan">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Rekening Koran</h1>
                        <p className="text-muted-foreground">
                            Cetak mutasi rekening tabungan siswa
                        </p>
                    </div>
                </div>
            </div>

            {/* Form Section - Hidden on print */}
            <Card className="print:hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Generate Rekening Koran
                    </CardTitle>
                    <CardDescription>
                        Pilih siswa dan periode untuk melihat mutasi tabungan
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2 md:col-span-2">
                            <Label>Pilih Siswa</Label>
                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openCombobox}
                                        className="w-full justify-between font-normal"
                                        disabled={isFetching}
                                    >
                                        {selectedSiswaId
                                            ? siswaList.find((s) => s.id === selectedSiswaId)?.nama
                                            : isFetching ? "Memuat siswa..." : "Pilih siswa..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Cari siswa..." />
                                        <CommandList>
                                            <CommandEmpty>Siswa tidak ditemukan.</CommandEmpty>
                                            <CommandGroup>
                                                {siswaList.map((s) => (
                                                    <CommandItem
                                                        key={s.id}
                                                        value={`${s.nama} ${s.nisn}`} // Enable search by name and NISN
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
                        </div>
                        <div className="space-y-2">
                            <Label>Dari Tanggal</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Sampai Tanggal</Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end mt-4">
                        <Button onClick={handleGenerate} disabled={isLoading || !selectedSiswaId}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Generate Rekening Koran
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Print Actions - Only show when statement is available */}
            {statement && (
                <div className="flex gap-2 print:hidden">
                    <Button onClick={handlePrint} variant="default">
                        <Printer className="mr-2 h-4 w-4" />
                        Cetak
                    </Button>
                    <Button variant="outline" asChild>
                        <a href={getVerificationUrl()} target="_blank" rel="noopener noreferrer">
                            <Download className="mr-2 h-4 w-4" />
                            Test Verifikasi QR
                        </a>
                    </Button>
                </div>
            )}

            {/* Statement Document - Print target */}
            {statement && (
                <div 
                    ref={printRef}
                    className="bg-white text-black print:text-black rounded-lg shadow-lg overflow-hidden relative"
                    style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif" }}
                >
                    {/* Watermark */}
                    <div 
                        className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none print:opacity-[0.05]"
                        style={{ zIndex: 0 }}
                    >
                        <div className="text-[120px] font-bold text-gray-500 rotate-[-30deg] select-none whitespace-nowrap">
                            BANK SEKOLAH
                        </div>
                    </div>

                    {/* Content with zIndex */}
                    <div className="relative" style={{ zIndex: 1 }}>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 print:bg-emerald-600">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                                        <span className="text-2xl font-bold">🏫</span>
                                    </div>
                                    <div>
                                        <h1 className="text-xl font-bold">REKENING KORAN TABUNGAN SISWA</h1>
                                        <p className="text-emerald-100">SDN Contoh Makmur</p>
                                        <p className="text-xs text-emerald-200">Jl. Pendidikan No. 1, Kota Contoh</p>
                                    </div>
                                </div>
                                <div className="text-right text-sm">
                                    <p className="text-emerald-100">No. Rekening:</p>
                                    <p className="font-mono font-bold">{statement.student.nisn}</p>
                                </div>
                            </div>
                        </div>

                        {/* Student Info */}
                        <div className="p-6 border-b bg-gray-50 print:bg-gray-100">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500">Nama Pemilik</p>
                                    <p className="font-semibold">{statement.student.nama}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">NISN</p>
                                    <p className="font-mono">{statement.student.nisn}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Kelas</p>
                                    <p className="font-semibold">{statement.student.kelas || "-"}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Periode Mutasi</p>
                                    <p className="font-semibold">
                                        {formatDate(statement.period.start)} - {formatDate(statement.period.end)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Summary Block */}
                        <div className="p-6 border-b">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                                    <p className="text-xs text-blue-600 uppercase font-medium">Saldo Awal</p>
                                    <p className="text-xl font-bold text-blue-700">{formatRupiah(statement.openingBalance)}</p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                                    <p className="text-xs text-green-600 uppercase font-medium">Total Masuk (Kredit)</p>
                                    <p className="text-xl font-bold text-green-700">+{formatRupiah(statement.summary.totalCredit)}</p>
                                </div>
                                <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                                    <p className="text-xs text-red-600 uppercase font-medium">Total Keluar (Debit)</p>
                                    <p className="text-xl font-bold text-red-700">-{formatRupiah(statement.summary.totalDebit)}</p>
                                </div>
                                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                                    <p className="text-xs text-emerald-600 uppercase font-medium">Saldo Akhir</p>
                                    <p className="text-xl font-bold text-emerald-700">{formatRupiah(statement.summary.closingBalance)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Mutation Table */}
                        <div className="p-6">
                            <h3 className="font-semibold mb-4 text-gray-700">MUTASI REKENING</h3>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-100 border-b">
                                            <th className="text-left p-3 font-semibold">Tanggal</th>
                                            <th className="text-left p-3 font-semibold">Ref</th>
                                            <th className="text-left p-3 font-semibold">Keterangan</th>
                                            <th className="text-right p-3 font-semibold text-red-600">Debit</th>
                                            <th className="text-right p-3 font-semibold text-green-600">Kredit</th>
                                            <th className="text-right p-3 font-semibold">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Opening Balance Row */}
                                        <tr className="border-b bg-gray-50">
                                            <td className="p-3 text-gray-500" colSpan={5}>
                                                <em>Saldo Awal Periode</em>
                                            </td>
                                            <td className="p-3 text-right font-mono font-semibold">
                                                {formatRupiah(statement.openingBalance)}
                                            </td>
                                        </tr>
                                        
                                        {statement.mutations.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-gray-500">
                                                    Tidak ada transaksi dalam periode ini
                                                </td>
                                            </tr>
                                        ) : (
                                            statement.mutations.map((m, idx) => (
                                                <tr key={idx} className="border-b hover:bg-gray-50">
                                                    <td className="p-3 text-gray-600">{formatDateTime(m.date)}</td>
                                                    <td className="p-3 font-mono text-xs text-gray-500">{m.refId}</td>
                                                    <td className="p-3">
                                                        <span className={m.category === "debt_settlement" ? "text-orange-600" : ""}>
                                                            {m.description}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right font-mono text-red-600">
                                                        {m.debit > 0 ? formatRupiah(m.debit) : "-"}
                                                    </td>
                                                    <td className="p-3 text-right font-mono text-green-600">
                                                        {m.credit > 0 ? formatRupiah(m.credit) : "-"}
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-semibold">
                                                        {formatRupiah(m.balance)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}

                                        {/* Closing Balance Row */}
                                        <tr className="bg-emerald-50 font-semibold">
                                            <td className="p-3" colSpan={5}>
                                                Saldo Akhir per {formatDate(statement.period.end)}
                                            </td>
                                            <td className="p-3 text-right font-mono text-emerald-700 text-lg">
                                                {formatRupiah(statement.summary.closingBalance)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Footer with QR */}
                        <div className="p-6 bg-gray-50 border-t">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white p-2 rounded-lg shadow-sm">
                                        <QRCodeSVG 
                                            value={getVerificationUrl()} 
                                            size={80}
                                            level="M"
                                        />
                                    </div>
                                    <div className="text-xs text-gray-500 max-w-xs">
                                        <p className="font-semibold text-gray-700 mb-1">Verifikasi Dokumen</p>
                                        <p>Scan QR Code untuk memverifikasi keaslian dokumen ini.</p>
                                        <p className="mt-2 text-[10px] italic">
                                            Dokumen ini adalah cetakan komputer dan sah tanpa tanda tangan basah 
                                            jika terdapat QR Code valid.
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right text-xs text-gray-500">
                                    <p>Dicetak: {formatDateTime(statement.generatedAt)}</p>
                                    <p className="font-mono text-[10px]">Hash: {statement.verificationHash}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .container > div:last-child,
                    .container > div:last-child * {
                        visibility: visible;
                    }
                    .container > div:last-child {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    .print\\:bg-emerald-600 {
                        background-color: #059669 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .print\\:bg-gray-100 {
                        background-color: #f3f4f6 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                }
            `}</style>
        </div>
    );
}

