"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { QRScanner } from "@/components/ui/qr-scanner";
import { CoverField } from "@/components/library/cover-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Book, QrCode, Search, Check, Loader2, ArrowLeft, ArrowRight, Save, Plus, Camera, CameraOff, AlertCircle, X, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDDCLabel, getAllDDCCategories, getShelfByDDC, getAllShelves, type DDCCategory } from "@/lib/library/ddc-mapping";
import { goGet, goPost } from "@/lib/api-client";

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
    const [lookupSources, setLookupSources] = useState<string[]>([]);
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
    // Kandidat multi-judul: 1 ISBN dipakai N katalog (dedup longgar).
    const [isbnCandidates, setIsbnCandidates] = useState<any[]>([]);

    // Cari Judul (search by title)
    const [searchMode, setSearchMode] = useState<'isbn' | 'title'>('isbn');
    const [searchQuery, setSearchQuery] = useState("");
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchPage, setSearchPage] = useState(1);
    const [searchHasMore, setSearchHasMore] = useState(false);
    const [searchTotal, setSearchTotal] = useState(0);
    const [searchPerformed, setSearchPerformed] = useState(false);

    const runBookSearch = async (query: string, page: number) => {
        if (!query.trim()) return;
        setSearchLoading(true);
        try {
            const params = new URLSearchParams({ q: query, page: String(page), perPage: "10" });
            const res: any = await goGet(`/api/library/search?${params.toString()}`, { timeout: 60000 });
            if (res?.data) {
                setSearchResults(res.data.results || []);
                setSearchHasMore(!!res.data.hasMore);
                setSearchTotal(res.data.totalItems || 0);
                setSearchPage(page);
                setSearchPerformed(true);
            } else {
                setSearchResults([]);
                setSearchHasMore(false);
                setSearchPerformed(true);
            }
        } catch {
            toast.error("Gagal mencari buku. Coba lagi.");
        } finally {
            setSearchLoading(false);
        }
    };

    const applySearchResult = (item: any) => {
        setIsbnCandidates(Array.isArray(item.candidates) ? item.candidates : []);
        setCatalog({
            title: item.title || "",
            author: item.author || "",
            publisher: item.publisher || "",
            year: item.year || new Date().getFullYear(),
            isbn: item.isbn || "",
            coverUrl: item.cover || item.coverUrl,
            subjects: item.subjects || [],
            ddcCategory: item.ddcCategory || "UNSORTED",
            localFound: item.localFound,
            totalExemplars: item.totalExemplars,
            description: item.description || "",
        });
        if (item.isbn) setIsbn(item.isbn);
        const targetShelf = getShelfByDDC((item.ddcCategory as DDCCategory) || "UNSORTED");
        setLocation(targetShelf);
        setOverrideCategory(null);
        setLookupStatus('success');
        setLookupSources(Array.isArray(item.sources) ? item.sources : []);
        toast.success(`Data "${item.title}" diterapkan.`);
    };

    // Cache hasil AI per judul+penulis (session) agar klik ulang instan & hemat token.
    const aiCacheRef = useRef<Map<string, typeof aiRecommendation>>(new Map());
    const aiInFlightRef = useRef(false);

    const aiCacheKey = (title: string, author: string) =>
        `${title.trim().toLowerCase()}::${author.trim().toLowerCase()}`;

    const triggerAIClassify = async (
        title: string,
        author: string,
        description: string = "",
        subjects: string[] = []
    ) => {
        if (!title.trim()) return;
        if (aiInFlightRef.current) return; // cegah klik ganda memicu 2 request
        const key = aiCacheKey(title, author);
        const cached = aiCacheRef.current.get(key);
        if (cached) {
            setAiRecommendation(cached);
            setAiEnabled(true);
            setOverrideCategory(prev => prev || cached!.category);
            setLocation(prev => (prev === "RAK-NEW" || !prev) ? cached!.shelf : prev);
            toast.info("Rekomendasi AI dari hasil sebelumnya diterapkan.");
            return;
        }
        aiInFlightRef.current = true;
        setAiLoading(true);
        try {
            // 25s: backend memberi provider utama 13s lalu fallback ~5s (total
            // 18s) + jaringan; 60s membuat spinner terasa menggantung bila gagal.
            const response: any = await goPost("/api/library/catalog/ai-classify", {
                title,
                author,
                description,
                subjects,
            }, { timeout: 25000 });

            if (!response.error) {
                if (response.ai_enabled === false) {
                    setAiEnabled(false);
                    setAiRecommendation(null);
                    toast.info(response.message || "AI belum dikonfigurasi di server.");
                } else {
                    setAiEnabled(true);
                    const rec = response.data;
                    setAiRecommendation(rec);
                    aiCacheRef.current.set(key, rec);

                    // Auto-apply AI suggestions to form fields if user hasn't manually set override
                    setOverrideCategory(prev => prev || rec.category);
                    setLocation(prev => (prev === "RAK-NEW" || !prev) ? rec.shelf : prev);

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

                    const secs = typeof response.elapsed_ms === "number" && response.elapsed_ms > 0
                        ? `${(response.elapsed_ms / 1000).toFixed(1)}s`
                        : null;
                    toast.success(secs
                        ? `Rekomendasi AI siap dalam ${secs}!`
                        : "Rekomendasi AI otomatis diterapkan!");
                }
            } else {
                console.error("AI Classify failed:", response.error);
                toast.error("AI tidak bisa merespons sekarang.", {
                    description: "Isi kategori & rak manual, atau coba lagi beberapa detik lagi.",
                    duration: 6000,
                });
            }
        } catch (error: any) {
            console.error("Failed calling AI classification endpoint", error);
            toast.error("Koneksi ke layanan AI gagal / timeout.", {
                description: "Isi kategori & rak manual, atau coba lagi nanti.",
                duration: 6000,
            });
        } finally {
            aiInFlightRef.current = false;
            setAiLoading(false);
        }
    };

    // Step 1: Scan QR Identity
    const checkQRBound = async (code: string): Promise<boolean> => {
        // true jika QR sudah terikat ke aset lain
        try {
            const res: any = await goGet(`/api/library/books/qr/${encodeURIComponent(code)}`);
            if (res && res.id) {
                toast.error(`QR "${code}" sudah terikat ke buku "${res.title || 'tanpa judul'}". Gunakan QR lain.`);
                return true;
            }
        } catch {
            // 404 = belum terikat, aman
        }
        return false;
    };

    const handleQRScan = async (code: string) => {
        setQrCode(code);
        if (await checkQRBound(code)) return; // tolak, tetap di langkah 1
        toast.success(`QR Code Terdeteksi: ${code}`);
        setStep(2);
    };

    // Step 2: ISBN Lookup
    const handleISBNScan = (code: string) => {
        // Normalisasi hasil scan barcode:
        // - buang spasi/pemisah dari hasil decode
        // - buang add-on harga (EAN-13 + 5 digit) agar ISBN inti yang terbaca
        // - konversi UPC-A buku lama (0 + ISBN-10 + check) menjadi ISBN-10
        let raw = code.replace(/[^0-9Xx]/g, "").toUpperCase();
        if (raw.length > 13 && (raw.startsWith("978") || raw.startsWith("979"))) {
            raw = raw.slice(0, 13);
        }
        if (raw.length === 12 && raw.startsWith("0")) {
            raw = raw.slice(1, 11);
        }
        const isIsbn13 = raw.length === 13 && /^97[89]/.test(raw);
        const isIsbn10 = raw.length === 10 && /^[0-9]{9}[0-9X]$/.test(raw);
        if (!isIsbn13 && !isIsbn10) {
            toast.info(`Barcode terbaca (${code}), tetapi bukan ISBN.`, {
                description: "Arahkan ke barcode ISBN 10/13 di sampul belakang, atau isi manual.",
                duration: 5000,
            });
            return;
        }
        setIsbn(raw);
        toast.info(`ISBN Terdeteksi: ${raw}`);
        // We need to pass the code directly because state update is async
        triggerISBNLookup(raw);
    };

    const handleISBNLookup = async () => {
        if (!isbn) return;
        triggerISBNLookup(isbn);
    };

    const triggerISBNLookup = async (isbnToLookup: string) => {
        setLoading(true);
        setLookupStatus('loading');
        try {
            const response: any = await goGet(`/api/library/isbn/${encodeURIComponent(isbnToLookup)}`, { timeout: 60000 });
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
                    if (Array.isArray(data.candidates) && data.candidates.length > 1) {
                        setIsbnCandidates(data.candidates);
                        setCatalog({
                            title: "",
                            author: "",
                            publisher: "",
                            year: new Date().getFullYear(),
                            isbn: isbnToLookup,
                            coverUrl: undefined,
                            subjects: [],
                            ddcCategory: "UNSORTED",
                            localFound: true,
                            totalExemplars: data.candidates.reduce((n: number, c: any) => n + (c.totalExemplars || 0), 0),
                            description: "",
                        });
                        setLocation("RAK-NEW");
                        toast.warning(`ISBN ini dipakai ${data.candidates.length} judul berbeda — pilih judul yang benar.`, {
                            description: "Buku tidak otomatis menumpang katalog lain lagi.",
                            duration: 7000,
                        });
                    } else {
                        toast.success(`Data ditemukan di koleksi lokal! (${data.totalExemplars} exemplar sudah ada)`);
                    }
                } else {
                    const sourceText = Array.isArray(data.sources) && data.sources.length > 0 ? ` (${data.sources.join(", ")})` : "";
                    toast.success(`Data buku ditemukan!${sourceText}`, {
                        description: sourceText ? `Sumber: ${data.sources.join(", ")}` : undefined,
                    });
                }
                // Simpan sumber agar bisa ditampilkan di UI
                setLookupSources(Array.isArray(data.sources) ? data.sources : []);
                // Automatically hide scanner to show results
                setShowISBNScanner(false);
            } else {
                setLookupStatus('not_found');
                setLookupSources([]);
                toast.info("ISBN tidak ditemukan di Google Books maupun Open Library.", {
                    description: "Silakan isi Judul & Penulis manual, atau gunakan tab 'Cari Judul'.",
                    duration: 7000,
                });
                setCatalog(prev => ({
                    ...prev,
                    title: "",
                    author: "",
                    publisher: "",
                    isbn: isbnToLookup,
                    ddcCategory: "UNSORTED",
                    description: "",
                }));
                setIsbnCandidates([]);
            }
        } catch (error) {
            setLookupStatus('idle');
            toast.error("Gagal menghubungi server. Periksa koneksi lalu coba lagi.");
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
                setIsbnCandidates([]);
                setLookupSources([]);
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
                            <Button disabled={!qrCode} onClick={async () => {
                                if (await checkQRBound(qrCode)) return; // tolak, tetap di langkah 1
                                setStep(2);
                            }}>Lanjut</Button>
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
                            {/* Mode: ISBN vs Cari Judul */}
                            <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
                                <Button
                                    type="button"
                                    variant={searchMode === 'isbn' ? 'default' : 'ghost'}
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => setSearchMode('isbn')}
                                >
                                    <QrCode className="h-3.5 w-3.5 mr-1" />
                                    Scan / ISBN
                                </Button>
                                <Button
                                    type="button"
                                    variant={searchMode === 'title' ? 'default' : 'ghost'}
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => setSearchMode('title')}
                                >
                                    <Search className="h-3.5 w-3.5 mr-1" />
                                    Cari Judul
                                </Button>
                            </div>

                            {searchMode === 'isbn' ? (
                                <>
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
                                                barcodeMode={true}
                                                sound={true}
                                                vibrate={true}
                                                formats={["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf", "codabar", "data_matrix", "pdf417"]}
                                                caption="Dekatkan 10–20 cm · tekan 🔦 bila gelap · pakai zoom untuk barcode kecil"
                                                className="mx-auto"
                                            />
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
                                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 border">
                                        <p className="font-medium mb-0.5">Tidak menemukan buku Indonesia?</p>
                                        <p>Banyak buku lokal tidak terindeks ISBN di Google Books/Open Library. Gunakan tab <strong>Cari Judul</strong> sebagai alternatif.</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Label className="text-sm font-medium">Cari Berdasarkan Judul</Label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                className="pl-8"
                                                placeholder="Ketik judul buku, mis. 'Laut Bercerita'..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') { setSearchPage(1); runBookSearch(searchQuery, 1); } }}
                                            />
                                        </div>
                                        <Button
                                            variant="secondary"
                                            onClick={() => { setSearchPage(1); runBookSearch(searchQuery, 1); }}
                                            disabled={searchLoading || !searchQuery.trim()}
                                        >
                                            {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cari"}
                                        </Button>
                                    </div>

                                    {searchLoading && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Mencari di Google Books & Open Library...
                                        </div>
                                    )}

                                    {!searchLoading && searchPerformed && searchResults.length === 0 && (
                                        <div className="text-xs rounded-md p-3 border border-amber-200 bg-amber-50 text-amber-800">
                                            <p className="font-medium mb-1">Tidak ada hasil untuk &quot;{searchQuery}&quot;</p>
                                            <p>Coba kurangi kata kunci (mis. hanya judul saja), atau gunakan tab Scan/ISBN bila bukunya punya barcode.</p>
                                            <p className="mt-1 opacity-80">Layanan katalog eksternal (Google Books/Open Library) kadang sedang penuh atau terganggu, sehingga sebagian buku tidak muncul.</p>
                                        </div>
                                    )}

                                    {searchResults.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs text-muted-foreground">
                                                Menampilkan halaman {searchPage} — {searchResults.length} hasil
                                                {searchTotal > 0 ? ` dari ±${searchTotal}` : ""}. Pilih salah satu:
                                            </p>
                                            <div className="grid gap-2 max-h-[420px] overflow-y-auto pr-1">
                                                {searchResults.map((item, idx) => (
                                                    <button
                                                        type="button"
                                                        key={(item.isbn || item.title) + idx}
                                                        onClick={() => applySearchResult(item)}
                                                        className="flex gap-3 text-left p-2.5 rounded-lg border border-border hover:border-purple-400 hover:bg-purple-500/5 transition-colors"
                                                    >
                                                        <div className="w-12 h-16 rounded overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                                                            {item.cover || item.coverUrl ? (
                                                                <img
                                                                    src={item.cover || item.coverUrl}
                                                                    alt={item.title}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                                />
                                                            ) : (
                                                                <Book className="h-5 w-5 text-muted-foreground/40" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start gap-2">
                                                                <p className="font-semibold text-sm line-clamp-2 flex-1">{item.title}</p>
                                                                {item.localFound && (
                                                                    <Badge className="bg-green-100 text-green-800 border-green-200 shrink-0 text-[10px]">
                                                                        Lokal
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground line-clamp-1">
                                                                {item.author || "Penulis tidak diketahui"}
                                                                {item.year ? ` • ${item.year}` : ""}
                                                            </p>
                                                            {item.publisher && (
                                                                <p className="text-[10px] text-muted-foreground line-clamp-1">{item.publisher}</p>
                                                            )}
                                                            {item.isbn && (
                                                                <p className="text-[10px] text-muted-foreground font-mono">ISBN: {item.isbn}</p>
                                                            )}
                                                            {Array.isArray(item.sources) && item.sources.length > 0 && (
                                                                <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">
                                                                    Sumber: {item.sources.join(", ")}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="flex items-center justify-between pt-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs"
                                                    disabled={searchPage <= 1 || searchLoading}
                                                    onClick={() => runBookSearch(searchQuery, searchPage - 1)}
                                                >
                                                    Sebelumnya
                                                </Button>
                                                <span className="text-xs text-muted-foreground">Halaman {searchPage}</span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs"
                                                    disabled={!searchHasMore || searchLoading}
                                                    onClick={() => runBookSearch(searchQuery, searchPage + 1)}
                                                >
                                                    Berikutnya
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="space-y-3 pt-4 border-t">
                            {lookupStatus === 'not_found' && (
                                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 rounded-md flex items-start gap-2 mb-2">
                                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                                    <div className="text-xs text-amber-800 dark:text-amber-300">
                                        <p className="font-semibold">ISBN tidak ada di Google Books & Open Library</p>
                                        <p>Silakan isi <strong>Judul</strong> dan <strong>Penulis</strong> manual di bawah, atau gunakan tab <strong>Cari Judul</strong>.</p>
                                    </div>
                                </div>
                            )}

                            {lookupStatus === 'success' && lookupSources.length > 0 && (
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mb-2">
                                    <span className="font-medium">Sumber data:</span>
                                    {lookupSources.map((s, i) => (
                                        <Badge key={i} variant="outline" className="text-[10px] py-0 px-1.5">{s}</Badge>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <CoverField
                                    coverUrl={catalog.coverUrl}
                                    isbn={catalog.isbn}
                                    onCoverChange={(url) => setCatalog((prev) => ({ ...prev, coverUrl: url }))}
                                    size="fluid"
                                    wrapperClassName="md:col-span-1 space-y-2"
                                    caption={catalog.coverUrl ? "Unduh otomatis aktif" : "Opsional"}
                                    onBusyChange={setLoading}
                                />
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
                                                     disabled={aiLoading || !catalog.title?.trim()}
                                                     onClick={() => triggerAIClassify(catalog.title, catalog.author, catalog.description || "", catalog.subjects || [])}
                                                >
                                                    {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                                    {aiLoading ? "Menganalisis…" : "Tanya AI"}
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
                                        {catalog.localFound && isbnCandidates.length <= 1 && (
                                            <p className="text-[10px] text-green-600 font-medium">
                                                Sudah ada {catalog.totalExemplars} copy di koleksi. Ini akan menjadi exemplar ke-{Number(catalog.totalExemplars) + 1}.
                                            </p>
                                        )}
                                        {isbnCandidates.length > 1 && (
                                            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                                                <p className="text-xs font-semibold text-amber-800">
                                                    ISBN ini dipakai {isbnCandidates.length} judul berbeda. Pilih judul yang benar:
                                                </p>
                                                <div className="space-y-1.5">
                                                    {isbnCandidates.map((c: any) => (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setCatalog(prev => ({
                                                                    ...prev,
                                                                    title: c.title,
                                                                    author: c.author || prev.author,
                                                                    localFound: true,
                                                                    totalExemplars: c.totalExemplars,
                                                                }));
                                                                toast.success(`Judul "${c.title}" dipilih.`);
                                                            }}
                                                            className={`w-full text-left rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                                                                catalog.title === c.title
                                                                    ? "border-green-500 bg-green-50 font-semibold"
                                                                    : "border-amber-200 bg-white hover:bg-amber-100/60"
                                                            }`}
                                                        >
                                                            {c.title}
                                                            <span className="ml-1.5 text-[10px] text-muted-foreground">
                                                                ({c.totalExemplars} eksemplar{c.author ? ` · ${c.author}` : ""})
                                                            </span>
                                                        </button>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsbnCandidates([]);
                                                            setCatalog(prev => ({ ...prev, title: "", localFound: false }));
                                                            toast.info("Isi judul baru di bawah — akan tersimpan sebagai katalog terpisah.");
                                                        }}
                                                        className="w-full text-left rounded-md border border-dashed border-amber-300 px-2.5 py-1.5 text-xs text-amber-700 hover:bg-amber-100/60"
                                                    >
                                                        + Judul lain (buat katalog baru dengan ISBN ini)
                                                    </button>
                                                </div>
                                            </div>
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

