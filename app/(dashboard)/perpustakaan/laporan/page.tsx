"use client";

import { useState, useEffect, useMemo } from "react";
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
import { siteConfig } from "@/lib/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KopSurat } from "@/components/reports/kop-surat";
import { showError, showSuccess } from "@/lib/toast";
import type { LoanReportItem, VisitReportItem } from "@/types/library";
import { goGet } from "@/lib/api-client";
import { getDDCLabel } from "@/lib/library/ddc-mapping";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

// ==========================================
// Helper Functions
// ==========================================

function formatDate(dateStr: string | number | Date): string {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(dateStr: string | number | Date): string {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
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

/** Hari keterlambatan: 0 bila belum lewat jatuh tempo. */
function daysOverdue(dueDate: string | number | Date): number {
    const due = new Date(dueDate).getTime();
    if (Number.isNaN(due)) return 0;
    const diff = Date.now() - due;
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
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
    const { settings } = useSchoolSettings();
    const defaults = getDefaultDates();
    const [startDate, setStartDate] = useState(defaults.startDate);
    const [endDate, setEndDate] = useState(defaults.endDate);
    const [activeTab, setActiveTab] = useState("peminjaman");

    const [loanData, setLoanData] = useState<LoanReportItem[]>([]);
    const [loanTotal, setLoanTotal] = useState(0);
    const [visitData, setVisitData] = useState<VisitReportItem[]>([]);
    const [visitTotal, setVisitTotal] = useState(0);
    const [overdueData, setOverdueData] = useState<OverdueLoan[]>([]);
    const [overdueTotal, setOverdueTotal] = useState(0);
    const [inventoryData, setInventoryData] = useState<InventoryStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    // Menandai bahwa data yang tampil tidak mencakup seluruh periode.
    const [terpotong, setTerpotong] = useState(false);

    // ==========================================
    // Fetch Handlers
    // ==========================================

    const handleSearch = async () => {
        setLoading(true);
        setHasSearched(true);
        setTerpotong(false);
        try {
            if (activeTab === "peminjaman") {
                const params = new URLSearchParams({ type: "loan", startDate, endDate });
                const res: any = await goGet(`/api/library/reports?${params}`);
                if (res?.error) throw new Error(res.error);
                const items = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
                const total = typeof res?.totalItems === "number" ? res.totalItems : items.length;
                setLoanData(items);
                setLoanTotal(total);
                setTerpotong(items.length < total);
            } else if (activeTab === "kunjungan") {
                const params = new URLSearchParams({ type: "visit", startDate, endDate });
                const res: any = await goGet(`/api/library/reports?${params}`);
                if (res?.error) throw new Error(res.error);
                const items = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
                const total = typeof res?.totalItems === "number" ? res.totalItems : items.length;
                setVisitData(items);
                setVisitTotal(total);
                setTerpotong(items.length < total);
            } else if (activeTab === "keterlambatan") {
                const res: any = await goGet(`/api/library/reports?type=overdue`);
                if (res?.error) throw new Error(res.error);
                const items = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
                const total = typeof res?.totalItems === "number" ? res.totalItems : items.length;
                setOverdueData(items);
                setOverdueTotal(total);
                setTerpotong(items.length < total);
            } else if (activeTab === "inventaris") {
                const res: any = await goGet(`/api/library/reports?type=inventory`);
                if (res?.error) throw new Error(res.error);
                setInventoryData(res?.data ?? res);
            }
        } catch (error) {
            console.error("Failed to generate report:", error);
            showError("Gagal mengambil data laporan");
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // Derived Data
    // ==========================================

    const loanSummary = useMemo(() => {
        const returned = loanData.filter((l) => l.isReturned).length;
        const active = loanData.length - returned;
        const totalFines = loanData.reduce((sum, l) => sum + (l.fineAmount || 0), 0);
        const uniqueMembers = new Set(loanData.map((l) => l.memberName)).size;
        return { returned, active, totalFines, uniqueMembers };
    }, [loanData]);

    const visitSummary = useMemo(() => {
        const uniqueMembers = new Set(visitData.map((v) => v.memberName)).size;
        const todayCount = visitData.filter(
            (v) => v.date === new Date().toISOString().split("T")[0]
        ).length;
        return { total: visitData.length, uniqueMembers, todayCount };
    }, [visitData]);

    const overdueSummary = useMemo(() => {
        const totalFines = overdueData.reduce((sum, l) => sum + ((l as any).fineAmount || 0), 0);
        const worst = overdueData.reduce((max, l) => Math.max(max, daysOverdue(l.dueDate)), 0);
        return { total: overdueData.length, totalFines, worst };
    }, [overdueData]);

    // Kategori DDC diurutkan dari terbanyak, untuk tabel (bukan grafik batang).
    const categoryRows = useMemo(() => {
        if (!inventoryData) return [];
        return Object.entries(inventoryData.byCategory)
            .map(([category, count]) => ({
                category,
                label: getDDCLabel(category as any),
                count,
                percent: inventoryData.total > 0 ? Math.round((count / inventoryData.total) * 100) : 0,
            }))
            .sort((a, b) => b.count - a.count);
    }, [inventoryData]);

    // ==========================================
    // Export CSV
    // ==========================================

    const handleExportCSV = () => {
        let csv = "";
        let filename = "";

        if (activeTab === "peminjaman") {
            csv = "No,Nama Anggota,Kelas,Judul Buku,Tanggal Pinjam,Jatuh Tempo,Tanggal Kembali,Status,Denda\n";
            loanData.forEach((item, index) => {
                csv += `${index + 1},"${item.memberName}","${item.memberClass || "-"}","${item.itemTitle}",${formatDate(item.borrowDate)},${formatDate(item.dueDate)},${(item as any).returnDate ? formatDate((item as any).returnDate) : "-"},${item.isReturned ? "Dikembalikan" : "Dipinjam"},${formatCurrency(item.fineAmount || 0)}\n`;
            });
            filename = `laporan-peminjaman-${startDate}-${endDate}.csv`;
        } else if (activeTab === "kunjungan") {
            csv = "No,Nama Pengunjung,Kelas,Tanggal,Waktu\n";
            visitData.forEach((item, index) => {
                csv += `${index + 1},"${item.memberName}","${item.memberClass || "-"}",${item.date},${formatTime(item.timestamp)}\n`;
            });
            filename = `laporan-kunjungan-${startDate}-${endDate}.csv`;
        } else if (activeTab === "keterlambatan") {
            csv = "No,Nama Anggota,Kelas,Judul Buku,Tanggal Pinjam,Jatuh Tempo,Hari Terlambat\n";
            overdueData.forEach((item, index) => {
                csv += `${index + 1},"${item.member?.name || "-"}","${item.member?.className || "-"}","${item.item?.catalog?.title || "-"}",${formatDate(item.borrowDate)},${formatDate(item.dueDate)},${daysOverdue(item.dueDate)}\n`;
            });
            filename = `laporan-keterlambatan-${new Date().toISOString().split("T")[0]}.csv`;
        } else {
            csv = "Kategori,Jumlah,Persentase\n";
            categoryRows.forEach((r) => {
                csv += `"${r.label}",${r.count},${r.percent}%\n`;
            });
            filename = "laporan-inventaris.csv";
        }

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        showSuccess("Berhasil mengekspor CSV");
    };

    const handlePrint = () => window.print();

    // ==========================================
    // Kop & Tanda Tangan
    // ==========================================

    // Tab ini memakai rentang tanggal; dua lainnya (keterlambatan, inventaris)
    // adalah snapshot dan tidak disaring tanggal. Mencetak "Periode" untuk
    // keduanya menyesatkan, karena periode itu tidak dipakai.
    const pakaiTanggal = activeTab === "peminjaman" || activeTab === "kunjungan";

    const judulPerTab: Record<string, string> = {
        peminjaman: "LAPORAN PEMINJAMAN BUKU",
        kunjungan: "LAPORAN KUNJUNGAN PERPUSTAKAAN",
        keterlambatan: "LAPORAN KETERLAMBATAN PENGEMBALIAN",
        inventaris: "LAPORAN INVENTARIS PERPUSTAKAAN",
    };

    const periode =
        startDate && endDate
            ? `${formatDate(startDate)} - ${formatDate(endDate)}`
            : formatDate(new Date());

    const Kop = () => (
        <KopSurat
            schoolName={settings?.school_name || siteConfig.school.name}
            schoolAddress={settings?.school_address}
            schoolPhone={settings?.school_phone}
            schoolNpsn={settings?.school_npsn}
            schoolLogo={settings?.school_logo}
            title={judulPerTab[activeTab]}
            subtitle={pakaiTanggal ? `Periode: ${periode}` : `Posisi per ${formatDate(new Date())}`}
        />
    );

    const TandaTangan = () => (
        <div style={{ marginTop: "16px" }}>
            <div className="grid grid-cols-2 gap-16 text-center">
                <div>
                    <p className="text-sm">Mengetahui,</p>
                    <p className="text-sm font-semibold">Kepala Sekolah</p>
                    <div className="mt-11 border-t border-foreground" />
                    <p className="text-xs mt-0.5">{settings?.principal_name || "________________"}</p>
                    <p className="text-xs">NIP. {settings?.principal_nip || "__________"}</p>
                </div>
                <div>
                    <p className="text-sm">{formatDate(new Date())}</p>
                    <p className="text-sm font-semibold">Pengelola Perpustakaan</p>
                    <div className="mt-11 border-t border-foreground" />
                    <p className="text-xs mt-0.5">________________</p>
                    <p className="text-xs">NIP. __________</p>
                </div>
            </div>
        </div>
    );

    // Ringkasan: kartu di layar, kotak bergaris di kertas. Kartu memakai
    // backdrop-blur & bayangan yang tercetak buruk, jadi disembunyikan.
    const Ringkasan = ({
        items,
        cols = 4,
    }: {
        items: { label: string; value: string | number }[];
        cols?: number;
    }) => (
        <>
            {/* Di layar sempit tetap dua kolom; melebar sesuai jumlah item. */}
            <div
                className="ringkasan-layar print:hidden"
                style={{ ["--ringkasan-kolom" as string]: cols } as React.CSSProperties}
            >
                {items.map((it) => (
                    <Card key={it.label}>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">{it.label}</p>
                            <p className="text-xl font-bold">{it.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
            {/* `!important` tidak berlaku pada atribut style React, jadi jumlah
                kolom dilewatkan lewat variabel CSS yang dipakai aturan cetak. */}
            <div
                className="hidden print:block ringkasan-cetak"
                style={{ ["--ringkasan-kolom" as string]: cols } as React.CSSProperties}
            >
                {items.map((it) => (
                    <div className="ringkasan-item" key={it.label}>
                        <div className="ringkasan-nilai">{it.value}</div>
                        <div className="ringkasan-label">{it.label}</div>
                    </div>
                ))}
            </div>
        </>
    );

    const PeringatanTerpotong = () =>
        terpotong ? (
            <p className="print:hidden text-xs text-amber-700">
                Perhatian: data tidak ditampilkan seluruhnya ({loanData.length || visitData.length || overdueData.length}{" "}
                dari {loanTotal || visitTotal || overdueTotal}). Persempit periode untuk melihat semua baris.
            </p>
        ) : null;

    return (
        <>
            <style>{`
                /* ── Gaya dasar: berlaku di LAYAR maupun CETAK ──
                   Dulu seluruh gaya tabel dikurung @media print, sehingga di
                   layar tabel tampil polos tanpa garis, jarak, dan perataan. */
                .report-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                    min-width: 0;
                    font-size: 12px;
                }
                .report-table th,
                .report-table td {
                    border: 1px solid #e2e8f0;
                    padding: 6px 8px;
                    vertical-align: middle;
                    word-break: break-word;
                }
                .report-table th {
                    background: #f8fafc;
                    font-weight: 600;
                    text-align: center;
                    font-size: 11px;
                }
                .report-table td.num { text-align: right; white-space: nowrap; }
                .report-table td.mid { text-align: center; }
                .report-table td.left { text-align: left; }
                .report-table tbody tr:hover { background: #f8fafc; }
                .report-table tr.total-row td { font-weight: 700; background: #f8fafc; }

                /* Ringkasan di layar: kartu mengatur sendiri jumlahnya per baris
                   (minimal 150px) supaya 3 maupun 5 item sama-sama rapi. */
                .ringkasan-layar {
                    display: grid;
                    gap: 12px;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                }

                @media print {
                    @page { size: A4 landscape; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

                    .report-table { font-size: 9px !important; }
                    .report-table th, .report-table td { border: 0.5px solid #000 !important; padding: 3px 4px !important; }
                    /* Header tidak boleh pecah baris seperti "Bai k" di A4. */
                    .report-table th { background: #f0f0f0 !important; font-weight: 700 !important; text-align: center !important; white-space: nowrap !important; }
                    .report-table td.num { text-align: right !important; white-space: nowrap !important; }
                    .report-table td.mid { text-align: center !important; }
                    .report-table td.left { text-align: left !important; }
                    .report-table tbody tr:hover { background: transparent !important; }
                    .report-thead { display: table-header-group !important; }
                    .report-row { page-break-inside: avoid !important; break-inside: avoid !important; }

                    .ringkasan-cetak { display: grid !important; gap: 4px !important; margin-bottom: 8px !important;
                        grid-template-columns: repeat(var(--ringkasan-kolom, 4), 1fr) !important; }
                    .ringkasan-item { border: 1px solid #000 !important; padding: 5px !important; text-align: center !important; page-break-inside: avoid !important; }
                    .ringkasan-nilai { font-size: 13px !important; font-weight: 700 !important; }
                    .ringkasan-label { font-size: 8px !important; color: #555 !important; }
                }
            `}</style>

            <div className="space-y-6">
                {/* Header layar */}
                <div className="flex items-center gap-4 print:hidden">
                    <Link href="/perpustakaan">
                        <Button variant="outline" size="icon" aria-label="Kembali">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Laporan Perpustakaan</h1>
                        <p className="text-muted-foreground">
                            Peminjaman, kunjungan, keterlambatan, dan inventaris.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-2 print:hidden">
                    <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loading}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    <Button size="sm" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Cetak / Simpan PDF
                    </Button>
                </div>

                <Tabs
                    defaultValue="peminjaman"
                    onValueChange={(v) => {
                        setActiveTab(v);
                        setHasSearched(false);
                    }}
                    className="space-y-6"
                >
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-2xl print:hidden">
                        <TabsTrigger value="peminjaman" className="gap-2">
                            <BookMarked className="h-4 w-4" /> Peminjaman
                        </TabsTrigger>
                        <TabsTrigger value="kunjungan" className="gap-2">
                            <UserCheck className="h-4 w-4" /> Kunjungan
                        </TabsTrigger>
                        <TabsTrigger value="keterlambatan" className="gap-2">
                            <Clock className="h-4 w-4" /> Keterlambatan
                        </TabsTrigger>
                        <TabsTrigger value="inventaris" className="gap-2">
                            <Package className="h-4 w-4" /> Inventaris
                        </TabsTrigger>
                    </TabsList>

                    {/* Filter tanggal — hanya untuk tab yang memakainya */}
                    {pakaiTanggal ? (
                        <Card className="print:hidden">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4 text-primary" />
                                    Filter Tanggal
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {[
                                        { id: "today", label: "Hari Ini" },
                                        { id: "week", label: "7 Hari" },
                                        { id: "month", label: "1 Bulan" },
                                        { id: "year", label: "1 Tahun" },
                                    ].map((p) => (
                                        <Button
                                            key={p.id}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const d = getDatePreset(p.id);
                                                setStartDate(d.startDate);
                                                setEndDate(d.endDate);
                                            }}
                                        >
                                            {p.label}
                                        </Button>
                                    ))}
                                </div>
                                <div className="flex flex-wrap items-end gap-3">
                                    <div className="grid gap-1">
                                        <Label className="text-xs">Dari</Label>
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-auto"
                                        />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-xs">Sampai</Label>
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-auto"
                                        />
                                    </div>
                                    <Button onClick={handleSearch} disabled={loading}>
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Generate Laporan
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : null}

                    {/* ================= PEMINJAMAN ================= */}
                    <TabsContent value="peminjaman" className="space-y-4">
                        <Kop />

                        {!hasSearched ? (
                            <Card className="print:hidden">
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium mb-1">Pilih Periode Laporan</p>
                                    <p className="text-sm">
                                        Pilih rentang tanggal lalu klik &quot;Generate Laporan&quot;.
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <Ringkasan
                                    items={[
                                        { label: "Total Transaksi", value: loanTotal },
                                        { label: "Sedang Dipinjam", value: loanSummary.active },
                                        { label: "Dikembalikan", value: loanSummary.returned },
                                        { label: "Total Denda", value: formatCurrency(loanSummary.totalFines) },
                                    ]}
                                />
                                <PeringatanTerpotong />

                                <div className="rounded-lg border overflow-x-auto">
                                    <table className="report-table">
                                        <thead className="report-thead">
                                            <tr>
                                                <th style={{ width: "4%" }}>No</th>
                                                <th style={{ width: "16%" }}>Anggota</th>
                                                {/* Judul buku paling panjang: diberi
                                                    porsi terbesar agar tidak terpotong. */}
                                                <th style={{ width: "26%" }}>Buku</th>
                                                <th style={{ width: "11%" }}>Tgl Pinjam</th>
                                                <th style={{ width: "11%" }}>Jatuh Tempo</th>
                                                <th style={{ width: "11%" }}>Tgl Kembali</th>
                                                <th style={{ width: "9%" }}>Status</th>
                                                <th style={{ width: "12%" }}>Denda</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loanData.map((item, index) => (
                                                <tr key={item.id} className="report-row">
                                                    <td className="mid">{index + 1}</td>
                                                    <td className="left">
                                                        {item.memberName}
                                                        {item.memberClass ? (
                                                            <span className="text-muted-foreground">
                                                                {" "}
                                                                ({item.memberClass})
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td className="left">{item.itemTitle}</td>
                                                    <td className="mid">{formatDate(item.borrowDate)}</td>
                                                    <td className="mid">{formatDate(item.dueDate)}</td>
                                                    {/* Kolom ini ada di data dan di CSV,
                                                        tapi dulu tidak pernah ditampilkan. */}
                                                    <td className="mid">
                                                        {(item as any).returnDate
                                                            ? formatDate((item as any).returnDate)
                                                            : "-"}
                                                    </td>
                                                    <td className="mid">
                                                        {item.isReturned ? "Kembali" : "Dipinjam"}
                                                    </td>
                                                    <td className="num">
                                                        {item.fineAmount > 0
                                                            ? formatCurrency(item.fineAmount)
                                                            : "-"}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="total-row">
                                                <td colSpan={7} className="left">
                                                    JUMLAH
                                                </td>
                                                <td className="num">
                                                    {formatCurrency(loanSummary.totalFines)}
                                                </td>
                                            </tr>
                                            {loanData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="mid" style={{ padding: "14px" }}>
                                                        Tidak ada data peminjaman pada periode ini.
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </tbody>
                                    </table>
                                </div>

                                <TandaTangan />
                            </>
                        )}
                    </TabsContent>

                    {/* ================= KUNJUNGAN ================= */}
                    <TabsContent value="kunjungan" className="space-y-4">
                        <Kop />

                        {!hasSearched ? (
                            <Card className="print:hidden">
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium mb-1">Pilih Periode Laporan</p>
                                    <p className="text-sm">
                                        Pilih rentang tanggal lalu klik &quot;Generate Laporan&quot;.
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <Ringkasan
                                    cols={3}
                                    items={[
                                        { label: "Total Kunjungan", value: visitTotal },
                                        { label: "Pengunjung Unik", value: visitSummary.uniqueMembers },
                                        { label: "Kunjungan Hari Ini", value: visitSummary.todayCount },
                                    ]}
                                />
                                <PeringatanTerpotong />

                                <div className="rounded-lg border overflow-x-auto">
                                    <table className="report-table">
                                        <thead className="report-thead">
                                            <tr>
                                                <th style={{ width: "5%" }}>No</th>
                                                <th style={{ width: "30%" }}>Nama Pengunjung</th>
                                                <th style={{ width: "20%" }}>Kelas</th>
                                                <th style={{ width: "22%" }}>Tanggal</th>
                                                <th style={{ width: "23%" }}>Waktu</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visitData.map((item, index) => (
                                                <tr key={item.id} className="report-row">
                                                    <td className="mid">{index + 1}</td>
                                                    <td className="left">{item.memberName}</td>
                                                    <td className="left">{item.memberClass || "-"}</td>
                                                    <td className="mid">{formatDate(item.date)}</td>
                                                    <td className="mid">{formatTime(item.timestamp)}</td>
                                                </tr>
                                            ))}
                                            <tr className="total-row">
                                                <td colSpan={4} className="left">
                                                    JUMLAH
                                                </td>
                                                <td className="mid">{visitTotal}</td>
                                            </tr>
                                            {visitData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="mid" style={{ padding: "14px" }}>
                                                        Tidak ada data kunjungan pada periode ini.
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </tbody>
                                    </table>
                                </div>

                                <TandaTangan />
                            </>
                        )}
                    </TabsContent>

                    {/* ================= KETERLAMBATAN ================= */}
                    <TabsContent value="keterlambatan" className="space-y-4">
                        <Kop />

                        {!hasSearched ? (
                            <Card className="print:hidden">
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium mb-1">Laporan Keterlambatan</p>
                                    <p className="text-sm mb-4">
                                        Menampilkan seluruh buku yang belum dikembalikan dan sudah lewat
                                        jatuh tempo.
                                    </p>
                                    {/* Tab ini punya tombol sendiri karena tidak
                                        butuh filter tanggal. */}
                                    <Button onClick={handleSearch} disabled={loading}>
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Generate Laporan
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <Ringkasan
                                    cols={3}
                                    items={[
                                        { label: "Total Terlambat", value: overdueTotal },
                                        { label: "Terlama (hari)", value: overdueSummary.worst },
                                        { label: "Total Denda", value: formatCurrency(overdueSummary.totalFines) },
                                    ]}
                                />
                                <PeringatanTerpotong />

                                <div className="rounded-lg border overflow-x-auto">
                                    <table className="report-table">
                                        <thead className="report-thead">
                                            <tr>
                                                <th style={{ width: "5%" }}>No</th>
                                                <th style={{ width: "22%" }}>Nama Anggota</th>
                                                <th style={{ width: "13%" }}>Kelas</th>
                                                {/* Judul buku diberi ruang terbesar —
                                                    dulu dipotong 200px dan berakhir "…". */}
                                                <th style={{ width: "28%" }}>Judul Buku</th>
                                                <th style={{ width: "12%" }}>Tgl Pinjam</th>
                                                <th style={{ width: "12%" }}>Jatuh Tempo</th>
                                                <th style={{ width: "8%" }}>Terlambat</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {overdueData.map((item, index) => (
                                                <tr key={item.id} className="report-row">
                                                    <td className="mid">{index + 1}</td>
                                                    <td className="left">{item.member?.name || "-"}</td>
                                                    <td className="left">{item.member?.className || "-"}</td>
                                                    <td className="left">{item.item?.catalog?.title || "-"}</td>
                                                    <td className="mid">{formatDate(item.borrowDate)}</td>
                                                    <td className="mid">{formatDate(item.dueDate)}</td>
                                                    <td className="mid" style={{ fontWeight: 700 }}>
                                                        {daysOverdue(item.dueDate)} hari
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="total-row">
                                                <td colSpan={6} className="left">
                                                    JUMLAH
                                                </td>
                                                <td className="mid">{overdueTotal}</td>
                                            </tr>
                                            {overdueData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="mid" style={{ padding: "14px" }}>
                                                        Tidak ada buku yang terlambat.
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </tbody>
                                    </table>
                                </div>

                                <TandaTangan />
                            </>
                        )}
                    </TabsContent>

                    {/* ================= INVENTARIS ================= */}
                    <TabsContent value="inventaris" className="space-y-4">
                        <Kop />

                        {!hasSearched ? (
                            <Card className="print:hidden">
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium mb-1">Laporan Inventaris</p>
                                    <p className="text-sm mb-4">
                                        Rekapitulasi koleksi perpustakaan menurut status dan klasifikasi
                                        DDC.
                                    </p>
                                    <Button onClick={handleSearch} disabled={loading}>
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Generate Laporan
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : inventoryData ? (
                            <>
                                <Ringkasan
                                    cols={5}
                                    items={[
                                        { label: "Total Koleksi", value: inventoryData.total },
                                        { label: "Tersedia", value: inventoryData.byStatus?.AVAILABLE ?? 0 },
                                        { label: "Dipinjam", value: inventoryData.byStatus?.BORROWED ?? 0 },
                                        { label: "Rusak", value: inventoryData.byStatus?.DAMAGED ?? 0 },
                                        { label: "Hilang", value: inventoryData.byStatus?.LOST ?? 0 },
                                    ]}
                                />

                                {/* Distribusi DDC: batang di layar (mudah dipindai
                                    sekilas), tabel di kertas (bisa dibaca & dijumlah). */}
                                <Card className="print:hidden">
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <BarChart3 className="h-4 w-4 text-primary" />
                                            Distribusi Kategori (DDC)
                                        </CardTitle>
                                        <CardDescription>
                                            Jumlah buku menurut klasifikasi Dewey Decimal
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {categoryRows.map((r) => (
                                                <div key={r.category} className="space-y-1">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="font-medium">{r.label}</span>
                                                        <span className="text-muted-foreground">
                                                            {r.count} ({r.percent}%)
                                                        </span>
                                                    </div>
                                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                                                            style={{ width: `${r.percent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="hidden print:block" style={{ fontWeight: 700, fontSize: "10px" }}>
                                    DISTRIBUSI KATEGORI (DDC)
                                </div>

                                <div className="rounded-lg border overflow-x-auto">
                                    <table className="report-table">
                                        <thead className="report-thead">
                                            <tr>
                                                <th style={{ width: "6%" }}>No</th>
                                                <th style={{ width: "52%" }}>Kategori</th>
                                                <th style={{ width: "21%" }}>Jumlah</th>
                                                <th style={{ width: "21%" }}>Persentase</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {categoryRows.map((r, i) => (
                                                <tr key={r.category} className="report-row">
                                                    <td className="mid">{i + 1}</td>
                                                    <td className="left">{r.label}</td>
                                                    <td className="mid">{r.count}</td>
                                                    <td className="mid">{r.percent}%</td>
                                                </tr>
                                            ))}
                                            <tr className="total-row">
                                                <td colSpan={2} className="left">
                                                    JUMLAH
                                                </td>
                                                <td className="mid">{inventoryData.total}</td>
                                                <td className="mid">100%</td>
                                            </tr>
                                            {categoryRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="mid" style={{ padding: "14px" }}>
                                                        Belum ada koleksi tercatat.
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </tbody>
                                    </table>
                                </div>

                                <TandaTangan />
                            </>
                        ) : null}
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}
