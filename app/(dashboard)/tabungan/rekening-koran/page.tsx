"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Printer, Loader2, FileText, Download, Check, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { goGet } from "@/lib/api-client";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
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
    StatementDocument,
    type StatementData,
    getVerificationUrl,
} from "@/components/tabungan/statement-document";

interface Siswa {
    id: string;
    nama: string;
    nisn: string;
    kelasId: string;
    kelas?: { nama: string } | null;
}

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
    const { settings } = useSchoolSettings();

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
                const st = data.data;
                // Guard bentuk: dulu array datar membuat guard `&&` lolos lalu
                // .student.id melempar TypeError begitu respons sukses.
                if (!st || typeof st !== "object" || !st.student || !Array.isArray(st.mutations)) {
                    toast.error("Bentuk data rekening koran tidak dikenal");
                    setStatement(null);
                } else {
                    setStatement(st);
                    toast.success("Rekening koran berhasil digenerate");
                }
            } else {
                toast.error(data.error || "Gagal generate rekening koran");
                setStatement(null);
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

    const verificationUrl = statement ? getVerificationUrl(statement.verificationHash) : "";

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
                        <a href={verificationUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="mr-2 h-4 w-4" />
                            Test Verifikasi QR
                        </a>
                    </Button>
                </div>
            )}

            {/* Statement Document - Print target */}
            {statement && (
                <StatementDocument
                    statement={statement}
                    schoolName={settings.school_name}
                    schoolAddress={settings.school_address}
                />
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

