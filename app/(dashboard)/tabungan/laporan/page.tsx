"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    Wallet,
    Download,
    Calendar,
    ArrowLeft,
    Printer,
} from "lucide-react";
import Link from "next/link";
import { showSuccess, showError } from "@/lib/toast";
import { goGet } from "@/lib/api-client";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { KopSurat } from "@/components/reports/kop-surat";
import type { TabunganStats, TabunganTransaksiWithRelations, TabunganKelas } from "@/types/tabungan";

function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

type PeriodType = "today" | "week" | "month" | "year";

function getDateRange(period: PeriodType): { start: string; end: string } {
    const now = new Date();
    const end = now.toISOString();
    let start: Date;

    switch (period) {
        case "today":
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case "week": {
            // Awal minggu = Senin (getDay(): Minggu=0 .. Sabtu=6).
            const day = (now.getDay() + 6) % 7;
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
            break;
        }
        case "month":
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case "year":
            start = new Date(now.getFullYear(), 0, 1);
            break;
        default:
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    return { start: start.toISOString(), end };
}

export default function TabunganLaporanPage() {
    const { settings } = useSchoolSettings();
    const [stats, setStats] = useState<TabunganStats | null>(null);
    const [transactions, setTransactions] = useState<TabunganTransaksiWithRelations[]>([]);
    const [kelasList, setKelasList] = useState<TabunganKelas[]>([]);
    const [period, setPeriod] = useState<PeriodType>("month");
    const [isLoading, setIsLoading] = useState(true);
    // Menandai data yang tampil tidak mencakup seluruh periode (dipotong batas server).
    const [terpotong, setTerpotong] = useState(false);
    const [totalTransaksi, setTotalTransaksi] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setTerpotong(false);
            try {
                const { start, end } = getDateRange(period);

                const statsPromise = goGet("/api/tabungan/stats");

                // fetchAll=1: jalur laporan di backend, mengambil seluruh baris
                // dalam periode (berbatas). Dulu memakai perPage=10000 yang
                // diam-diam dipotong ke 100 — ringkasan pun menjumlah dari
                // sebagian data saja.
                const transParams = new URLSearchParams({
                    startDate: start,
                    endDate: end,
                    fetchAll: "1",
                });
                const transPromise = goGet(`/api/tabungan/transaksi?${transParams.toString()}`);

                const kelasPromise = goGet("/api/tabungan/kelas");

                const [statsData, transRes, kelasRes] = await Promise.all([
                    statsPromise,
                    transPromise,
                    kelasPromise,
                ]);

                if (statsData.error) throw new Error(statsData.error);
                if (transRes.error) throw new Error(transRes.error);
                if (kelasRes.error) throw new Error(kelasRes.error);

                const items: TabunganTransaksiWithRelations[] =
                    (transRes as any).items || (transRes as any).data || [];
                const total: number =
                    typeof (transRes as any).totalItems === "number"
                        ? (transRes as any).totalItems
                        : items.length;
                setStats(((statsData as any).data || statsData) as any);
                setTransactions(items);
                setTotalTransaksi(total);
                setTerpotong(items.length < total);
                setKelasList(Array.isArray(kelasRes) ? (kelasRes as any) : (kelasRes as any).items || (kelasRes as any).data || []);
            } catch (error) {
                console.error("Failed to fetch report data:", error);
                showError("Gagal memuat data laporan");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [period]);

    // Calculate period stats
    const periodStats = {
        totalSetor: transactions
            .filter((t) => t.tipe === "setor")
            .reduce((sum, t) => sum + t.nominal, 0),
        totalTarik: transactions
            .filter((t) => t.tipe === "tarik")
            .reduce((sum, t) => sum + t.nominal, 0),
        jumlahTransaksi: transactions.length,
    };

    const handleExport = () => {
        const headers = ["Tanggal", "Siswa", "Kelas", "Tipe", "Nominal", "Status"];
        // Nilai di-quote dan escape: nama berisi koma/kutip tidak boleh
        // merusak kolom (dulu join(",") polos).
        const rows = transactions.map((t) => [
            new Date(t.createdAt || "").toLocaleDateString("id-ID"),
            t.siswa?.nama || "-",
            t.siswa?.kelas?.nama || "-",
            t.tipe,
            t.nominal.toString(),
            t.status,
        ]);
        const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
        // BOM supaya Excel membaca UTF-8 dengan benar.
        const csv = "\uFEFF" + [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `laporan-tabungan-${period}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        showSuccess("Laporan berhasil diunduh");
    };

    const periodLabels: Record<PeriodType, string> = {
        today: "Hari Ini",
        week: "Minggu Ini",
        month: "Bulan Ini",
        year: "Tahun Ini",
    };

    const range = getDateRange(period);
    const periodeTeks = `${range.start.slice(0, 10)} s.d. ${range.end.slice(0, 10)}`;

    // Peringatan bila data periode tidak dimuat seluruhnya: ringkasan di bawah
    // menjumlah dari baris yang ada, jadi pengguna perlu tahu angkanya bisa
    // kurang dari kenyataan.
    const peringatanTerpotong =
        terpotong ? (
            <p className="text-xs text-amber-700 print:hidden">
                Perhatian: data tidak termuat seluruhnya ({transactions.length} dari {totalTransaksi}{" "}
                transaksi). Angka ringkasan di halaman ini mungkin kurang dari sebenarnya — persempit periode.
            </p>
        ) : null;

    const tandaTanggal = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    return (
        <div className="space-y-6">
            {/* Gaya tabel: berlaku di LAYAR maupun CETAK (pola yang sama dengan
                inventaris & perpustakaan — dulu halaman ini sama sekali tak punya
                tabel). */}
            <style>{`
                .tb-laporan { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
                .tb-laporan th, .tb-laporan td { border: 1px solid #e2e8f0; padding: 6px 8px; overflow-wrap: break-word; }
                .tb-laporan th { background: #f8fafc; font-weight: 700; text-align: center; }
                .tb-laporan td.num { text-align: right; white-space: nowrap; }
                .tb-laporan td.mid { text-align: center; }
                .tb-laporan tr.total-row td { font-weight: 700; background: #f8fafc; }
                .tb-laporan tbody tr:hover { background: #f8fafc; }
                @media print {
                    .tb-laporan { font-size: 9px !important; }
                    .tb-laporan th, .tb-laporan td { border: 0.5px solid #000 !important; padding: 3px 4px !important; }
                    .tb-laporan th { background: #f0f0f0 !important; }
                    .tb-laporan tbody tr:hover { background: transparent !important; }
                    .tb-laporan thead { display: table-header-group; }
                    .tb-laporan tr { page-break-inside: avoid; }
                }
                @page { size: A4 portrait; margin: 12mm 10mm; }
            `}</style>

            {/* Kop surat hanya saat cetak (pola KopSurat: hidden print:block) */}
            <KopSurat
                schoolName={settings?.school_name}
                schoolAddress={settings?.school_address}
                schoolPhone={settings?.school_phone}
                schoolNpsn={settings?.school_npsn}
                schoolLogo={settings?.school_logo}
                title="LAPORAN TABUNGAN SISWA"
                subtitle={`Periode: ${periodeTeks}`}
            />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
                <div className="flex items-center gap-4">
                    <Link href="/tabungan">
                        <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200 bg-white shadow-sm hover:bg-slate-50">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Laporan Tabungan</h1>
                        <p className="text-muted-foreground">
                            Statistik dan analisis tabungan siswa
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                        <SelectTrigger className="w-40">
                            <Calendar className="h-4 w-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Hari Ini</SelectItem>
                            <SelectItem value="week">Minggu Ini</SelectItem>
                            <SelectItem value="month">Bulan Ini</SelectItem>
                            <SelectItem value="year">Tahun Ini</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={handleExport} disabled={transactions.length === 0}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                    <Button variant="outline" onClick={() => window.print()} disabled={transactions.length === 0}>
                        <Printer className="h-4 w-4 mr-2" />
                        Cetak / PDF
                    </Button>
                </div>
            </div>

            {peringatanTerpotong}

            {/* Overall Stats — layar saja; versi cetak memakai tabel di bawah */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Saldo
                        </CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-32" />
                        ) : (
                            <div className="text-2xl font-bold text-green-600">
                                {formatRupiah(stats?.totalSaldo || 0)}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Siswa
                        </CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <div className="text-2xl font-bold">{stats?.totalSiswa || 0}</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Kelas
                        </CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <div className="text-2xl font-bold">{kelasList.length}</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Rata-rata Saldo
                        </CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <div className="text-2xl font-bold text-blue-600">
                                {formatRupiah(
                                    stats?.totalSiswa ? Math.round(stats.totalSaldo / stats.totalSiswa) : 0
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Period Stats */}
            <Card className="print:hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Laporan {periodLabels[period]}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="p-6 bg-green-50 dark:bg-green-950/30 rounded-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <TrendingUp className="h-5 w-5 text-green-600" />
                                <span className="text-sm text-muted-foreground">Total Setoran</span>
                            </div>
                            {isLoading ? (
                                <Skeleton className="h-10 w-32" />
                            ) : (
                                <p className="text-3xl font-bold text-green-600">
                                    {formatRupiah(periodStats.totalSetor)}
                                </p>
                            )}
                        </div>

                        <div className="p-6 bg-red-50 dark:bg-red-950/30 rounded-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <TrendingDown className="h-5 w-5 text-red-600" />
                                <span className="text-sm text-muted-foreground">Total Penarikan</span>
                            </div>
                            {isLoading ? (
                                <Skeleton className="h-10 w-32" />
                            ) : (
                                <p className="text-3xl font-bold text-red-600">
                                    {formatRupiah(periodStats.totalTarik)}
                                </p>
                            )}
                        </div>

                        <div className="p-6 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <BarChart3 className="h-5 w-5 text-blue-600" />
                                <span className="text-sm text-muted-foreground">Jumlah Transaksi</span>
                            </div>
                            {isLoading ? (
                                <Skeleton className="h-10 w-16" />
                            ) : (
                                <p className="text-3xl font-bold text-blue-600">
                                    {periodStats.jumlahTransaksi}
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Net Change */}
            <Card className="print:hidden">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Perubahan Bersih ({periodLabels[period]})</p>
                            {isLoading ? (
                                <Skeleton className="h-10 w-40 mt-2" />
                            ) : (
                                <p
                                    className={`text-3xl font-bold ${periodStats.totalSetor - periodStats.totalTarik >= 0
                                            ? "text-green-600"
                                            : "text-red-600"
                                        }`}
                                >
                                    {periodStats.totalSetor - periodStats.totalTarik >= 0 ? "+" : ""}
                                    {formatRupiah(periodStats.totalSetor - periodStats.totalTarik)}
                                </p>
                            )}
                        </div>
                        <div
                            className={`p-4 rounded-full ${periodStats.totalSetor - periodStats.totalTarik >= 0
                                    ? "bg-green-100 dark:bg-green-900/30"
                                    : "bg-red-100 dark:bg-red-900/30"
                                }`}
                        >
                            {periodStats.totalSetor - periodStats.totalTarik >= 0 ? (
                                <TrendingUp className="h-8 w-8 text-green-600" />
                            ) : (
                                <TrendingDown className="h-8 w-8 text-red-600" />
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── Versi cetak: ringkasan kotak + tabel rincian + tanda tangan ──
                Layar memakai kartu; kertas memakai blok ini (grid bergaris
                supaya terbaca di hitam-putih). */}
            <div className="hidden print:block space-y-3">
                <div
                    className="grid gap-4"
                    style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
                >
                    <div style={{ border: "1px solid #000", padding: 5, textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{formatRupiah(stats?.totalSaldo || 0)}</div>
                        <div style={{ fontSize: 8, color: "#555" }}>TOTAL SALDO</div>
                    </div>
                    <div style={{ border: "1px solid #000", padding: 5, textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{stats?.totalSiswa || 0}</div>
                        <div style={{ fontSize: 8, color: "#555" }}>TOTAL SISWA</div>
                    </div>
                    <div style={{ border: "1px solid #000", padding: 5, textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{formatRupiah(periodStats.totalSetor)}</div>
                        <div style={{ fontSize: 8, color: "#555" }}>TOTAL SETORAN</div>
                    </div>
                    <div style={{ border: "1px solid #000", padding: 5, textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{formatRupiah(periodStats.totalTarik)}</div>
                        <div style={{ fontSize: 8, color: "#555" }}>TOTAL PENARIKAN</div>
                    </div>
                </div>

                <table className="tb-laporan">
                    <thead>
                        <tr>
                            <th style={{ width: "5%" }}>No</th>
                            <th style={{ width: "12%" }}>Tanggal</th>
                            <th style={{ width: "25%" }}>Siswa</th>
                            <th style={{ width: "13%" }}>Kelas</th>
                            <th style={{ width: "10%" }}>Tipe</th>
                            <th style={{ width: "15%" }}>Nominal</th>
                            <th style={{ width: "10%" }}>Status</th>
                            <th style={{ width: "10%" }}>Petugas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((t, i) => (
                            <tr key={t.id || i}>
                                <td className="mid">{i + 1}</td>
                                <td className="mid">
                                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString("id-ID") : "-"}
                                </td>
                                <td>{t.siswa?.nama || "-"}</td>
                                <td className="mid">{t.siswa?.kelas?.nama || "-"}</td>
                                <td className="mid">{t.tipe === "setor" ? "Setor" : "Tarik"}</td>
                                <td className="num">{formatRupiah(t.nominal)}</td>
                                <td className="mid">{t.status}</td>
                                <td className="mid">{t.user?.name || "-"}</td>
                            </tr>
                        ))}
                        {transactions.length === 0 && (
                            <tr>
                                <td colSpan={8} className="mid" style={{ padding: 12 }}>
                                    Tidak ada transaksi pada periode ini
                                </td>
                            </tr>
                        )}
                        <tr className="total-row">
                            <td colSpan={5}>JUMLAH</td>
                            <td className="num">
                                {formatRupiah(periodStats.totalSetor + periodStats.totalTarik)}
                            </td>
                            <td colSpan={2}>{periodStats.jumlahTransaksi} transaksi</td>
                        </tr>
                    </tbody>
                </table>

                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, textAlign: "center" }}>
                    <div>
                        <p style={{ fontSize: 11 }}>Mengetahui,</p>
                        <p style={{ fontSize: 11, fontWeight: 700 }}>Kepala Sekolah</p>
                        <div style={{ marginTop: 44, borderTop: "1px solid #000" }} />
                        <p style={{ fontSize: 9 }}>{settings?.principal_name || "________________"}</p>
                        <p style={{ fontSize: 9 }}>NIP. {settings?.principal_nip || "__________"}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: 11 }}>{tandaTanggal}</p>
                        <p style={{ fontSize: 11, fontWeight: 700 }}>Bendahara Sekolah</p>
                        <div style={{ marginTop: 44, borderTop: "1px solid #000" }} />
                        <p style={{ fontSize: 9 }}>________________</p>
                        <p style={{ fontSize: 9 }}>NIP. __________</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

