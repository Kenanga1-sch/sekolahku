"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QRScanner } from "@/components/ui/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Book, QrCode, Search, Check, Loader2, ArrowLeft, ArrowRight, Save, Plus, Camera, CameraOff, AlertCircle, Upload, X, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDDCLabel, getAllDDCCategories, getShelfByDDC, getAllShelves, type DDCCategory } from "@/lib/library/ddc-mapping";
import { goGet, goPost } from "@/lib/api-client";
import { compressImage } from "@/lib/utils";

interface CatalogData {
    title: string;
    author: string;
    publisher?: string;
    year?: number;
    isbn?: string;
    coverUrl?: string;
    subjects?: string[];
    ddcCategory?: DDCCategory;
    localFound?: boolean;
    totalExemplars?: number;
    description?: string;
}

export default function LibraryBindingPage() {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [qrCode, setQrCode] = useState("");
    const [isbn, setIsbn] = useState("");
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState("RAK-NEW");
    const [overrideCategory, setOverrideCategory] = useState<DDCCategory | null>(null);
    const [showISBNScanner, setShowISBNScanner] = useState(true);
    const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'success' | 'not_found'>('idle');
    const [catalog, setCatalog] = useState<CatalogData>({
        title: "",
        author: "",
        publisher: "",
        year: new Date().getFullYear(),
        isbn: "",
        ddcCategory: "UNSORTED",
        description: "",
    });
    const [aiLoading, setAiLoading] = useState(false);
    const [aiRecommendation, setAiRecommendation] = useState<{
        category: DDCCategory;
        shelf: string;
        description?: string;
        reason?: string;
        subjects?: string[];
    } | null>(null);
    const [aiEnabled, setAiEnabled] = useState(true);

    const triggerAIClassify = async (
        title: string,
        author: string,
        description: string = "",
        subjects: string[] = []
    ) => {
        if (!title.trim()) return;
        setAiLoading(true);
        try {
            const response: any = await goPost("/api/library/catalog/ai-classify", {
                title,
                author,
                description,
                subjects,
            });

            if (!response.error) {
                if (response.ai_enabled === false) {
                    setAiEnabled(false);
                    setAiRecommendation(null);
                } else {
                    setAiEnabled(true);
                    setAiRecommendation(response.data);
                    
                    // Auto-apply AI suggestions to form fields
                    const rec = response.data;
                    setOverrideCategory(rec.category);
                    setLocation(rec.shelf);
                    
                    setCatalog(prev => {
                        const newCat = { ...prev };
                        if (rec.description && (!prev.description || prev.description.trim() === "")) {
                            newCat.description = rec.description;
                        }
                        if (rec.subjects && rec.subjects.length > 0) {
                            newCat.subjects = Array.from(new Set([...(prev.subjects || []), ...(rec.subjects || [])]));
                        }
                        return newCat;
                    });
                    
                    toast.success("Rekomendasi AI otomatis diterapkan!");
                }
            } else {
                console.error("AI Classify failed:", response.error);
            }
        } catch (error) {
            console.error("Failed calling AI classification endpoint", error);
        } finally {
            setAiLoading(false);
        }
    };

    // Step 1: Scan QR Identity
    const handleQRScan = (code: string) => {
        setQrCode(code);
        toast.success(`QR Code Terdeteksi: ${code}`);
        setStep(2);
    };

    // Step 2: ISBN Lookup
    const handleISBNScan = (code: string) => {
        setIsbn(code);
        toast.info(`ISBN Terdeteksi: ${code}`);
        // We need to pass the code directly because state update is async
        triggerISBNLookup(code);
    };

    const handleISBNLookup = async () => {
        if (!isbn) return;
        triggerISBNLookup(isbn);
    };

    const triggerISBNLookup = async (isbnToLookup: string) => {
        setLoading(true);
        setLookupStatus('loading');
        try {
            const response: any = await goGet(`/api/library/isbn/${encodeURIComponent(isbnToLookup)}`);
            if (!response.error) {
                const data = response.data; // Unpack the actual book data
                
                setLookupStatus('success');
                setCatalog({
                    title: data.title || "",
                    author: data.author || "",
                    publisher: data.publisher || "",
                    year: data.year || new Date().getFullYear(),
                    isbn: isbnToLookup,
                    coverUrl: data.cover || data.coverUrl,
                    subjects: data.subjects || [],
                    ddcCategory: data.ddcCategory || "UNSORTED",
                    localFound: data.localFound,
                    totalExemplars: data.totalExemplars,
                    description: data.description || "",
                });

                // Auto-map to shelf
                const targetShelf = getShelfByDDC(data.ddcCategory || "UNSORTED");
                setLocation(targetShelf);

                // Call Gemini AI auto classification in background
                triggerAIClassify(
                    data.title || "",
                    data.author || "",
                    data.description || "",
                    data.subjects || []
                );

                if (data.localFound) {
                    toast.success(`Data ditemukan di koleksi lokal! (${data.totalExemplars} exemplar sudah ada)`);
                } else {
                    const sourceText = Array.isArray(data.sources) && data.sources.length > 0 ? ` (${data.sources.join(", ")})` : "";
                    toast.success(`Data buku ditemukan secara online!${sourceText}`);
                }
                // Automatically hide scanner to show results
                setShowISBNScanner(false);
            } else {
                setLookupStatus('not_found');
                toast.error("Buku tidak ditemukan di database online.");
                setCatalog(prev => ({ 
                    ...prev, 
                    title: "", 
                    author: "", 
                    publisher: "", 
                    isbn: isbnToLookup,
                    ddcCategory: "UNSORTED",
                    description: "",
                }));
            }
        } catch (error) {
            setLookupStatus('idle');
            toast.error("Gagal menghubungi server catalog.");
        } finally {
            setLoading(false);
        }
    };

    const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Simple client-side validation
        if (!file.type.startsWith("image/")) {
            toast.error("File harus berupa gambar");
            return;
        }

        setLoading(true);
        let uploadFile = file;
        try {
            uploadFile = await compressImage(file, 600, 0.85);
        } catch (error) {
            console.error("Cover image compression failed:", error);
        }

        const formData = new FormData();
        formData.append("file", uploadFile);
        if (catalog.isbn) formData.append("isbn", catalog.isbn);
        try {
            const data: any = await goPost("/api/library/catalog/cover", formData);

            if (!data.error) {
                setCatalog({ ...catalog, coverUrl: data.url });
                toast.success("Sampul berhasil diunggah!");
            } else {
                toast.error("Gagal mengunggah sampul.");
            }
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Terjadi kesalahan saat mengunggah.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const result: any = await goPost("/api/library/assets/bind", {
                qrCode,
                location,
                catalog: {
                    ...catalog,
                    cover: catalog.coverUrl, // Map frontend coverUrl to backend cover
                    category: overrideCategory || catalog.ddcCategory || "UNSORTED",
                }
            });

            if (result.success) {
                toast.success("Buku berhasil didaftarkan!");
                
                // Reset ALL states for next book
                setQrCode("");
                setIsbn("");
                setLookupStatus("idle");
                setShowISBNScanner(true);
                setOverrideCategory(null);
                setAiRecommendation(null);
                setCatalog({ 
                    title: "", 
                    author: "", 
                    publisher: "", 
                    year: new Date().getFullYear(), 
                    isbn: "",
                    coverUrl: undefined,
                    ddcCategory: "UNSORTED",
                    localFound: false,
                    subjects: [],
                    description: ""
                });
                setLocation("RAK-NEW");
                setStep(1);
            } else {
                toast.error(result.error || "Gagal menyimpan data.");
            }
        } catch (error) {
            toast.error("Terjadi kesalahan sistem.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container max-w-2xl py-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.back()} className="border-slate-200 bg-white shadow-sm hover:bg-slate-50">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Binding Buku Baru</h1>
                    <p className="text-muted-foreground">Hubungkan Identitas Fisik (QR) dengan Data Katalog (ISBN)</p>
                </div>
            </div>

            <div className="flex justify-between items-center mb-4">
                {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === s ? 'bg-primary text-primary-foreground' : (step > s ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground')}`}>
                            {step > s ? <Check className="h-4 w-4" /> : s}
                        </div>
                        <span className={`text-sm hidden sm:inline ${step === s ? 'font-bold' : 'text-muted-foreground'}`}>
                            {s === 1 ? 'Scan QR' : s === 2 ? 'Data Buku' : 'Konfirmasi'}
                        </span>
                        {s < 3 && <div className="h-px w-8 bg-border" />}
                    </div>
                ))}
            </div>

            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Langkah 1: Identitas Fisik</CardTitle>
                        <CardDescription>Scan QR Code yang tertempel pada fisik buku</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <QRScanner 
                            onScan={handleQRScan} 
                            mirrored={true} 
                            formats={["qr_code"]}
                            className="mx-auto" 
                        />
                        <div className="flex items-center gap-2">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs text-muted-foreground uppercase">Atau Input Manual</span>
                            <div className="h-px flex-1 bg-border" />
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Input Kode QR Manual..."
                                value={qrCode}
                                onChange={(e) => setQrCode(e.target.value.toUpperCase())}
                            />
                            <Button disabled={!qrCode} onClick={() => setStep(2)}>Lanjut</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Langkah 2: Data Katalog</CardTitle>
                        <CardDescription>Gunakan ISBN untuk menarik data otomatis atau isi manual</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">Scan/Input ISBN</Label>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 text-xs gap-2"
                                    onClick={() => setShowISBNScanner(!showISBNScanner)}
                                >
                                    {showISBNScanner ? <CameraOff className="h-3 w-3" /> : <Camera className="h-3 w-3" />}
                                    {showISBNScanner ? "Matikan Kamera" : "Aktifkan Kamera"}
                                </Button>
                            </div>

                            {showISBNScanner && (
                                <div className="mb-4">
                                    <QRScanner 
                                        onScan={handleISBNScan} 
                                        mirrored={true}
                                        formats={["ean_13"]}
                                        className="mx-auto" 
                                    />
                                    <p className="text-[10px] text-center text-muted-foreground mt-2">
                                        Scan barcode ISBN 10/13 pada sampul belakang buku
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pl-8"
                                        placeholder="Scan barcode ISBN..."
                                        value={isbn}
                                        onChange={(e) => setIsbn(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleISBNLookup()}
                                    />
                                </div>
                                <Button variant="secondary" onClick={handleISBNLookup} disabled={loading || !isbn}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cari"}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t">
                            {lookupStatus === 'not_found' && (
                                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 rounded-md flex items-start gap-2 mb-2">
                                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                                    <div className="text-xs text-amber-800 dark:text-amber-300">
                                        <p className="font-semibold">Data online tidak ditemukan</p>
                                        <p>ISBN valid namun datanya tidak ada di server. Silakan isi **Judul** dan **Penulis** secara manual di bawah ini.</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                {catalog.coverUrl ? (
                                    <div className="md:col-span-1 space-y-2">
                                        <div className="group relative aspect-[3/4] rounded-lg overflow-hidden border border-border shadow-sm bg-muted flex items-center justify-center">
                                            <img 
                                                src={catalog.coverUrl} 
                                                alt="Cover" 
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = "/images/placeholder-book.png";
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <Label htmlFor="cover-upload" className="cursor-pointer bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-sm border border-white/20 text-white">
                                                    <Upload className="h-5 w-5" />
                                                </Label>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-center text-muted-foreground italic">
                                            Unduh otomatis aktif
                                        </p>
                                        <input 
                                            type="file" 
                                            id="cover-upload" 
                                            className="hidden" 
                                            accept="image/*"
                                            onChange={handleUploadCover}
                                        />
                                    </div>
                                ) : (
                                    <div className="md:col-span-1 space-y-2">
                                        <div className="aspect-[3/4] rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/20 bg-muted/50 flex flex-col items-center justify-center p-4 text-center group cursor-pointer hover:border-muted-foreground/40 transition-colors" onClick={() => document.getElementById('cover-upload')?.click()}>
                                            <Upload className="h-8 w-8 text-muted-foreground/40 mb-2 group-hover:text-muted-foreground/60 transition-colors" />
                                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Upload Sampul</p>
                                            <input 
                                                type="file" 
                                                id="cover-upload" 
                                                className="hidden" 
                                                accept="image/*"
                                                onChange={handleUploadCover}
                                            />
                                        </div>
                                        <p className="text-[10px] text-center text-muted-foreground italic">
                                            Opsional
                                        </p>
                                    </div>
                                )}
                                <div className="md:col-span-3 space-y-5">
                                    <div className="grid gap-3">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="title">Judul Buku</Label>
                                            {aiEnabled && (
                                                <Button 
                                                    type="button" 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-7 px-2.5 text-xs border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/10 text-purple-700 dark:text-purple-300 gap-1 font-semibold"
                                                    disabled={aiLoading || !catalog.title?.trim() || !catalog.author?.trim()}
                                                    onClick={() => triggerAIClassify(catalog.title, catalog.author, catalog.description || "", catalog.subjects || [])}
                                                >
                                                    {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                                    Tanya AI
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="title"
                                                className={!catalog.title?.trim() ? "border-amber-400 ring-amber-400 focus-visible:ring-amber-500" : ""}
                                                value={catalog.title}
                                                onChange={(e) => setCatalog({...catalog, title: e.target.value})}
                                            />
                                            {catalog.localFound && (
                                                <Badge className="bg-green-100 text-green-800 border-green-200 shrink-0">
                                                    Lokal
                                                </Badge>
                                            )}
                                        </div>
                                        {catalog.localFound && (
                                            <p className="text-[10px] text-green-600 font-medium">
                                                Sudah ada {catalog.totalExemplars} copy di koleksi. Ini akan menjadi exemplar ke-{Number(catalog.totalExemplars) + 1}.
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div className="grid gap-3">
                                            <Label htmlFor="author">Penulis</Label>
                                            <Input
                                                id="author"
                                                className={!catalog.author?.trim() ? "border-amber-400 ring-amber-400 focus-visible:ring-amber-500" : ""}
                                                value={catalog.author}
                                                onChange={(e) => setCatalog({...catalog, author: e.target.value})}
                                            />
                                        </div>
                                        <div className="grid gap-3">
                                            <Label htmlFor="publisher">Penerbit</Label>
                                            <Input
                                                id="publisher"
                                                value={catalog.publisher}
                                                onChange={(e) => setCatalog({...catalog, publisher: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* AI Suggestion Card */}
                                    {aiEnabled && (aiRecommendation || aiLoading) && (
                                        <div className="relative overflow-hidden rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-transparent to-indigo-500/5 p-4 backdrop-blur-sm shadow-sm space-y-3">
                                            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 opacity-60" />
                                            
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="rounded-full bg-purple-500/10 p-1.5 text-purple-600 dark:text-purple-400">
                                                        <Sparkles className="h-4 w-4 animate-pulse" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xs font-bold text-purple-950 dark:text-purple-300 uppercase tracking-wider">Rekomendasi Gemini AI</h4>
                                                        <p className="text-[10px] text-muted-foreground">Otomatisasi klasifikasi DDC & Rak Buku</p>
                                                    </div>
                                                </div>
                                                
                                                {aiRecommendation && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold gap-1"
                                                        onClick={() => {
                                                            setOverrideCategory(aiRecommendation.category);
                                                            setLocation(aiRecommendation.shelf);
                                                            if (aiRecommendation.description && !catalog.description) {
                                                                setCatalog(prev => ({ ...prev, description: aiRecommendation.description }));
                                                            }
                                                            if (aiRecommendation.subjects && aiRecommendation.subjects.length > 0) {
                                                                setCatalog(prev => ({ 
                                                                    ...prev, 
                                                                    subjects: Array.from(new Set([...(prev.subjects || []), ...(aiRecommendation.subjects || [])]))
                                                                }));
                                                            }
                                                            toast.success("Rekomendasi AI berhasil diterapkan!");
                                                        }}
                                                    >
                                                        <Check className="h-3 w-3" />
                                                        Terapkan Saran
                                                    </Button>
                                                )}
                                            </div>
                                            
                                            {aiLoading ? (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
                                                    <span>Gemini sedang menganalisis buku...</span>
                                                </div>
                                            ) : aiRecommendation ? (
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                                        <div className="rounded-lg bg-background/50 border p-2 space-y-0.5">
                                                            <span className="text-[10px] text-muted-foreground font-medium uppercase">Kategori DDC</span>
                                                            <p className="font-semibold text-foreground">{getDDCLabel(aiRecommendation.category)}</p>
                                                        </div>
                                                        <div className="rounded-lg bg-background/50 border p-2 space-y-0.5">
                                                            <span className="text-[10px] text-muted-foreground font-medium uppercase">Saran Lokasi Rak</span>
                                                            <p className="font-semibold text-foreground">{getAllShelves().find(s => s.value === aiRecommendation.shelf)?.label || aiRecommendation.shelf}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    {aiRecommendation.reason && (
                                                        <p className="text-xs text-muted-foreground leading-relaxed italic bg-purple-500/5 p-2 rounded-lg border border-purple-500/10">
                                                            &ldquo;{aiRecommendation.reason}&rdquo;
                                                        </p>
                                                    )}
                                                    
                                                    {aiRecommendation.description && !catalog.description && (
                                                        <div className="text-[11px] text-muted-foreground space-y-1">
                                                            <span className="font-semibold text-foreground block">Sinopsis Pendek (AI):</span>
                                                            <p className="leading-normal">{aiRecommendation.description}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                    )}

                                    {/* DDC Category Section */}
                                    <div className="grid gap-3 pt-5 border-t">
                                        <Label>Kategori DDC (Dewey Decimal)</Label>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <Badge variant="outline" className="text-sm py-1 px-3">
                                                {getDDCLabel(catalog.ddcCategory || "UNSORTED")}
                                            </Badge>
                                            <Select
                                                value={overrideCategory || "auto"}
                                                onValueChange={(val) => {
                                                    const newCat = val === "auto" ? null : val as DDCCategory;
                                                    setOverrideCategory(newCat);
                                                    // Update shelf when override changes
                                                    const shelf = getShelfByDDC(newCat || catalog.ddcCategory || "UNSORTED");
                                                    setLocation(shelf);
                                                }}
                                            >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Override kategori (opsional)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="auto">Gunakan kategori otomatis</SelectItem>
                                                {getAllDDCCategories().map((cat) => (
                                                    <SelectItem key={cat.value} value={cat.value}>
                                                        {cat.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                            </Select>
                                        </div>
                                        
                                        {/* Show subjects from API */}
                                        {catalog.subjects && catalog.subjects.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                <span className="text-xs text-muted-foreground mr-1">Subjek:</span>
                                                {catalog.subjects.slice(0, 5).map((s, i) => (
                                                    <Badge key={i} variant="secondary" className="text-xs">
                                                        {s}
                                                    </Badge>
                                                ))}
                                                {catalog.subjects.length > 5 && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        +{catalog.subjects.length - 5}
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between mt-6 items-center">
                            <Button variant="outline" onClick={() => setStep(1)}>Kembali</Button>
                            
                            <div className="flex items-center gap-3">
                                {(!catalog.title?.trim() || !catalog.author?.trim()) && (
                                    <span className="text-xs text-amber-600 font-medium">Judul dan Penulis wajib diisi</span>
                                )}
                                <Button onClick={() => setStep(3)} disabled={!catalog.title?.trim() || !catalog.author?.trim()}>Lanjut</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 3 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Langkah 3: Konfirmasi & Lokasi</CardTitle>
                        <CardDescription>Tentukan lokasi penyimpanan dan simpan data</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-muted p-4 rounded-lg space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg">{catalog.title}</h3>
                                    <p className="text-sm text-muted-foreground">{catalog.author}</p>
                                </div>
                                <Badge variant="outline" className="font-mono">{qrCode}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
                                <span>ISBN: {catalog.isbn || '-'}</span>
                                <span>Penerbit: {catalog.publisher || '-'}</span>
                                <span>Kategori: {getDDCLabel(overrideCategory || catalog.ddcCategory || "UNSORTED")}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Lokasi Rak</Label>
                                <Select value={location} onValueChange={setLocation}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Rak" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getAllShelves().map((shelf) => (
                                            <SelectItem key={shelf.value} value={shelf.value}>
                                                {shelf.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="outline" onClick={() => setStep(2)}>Edit Data</Button>
                            <Button className="gap-2" onClick={handleSave} disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Simpan Buku
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

