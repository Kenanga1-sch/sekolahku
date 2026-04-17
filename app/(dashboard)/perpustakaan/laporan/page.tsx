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
    BarChart3,
    Package,
    Printer,
    Clock,
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
import { showError, showSuccess } from "@/lib/toast";
import type { LoanReportItem, VisitReportItem } from "@/types/library";
import { goGet } from "@/lib/api-client";
import { getDDCLabel } from "@/lib/library/ddc-mapping";

// ==========================================
// Helper Functions
// ==========================================

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

// ==========================================
// Types
// ==========================================

interface OverdueLoan {
    id: string;
    memberId: string;
    itemId: string;
    borrowDate: string;
    dueDate: string;
    member: { name: string; className?: string } | null;
    item: { catalog?: { title: string } | null } | null;
}

interface InventoryStats {
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
}

// ==========================================
// Date Preset Helpers
// ==========================================

function getDatePreset(preset: string) {
    const end = new Date();
    const start = new Date();
    
    switch (preset) {
        case "today":
            return { startDate: end.toISOString().split("T")[0], endDate: end.toISOString().split("T")[0] };
        case "week":
            start.setDate(start.getDate() - 7);
            break;
        case "month":
            start.setMonth(start.getMonth() - 1);
            break;
        case "year":
            start.setFullYear(start.getFullYear() - 1);
            break;
        default:
            start.setDate(start.getDate() - 30);
    }
    
    return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
    };
}

// ==========================================
// Main Component
// ==========================================

