"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import QRCode from "qrcode";
import { goGet, goPost } from "@/lib/api-client";
import { Loader2, Download, RefreshCw, CheckSquare, Square, Archive, FolderArchive, ArrowLeft, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import {
    downloadQrStickerPdf,
    labelsPerSheet,
    STICKER_PRESETS,
    type StickerLayout,
} from "@/lib/library/qr-pdf";

interface QrBatch {
    id: string;
    date: string;
    prefix: string;
    startSequence: number;
    endSequence: number;
    batchSize: number;
    createdAt: string;
}

export default function QRGeneratorPage() {
    const router = useRouter();

    // State
    const [activeTab, setActiveTab] = useState("generate");
    const [count, setCount] = useState(12);
    const [prefix, setPrefix] = useState("BK");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
    const [qrImages, setQrImages] = useState<{ code: string; dataUrl: string }[]>([]);
    const [sizeMm, setSizeMm] = useState(30); // Default 30mm (~1.2 inch)
    
    // History State
    const [history, setHistory] = useState<QrBatch[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [searchDate, setSearchDate] = useState("");

    // Output PDF: pilihan kedua di samping ZIP/PNG yang sudah ada.
    const [presetId, setPresetId] = useState(STICKER_PRESETS[0].id);
    const [layout, setLayout] = useState<StickerLayout>(STICKER_PRESETS[0].layout);
    const [showGuides, setShowGuides] = useState(true);
    const [isMakingPdf, setIsMakingPdf] = useState(false);
    const { settings } = useSchoolSettings();
    const schoolName = settings?.school_name || "";

    // Fetch history
    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append("search", searchQuery);
            if (searchDate) params.append("date", searchDate);

            const res: any = await goGet(`/api/library/qr-generator?${params.toString()}`);
            // Backend mengirim daftar batch di field `data`, bukan `batches`.
            // Salah baca field membuat riwayat selalu kosong tanpa error.
            if (res.success) {
                setHistory(res.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // Load history when tab changes
    useEffect(() => {
        if (activeTab === "history") {
            fetchHistory();
        }
    }, [activeTab]);

    // Generate Logic
    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const data: any = await goPost("/api/library/qr-generator", { count, prefix });
            if (data.success) {
                // Generate preview with small fixed size
                await processCodes(data.codes, 300); // Preview size in pixels
                setGeneratedCodes(data.codes); // Store raw codes
                toast.success(`Berhasil generate ${data.codes.length} QR Code`);
            } else {
                toast.error(data.error || "Gagal generate");
            }
        } catch (error) {
            toast.error("Terjadi kesalahan sistem");
        } finally {
            setIsGenerating(false);
        }
    };

    // Helper: mm to px at 300 DPI
    const mmToPx = (mm: number) => {
        const inches = mm / 25.4;
        return Math.ceil(inches * 300);
    };

    // Process codes to images
    // size param is in PIXELS. If converting from mm, call mmToPx first.
    const processCodes = async (codes: string[], sizePx: number, includeLabel = false) => {
        const images = await Promise.all(
            codes.map(async (code) => {
                // Generate QR pattern
                const qrDataUrl = await QRCode.toDataURL(code, {
                    width: sizePx,
                    margin: 1,
                    errorCorrectionLevel: "H",
                });

                if (!includeLabel) return { code, dataUrl: qrDataUrl };

                // LOGIC: Create a canvas to combine QR + Label
                return new Promise<{ code: string; dataUrl: string }>((resolve) => {
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return resolve({ code, dataUrl: qrDataUrl });

                    const img = new Image();
                    img.onload = () => {
                        // Label area takes ~20% of total height
                        const labelHeight = Math.ceil(sizePx * 0.2);
                        canvas.width = sizePx;
                        canvas.height = sizePx + labelHeight;

                        // Fill background white
                        ctx.fillStyle = "white";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // Draw QR
                        ctx.drawImage(img, 0, 0);

                        // Draw Text
                        ctx.fillStyle = "black";
                        ctx.textAlign = "center";
                        // Responsive font size: 8% of sizePx
                        const fontSize = Math.max(12, Math.floor(sizePx * 0.08));
                        ctx.font = `bold ${fontSize}px monospace`;
                        ctx.fillText(code, canvas.width / 2, sizePx + (labelHeight * 0.6));

                        resolve({ code, dataUrl: canvas.toDataURL("image/png") });
                    };
                    img.src = qrDataUrl;
                });
            })
        );
        // Only update preview images if it is the preview generation call (usually small size)
        if (sizePx === 300) {
            setQrImages(images);
        }
        return images;
    };

    // ZIP Download Logic
    const handleDownloadZip = async (codesToDownload = generatedCodes, filename = "QR_Codes") => {
        if (codesToDownload.length === 0) return;

        try {
            const targetPx = mmToPx(sizeMm);
            toast.info(`Menyiapkan ${codesToDownload.length} gambar dengan label (${sizeMm}mm / ${targetPx}px)...`);
            
            // Re-generate images with selected High Res size (from MM) AND include label
            const images = await processCodes(codesToDownload, targetPx, true);

            const zip = new JSZip();
            
            images.forEach((img) => {
                // Remove data:image/png;base64, prefix
                const base64Data = img.dataUrl.replace(/^data:image\/png;base64,/, "");
                zip.file(`${img.code}.png`, base64Data, { base64: true });
            });

            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `${filename}_${sizeMm}mm.zip`);
            toast.success("File ZIP berhasil diunduh");
        } catch (error) {
            console.error("ZIP Error:", error);
            toast.error("Gagal membuat file ZIP");
        }
    };

    // PDF Download Logic — output dokumen untuk lembar stiker A4.
    const handleDownloadPdf = async (codesToDownload = generatedCodes, filename = "Label_QR_Buku") => {
        if (codesToDownload.length === 0) return;
        setIsMakingPdf(true);
        try {
            toast.info(`Menyusun PDF untuk ${codesToDownload.length} label...`);
            await downloadQrStickerPdf(codesToDownload, layout, filename, {
                schoolName,
                showGuides,
            });
            toast.success("File PDF berhasil diunduh");
        } catch (error) {
            console.error("PDF Error:", error);
            toast.error("Gagal membuat dokumen PDF");
        } finally {
            setIsMakingPdf(false);
        }
    };

    const handlePresetChange = (presetId: string) => {
        setPresetId(presetId);
        const p = STICKER_PRESETS.find((p) => p.id === presetId);
        if (p) setLayout(p.layout);
    };

    // Reprint Logic (from History)
    const handleReprintBatch = async (batch: QrBatch) => {
        const codes: string[] = [];
        const dateCode = batch.date.replace(/-/g, "");
        for (let i = batch.startSequence; i <= batch.endSequence; i++) {
            const seq = i.toString().padStart(4, "0");
            codes.push(`${batch.prefix}-${dateCode}-${seq}`);
        }
        handleDownloadZip(codes, `QR_Batch_${batch.prefix}_${batch.date}_${batch.startSequence}-${batch.endSequence}`);
    };

    // Cetak ulang satu batch sebagai PDF — nomor diambil dari rentang yang
    // tersimpan, jadi merujuk ke stiker yang sama seperti cetakan pertama.
    const handleReprintBatchPdf = async (batch: QrBatch) => {
        const codes: string[] = [];
        const dateCode = batch.date.replace(/-/g, "");
        for (let i = batch.startSequence; i <= batch.endSequence; i++) {
            const seq = i.toString().padStart(4, "0");
            codes.push(`${batch.prefix}-${dateCode}-${seq}`);
        }
        await handleDownloadPdf(codes, `Label_QR_${batch.prefix}_${batch.date}_${batch.startSequence}-${batch.endSequence}`);
    };

    // Selective Reprint
    const toggleCodeSelection = (code: string) => {
        const newSet = new Set(selectedCodes);
        if (newSet.has(code)) newSet.delete(code);
        else newSet.add(code);
        setSelectedCodes(newSet);
    };

    const handleReprintSelected = async () => {
        if (selectedCodes.size === 0) return;
        const codes = Array.from(selectedCodes).sort();
        handleDownloadZip(codes, `QR_Selected_${codes.length}_items`);
        setSelectedCodes(new Set()); // Clear selection
    };

    const handleReprintSelectedPdf = async () => {
        if (selectedCodes.size === 0) return;
        const codes = Array.from(selectedCodes).sort();
        await handleDownloadPdf(codes, `Label_QR_Pilihan_${codes.length}`);
        setSelectedCodes(new Set());
    };

    // Expand batch to show codes for selection
    const renderBatchCodes = (batch: QrBatch) => {
        const dateCode = batch.date.replace(/-/g, "");
        const codes: string[] = [];
        for (let i = batch.startSequence; i <= batch.endSequence; i++) {
            codes.push(`${batch.prefix}-${dateCode}-${i.toString().padStart(4, "0")}`);
        }

        return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {codes.map(code => (
                    <div 
                        key={code} 
                        className={`
                            flex items-center gap-2 p-2 rounded border text-xs cursor-pointer select-none
                            ${selectedCodes.has(code) ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-transparent'}
                        `}
                        onClick={() => toggleCodeSelection(code)}
                    >
                        {selectedCodes.has(code) ? 
                            <CheckSquare className="h-3 w-3 text-primary" /> : 
                            <Square className="h-3 w-3 text-muted-foreground" />
                        }
                        <span className="font-mono">{code}</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Generator QR Code</h1>
                    <p className="text-muted-foreground">Buat label QR Code untuk buku perpustakaan</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="generate">Generate Baru</TabsTrigger>
                    <TabsTrigger value="history">Riwayat & Download Ulang</TabsTrigger>
                </TabsList>

                <TabsContent value="generate" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Konfigurasi Batch</CardTitle>
                            <CardDescription>Generate kode baru secara berurutan sesuai tanggal hari ini.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col md:flex-row items-end gap-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="prefix">Prefix Kode</Label>
                                    <Input 
                                        id="prefix" 
                                        value={prefix} 
                                        onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                                        maxLength={3}
                                    />
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="count">Jumlah (1-100)</Label>
                                    <Input 
                                        id="count" 
                                        type="number" 
                                        value={count || ""} 
                                        onChange={(e) => setCount(parseInt(e.target.value) || 0)}
                                        min={1} 
                                        max={100} 
                                    />
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="size">Ukuran Gambar (mm)</Label>
                                    <Input 
                                        id="size" 
                                        type="number" 
                                        value={sizeMm || ""} 
                                        onChange={(e) => setSizeMm(parseInt(e.target.value) || 0)}
                                        min={10} 
                                        max={300} 
                                        step={5}
                                    />
                                </div>
                                <Button onClick={handleGenerate} disabled={isGenerating}>
                                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                    Generate
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tata letak stiker — hanya untuk output PDF */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Ukuran Kertas Stiker (untuk PDF)</CardTitle>
                            <CardDescription>
                                Pilih ukuran yang sudah tersedia, atau atur sendiri.
                                Kisi dipusatkan otomatis di kertas A4.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label>Preset</Label>
                                <select
                                    className="w-full border rounded px-2 py-2 text-sm bg-background"
                                    value={presetId}
                                    onChange={(e) => handlePresetChange(e.target.value)}
                                >
                                    {STICKER_PRESETS.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                    <option value="custom">Sesuaikan sendiri...</option>
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    {labelsPerSheet(layout)} label per lembar · kertas {layout.paperWidth}×{layout.paperHeight} mm
                                </p>
                            </div>

                            {presetId === "custom" && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="grid gap-1">
                                        <Label className="text-xs">Lebar Label (mm)</Label>
                                        <Input type="number" step="0.1" value={layout.labelWidth}
                                            onChange={(e) => setLayout((p) => ({ ...p, labelWidth: parseFloat(e.target.value) || 1 }))} />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-xs">Tinggi Label (mm)</Label>
                                        <Input type="number" step="0.1" value={layout.labelHeight}
                                            onChange={(e) => setLayout((p) => ({ ...p, labelHeight: parseFloat(e.target.value) || 1 }))} />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-xs">Jarak X (mm)</Label>
                                        <Input type="number" step="0.1" value={layout.gapX}
                                            onChange={(e) => setLayout((p) => ({ ...p, gapX: parseFloat(e.target.value) || 0 }))} />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-xs">Jarak Y (mm)</Label>
                                        <Input type="number" step="0.1" value={layout.gapY}
                                            onChange={(e) => setLayout((p) => ({ ...p, gapY: parseFloat(e.target.value) || 0 }))} />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="checkbox" checked={showGuides}
                                        onChange={(e) => setShowGuides(e.target.checked)} />
                                    Garis panduan potong
                                </label>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Preview Area & Main Download Button */}
                    {generatedCodes.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Preview ({generatedCodes.length} items)
                                </CardTitle>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        onClick={() => handleDownloadPdf(generatedCodes)}
                                        disabled={isMakingPdf}
                                        className="gap-2"
                                    >
                                        {isMakingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                                        Unduh PDF
                                    </Button>
                                    <Button variant="outline" onClick={() => handleDownloadZip(generatedCodes)} className="gap-2">
                                        <FolderArchive className="h-4 w-4" />
                                        Download ZIP ({sizeMm}mm)
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                                    {qrImages.map((qr) => (
                                        <div key={qr.code} className="flex flex-col items-center border rounded p-2">
                                            <img src={qr.dataUrl} alt={qr.code} className="w-full h-auto" />
                                            <div className="text-[10px] font-mono mt-1 text-center truncate w-full">{qr.code}</div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>Riwayat Generate</CardTitle>
                            <CardDescription>
                                Cari dan download ulang QR code lama.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-4 mb-4">
                                {/* Search Row */}
                                <div className="flex flex-col sm:flex-row justify-between gap-4">
                                    <div className="flex gap-2 items-center flex-1">
                                        <Input 
                                            placeholder="Cari Prefix (BK) atau Kode..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && fetchHistory()}
                                            className="max-w-sm"
                                        />
                                        <Input 
                                            type="date"
                                            value={searchDate}
                                            onChange={(e) => setSearchDate(e.target.value)}
                                            className="w-auto"
                                        />
                                        <Button variant="secondary" onClick={fetchHistory} disabled={isLoadingHistory}>
                                            Cari
                                        </Button>
                                    </div>
                                    
                                    {/* Action Row */}
                                    <div className="flex items-center gap-2">
                                         <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-md border mr-2">
                                            <Label htmlFor="hist-size" className="text-xs whitespace-nowrap pl-1">Size (mm):</Label>
                                            <Input 
                                                id="hist-size"
                                                type="number"
                                                className="h-7 w-16 text-xs"
                                                value={sizeMm || ""}
                                                onChange={(e) => setSizeMm(Number(e.target.value) || 0)}
                                                min={10}
                                                max={300}
                                            />
                                         </div>

                                        {selectedCodes.size > 0 && (
                                            <>
                                                <Button size="sm" onClick={handleReprintSelected}>
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Download {selectedCodes.size} Selected
                                                </Button>
                                                <Button size="sm" variant="secondary" onClick={handleReprintSelectedPdf} disabled={isMakingPdf}>
                                                    <FileText className="mr-2 h-4 w-4" />
                                                    PDF {selectedCodes.size}
                                                </Button>
                                            </>
                                        )}
                                        <Button variant="outline" size="sm" onClick={fetchHistory} disabled={isLoadingHistory}>
                                            <RefreshCw className={`h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <ScrollArea className="h-[500px] pr-4">
                                <Accordion type="single" collapsible className="w-full">
                                    {history.map((batch) => (
                                        <AccordionItem key={batch.id} value={batch.id}>
                                            <AccordionTrigger className="hover:no-underline">
                                                <div className="flex items-center justify-between w-full pr-4">
                                                    <div className="flex items-center gap-4 text-left">
                                                        <Badge variant="outline">{batch.prefix}</Badge>
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-sm">
                                                                {format(new Date(batch.date), "dd MMMM yyyy", { locale: id })}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                Sequence: {batch.startSequence} - {batch.endSequence} ({batch.batchSize} pcs)
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="px-1 py-2 space-y-4">
                                                    <div className="flex justify-between items-center bg-muted/30 p-2 rounded">
                                                        <span className="text-xs text-muted-foreground">
                                                            Dibuat: {format(new Date(batch.createdAt), "HH:mm")}
                                                        </span>
                                                        <div className="flex gap-2">
                                                            <Button variant="secondary" size="sm" className="h-7 px-2 text-xs" onClick={() => handleReprintBatchPdf(batch)} disabled={isMakingPdf}>
                                                                <FileText className="mr-2 h-3 w-3" />
                                                                Cetak PDF
                                                            </Button>
                                                            <Button variant="secondary" size="sm" className="h-7 px-2 text-xs" onClick={() => handleReprintBatch(batch)}>
                                                                <Archive className="mr-2 h-3 w-3" />
                                                                Download Full Batch
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="border-t pt-2">
                                                        <p className="text-xs text-muted-foreground mb-2">Pilih kode individual untuk download ulang:</p>
                                                        {renderBatchCodes(batch)}
                                                    </div>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

