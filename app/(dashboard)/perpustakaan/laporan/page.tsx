"use client";

import { useState } from "react";
import {
    FileText,
    Download,
    CalendarDays,
    BookMarked,
    UserCheck,
    AlertTriangle,
    Loader2,
    ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
// Server imports removed
import { showError } from "@/lib/toast";
import type { LoanReportItem, VisitReportItem } from "@/types/library";

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

function getDefaultDates() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
    };
}

export default function LaporanPage() {
    const defaults = getDefaultDates();
    const [startDate, setStartDate] = useState(defaults.startDate);
    const [endDate, setEndDate] = useState(defaults.endDate);
    const [activeTab, setActiveTab] = useState("peminjaman");
    
    const [loanData, setLoanData] = useState<LoanReportItem[]>([]);
    const [visitData, setVisitData] = useState<VisitReportItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        setLoading(true);
        setHasSearched(true);
        try {
            if (activeTab === "peminjaman") {
                const params = new URLSearchParams({ type: "loan", startDate, endDate });
                const res = await fetch(`/api/library/reports?${params}`);
                if (!res.ok) throw new Error("Failed to fetch loan report");
                const data = await res.json();
                setLoanData(data);
            } else {
                const params = new URLSearchParams({ type: "visit", startDate, endDate });
                const res = await fetch(`/api/library/reports?${params}`);
                if (!res.ok) throw new Error("Failed to fetch visit report");
                const data = await res.json();
                setVisitData(data);
            }
        } catch (error) {
            console.error("Failed to generate report:", error);
            showError("Gagal mengambil data laporan");
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        let csv = "";
        let filename = "";
        
        if (activeTab === "peminjaman") {
            csv = "No,Nama Anggota,Kelas,Judul Buku,Tanggal Pinjam,Jatuh Tempo,Tanggal Kembali,Status,Denda\n";
            loanData.forEach((item, index) => {
                csv += `${index + 1},"${item.memberName}","${item.memberClass || '-'}","${item.itemTitle}",${formatDate(item.borrowDate)},${formatDate(item.dueDate)},${item.returnDate ? formatDate(item.returnDate) : '-'},${item.isReturned ? 'Dikembalikan' : 'Dipinjam'},${formatCurrency(item.fineAmount)}\n`;
            });
            filename = `laporan-peminjaman-${startDate}-${endDate}.csv`;
        } else {
            csv = "No,Nama Anggota,Kelas,Tanggal,Waktu\n";
            visitData.forEach((item, index) => {
                const time = new Date(item.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                csv += `${index + 1},"${item.memberName}","${item.memberClass || '-'}",${formatDate(item.date)},${time}\n`;
            });
            filename = `laporan-kunjungan-${startDate}-${endDate}.csv`;
        }

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    };

    // Calculate summary stats
    const loanSummary = {
        total: loanData.length,
        returned: loanData.filter(l => l.isReturned).length,
        active: loanData.filter(l => !l.isReturned).length,
        totalFines: loanData.reduce((sum, l) => sum + l.fineAmount, 0),
    };

    const visitSummary = {
        total: visitData.length,
        uniqueMembers: new Set(visitData.map(v => v.memberName)).size,
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/perpustakaan">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        Laporan Perpustakaan
                    </h1>
                    <p className="text-muted-foreground">
                        Generate dan export laporan peminjaman dan kunjungan
                    </p>
                </div>
            </div>

            {/* Date Filter */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Filter Tanggal
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="startDate">Dari Tanggal</Label>
                            <Input
                                id="startDate"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="endDate">Sampai Tanggal</Label>
                            <Input
                                id="endDate"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={loading} className="gap-2">
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <FileText className="h-4 w-4" />
                            )}
                            Generate Laporan
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Report Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setHasSearched(false); }}>
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="peminjaman" className="gap-2">
                        <BookMarked className="h-4 w-4" />
                        Peminjaman
                    </TabsTrigger>
                    <TabsTrigger value="kunjungan" className="gap-2">
                        <UserCheck className="h-4 w-4" />
                        Kunjungan
                    </TabsTrigger>
                </TabsList>

                {/* Loan Report */}
                <TabsContent value="peminjaman" className="space-y-6">
                    {hasSearched && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <p className="text-2xl font-bold">{loanSummary.total}</p>
                                        <p className="text-xs text-muted-foreground">Total Transaksi</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <p className="text-2xl font-bold text-green-500">{loanSummary.returned}</p>
                                        <p className="text-xs text-muted-foreground">Dikembalikan</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <p className="text-2xl font-bold text-orange-500">{loanSummary.active}</p>
                                        <p className="text-xs text-muted-foreground">Masih Dipinjam</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <p className="text-2xl font-bold text-red-500">{formatCurrency(loanSummary.totalFines)}</p>
                                        <p className="text-xs text-muted-foreground">Total Denda</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Data Table */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg">Data Peminjaman</CardTitle>
                                        <CardDescription>
                                            {loanData.length} transaksi ditemukan
                                        </CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loanData.length === 0}>
                                        <Download className="h-4 w-4 mr-2" />
                                        Export CSV
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {loanData.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                            <p>Tidak ada data peminjaman pada periode ini</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-12">No</TableHead>
                                                        <TableHead>Anggota</TableHead>
                                                        <TableHead>Buku</TableHead>
                                                        <TableHead>Tgl Pinjam</TableHead>
                                                        <TableHead>Jatuh Tempo</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="text-right">Denda</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {loanData.map((item, index) => (
                                                        <TableRow key={item.id}>
                                                            <TableCell className="font-medium">{index + 1}</TableCell>
                                                            <TableCell>
                                                                <div>
                                                                    <p className="font-medium">{item.memberName}</p>
                                                                    <p className="text-xs text-muted-foreground">{item.memberClass || "-"}</p>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="max-w-[200px] truncate">{item.itemTitle}</TableCell>
                                                            <TableCell>{formatDate(item.borrowDate)}</TableCell>
                                                            <TableCell>{formatDate(item.dueDate)}</TableCell>
                                                            <TableCell>
                                                                <Badge variant={item.isReturned ? "secondary" : "default"}>
                                                                    {item.isReturned ? "Kembali" : "Dipinjam"}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {item.fineAmount > 0 ? (
                                                                    <span className="text-red-500 font-medium">
                                                                        {formatCurrency(item.fineAmount)}
                                                                    </span>
                                                                ) : (
                                                                    "-"
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {!hasSearched && (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium mb-1">Pilih Periode Laporan</p>
                                <p className="text-sm">Pilih rentang tanggal dan klik "Generate Laporan" untuk melihat data</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Visit Report */}
                <TabsContent value="kunjungan" className="space-y-6">
                    {hasSearched && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-4 max-w-md">
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <p className="text-2xl font-bold">{visitSummary.total}</p>
                                        <p className="text-xs text-muted-foreground">Total Kunjungan</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <p className="text-2xl font-bold text-purple-500">{visitSummary.uniqueMembers}</p>
                                        <p className="text-xs text-muted-foreground">Pengunjung Unik</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Data Table */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg">Data Kunjungan</CardTitle>
                                        <CardDescription>
                                            {visitData.length} kunjungan ditemukan
                                        </CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={visitData.length === 0}>
                                        <Download className="h-4 w-4 mr-2" />
                                        Export CSV
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {visitData.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <UserCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                            <p>Tidak ada data kunjungan pada periode ini</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-12">No</TableHead>
                                                        <TableHead>Nama Anggota</TableHead>
                                                        <TableHead>Kelas</TableHead>
                                                        <TableHead>Tanggal</TableHead>
                                                        <TableHead>Waktu</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {visitData.map((item, index) => (
                                                        <TableRow key={item.id}>
                                                            <TableCell className="font-medium">{index + 1}</TableCell>
                                                            <TableCell className="font-medium">{item.memberName}</TableCell>
                                                            <TableCell>{item.memberClass || "-"}</TableCell>
                                                            <TableCell>{formatDate(item.date)}</TableCell>
                                                            <TableCell>
                                                                {new Date(item.timestamp).toLocaleTimeString("id-ID", {
                                                                    hour: "2-digit",
                                                                    minute: "2-digit",
                                                                })}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {!hasSearched && (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium mb-1">Pilih Periode Laporan</p>
                                <p className="text-sm">Pilih rentang tanggal dan klik "Generate Laporan" untuk melihat data</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