export default function LaporanPage() {
    const defaults = getDefaultDates();
    const [startDate, setStartDate] = useState(defaults.startDate);
    const [endDate, setEndDate] = useState(defaults.endDate);
    const [activeTab, setActiveTab] = useState("peminjaman");
    
    const [loanData, setLoanData] = useState<LoanReportItem[]>([]);
    const [visitData, setVisitData] = useState<VisitReportItem[]>([]);
    const [overdueData, setOverdueData] = useState<OverdueLoan[]>([]);
    const [inventoryData, setInventoryData] = useState<InventoryStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // ==========================================
    // Fetch Handlers
    // ==========================================

    const handleSearch = async () => {
        setLoading(true);
        setHasSearched(true);
        try {
            if (activeTab === "peminjaman") {
                const params = new URLSearchParams({ type: "loan", startDate, endDate });
                const data: any = await goGet(`/api/library/reports?${params}`);
                if (data.error) throw new Error(data.error);
                setLoanData(data);
            } else if (activeTab === "kunjungan") {
                const params = new URLSearchParams({ type: "visit", startDate, endDate });
                const data: any = await goGet(`/api/library/reports?${params}`);
                if (data.error) throw new Error(data.error);
                setVisitData(data);
            } else if (activeTab === "keterlambatan") {
                const data: any = await goGet(`/api/library/reports?type=overdue`);
                if (data.error) throw new Error(data.error);
                setOverdueData(data);
            } else if (activeTab === "inventaris") {
                const data: any = await goGet(`/api/library/reports?type=inventory`);
                if (data.error) throw new Error(data.error);
                setInventoryData(data);
            }
        } catch (error) {
            console.error("Failed to generate report:", error);
            showError("Gagal mengambil data laporan");
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // Export CSV Handler
    // ==========================================

    const handleExportCSV = () => {
        let csv = "";
        let filename = "";
        
        if (activeTab === "peminjaman") {
            csv = "No,Nama Anggota,Kelas,Judul Buku,Tanggal Pinjam,Jatuh Tempo,Tanggal Kembali,Status,Denda\n";
            loanData.forEach((item, index) => {
                csv += `${index + 1},"${item.memberName}","${item.memberClass || '-'}","${item.itemTitle}",${formatDate(item.borrowDate)},${formatDate(item.dueDate)},${item.returnDate ? formatDate(item.returnDate) : '-'},${item.isReturned ? 'Dikembalikan' : 'Dipinjam'},${formatCurrency(item.fineAmount)}\n`;
            });
            filename = `laporan-peminjaman-${startDate}-${endDate}.csv`;
        } else if (activeTab === "kunjungan") {
            csv = "No,Nama Anggota,Kelas,Tanggal,Waktu\n";
            visitData.forEach((item, index) => {
                const time = new Date(item.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                csv += `${index + 1},"${item.memberName}","${item.memberClass || '-'}",${formatDate(item.date)},${time}\n`;
            });
            filename = `laporan-kunjungan-${startDate}-${endDate}.csv`;
        } else if (activeTab === "keterlambatan") {
            csv = "No,Nama Anggota,Kelas,Judul Buku,Jatuh Tempo,Hari Terlambat\n";
            overdueData.forEach((item, index) => {
                const daysOverdue = Math.ceil((Date.now() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                csv += `${index + 1},"${item.member?.name || '-'}","${item.member?.className || '-'}","${item.item?.catalog?.title || '-'}",${formatDate(item.dueDate)},${daysOverdue}\n`;
            });
            filename = `laporan-keterlambatan-${new Date().toISOString().split("T")[0]}.csv`;
        }

        if (csv) {
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            showSuccess("Laporan berhasil diunduh");
        }
    };

    // ==========================================
    // Print Handler
    // ==========================================

    const handlePrint = () => {
        window.print();
    };

    // ==========================================
    // Quick Date Preset Handler
    // ==========================================

    const applyDatePreset = (preset: string) => {
        const { startDate: s, endDate: e } = getDatePreset(preset);
        setStartDate(s);
        setEndDate(e);
    };

    // ==========================================
    // Calculate Summaries
    // ==========================================

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

    // Status label mapping
    const statusLabels: Record<string, string> = {
        AVAILABLE: "Tersedia",
        BORROWED: "Dipinjam",
        DAMAGED: "Rusak",
        LOST: "Hilang",
    };

    // ==========================================
    // Render
    // ==========================================

    return (
        <div className="space-y-8 print:space-y-4">
            {/* Header */}
            <div className="flex items-center gap-4 print:hidden">
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
                        Generate dan export laporan lengkap perpustakaan
                    </p>
                </div>
            </div>

            {/* Print Header (Hidden on screen) */}
            <div className="hidden print:block text-center mb-8">
                <h1 className="text-2xl font-bold">Laporan Perpustakaan</h1>
                <p className="text-sm text-gray-600">Periode: {formatDate(startDate)} - {formatDate(endDate)}</p>
            </div>

            {/* Date Filter with Quick Presets */}
            <Card className="print:hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Filter Tanggal
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Quick Presets */}
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => applyDatePreset("today")}>
                            <Clock className="h-3 w-3 mr-1" />
                            Hari Ini
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => applyDatePreset("week")}>
                            Minggu Ini
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => applyDatePreset("month")}>
                            Bulan Ini
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => applyDatePreset("year")}>
                            Tahun Ini
                        </Button>
                    </div>
                    
                    {/* Manual Date Picker */}
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
                <TabsList className="grid w-full grid-cols-4 max-w-2xl print:hidden">
                    <TabsTrigger value="peminjaman" className="gap-2">
                        <BookMarked className="h-4 w-4" />
                        <span className="hidden sm:inline">Peminjaman</span>
                    </TabsTrigger>
                    <TabsTrigger value="kunjungan" className="gap-2">
                        <UserCheck className="h-4 w-4" />
                        <span className="hidden sm:inline">Kunjungan</span>
                    </TabsTrigger>
                    <TabsTrigger value="keterlambatan" className="gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="hidden sm:inline">Keterlambatan</span>
                    </TabsTrigger>
                    <TabsTrigger value="inventaris" className="gap-2">
                        <Package className="h-4 w-4" />
                        <span className="hidden sm:inline">Inventaris</span>
                    </TabsTrigger>
                </TabsList>

                {/* ==========================================
                    LOAN REPORT TAB
                ========================================== */}
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
                                <CardHeader className="flex flex-row items-center justify-between print:hidden">
                                    <div>
                                        <CardTitle className="text-lg">Data Peminjaman</CardTitle>
                                        <CardDescription>
                                            {loanData.length} transaksi ditemukan
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loanData.length === 0}>
                                            <Download className="h-4 w-4 mr-2" />
                                            Export CSV
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handlePrint} disabled={loanData.length === 0}>
                                            <Printer className="h-4 w-4 mr-2" />
                                            Print
                                        </Button>
                                    </div>
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
                                <p className="text-sm">Pilih rentang tanggal dan klik &quot;Generate Laporan&quot; untuk melihat data</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ==========================================
                    VISIT REPORT TAB
                ========================================== */}
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
                                <CardHeader className="flex flex-row items-center justify-between print:hidden">
                                    <div>
                                        <CardTitle className="text-lg">Data Kunjungan</CardTitle>
                                        <CardDescription>
                                            {visitData.length} kunjungan ditemukan
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={visitData.length === 0}>
                                            <Download className="h-4 w-4 mr-2" />
                                            Export CSV
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handlePrint} disabled={visitData.length === 0}>
                                            <Printer className="h-4 w-4 mr-2" />
                                            Print
                                        </Button>
                                    </div>
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
                                <p className="text-sm">Pilih rentang tanggal dan klik &quot;Generate Laporan&quot; untuk melihat data</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ==========================================
                    OVERDUE REPORT TAB
                ========================================== */}
                <TabsContent value="keterlambatan" className="space-y-6">
                    {hasSearched && (
                        <>
                            {/* Summary */}
                            <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4">
                                        <AlertTriangle className="h-8 w-8 text-red-500" />
                                        <div>
                                            <p className="text-2xl font-bold text-red-600">{overdueData.length}</p>
                                            <p className="text-sm text-red-600/70">Buku Terlambat Dikembalikan</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Data Table */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between print:hidden">
                                    <div>
                                        <CardTitle className="text-lg">Daftar Keterlambatan</CardTitle>
                                        <CardDescription>
                                            Buku yang sudah melewati jatuh tempo
                                        </CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={overdueData.length === 0}>
                                        <Download className="h-4 w-4 mr-2" />
                                        Export CSV
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {overdueData.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                            <p>Tidak ada buku yang terlambat dikembalikan 🎉</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-12">No</TableHead>
                                                        <TableHead>Peminjam</TableHead>
                                                        <TableHead>Judul Buku</TableHead>
                                                        <TableHead>Jatuh Tempo</TableHead>
                                                        <TableHead className="text-right">Hari Terlambat</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {overdueData.map((item, index) => {
                                                        const daysOverdue = Math.ceil((Date.now() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                                                        return (
                                                            <TableRow key={item.id}>
                                                                <TableCell className="font-medium">{index + 1}</TableCell>
                                                                <TableCell>
                                                                    <div>
                                                                        <p className="font-medium">{item.member?.name || "-"}</p>
                                                                        <p className="text-xs text-muted-foreground">{item.member?.className || "-"}</p>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="max-w-[200px] truncate">{item.item?.catalog?.title || "-"}</TableCell>
                                                                <TableCell>{formatDate(item.dueDate)}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Badge variant="destructive">{daysOverdue} hari</Badge>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
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
                                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium mb-1">Laporan Keterlambatan</p>
                                <p className="text-sm mb-4">Klik &quot;Generate Laporan&quot; untuk melihat daftar buku yang terlambat dikembalikan</p>
                                <Button onClick={handleSearch} disabled={loading}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                                    Generate Laporan
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ==========================================
                    INVENTORY REPORT TAB
                ========================================== */}
                <TabsContent value="inventaris" className="space-y-6">
                    {hasSearched && inventoryData && (
                        <>
                            {/* Status Summary */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <Card className="md:col-span-1">
                                    <CardContent className="p-4 text-center">
                                        <p className="text-3xl font-bold">{inventoryData.total}</p>
                                        <p className="text-xs text-muted-foreground">Total Buku</p>
                                    </CardContent>
                                </Card>
                                {Object.entries(inventoryData.byStatus).map(([status, count]) => (
                                    <Card key={status}>
                                        <CardContent className="p-4 text-center">
                                            <p className={`text-2xl font-bold ${
                                                status === "AVAILABLE" ? "text-green-500" :
                                                status === "BORROWED" ? "text-blue-500" :
                                                status === "DAMAGED" ? "text-orange-500" :
                                                "text-red-500"
                                            }`}>{count}</p>
                                            <p className="text-xs text-muted-foreground">{statusLabels[status] || status}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            {/* Category Breakdown */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-primary" />
                                        Distribusi Kategori (DDC)
                                    </CardTitle>
                                    <CardDescription>Jumlah buku berdasarkan klasifikasi Dewey Decimal</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {Object.entries(inventoryData.byCategory)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([category, count]) => {
                                                const percentage = Math.round((count / inventoryData.total) * 100);
                                                return (
                                                    <div key={category} className="space-y-1">
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="font-medium">{getDDCLabel(category as import("@/lib/library/ddc-mapping").DDCCategory)}</span>
                                                            <span className="text-muted-foreground">{count} ({percentage}%)</span>
                                                        </div>
                                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                                                                style={{ width: `${percentage}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {!hasSearched && (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium mb-1">Laporan Inventaris</p>
                                <p className="text-sm mb-4">Klik &quot;Generate Laporan&quot; untuk melihat statistik koleksi perpustakaan</p>
                                <Button onClick={handleSearch} disabled={loading}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                                    Generate Laporan
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

