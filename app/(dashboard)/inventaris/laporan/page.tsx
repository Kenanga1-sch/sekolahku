"use client";

import { useEffect, useState } from "react";
import {
    TrendingDown,
    AlertTriangle,
    Package,
    ArrowLeft,
    Printer,
    RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { InventoryStats } from "@/types/inventory";
import { showError } from "@/lib/toast";
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { goGet } from "@/lib/api-client";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { siteConfig } from "@/lib/config";

export default function LaporanPage() {
    const { settings } = useSchoolSettings();
    const [stats, setStats] = useState<InventoryStats | null>(null);
    const [atkItems, setAtkItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const schoolName = settings?.school_name || siteConfig.school.name;
    const schoolAddress = settings?.school_address || siteConfig.school.address;
    const schoolPhone = settings?.school_phone || siteConfig.school.phone;
    const schoolNPSN = settings?.school_npsn || siteConfig.school.npsn;
    const principalName = settings?.principal_name || "";
    const principalNIP = settings?.principal_nip || "";

    async function loadStats() {
        setLoading(true);
        try {
            const res: any = await goGet("/api/inventory/stats");
            setStats(res.data || res);

            const resAtk: any = await goGet("/api/inventory/items?limit=1000");
            setAtkItems(resAtk.items || resAtk.data || []);
        } catch (error) {
            console.error("Failed to load inventory stats:", error);
            showError("Gagal memuat data laporan");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadStats();
    }, []);

    const handlePrint = () => {
        window.print();
    };

    const conditionData = stats
        ? [
              { name: "Baik", value: stats.itemsGood, color: "#10B981" },
              { name: "Rusak", value: stats.itemsDamaged, color: "#EF4444" },
              { name: "Hilang", value: stats.itemsLost, color: "#6B7280" },
          ]
        : [];

    const totalAtkValue = atkItems.reduce(
        (sum, item) => sum + item.currentStock * item.price,
        0
    );

    const today = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    return (
        <>
        <style>{`
            @media print {
                @page {
                    size: A4 portrait;
                    margin: 10mm;
                }
                body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .no-print,
                header, aside,
                .print\\:hidden {
                    display: none !important;
                }
                .print-only {
                    display: block !important;
                }
                .print-page {
                    background: white !important;
                }
                .print-card {
                    border: 1px solid #000 !important;
                    box-shadow: none !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }
                .print-table-wrap {
                    overflow: visible !important;
                    border: 1px solid #000 !important;
                }
                .print-table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    font-size: 9px !important;
                }
                .print-table th,
                .print-table td {
                    border: 0.5px solid #000 !important;
                    padding: 3px 5px !important;
                    text-align: left !important;
                    vertical-align: middle !important;
                }
                .print-table th {
                    background-color: #f0f0f0 !important;
                    font-weight: 700 !important;
                    text-align: center !important;
                }
                .print-table td {
                    text-align: center !important;
                }
                .print-table td:nth-child(2),
                .print-table td:nth-child(3) {
                    text-align: left !important;
                }
                .print-thead {
                    display: table-header-group !important;
                }
                .print-tr-break {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }
                .print-summary-grid {
                    display: grid !important;
                    grid-template-columns: repeat(3, 1fr) !important;
                    gap: 4px !important;
                    margin-bottom: 8px !important;
                }
                .print-summary-item {
                    border: 1px solid #000 !important;
                    padding: 6px !important;
                    text-align: center !important;
                    page-break-inside: avoid !important;
                }
                .print-summary-label {
                    font-size: 8px !important;
                    color: #555 !important;
                }
                .print-summary-value {
                    font-size: 14px !important;
                    font-weight: 700 !important;
                }
                .print-kop {
                    border-bottom: 2px solid #000 !important;
                    padding-bottom: 6px !important;
                    margin-bottom: 4px !important;
                }
                .print-signature {
                    margin-top: 16px !important;
                    page-break-inside: avoid !important;
                }
                .print-signature-grid {
                    display: grid !important;
                    grid-template-columns: 1fr 1fr !important;
                    gap: 40px !important;
                    margin-top: 24px !important;
                }
                .print-signature-item {
                    text-align: center !important;
                }
                .print-signature-line {
                    margin-top: 40px !important;
                    border-top: 1px solid #000 !important;
                    display: block !important;
                }
                .print-chart-container {
                    height: 160px !important;
                }
                .print-chart-legend {
                    display: flex !important;
                    justify-content: center !important;
                    gap: 12px !important;
                    margin-top: 4px !important;
                    font-size: 9px !important;
                }
            }
        `}</style>

        <div className="space-y-6">
            {/* ======== SCREEN HEADER ======== */}
            <div className="flex items-center gap-4 no-print">
                <Link href="/inventaris">
                    <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200 bg-white shadow-sm hover:bg-slate-50" aria-label="Kembali"><ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Laporan Inventaris</h1>
                    <p className="text-muted-foreground">
                        Ringkasan statistik, kondisi aset, dan stok ATK.
                    </p>
                </div>
            </div>

            {/* ======== SCREEN ACTIONS ======== */}
            <div className="flex justify-end gap-2 no-print">
                <Button variant="outline" size="sm" onClick={loadStats} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Cetak / Simpan PDF
                </Button>
            </div>

            {/* ======== PRINT KOP HEADER ======== */}
            <div className="hidden print-only print-kop">
                <div style={{ textAlign: "center", marginBottom: "2px" }}>
                    <h1 style={{ margin: 0, fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {schoolName}
                    </h1>
                    <p style={{ margin: "1px 0", fontSize: "10px" }}>{schoolAddress}</p>
                    <p style={{ margin: "1px 0", fontSize: "10px" }}>NPSN: {schoolNPSN} | Telp: {schoolPhone}</p>
                </div>
                <hr style={{ border: "none", borderTop: "2px solid #000", marginTop: "4px" }} />
            </div>

            {/* ======== TABS ======== */}
            <Tabs defaultValue="aset" className="space-y-6">
                <TabsList className="no-print">
                    <TabsTrigger value="aset">Laporan Aset Tetap</TabsTrigger>
                    <TabsTrigger value="atk">Laporan Stok ATK</TabsTrigger>
                </TabsList>

                {/* ==================== TAB ASET TETAP ==================== */}
                <TabsContent value="aset" className="space-y-6">

                    {/* Print Title */}
                    <div className="hidden print-only" style={{ textAlign: "center", marginBottom: "4px" }}>
                        <h2 style={{ margin: 0, fontSize: "13px", fontWeight: 700, textDecoration: "underline" }}>
                            LAPORAN ASET TETAP
                        </h2>
                        <p style={{ margin: "1px 0", fontSize: "10px" }}>Posisi per {today}</p>
                    </div>

                    {/* Summary Grid — Screen */}
                    <div className="grid gap-4 md:grid-cols-3 no-print">
                        <Card>
                            <CardHeader><CardTitle className="text-sm font-medium">Total Aset</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats?.totalAssets || 0}</div>
                                <p className="text-xs text-muted-foreground">Unit barang terdaftar</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle className="text-sm font-medium">Total Item Fisik</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats?.totalItems || 0}</div>
                                <p className="text-xs text-muted-foreground">Jumlah keseluruhan unit</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle className="text-sm font-medium">Estimasi Nilai</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(stats?.totalValue || 0)}</div>
                                <p className="text-xs text-muted-foreground">Total nilai aset</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Summary Grid — Print */}
                    <div className="hidden print-only print-summary-grid">
                        <div className="print-summary-item">
                            <div className="print-summary-value">{stats?.totalAssets || 0}</div>
                            <div className="print-summary-label">Total Aset (Unit)</div>
                        </div>
                        <div className="print-summary-item">
                            <div className="print-summary-value">{stats?.totalItems || 0}</div>
                            <div className="print-summary-label">Total Item Fisik</div>
                        </div>
                        <div className="print-summary-item">
                            <div className="print-summary-value">{formatCurrency(stats?.totalValue || 0)}</div>
                            <div className="print-summary-label">Estimasi Nilai (Rp)</div>
                        </div>
                    </div>

                    {/* Chart + Attention — Screen */}
                    <div className="grid gap-4 md:grid-cols-2 no-print">
                        <Card className="print:break-inside-avoid">
                            <CardHeader>
                                <CardTitle>Distribusi Kondisi</CardTitle>
                                <CardDescription>Persentase kondisi fisik aset</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={conditionData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {conditionData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex justify-center gap-6 mt-4">
                                    {conditionData.map((item) => (
                                        <div key={item.name} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span className="text-sm text-muted-foreground">
                                                {item.name} ({item.value})
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="print:break-inside-avoid">
                            <CardHeader>
                                <CardTitle>Perlu Perhatian</CardTitle>
                                <CardDescription>Aset yang memerlukan tindakan lanjut</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {stats?.itemsDamaged ? (
                                        <div className="flex items-center gap-4 p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/20">
                                            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full">
                                                <TrendingDown className="h-4 w-4 text-red-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-red-900 dark:text-red-200">{stats.itemsDamaged} Item Rusak</p>
                                                <p className="text-sm text-red-700 dark:text-red-300">Perlu perbaikan atau penghapusan aset</p>
                                            </div>
                                        </div>
                                    ) : null}

                                    {stats?.itemsLost ? (
                                        <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-950/20">
                                            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                                                <AlertTriangle className="h-4 w-4 text-gray-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900 dark:text-gray-200">{stats.itemsLost} Item Hilang</p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">Perlu investigasi atau pelaporan</p>
                                            </div>
                                        </div>
                                    ) : null}

                                    {!stats?.itemsDamaged && !stats?.itemsLost && (
                                        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                                            <Package className="h-8 w-8 text-green-500 mb-2 opacity-50" />
                                            <p>Semua aset dalam kondisi baik.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Print: Condition Table (simpler than chart) */}
                    <div className="hidden print-only print-card" style={{ padding: "8px", marginBottom: "4px" }}>
                        <div style={{ fontWeight: 700, fontSize: "10px", marginBottom: "4px" }}>DISTRIBUSI KONDISI ASET</div>
                        <div className="print-table-wrap">
                            <table className="print-table">
                                <thead className="print-thead">
                                    <tr>
                                        <th>No</th>
                                        <th>Kondisi</th>
                                        <th>Jumlah</th>
                                        <th>Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {conditionData.map((item, i) => (
                                        <tr key={item.name} className="print-tr-break">
                                            <td>{i + 1}</td>
                                            <td style={{ textAlign: "left" }}>{item.name}</td>
                                            <td>{item.value}</td>
                                            <td style={{ textAlign: "left" }}>
                                                {item.name === "Baik" ? "Aset siap digunakan" :
                                                 item.name === "Rusak" ? "Perlu perbaikan / penghapusan" :
                                                 "Perlu investigasi lebih lanjut"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Signature Block — Print */}
                    <div className="hidden print-only print-signature">
                        <div className="print-signature-grid">
                            <div className="print-signature-item">
                                <p style={{ fontSize: "10px" }}>Mengetahui,</p>
                                <p style={{ fontSize: "10px", fontWeight: 600 }}>Kepala Sekolah</p>
                                <span className="print-signature-line" />
                                <p style={{ fontSize: "9px", marginTop: "2px" }}>{principalName || "________________"}</p>
                                <p style={{ fontSize: "9px" }}>NIP. {principalNIP || "__________"}</p>
                            </div>
                            <div className="print-signature-item">
                                <p style={{ fontSize: "10px" }}>{today}</p>
                                <p style={{ fontSize: "10px", fontWeight: 600 }}>Pengurus Inventaris</p>
                                <span className="print-signature-line" />
                                <p style={{ fontSize: "9px", marginTop: "2px" }}>________________</p>
                                <p style={{ fontSize: "9px" }}>NIP. __________</p>
                            </div>
                        </div>
                    </div>

                </TabsContent>

                {/* ==================== TAB STOK ATK ==================== */}
                <TabsContent value="atk" className="space-y-6">

                    {/* Print Title */}
                    <div className="hidden print-only" style={{ textAlign: "center", marginBottom: "4px" }}>
                        <h2 style={{ margin: 0, fontSize: "13px", fontWeight: 700, textDecoration: "underline" }}>
                            LAPORAN STOK BARANG HABIS PAKAI (ATK)
                        </h2>
                        <p style={{ margin: "1px 0", fontSize: "10px" }}>Posisi per {today}</p>
                    </div>

                    {/* Summary — Screen */}
                    <Card className="no-print">
                        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border">
                            <div>
                                <p className="text-xs text-muted-foreground">Total Item</p>
                                <p className="text-xl font-bold">{atkItems.length}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Total Nilai Persediaan</p>
                                <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalAtkValue)}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Summary — Print */}
                    <div className="hidden print-only print-summary-grid" style={{ gridTemplateColumns: "repeat(2, 1fr) !important" }}>
                        <div className="print-summary-item">
                            <div className="print-summary-value">{atkItems.length}</div>
                            <div className="print-summary-label">Total Item ATK</div>
                        </div>
                        <div className="print-summary-item">
                            <div className="print-summary-value" style={{ color: "#059669" }}>{formatCurrency(totalAtkValue)}</div>
                            <div className="print-summary-label">Total Nilai Persediaan (Rp)</div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="print-table-wrap rounded-lg border overflow-hidden">
                        <Table className="print-table">
                            <TableHeader className="print-thead">
                                <TableRow>
                                    <TableHead style={{ width: "4%", textAlign: "center" }}>No</TableHead>
                                    <TableHead style={{ width: "12%" }}>Kode</TableHead>
                                    <TableHead style={{ width: "28%" }}>Nama Barang</TableHead>
                                    <TableHead style={{ width: "14%" }}>Kategori</TableHead>
                                    <TableHead style={{ width: "8%", textAlign: "center" }}>Stok</TableHead>
                                    <TableHead style={{ width: "8%", textAlign: "center" }}>Satuan</TableHead>
                                    <TableHead style={{ width: "13%", textAlign: "right" }}>Harga (Rp)</TableHead>
                                    <TableHead style={{ width: "13%", textAlign: "right" }}>Total Nilai (Rp)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {atkItems.map((item, index) => (
                                    <TableRow key={item.id} className="print-tr-break">
                                        <TableCell style={{ textAlign: "center" }}>{index + 1}</TableCell>
                                        <TableCell style={{ fontFamily: "monospace", fontSize: "8px" }}>{item.code || "-"}</TableCell>
                                        <TableCell style={{ textAlign: "left" }}>{item.name}</TableCell>
                                        <TableCell style={{ textAlign: "left" }}>{item.category || "-"}</TableCell>
                                        <TableCell style={{
                                            textAlign: "center",
                                            fontWeight: item.currentStock <= (item.minStock || 0) ? 700 : 400,
                                            color: item.currentStock <= (item.minStock || 0) ? "#dc2626" : "inherit",
                                        }}>
                                            {item.currentStock}
                                        </TableCell>
                                        <TableCell style={{ textAlign: "center" }}>{item.unit || "-"}</TableCell>
                                        <TableCell style={{ textAlign: "right" }}>{formatCurrency(item.price)}</TableCell>
                                        <TableCell style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(item.currentStock * item.price)}</TableCell>
                                    </TableRow>
                                ))}
                                {atkItems.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} style={{ textAlign: "center", padding: "16px" }}>
                                            Tidak ada data barang habis pakai.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Signature Block — Print */}
                    <div className="hidden print-only print-signature">
                        <div className="print-signature-grid">
                            <div className="print-signature-item">
                                <p style={{ fontSize: "10px" }}>Mengetahui,</p>
                                <p style={{ fontSize: "10px", fontWeight: 600 }}>Kepala Sekolah</p>
                                <span className="print-signature-line" />
                                <p style={{ fontSize: "9px", marginTop: "2px" }}>{principalName || "________________"}</p>
                                <p style={{ fontSize: "9px" }}>NIP. {principalNIP || "__________"}</p>
                            </div>
                            <div className="print-signature-item">
                                <p style={{ fontSize: "10px" }}>{today}</p>
                                <p style={{ fontSize: "10px", fontWeight: 600 }}>Pengurus Inventaris</p>
                                <span className="print-signature-line" />
                                <p style={{ fontSize: "9px", marginTop: "2px" }}>________________</p>
                                <p style={{ fontSize: "9px" }}>NIP. __________</p>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
        </>
    );
}
