"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { KopSurat } from "@/components/reports/kop-surat";
import { goGet } from "@/lib/api-client";
import { getAllAssets } from "@/lib/inventory";
import {
    conditionTotals,
    grandTotals,
    groupByRoom,
    toAssetRows,
    unclassifiedTotal,
} from "@/lib/inventory/report-data";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { formatCurrency } from "@/lib/utils";
import type { InventoryAsset, InventoryOpname, InventoryStats } from "@/types/inventory";

const today = () =>
    new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

function formatDate(d?: string | null) {
    if (!d) return "-";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function LaporanPage() {
    const { settings } = useSchoolSettings();
    const [stats, setStats] = useState<InventoryStats | null>(null);
    const [assets, setAssets] = useState<InventoryAsset[]>([]);
    const [atkItems, setAtkItems] = useState<any[]>([]);
    const [opnames, setOpnames] = useState<InventoryOpname[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOpname, setSelectedOpname] = useState<string>("");

    async function loadData() {
        setLoading(true);
        try {
            const resStats: any = await goGet("/api/inventory/stats");
            setStats(resStats?.data || resStats);

            // Ambil seluruh halaman: backend memotong limit ke 200, sehingga
            // laporan yang hanya mengambil halaman pertama akan terpotong
            // tanpa tanda apa pun.
            const all = await getAllAssets();
            setAssets(Array.isArray(all) ? all : []);

            const resAtk: any = await goGet("/api/inventory/items?limit=200");
            setAtkItems(resAtk?.items || resAtk?.data || []);

            const resOp: any = await goGet("/api/inventory/opname?page=1&limit=50");
            const list: InventoryOpname[] = resOp?.items || [];
            setOpnames(list);
            setSelectedOpname((prev) => prev || (list[0]?.id ?? ""));
        } catch (error) {
            console.error("Gagal memuat data laporan:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    const rows = useMemo(() => toAssetRows(assets), [assets]);
    const groups = useMemo(() => groupByRoom(rows), [rows]);
    const totals = useMemo(() => grandTotals(rows), [rows]);
    const conditions = useMemo(() => conditionTotals(rows), [rows]);
    const unclassified = useMemo(() => unclassifiedTotal(rows), [rows]);
    const conditionSum = conditions.reduce((s, c) => s + c.count, 0);

    const totalAtkValue = atkItems.reduce((s, i) => s + (i.currentStock || 0) * (i.price || 0), 0);
    const selected = opnames.find((o) => o.id === selectedOpname) || opnames[0];

    // Baris opname hanya menyimpan asset_id (kolom inventory_opname_items tidak
    // punya kolom nama), jadi nama barang digabung dari daftar aset agar berita
    // acara tidak mencetak "-". Kode ikut ditampilkan bila tersedia.
    const assetNameById = useMemo(() => {
        const m = new Map<string, { name: string; code: string }>();
        for (const a of assets) m.set(a.id, { name: a.name || "-", code: a.code || "-" });
        return m;
    }, [assets]);

    const Kop = ({ title, subtitle }: { title: string; subtitle?: string }) => (
        <KopSurat
            schoolName={settings?.school_name}
            schoolAddress={settings?.school_address}
            schoolPhone={settings?.school_phone}
            schoolNpsn={settings?.school_npsn}
            schoolLogo={settings?.school_logo}
            title={title}
            subtitle={subtitle}
        />
    );

    const TandaTangan = () => (
        <div className="hidden print:block" style={{ marginTop: "18px" }}>
            <div className="grid grid-cols-2 gap-16 text-center">
                <div>
                    <p style={{ fontSize: "10px" }}>Mengetahui,</p>
                    <p style={{ fontSize: "10px", fontWeight: 600 }}>Kepala Sekolah</p>
                    <div style={{ marginTop: "44px", borderTop: "1px solid #000" }} />
                    <p style={{ fontSize: "9px", marginTop: "2px" }}>
                        {settings?.principal_name || "________________"}
                    </p>
                    <p style={{ fontSize: "9px" }}>NIP. {settings?.principal_nip || "__________"}</p>
                </div>
                <div>
                    <p style={{ fontSize: "10px" }}>{today()}</p>
                    <p style={{ fontSize: "10px", fontWeight: 600 }}>Pengurus Inventaris</p>
                    <div style={{ marginTop: "44px", borderTop: "1px solid #000" }} />
                    <p style={{ fontSize: "9px", marginTop: "2px" }}>________________</p>
                    <p style={{ fontSize: "9px" }}>NIP. __________</p>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 12mm 10mm; }
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

                    .report-table { width: 100% !important; border-collapse: collapse !important; font-size: 9px !important; table-layout: fixed !important; }
                    .report-table th, .report-table td { border: 0.5px solid #000 !important; padding: 3px 4px !important; }
                    .report-table th { background: #f0f0f0 !important; font-weight: 700 !important; text-align: center !important; }
                    .report-table td.num { text-align: right !important; white-space: nowrap !important; }
                    .report-table td.mid { text-align: center !important; }
                    .report-table td.left { text-align: left !important; word-break: break-word !important; }
                    .report-thead { display: table-header-group !important; }
                    .report-row { page-break-inside: avoid !important; break-inside: avoid !important; }

                    /* Tabel ke-luar-kertas: min-w-max pada komponen tabel membuat
                       lebarnya mengikuti konten terlebar. Saat cetak, lebar itu
                       meluber melewati pinggir kertas. */
                    .report-table { min-width: 0 !important; }
                    .report-table th, .report-table td { white-space: normal !important; word-break: break-word !important; }

                    .room-block { page-break-inside: avoid !important; break-inside: avoid !important; margin-bottom: 8px !important; }
                    .room-head { font-weight: 700 !important; font-size: 10px !important; margin: 6px 0 2px !important; }

                    .summary-grid { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 4px !important; margin-bottom: 8px !important; }
                    .summary-item { border: 1px solid #000 !important; padding: 5px !important; text-align: center !important; page-break-inside: avoid !important; }
                    .summary-value { font-size: 13px !important; font-weight: 700 !important; }
                    .summary-label { font-size: 8px !important; color: #555 !important; }

                    .page-break { break-before: page !important; page-break-before: always !important; }
                }
            `}</style>

            <div className="space-y-6">
                {/* Header layar */}
                <div className="flex items-center gap-4 print:hidden">
                    <Link href="/inventaris">
                        <Button variant="outline" size="icon" aria-label="Kembali">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Laporan Inventaris</h1>
                        <p className="text-muted-foreground">
                            Aset tetap, stok habis pakai, DIR, dan berita acara pemeriksaan.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-2 print:hidden">
                    <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Cetak / Simpan PDF
                    </Button>
                </div>

                {loading ? (
                    <Card className="print:hidden">
                        <CardContent className="py-10 text-center text-muted-foreground">
                            Memuat data laporan...
                        </CardContent>
                    </Card>
                ) : null}

                <Tabs defaultValue="aset" className="space-y-6">
                    <TabsList className="print:hidden">
                        <TabsTrigger value="aset">Laporan Aset Tetap</TabsTrigger>
                        <TabsTrigger value="atk">Stok Habis Pakai</TabsTrigger>
                        <TabsTrigger value="dir">DIR per Ruangan</TabsTrigger>
                        <TabsTrigger value="ba">Berita Acara Pemeriksaan</TabsTrigger>
                    </TabsList>

                    {/* ================= ASET TETAP ================= */}
                    <TabsContent value="aset" className="space-y-4">
                        <Kop title="LAPORAN ASET TETAP" subtitle={`Posisi per ${today()}`} />

                        <div className="hidden print:block summary-grid">
                            <div className="summary-item">
                                <div className="summary-value">{assets.length}</div>
                                <div className="summary-label">Jenis Aset</div>
                            </div>
                            <div className="summary-item">
                                <div className="summary-value">{totals.quantity}</div>
                                <div className="summary-label">Total Unit</div>
                            </div>
                            <div className="summary-item">
                                <div className="summary-value">{formatCurrency(totals.value)}</div>
                                <div className="summary-label">Nilai Aset</div>
                            </div>
                            <div className="summary-item">
                                <div className="summary-value">{groups.length}</div>
                                <div className="summary-label">Ruangan</div>
                            </div>
                        </div>

                        {/* Bila ringkasan server berbeda dari hasil hitung daftar,
                            tampilkan di layar supaya ketidakkonsistenan tidak
                            luput — misalnya aset aktif yang tak ikut terdaftar. */}
                        {stats && stats.totalAssets !== rows.length ? (
                            <p className="print:hidden text-xs text-amber-700">
                                Catatan: server melaporkan {stats.totalAssets} aset, sedangkan daftar
                                memuat {rows.length}. Periksa data yang belum lengkap.
                            </p>
                        ) : null}

                        {/* Ringkasan kondisi — dengan baris total agar angka tertutup */}
                        <div className="hidden print:block room-block">
                            <div className="room-head">REKAPITULASI KONDISI</div>
                            <table className="report-table">
                                <thead className="report-thead">
                                    <tr>
                                        <th style={{ width: "40%" }}>Kondisi</th>
                                        <th style={{ width: "20%" }}>Jumlah</th>
                                        <th style={{ width: "40%" }}>Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {conditions.map((c) => (
                                        <tr key={c.name} className="report-row">
                                            <td className="left">{c.name}</td>
                                            <td className="mid">{c.count}</td>
                                            <td className="left">
                                                {c.name === "Baik"
                                                    ? "Siap digunakan"
                                                    : c.name === "Hilang"
                                                      ? "Perlu investigasi"
                                                      : "Perlu perbaikan"}
                                            </td>
                                        </tr>
                                    ))}
                                    {unclassified > 0 ? (
                                        <tr className="report-row">
                                            <td className="left">Belum Diklasifikasi</td>
                                            <td className="mid">{unclassified}</td>
                                            <td className="left">Kondisi belum diisi</td>
                                        </tr>
                                    ) : null}
                                    <tr style={{ fontWeight: 700 }}>
                                        <td className="left">Jumlah</td>
                                        <td className="mid">{conditionSum + unclassified}</td>
                                        <td className="left">Total unit tercatat: {totals.quantity}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Daftar aset — inti laporan */}
                        <div className="rounded-lg border overflow-hidden">
                            <table className="report-table">
                                <thead className="report-thead">
                                    <tr>
                                        <th style={{ width: "4%" }}>No</th>
                                        <th style={{ width: "10%" }}>Kode</th>
                                        <th style={{ width: "21%" }}>Nama Barang</th>
                                        <th style={{ width: "11%" }}>Kategori</th>
                                        <th style={{ width: "12%" }}>Ruangan</th>
                                        <th style={{ width: "5%" }}>Qty</th>
                                        <th style={{ width: "5%" }}>Baik</th>
                                        <th style={{ width: "4%" }}>RR</th>
                                        <th style={{ width: "4%" }}>RB</th>
                                        <th style={{ width: "4%" }}>Hlg</th>
                                        {/* Nilai butuh ruang lebih: "Rp 25.000.000"
                                            tidak muat di kolom 11% dan pecah dua baris. */}
                                        <th style={{ width: "20%" }}>Nilai (Rp)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups.map((g) => (
                                        // Fragment shorthand tidak bisa diberi key,
                                        // jadi dipakai <Fragment> eksplisit.
                                        <Fragment key={g.roomName}>
                                            <tr className="report-row">
                                                <td colSpan={11} className="left" style={{ fontWeight: 700, background: "#f7f7f7" }}>
                                                    {g.roomName} — {g.rows.length} jenis, {g.totalQuantity} unit
                                                </td>
                                            </tr>
                                            {g.rows.map((r, i) => (
                                                <tr key={r.id} className="report-row">
                                                    <td className="mid">{i + 1}</td>
                                                    <td className="left">{r.code}</td>
                                                    <td className="left">{r.name}</td>
                                                    <td className="left">{r.category}</td>
                                                    <td className="left">{r.roomName}</td>
                                                    <td className="mid">{r.quantity}</td>
                                                    <td className="mid">{r.good}</td>
                                                    <td className="mid">{r.lightDamaged}</td>
                                                    <td className="mid">{r.heavyDamaged}</td>
                                                    <td className="mid">{r.lost}</td>
                                                    <td className="num">{formatCurrency(r.value)}</td>
                                                </tr>
                                            ))}
                                            <tr className="report-row">
                                                <td colSpan={5} className="left" style={{ fontStyle: "italic" }}>
                                                    Sub-total {g.roomName}
                                                </td>
                                                <td className="mid" style={{ fontWeight: 700 }}>
                                                    {g.totalQuantity}
                                                </td>
                                                <td colSpan={4} />
                                                <td className="num" style={{ fontWeight: 700 }}>
                                                    {formatCurrency(g.totalValue)}
                                                </td>
                                            </tr>
                                        </Fragment>
                                    ))}
                                    <tr style={{ fontWeight: 700 }}>
                                        <td colSpan={5} className="left">
                                            JUMLAH KESELURUHAN
                                        </td>
                                        <td className="mid">{totals.quantity}</td>
                                        <td className="mid">{conditions[0]?.count ?? 0}</td>
                                        <td className="mid">{conditions[1]?.count ?? 0}</td>
                                        <td className="mid">{conditions[2]?.count ?? 0}</td>
                                        <td className="mid">{conditions[3]?.count ?? 0}</td>
                                        <td className="num">{formatCurrency(totals.value)}</td>
                                    </tr>
                                    {rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="mid" style={{ padding: "14px" }}>
                                                Belum ada aset tercatat.
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                        <p className="hidden print:block" style={{ fontSize: "8px", color: "#555" }}>
                            RR = Rusak Ringan, RB = Rusak Berat, Hlg = Hilang
                        </p>

                        <TandaTangan />
                    </TabsContent>

                    {/* ================= STOK HABIS PAKAI ================= */}
                    <TabsContent value="atk" className="space-y-4">
                        <Kop title="LAPORAN STOK BARANG HABIS PAKAI" subtitle={`Posisi per ${today()}`} />

                        <div className="hidden print:block summary-grid" style={{ gridTemplateColumns: "repeat(2, 1fr) !important" }}>
                            <div className="summary-item">
                                <div className="summary-value">{atkItems.length}</div>
                                <div className="summary-label">Jenis Barang</div>
                            </div>
                            <div className="summary-item">
                                <div className="summary-value">{formatCurrency(totalAtkValue)}</div>
                                <div className="summary-label">Nilai Persediaan</div>
                            </div>
                        </div>

                        <div className="rounded-lg border overflow-hidden">
                            <table className="report-table">
                                <thead className="report-thead">
                                    <tr>
                                        <th style={{ width: "4%" }}>No</th>
                                        <th style={{ width: "11%" }}>Kode</th>
                                        <th style={{ width: "26%" }}>Nama Barang</th>
                                        <th style={{ width: "13%" }}>Kategori</th>
                                        <th style={{ width: "6%" }}>Stok</th>
                                        <th style={{ width: "6%" }}>Min</th>
                                        <th style={{ width: "8%" }}>Satuan</th>
                                        <th style={{ width: "13%" }}>Harga</th>
                                        <th style={{ width: "13%" }}>Nilai</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {atkItems.map((item, i) => {
                                        const low = (item.currentStock || 0) <= (item.minStock || 0);
                                        return (
                                            <tr key={item.id} className="report-row">
                                                <td className="mid">{i + 1}</td>
                                                <td className="left">{item.code || "-"}</td>
                                                <td className="left">{item.name}</td>
                                                <td className="left">{item.category || "-"}</td>
                                                <td className="mid" style={low ? { fontWeight: 700 } : undefined}>
                                                    {item.currentStock}
                                                </td>
                                                <td className="mid">{item.minStock ?? 0}</td>
                                                <td className="mid">{item.unit || "-"}</td>
                                                <td className="num">{formatCurrency(item.price || 0)}</td>
                                                <td className="num">{formatCurrency((item.currentStock || 0) * (item.price || 0))}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr style={{ fontWeight: 700 }}>
                                        <td colSpan={7} className="left">
                                            JUMLAH
                                        </td>
                                        <td />
                                        <td className="num">{formatCurrency(totalAtkValue)}</td>
                                    </tr>
                                    {atkItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="mid" style={{ padding: "14px" }}>
                                                Belum ada barang habis pakai.
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>

                        <TandaTangan />
                    </TabsContent>

                    {/* ================= DIR PER RUANGAN ================= */}
                    <TabsContent value="dir" className="space-y-4">
                        <Kop title="DAFTAR INVENTARIS RUANGAN (DIR)" subtitle={`Posisi per ${today()}`} />

                        {groups.map((g, gi) => (
                            <div key={g.roomName} className={gi > 0 ? "page-break" : undefined}>
                                {/* Satu ruangan satu halaman, siap ditempel di dinding */}
                                <div className="hidden print:block room-head" style={{ textAlign: "center", fontSize: "11px" }}>
                                    RUANGAN: {g.roomName.toUpperCase()}
                                </div>
                                {gi > 0 ? (
                                    <div className="hidden print:block" style={{ textAlign: "center", fontSize: "11px", fontWeight: 700 }}>
                                        DAFTAR INVENTARIS RUANGAN
                                    </div>
                                ) : null}
                                <div className="rounded-lg border overflow-hidden" style={{ marginBottom: "8px" }}>
                                    <table className="report-table">
                                        <thead className="report-thead">
                                            <tr>
                                                <th style={{ width: "5%" }}>No</th>
                                                <th style={{ width: "15%" }}>Kode</th>
                                                <th style={{ width: "35%" }}>Nama Barang</th>
                                                <th style={{ width: "15%" }}>Kategori</th>
                                                <th style={{ width: "10%" }}>Jumlah</th>
                                                <th style={{ width: "20%" }}>Kondisi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {g.rows.map((r, i) => (
                                                <tr key={r.id} className="report-row">
                                                    <td className="mid">{i + 1}</td>
                                                    <td className="left">{r.code}</td>
                                                    <td className="left">{r.name}</td>
                                                    <td className="left">{r.category}</td>
                                                    <td className="mid">
                                                        {r.quantity} {r.category ? "" : ""}
                                                    </td>
                                                    <td className="left">
                                                        {[
                                                            r.good ? `Baik ${r.good}` : "",
                                                            r.lightDamaged ? `RR ${r.lightDamaged}` : "",
                                                            r.heavyDamaged ? `RB ${r.heavyDamaged}` : "",
                                                            r.lost ? `Hilang ${r.lost}` : "",
                                                        ]
                                                            .filter(Boolean)
                                                            .join(", ") || "-"}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr style={{ fontWeight: 700 }}>
                                                <td colSpan={4} className="left">
                                                    Jumlah
                                                </td>
                                                <td className="mid">{g.totalQuantity}</td>
                                                <td className="left" />
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <TandaTangan />
                            </div>
                        ))}

                        {groups.length === 0 ? (
                            <Card className="print:hidden">
                                <CardContent className="py-8 text-center text-muted-foreground">
                                    Belum ada aset untuk disusun per ruangan.
                                </CardContent>
                            </Card>
                        ) : null}
                    </TabsContent>

                    {/* ================= BERITA ACARA PEMERIKSAAN ================= */}
                    <TabsContent value="ba" className="space-y-4">
                        <Kop title="BERITA ACARA PEMERIKSAAN BARANG (OPNAME)" subtitle={selected ? formatDate(selected.date) : undefined} />

                        <div className="print:hidden">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Pilih Sesi Pemeriksaan</CardTitle>
                                    <CardDescription className="text-xs">
                                        Berita acara disusun dari sesi opname yang tersimpan.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {opnames.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Belum ada sesi pemeriksaan tersimpan.
                                        </p>
                                    ) : (
                                        <div className="grid gap-2">
                                            <Label className="text-xs">Sesi</Label>
                                            <select
                                                className="w-full border rounded px-2 py-2 text-sm bg-background"
                                                value={selected?.id ?? ""}
                                                onChange={(e) => setSelectedOpname(e.target.value)}
                                            >
                                                {opnames.map((o) => (
                                                    <option key={o.id} value={o.id}>
                                                        {formatDate(o.date)} — {o.expand?.room?.name || "Semua ruangan"} ({o.status})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {selected ? (
                            <>
                                <div className="hidden print:block" style={{ fontSize: "10px", marginBottom: "4px" }}>
                                    <p>
                                        Pada hari ini <b>{formatDate(selected.date)}</b> telah dilakukan
                                        pemeriksaan barang di <b>{selected.expand?.room?.name || "seluruh ruangan"}</b>{" "}
                                        dengan hasil sebagai berikut:
                                    </p>
                                </div>

                                <div className="rounded-lg border overflow-hidden">
                                    <table className="report-table">
                                        <thead className="report-thead">
                                            <tr>
                                                <th style={{ width: "4%" }}>No</th>
                                                <th style={{ width: "26%" }}>Nama Barang</th>
                                                <th style={{ width: "10%" }}>Sistem</th>
                                                <th style={{ width: "10%" }}>Baik</th>
                                                <th style={{ width: "10%" }}>RR</th>
                                                <th style={{ width: "10%" }}>RB</th>
                                                <th style={{ width: "10%" }}>Hilang</th>
                                                <th style={{ width: "10%" }}>Selisih</th>
                                                <th style={{ width: "10%" }}>Ket.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selected.items.map((it, i) => {
                                                const counted =
                                                    (it.qtyGood || 0) +
                                                    (it.qtyLightDamage || 0) +
                                                    (it.qtyHeavyDamage || 0) +
                                                    (it.qtyLost || 0);
                                                const diff = counted - (it.systemQty || 0);
                                                return (
                                                    <tr key={it.assetId || i} className="report-row">
                                                        <td className="mid">{i + 1}</td>
                                                        <td className="left">
                                                            {assetNameById.get(it.assetId)?.name || it.assetName || "-"}
                                                            <span style={{ color: "#666" }}>
                                                                {assetNameById.get(it.assetId)?.code
                                                                    ? ` (${assetNameById.get(it.assetId)?.code})`
                                                                    : ""}
                                                            </span>
                                                        </td>
                                                        <td className="mid">{it.systemQty}</td>
                                                        <td className="mid">{it.qtyGood}</td>
                                                        <td className="mid">{it.qtyLightDamage}</td>
                                                        <td className="mid">{it.qtyHeavyDamage}</td>
                                                        <td className="mid">{it.qtyLost}</td>
                                                        <td className="mid" style={diff !== 0 ? { fontWeight: 700 } : undefined}>
                                                            {diff > 0 ? `+${diff}` : diff}
                                                        </td>
                                                        <td className="left">{it.notes || "-"}</td>
                                                    </tr>
                                                );
                                            })}
                                            {selected.items.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className="mid" style={{ padding: "14px" }}>
                                                        Tidak ada baris pemeriksaan pada sesi ini.
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </tbody>
                                    </table>
                                </div>

                                {selected.note ? (
                                    <p className="hidden print:block" style={{ fontSize: "10px" }}>
                                        Catatan: {selected.note}
                                    </p>
                                ) : null}

                                <TandaTangan />
                            </>
                        ) : (
                            <Card className="print:hidden">
                                <CardContent className="py-8 text-center text-muted-foreground">
                                    Pilih sesi pemeriksaan terlebih dahulu.
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}
