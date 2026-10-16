"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Printer, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { KopSurat } from "@/components/reports/kop-surat";
import { goGet } from "@/lib/api-client";
import { getAllAssets, getAllRooms, getCategories } from "@/lib/inventory";
import {
    conditionTotals,
    filterAssetRows,
    filterRows,
    grandTotals,
    groupByRoom,
    hasActiveAssetFilter,
    renumber,
    toAssetRows,
    unclassifiedTotal,
} from "@/lib/inventory/report-data";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { renderTemplatePdf, renderModuleReport, downloadBlob } from "@/lib/report-template-runner";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import type { InventoryAsset, InventoryCategory, InventoryOpname, InventoryRoom, InventoryStats } from "@/types/inventory";

const today = () =>
    new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

/**
 * Pengelola Barang / Bendahara BOS pada blok tanda tangan laporan inventaris.
 *
 * SEMENTARA: belum ada UI untuk menunjuk pengelola barang, jadi nama ini
 * di-hardcode. Ketika fitur penunjukan pejabat dibuat (mis. di pengaturan
 * sekolah), ganti dengan nilai dari sana dan hapus konstanta ini.
 * NIP sengaja dikosongkan sampai penunjukan resmi tersedia.
 */
const DEFAULT_PENGURUS_INVENTARIS_NAMA = "Lucki Hari Munnandar";
const DEFAULT_PENGURUS_INVENTARIS_NIP = "199903092025211053";

/**
 * Unduh Blob dengan nama berkas apa adanya (ekstensi dipertahankan).
 *
 * `downloadBlob` dari report-template-runner selalu memaksa akhiran ".pdf",
 * sehingga mengunduh Excel/CSV lewatnya menghasilkan "….xlsx.pdf". Helper ini
 * dipakai untuk berkas non-PDF.
 */
function downloadAs(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

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
    const [exportingPdf, setExportingPdf] = useState(false);
    const [exportingAsetPdf, setExportingAsetPdf] = useState(false);
    // Pencarian hanya untuk layar; hasil cetak/ekspor mengikuti filter
    // laporan (tahun/kategori/ruangan), bukan pencarian.
    const [query, setQuery] = useState("");
    // Filter isi laporan (berlaku ke cetak, Excel, PDF, CSV): tahun anggaran,
    // kategori, dan ruangan. "all" berarti tanpa batas.
    const [filterYear, setFilterYear] = useState<string>("all");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [filterRoom, setFilterRoom] = useState<string>("all");
    const [rooms, setRooms] = useState<InventoryRoom[]>([]);
    const [categories, setCategories] = useState<string[]>([]);

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

            // Opsi filter laporan: seluruh ruangan + kategori aset terkelola.
            // Gagal memuat bukan fatal — dropdown tetap berfungsi dengan opsi
            // "Semua" (kategori jatuh kembali ke nilai yang ada di data).
            try {
                setRooms(await getAllRooms());
            } catch {
                /* abaikan */
            }
        } catch (error) {
            console.error("Gagal memuat data laporan:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        getCategories("ASSET")
            .then((cats: InventoryCategory[]) => {
                const names = cats.map((c) => c.name).filter(Boolean);
                if (names.length > 0) setCategories(names);
            })
            .catch(() => { /* fallback: dari data */ });
    }, []);

    // Opsi tahun anggaran dari data aktual (urut menurun) + kategori cadangan
    // dari data bila kategori terkelola gagal dimuat.
    const yearOptions = useMemo(() => {
        const set = new Set<number>();
        for (const a of assets) if (a.fiscalYear != null) set.add(a.fiscalYear);
        return Array.from(set).sort((a, b) => b - a);
    }, [assets]);
    const categoryOptions = useMemo(() => {
        if (categories.length > 0) return categories;
        const set = new Set<string>();
        for (const a of assets) if (a.category) set.add(a.category);
        return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
    }, [categories, assets]);

    // Filter MEMBATASI ISI LAPORAN: semua output (cetak, Excel, PDF, CSV)
    // memakai rows terfilter. Pencarian layar (query) dilapiskan di atasnya
    // khusus tampilan.
    const reportFilter = useMemo(
        () => ({
            fiscalYear: filterYear === "all" ? ("all" as const) : Number(filterYear),
            category: filterCategory,
            roomId: filterRoom,
        }),
        [filterYear, filterCategory, filterRoom]
    );
    const filterActive = useMemo(() => hasActiveAssetFilter(reportFilter), [reportFilter]);
    const rows = useMemo(() => filterAssetRows(toAssetRows(assets), reportFilter), [assets, reportFilter]);
    // Aset tanpa tahun anggaran yang tersembunyi saat filter tahun aktif.
    const hiddenNoYear = useMemo(
        () =>
            filterYear !== "all"
                ? toAssetRows(assets).filter(
                      (r) =>
                          r.fiscalYear == null &&
                          (filterCategory === "all" || r.category === filterCategory) &&
                          (filterRoom === "all" || r.roomId === filterRoom)
                  ).length
                : 0,
        [assets, filterYear, filterCategory, filterRoom]
    );
    // Label filter untuk subjudul cetak + nama berkas unduhan.
    const filterLabels = useMemo(() => {
        const parts: string[] = [];
        if (filterYear !== "all") parts.push(`TA ${filterYear}`);
        if (filterCategory !== "all") parts.push(filterCategory);
        if (filterRoom !== "all") parts.push(rooms.find((r) => r.id === filterRoom)?.name || "");
        return parts.filter(Boolean);
    }, [filterYear, filterCategory, filterRoom, rooms]);
    const reportSubtitle = useMemo(
        () => `Posisi per ${today()}${filterLabels.length > 0 ? ` — ${filterLabels.join(" · ")}` : ""}`,
        [filterLabels]
    );
    const fileSuffix = useMemo(
        () => (filterLabels.length > 0 ? ` ${filterLabels.join(" ")}` : ""),
        [filterLabels]
    );

    function resetReportFilter() {
        setFilterYear("all");
        setFilterCategory("all");
        setFilterRoom("all");
        setQuery("");
    }

    // Pencarian hanya memengaruhi tampilan layar. Yang dicetak tetap seluruh
    // data, karena laporan fisik harus lengkap.
    const screenRows = useMemo(() => filterRows(rows, query), [rows, query]);
    const screenGroups = useMemo(() => groupByRoom(screenRows), [screenRows]);
    const numberMap = useMemo(() => renumber(groupByRoom(rows)), [rows]);

    const groups = useMemo(() => groupByRoom(rows), [rows]);
    const totals = useMemo(() => grandTotals(rows), [rows]);
    const conditions = useMemo(() => conditionTotals(rows), [rows]);
    const unclassified = useMemo(() => unclassifiedTotal(rows), [rows]);
    const conditionSum = conditions.reduce((s, c) => s + c.count, 0);

    const totalAtkValue = atkItems.reduce((s, i) => s + (i.currentStock || 0) * (i.price || 0), 0);
    const selected = opnames.find((o) => o.id === selectedOpname) || opnames[0];

    /**
     * Bangun data skalar + baris untuk mengisi template Inventaris (.xlsx)
     * yang diunggah admin via Admin → Format Laporan. Nama variabel di sini
     * HARUS sama dengan kamus (lib/config/report-variables.ts modul "inventaris").
     */
    function buildInventoryTemplateInput(paperSize?: string, orientation?: string) {
        const signPlace = (settings?.school_address || "")
            .match(/Kab\.\s*([^,]+)/)?.[1]
            ?.trim() ||
            (settings?.school_address || "").match(/Kota\s+([^,]+)/)?.[1]?.trim() ||
            "";
        return {
            rows,
            paperSize,
            orientation,
            scalars: {
                sekolahNama: settings?.school_name,
                sekolahAlamat: settings?.school_address,
                sekolahTelepon: settings?.school_phone,
                sekolahNpsn: settings?.school_npsn,
                sekolahEmail: settings?.school_email,
                sekolahWebsite: settings?.school_website,
                kepalaSekolahNama: settings?.principal_name,
                kepalaSekolahNip: settings?.principal_nip,
                pengurusInventarisNama: DEFAULT_PENGURUS_INVENTARIS_NAMA,
                pengurusInventarisNip: DEFAULT_PENGURUS_INVENTARIS_NIP,
                periode: reportSubtitle,
                tanggalCetak: today(),
                tempatTtd: signPlace,
                totalUnit: totals.quantity,
                totalNilaiAset: totals.value,
                jumlahRuangan: groups.length,
                jumlahJenis: rows.length,
            },
        };
    }

    /**
     * Isi template Inventaris (.xlsx) yang diunggah admin dan kembalikan Blob
     * Excel siap unduh — pola sama dengan ekspor Excel presensi:
     *   1. ambil default modul inventaris (Admin → Format Laporan),
     *   2. load template (style dipertahankan),
     *   3. isi skalar + replikasi baris contoh per aset + geser formula,
     *   4. kembalikan buffer xlsx.
     * Melempar Error berisi pesan ramah bila template belum ada / tidak valid.
     */
    async function buildInventoryBlob(): Promise<{ blob: Blob; unknown: string[] }> {
        const { resolveInventoryTemplateUrl, fillInventoryWorksheet } = await import(
            "@/lib/inventory/inventory-excel"
        );
        const { url, paperSize, orientation, fromDefault } = await resolveInventoryTemplateUrl(
            fetch,
            process.env.NEXT_PUBLIC_API_URL || ""
        );
        if (!fromDefault || !url) {
            throw new Error(
                "Belum ada template laporan Inventaris — unggah berkas .xlsx via Admin → Format Laporan."
            );
        }
        // Template unggahan admin = folder privat → butuh cookie sesi.
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error("Berkas template tidak dapat diunduh dari server.");
        const buf = await res.arrayBuffer();

        const [{ default: ExcelJS }] = await Promise.all([import("exceljs")]);
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf as never);
        const ws = wb.worksheets[0];
        if (!ws) throw new Error("Template Excel tidak valid (tanpa lembar).");
        const { rowCount, unknown } = await fillInventoryWorksheet(ws as never, {
            ...buildInventoryTemplateInput(paperSize, orientation),
            paperSize: (paperSize || "A4").trim().toUpperCase(),
            orientation: orientation || "landscape",
        });
        if (rowCount === 0) {
            throw new Error(
                "Template Excel tidak punya baris contoh. Tandai baris data dengan variabel seperti {{kode}} / {{nama}}."
            );
        }
        const out = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
        return {
            blob: new Blob([out], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }),
            unknown,
        };
    }

    /**
     * Cadangan bila template Excel belum tersedia: unduh CSV seluruh baris aset
     * supaya pengguna tetap mendapat data. Sama semangat dengan fallback CSV
     * pada daftar hadir.
     */
    function downloadInventoryCsv() {
        const header = [
            "No", "Kode", "Nama", "Kategori", "Ruangan", "Jumlah",
            "Baik", "Rusak Ringan", "Rusak Berat", "Hilang", "Belum Diklasifikasi",
            "Sumber Dana", "Tahun Anggaran", "Tanggal Perolehan",
            "Penyedia", "No. Nota", "No. Seri", "Merek", "Model", "Cara Perolehan",
            "Harga", "Nilai",
        ];
        const esc = (v: string | number) => {
            const s = String(v ?? "");
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const lines = [header.map(esc).join(",")];
        rows.forEach((r, i) => {
            lines.push(
                [
                    i + 1, r.code, r.name, r.category, r.roomName, r.quantity,
                    r.good, r.lightDamaged, r.heavyDamaged, r.lost, r.unclassified,
                    r.fundingSource, r.fiscalYear ?? "", r.purchaseDate ?? "",
                    r.supplier, r.invoiceNo, r.serialNumber, r.brand, r.model, r.acquisitionType,
                    r.price, r.value,
                ]
                    .map(esc)
                    .join(",")
            );
        });
        const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        downloadAs(blob, `Laporan Aset Tetap${fileSuffix}.csv`);
    }

    /** Ekspor laporan Aset Tetap sebagai PDF (xlsx → LibreOffice headless). */
    async function handleExportAsetPdf() {
        setExportingAsetPdf(true);
        const toastId = toast.loading("Menyiapkan PDF laporan aset…");
        try {
            const { blob, unknown } = await buildInventoryBlob();
            const { convertXlsxToPdf } = await import("@/lib/print-kit");
            const buf = await blob.arrayBuffer();
            const { blob: pdf } = await convertXlsxToPdf([buf], `Laporan Aset Tetap${fileSuffix}`);
            downloadBlob(pdf, `Laporan Aset Tetap${fileSuffix}`);
            toast.success("PDF berhasil diunduh", {
                id: toastId,
                description: unknown.length > 0 ? `Variabel tak dikenal dibiarkan: ${unknown.join(", ")}` : undefined,
            });
        } catch (err) {
            console.error("Ekspor PDF aset gagal:", err);
            toast.error("Template Excel belum tersedia — mengunduh CSV sebagai gantinya", { id: toastId });
            downloadInventoryCsv();
        } finally {
            setExportingAsetPdf(false);
        }
    }

    /** Ekspor laporan Aset Tetap sebagai berkas Excel (.xlsx) hasil isi template. */
    async function handleExportAsetFile() {
        setExportingAsetPdf(true);
        const toastId = toast.loading("Menyiapkan berkas Excel laporan aset…");
        try {
            const { blob, unknown } = await buildInventoryBlob();
            downloadAs(blob, `Laporan Aset Tetap${fileSuffix}.xlsx`);
            toast.success("Excel berhasil diunduh", {
                id: toastId,
                description: unknown.length > 0 ? `Variabel tak dikenal dibiarkan: ${unknown.join(", ")}` : undefined,
            });
        } catch (err) {
            console.error("Ekspor Excel aset gagal:", err);
            toast.error("Template Excel belum tersedia — mengunduh CSV sebagai gantinya", { id: toastId });
            downloadInventoryCsv();
        } finally {
            setExportingAsetPdf(false);
        }
    }

    /**
     * Ekspor stok habis pakai memakai format dari Studio Format Laporan.
     * Prioritas: format default modul Inventaris (dapat diatur admin di halaman
     * "Laporan & Format"), lalu template berkode RPT_INVENTARIS_HABIS_PAKAI.
     * Bila keduanya tak ada / gagal, jatuh kembali ke cetak HTML (window.print).
     */
    async function handleExportAtkPdf() {
        setExportingPdf(true);
        try {
            const dataset = atkItems.map((i) => ({
                code: i.code || "-",
                name: i.name,
                category: i.category || "-",
                currentStock: i.currentStock ?? 0,
                minStock: i.minStock ?? 0,
                unit: i.unit || "-",
                price: i.price ?? 0,
                nilai: (i.currentStock || 0) * (i.price || 0),
                isLow: (i.currentStock || 0) <= (i.minStock || 0),
            }));
            const global = {
                laporan: {
                    periode: `Posisi per ${today()}`,
                    total_jenis: atkItems.length,
                    total_nilai: totalAtkValue,
                },
            };
            let blob = await renderModuleReport({
                module: "inventaris",
                dataset,
                global,
                settings,
                fileName: "Laporan Stok Barang Habis Pakai",
            });
            if (!blob) {
                blob = await renderTemplatePdf({
                    code: "RPT_INVENTARIS_HABIS_PAKAI",
                    dataset,
                    global,
                    settings,
                    fileName: "Laporan Stok Barang Habis Pakai",
                    fallback: () => window.print(),
                });
            }
            if (blob) downloadBlob(blob, "Laporan Stok Barang Habis Pakai");
        } finally {
            setExportingPdf(false);
        }
    }

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
        // Tampil di layar maupun cetak: di layar memberi tahu bahwa dokumen ini
        // memang ditutup dengan blok tanda tangan, bukan terpotong.
        <div style={{ marginTop: "18px" }}>
            <div className="grid grid-cols-2 gap-16 text-center">
                <div>
                    <p className="text-sm">Mengetahui,</p>
                    <p className="text-sm font-semibold">Kepala Sekolah</p>
                    <div className="mt-11 border-t border-foreground" />
                    <p className="text-xs mt-0.5">{settings?.principal_name || "________________"}</p>
                    <p className="text-xs">NIP. {settings?.principal_nip || "__________"}</p>
                </div>
                <div>
                    <p className="text-sm">{today()}</p>
                    <p className="text-sm font-semibold">Pengurus Inventaris</p>
                    <div className="mt-11 border-t border-foreground" />
                    <p className="text-xs mt-0.5">________________</p>
                    <p className="text-xs">NIP. __________</p>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <style>{`
                /* ── Gaya dasar: berlaku di LAYAR maupun CETAK ──
                   Dulu seluruh gaya tabel ditaruh di dalam @media print, sehingga
                   di layar tabel tampil polos tanpa garis, jarak, dan perataan.
                   Kini gaya dasarnya berlaku kapan saja; bagian cetak di bawah
                   hanya menimpali apa yang memang perlu berbeda di kertas. */
                .report-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                    /* globals.css memberi min-width:max-content pada table.
                       Di layar itu berguna agar bisa digulir, tetapi membuat
                       tabel melebar melewati wadahnya. */
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

                /* Baris pengelompok ruangan & total */
                .report-table tr.group-head td { background: #f1f5f9; font-weight: 600; }
                .report-table tr.total-row td { font-weight: 700; background: #f8fafc; }

                /* Ruangan: di layar tampil sebagai judul besar, di cetak mengecil */
                .room-head { font-weight: 700; font-size: 13px; margin: 4px 0; }

                .page-break { }

                @media print {
                    @page { size: A4 portrait; margin: 12mm 10mm; }
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

                    .report-table { font-size: 9px !important; }
                    .report-table th, .report-table td { border: 0.5px solid #000 !important; padding: 3px 4px !important; }
                    /* Header tidak boleh pecah baris: "Baik" yang terdesak kolom
                       sempit pernah tercetak menjadi "Bai k". */
                    .report-table th { background: #f0f0f0 !important; font-weight: 700 !important; text-align: center !important; white-space: nowrap !important; }
                    .report-table td.num { white-space: nowrap !important; }
                    .report-table td.num { text-align: right !important; white-space: nowrap !important; }
                    .report-table td.mid { text-align: center !important; }
                    .report-table td.left { text-align: left !important; }
                    .report-table tbody tr:hover { background: transparent !important; }
                    .report-thead { display: table-header-group !important; }
                    .report-row { page-break-inside: avoid !important; break-inside: avoid !important; }

                    .room-block { page-break-inside: avoid !important; break-inside: avoid !important; margin-bottom: 8px !important; }
                    .room-head { font-weight: 700 !important; font-size: 10px !important; margin: 6px 0 2px !important; }

                    .summary-grid { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 4px !important; margin-bottom: 8px !important; }
                    .summary-item { border: 1px solid #000 !important; padding: 5px !important; text-align: center !important; page-break-inside: avoid !important; }
                    .summary-value { font-size: 13px !important; font-weight: 700 !important; }
                    .summary-label { font-size: 8px !important; color: #555 !important; }

                                    /* Ukuran cetak dikembalikan ke 10pt: pada 12px
                                       kalimat pembuka berita acara pecah dua baris. */
                                    .ba-pembuka { font-size: 10px !important; }

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
                        <Kop title="LAPORAN ASET TETAP" subtitle={reportSubtitle} />

                        {/* Filter isi laporan: berlaku ke cetak, Excel, PDF, CSV. */}
                        <div className="flex flex-wrap items-end gap-2 print:hidden">
                            <div className="grid gap-1">
                                <Label className="text-xs">Tahun Anggaran</Label>
                                <Select value={filterYear} onValueChange={setFilterYear}>
                                    <SelectTrigger className="w-full sm:w-[170px]" aria-label="Tahun anggaran">
                                        <SelectValue placeholder="Semua tahun" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua tahun</SelectItem>
                                        {yearOptions.map((y) => (
                                            <SelectItem key={y} value={String(y)}>TA {y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-xs">Kategori</Label>
                                <Select value={filterCategory} onValueChange={setFilterCategory}>
                                    <SelectTrigger className="w-full sm:w-[190px]" aria-label="Kategori aset">
                                        <SelectValue placeholder="Semua kategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua kategori</SelectItem>
                                        {categoryOptions.map((c) => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-xs">Ruangan</Label>
                                <Select value={filterRoom} onValueChange={setFilterRoom}>
                                    <SelectTrigger className="w-full sm:w-[190px]" aria-label="Ruangan">
                                        <SelectValue placeholder="Semua ruangan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua ruangan</SelectItem>
                                        {rooms.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {filterActive ? (
                                <Button variant="ghost" size="sm" onClick={resetReportFilter}>
                                    Reset filter
                                </Button>
                            ) : null}
                        </div>
                        {filterActive ? (
                            <p className="text-xs text-muted-foreground">
                                Laporan dibatasi: {filterLabels.join(" · ")} — {rows.length} dari {assets.length} jenis aset.
                                {hiddenNoYear > 0 ? ` ${hiddenNoYear} aset tanpa tahun anggaran tidak ditampilkan.` : ""}
                            </p>
                        ) : null}

                        <div className="flex flex-wrap justify-end gap-2 print:hidden">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportAsetFile}
                                disabled={exportingAsetPdf}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Unduh Excel (.xlsx)
                            </Button>
                            <Button size="sm" onClick={handleExportAsetPdf} disabled={exportingAsetPdf}>
                                <Printer className={`mr-2 h-4 w-4 ${exportingAsetPdf ? "animate-pulse" : ""}`} />
                                {exportingAsetPdf ? "Menyiapkan…" : "Ekspor PDF (Format Studio)"}
                            </Button>
                        </div>

                        {/* Ringkasan: kartu di layar, kotak padat di kertas.
                            Dulu hanya versi cetak yang ada, jadi layar tampak kosong. */}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
                            <Card>
                                <CardContent className="p-4">
                                    <p className="text-xs text-muted-foreground">Jenis Aset</p>
                                    <p className="text-2xl font-bold">{rows.length}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <p className="text-xs text-muted-foreground">Total Unit</p>
                                    <p className="text-2xl font-bold">{totals.quantity}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <p className="text-xs text-muted-foreground">Nilai Aset</p>
                                    <p className="text-xl font-bold">{formatCurrency(totals.value)}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <p className="text-xs text-muted-foreground">Ruangan</p>
                                    <p className="text-2xl font-bold">{groups.length}</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="hidden print:block summary-grid">
                            <div className="summary-item">
                                <div className="summary-value">{rows.length}</div>
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
                            luput — misalnya aset aktif yang tak ikut terdaftar.
                            Disembunyikan saat filter aktif karena selisihnya
                            memang disengaja. */}
                        {!filterActive && stats && stats.totalAssets !== rows.length ? (
                            <p className="print:hidden text-xs text-amber-700">
                                Catatan: server melaporkan {stats.totalAssets} aset, sedangkan daftar
                                memuat {rows.length}. Periksa data yang belum lengkap.
                            </p>
                        ) : null}

                        {/* Ringkasan kondisi — dengan baris total agar angka tertutup.
                            Tampil di layar maupun cetak. */}
                        <div className="room-block">
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

                        {/* Pencarian — layar saja. Hasil cetak/ekspor mengikuti
                            filter laporan, bukan pencarian. */}
                        <div className="flex flex-wrap items-center gap-2 print:hidden">
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Cari nama, kode, kategori, atau ruangan..."
                                className="max-w-sm"
                                aria-label="Cari aset"
                            />
                            {query ? (
                                <>
                                    <span className="text-xs text-muted-foreground">
                                        {screenRows.length} dari {rows.length} baris
                                    </span>
                                    <Button variant="ghost" size="sm" onClick={() => setQuery("")}>
                                        Reset
                                    </Button>
                                </>
                            ) : null}
                        </div>

                        {/* Daftar aset — inti laporan */}
                        <div className="rounded-lg border overflow-x-auto">
                            <table className="report-table">
                                <thead className="report-thead">
                                    <tr>
                                        <th style={{ width: "5%" }}>No</th>
                                        <th style={{ width: "10%" }}>Kode</th>
                                        <th style={{ width: "20%" }}>Nama Barang</th>
                                        <th style={{ width: "10%" }}>Kategori</th>
                                        <th style={{ width: "11%" }}>Ruangan</th>
                                        <th style={{ width: "5%" }}>Qty</th>
                                        {/* "Baik" butuh lebih dari 4% pada A4:
                                            kolom terlalu sempit membuat teksnya
                                            pecah jadi "Bai k" saat dicetak. */}
                                        <th style={{ width: "6%" }}>Baik</th>
                                        <th style={{ width: "6%" }}>RR</th>
                                        <th style={{ width: "6%" }}>RB</th>
                                        <th style={{ width: "6%" }}>Hlg</th>
                                        {/* Nilai butuh ruang lebih: "Rp 25.000.000"
                                            tidak muat di kolom 11% dan pecah dua baris. */}
                                        <th style={{ width: "15%" }}>Nilai (Rp)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {screenGroups.map((g) => (
                                        // Fragment shorthand tidak bisa diberi key,
                                        // jadi dipakai <Fragment> eksplisit.
                                        <Fragment key={g.roomName}>
                                            <tr className="report-row group-head">
                                                <td colSpan={11} className="left">
                                                    {g.roomName} — {g.rows.length} jenis, {g.totalQuantity} unit
                                                </td>
                                            </tr>
                                            {g.rows.map((r) => (
                                                <tr key={r.id} className="report-row">
                                                    {/* Nomor urut menyeluruh (1..N) lintas
                                                        ruangan, bukan ulang dari 1 per ruangan. */}
                                                    <td className="mid">{numberMap.get(r.id)}</td>
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
                                    {/* Baris total selalu dari SELURUH data, bukan
                                        hasil saringan, agar tidak menyesatkan. */}
                                    <tr className="total-row">
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
                                    {screenRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="mid" style={{ padding: "14px" }}>
                                                {rows.length === 0
                                                    ? "Belum ada aset tercatat."
                                                    : "Tidak ada baris yang cocok dengan pencarian."}
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            RR = Rusak Ringan, RB = Rusak Berat, Hlg = Hilang
                        </p>

                        <TandaTangan />
                    </TabsContent>

                    {/* ================= STOK HABIS PAKAI ================= */}
                    <TabsContent value="atk" className="space-y-4">
                        <Kop title="LAPORAN STOK BARANG HABIS PAKAI" subtitle={`Posisi per ${today()}`} />

                        <div className="flex justify-end print:hidden">
                            <Button size="sm" onClick={handleExportAtkPdf} disabled={exportingPdf}>
                                <Printer className={`mr-2 h-4 w-4 ${exportingPdf ? "animate-pulse" : ""}`} />
                                {exportingPdf ? "Menyiapkan PDF..." : "Ekspor PDF (Format Studio)"}
                            </Button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 print:hidden">
                            <Card>
                                <CardContent className="p-4">
                                    <p className="text-xs text-muted-foreground">Jenis Barang</p>
                                    <p className="text-2xl font-bold">{atkItems.length}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <p className="text-xs text-muted-foreground">Nilai Persediaan</p>
                                    <p className="text-xl font-bold text-emerald-600">
                                        {formatCurrency(totalAtkValue)}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

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

                        <div className="rounded-lg border overflow-x-auto">
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
                                {/* Judul ruangan tampil di layar maupun cetak —
                                    di layar menjadi penanda kelompok. */}
                                <div className="room-head" style={{ textAlign: "center" }}>
                                    RUANGAN: {g.roomName.toUpperCase()}
                                </div>
                                {gi > 0 ? (
                                    <div style={{ textAlign: "center", fontSize: "11px", fontWeight: 700 }}>
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
                                 {/* Tanda tangan dicetak per ruangan (tiap ruangan
                                     jadi lembar sendiri), tetapi di layar cukup
                                     sekali di akhir agar tidak berulang-ulang. */}
                                 <div className="hidden print:block">
                                     <TandaTangan />
                                 </div>
                             </div>
                         ))}

                         {groups.length > 0 ? <div className="print:hidden"><TandaTangan /></div> : null}

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
                                {/* Kalimat pembuka tampil di layar maupun cetak:
                                    di layar menjelaskan isi tabel di bawahnya. */}
                                <div className="ba-pembuka" style={{ fontSize: "12px", marginBottom: "4px" }}>
                                    <p className="text-muted-foreground">
                                        Pada hari ini <b className="text-foreground">{formatDate(selected.date)}</b> telah
                                        dilakukan pemeriksaan barang di{" "}
                                        <b className="text-foreground">
                                            {selected.expand?.room?.name || "seluruh ruangan"}
                                        </b>{" "}
                                        dengan hasil sebagai berikut:
                                    </p>
                                </div>

                                <div className="rounded-lg border overflow-x-auto">
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
                                    <p style={{ fontSize: "12px" }}>
                                        <span className="text-muted-foreground">Catatan:</span> {selected.note}
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
