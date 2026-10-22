"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { QRScanner } from "@/components/ui/qr-scanner";
import { CoverField } from "@/components/library/cover-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Book, QrCode, Search, Check, Loader2, ArrowLeft, Save, Plus, Camera, CameraOff, AlertCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDDCLabel, getAllDDCCategories, getShelfByDDC, getAllShelves, type DDCCategory } from "@/lib/library/ddc-mapping";
import { goGet, goPost } from "@/lib/api-client";
import { normalizeISBNBarcode, aiCacheKey, resolveCoverState } from "./binding-helpers";
import type { CatalogData } from "./binding-helpers";

export default function LibraryBindingPage() {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [qrCode, setQrCode] = useState("");
    const [isbn, setIsbn] = useState("");
    const [loading, setLoading] = useState(false);
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
        description?: string;
        reason?: string;
        subjects?: string[];
    } | null>(null);
    const [aiEnabled, setAiEnabled] = useState(true);
    // Kandidat multi-judul: 1 ISBN dipakai N katalog (dedup longgar).
    const [isbnCandidates, setIsbnCandidates] = useState<any[]>([]);
    const [selectedCatalogId, setSelectedCatalogId] = useState<string>("");
    // Sampul hasil unggahan pada sesi ini + katalog tujuan unggahan itu.
    // Unggahan hanya berlaku untuk judul yang sama; kalau target berubah,
    // sampul unggahan lama dibuang (bukan diwarisi judul lain).
    const [uploadedCover, setUploadedCover] = useState<{ url: string; catalogId: string } | null>(null);
    const finalCategory = (overrideCategory || catalog.ddcCategory || "UNSORTED") as DDCCategory;
    const location = getShelfByDDC(finalCategory);
    const lookupSeqRef = useRef(0);

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
        const candidates: any[] = Array.isArray(item.candidates) ? item.candidates : [];
        setIsbnCandidates(candidates);
        // Hasil Cari Judul selalu berasal dari katalog lokal. Bila user memilih
        // judul yang sudah ada, eksemplar baru masuk ke katalog itu (eksemplar
        // ke-2 dst.) — bukan membuat duplikat judul.
        setSelectedCatalogId(item.id ? String(item.id) : "");
        setUploadedCover(null);
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
        setOverrideCategory(null);
        setLookupStatus('success');
        setLookupSources(Array.isArray(item.sources) ? item.sources : []);
        if (item.localFound && item.totalExemplars) {
            toast.success(`"${item.title}" sudah ada — eksemplar ke-${Number(item.totalExemplars) + 1}.`);
        } else {
            toast.success(`Data "${item.title}" diterapkan.`);
        }
    };

    // Cache hasil AI per judul+penulis (session) agar klik ulang instan & hemat token.
    const aiCacheRef = useRef<Map<string, typeof aiRecommendation>>(new Map());
    const aiInFlightRef = useRef(false);

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
        const { isbn: raw, valid } = normalizeISBNBarcode(code);
        if (!valid) {
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

    const triggerISBNLookup = async (isbnToLookup: string, opts?: { preferNewTitle?: boolean }) => {
        const seq = ++lookupSeqRef.current;
        setLoading(true);
        setLookupStatus('loading');
        try {
            const response: any = await goGet(`/api/library/isbn/${encodeURIComponent(isbnToLookup)}`, { timeout: 15000 });
            if (seq !== lookupSeqRef.current) return; // hasil lama, sudah digantikan scan berikutnya
            const data = response?.data;
            if (!response.error && data) {
                const candidates: any[] = Array.isArray(data.candidates) ? data.candidates : [];
                const multi = candidates.length > 1;
                const first = candidates.length >= 1 ? candidates[0] : null;
                setLookupStatus('success');
                // Selalu simpan kandidat (walau hanya 1) supaya picker + tombol
                // "+ Judul lain" tetap muncul: ISBN yang sudah dipakai 1 judul
                // pun harus bisa dipakai untuk judul BARU.
                setIsbnCandidates(candidates);
                setUploadedCover(null);
                setSelectedCatalogId(multi ? "" : (first?.id || data.id || ""));
                setCatalog({
                    title: (multi || opts?.preferNewTitle) ? "" : (data.title || ""),
                    author: (multi || opts?.preferNewTitle) ? "" : (data.author || ""),
                    publisher: (multi || opts?.preferNewTitle) ? "" : (data.publisher || ""),
                    year: data.year || new Date().getFullYear(),
                    isbn: isbnToLookup,
                    coverUrl: (multi || opts?.preferNewTitle) ? undefined : (data.cover || data.coverUrl),
                    subjects: data.subjects || [],
                    ddcCategory: data.ddcCategory || "UNSORTED",
                    localFound: true,
                    totalExemplars: multi ? candidates.reduce((n: number, c: any) => n + (c.totalExemplars || 0), 0) : data.totalExemplars,
                    description: (multi || opts?.preferNewTitle) ? "" : (data.description || ""),
                });
                if (opts?.preferNewTitle) {
                    // User sudah menekan "Judul Baru": biarkan judul kosong agar
                    // diisi manual; kandidat tetap tampil agar bisa memilih
                    // "tambah eksemplar" bila ternyata judulnya sama.
                    setSelectedCatalogId("");
                    toast.info("ISBN ini sudah terdaftar. Isi judul baru, atau pilih judul yang ada di bawah.", {
                        duration: 7000,
                    });
                } else if (!multi) {
                    // Buku sudah ada: eksemplar baru mewarisi kategori & data
                    // katalog yang ada. AI TIDAK dipanggil otomatis — user bisa
                    // menekan "Tanya AI" bila memang ingin menilai ulang.
                    toast.success(`Ditemukan di koleksi! Ini akan menjadi eksemplar ke-${(data.totalExemplars || 0) + 1}.`, {
                        description: "Atau tekan \"Judul lain\" bila buku ini judul berbeda dengan ISBN sama.",
                        duration: 7000,
                    });
                } else {
                    toast.warning(`ISBN ini dipakai ${candidates.length} judul berbeda — pilih judul yang benar.`, {
                        description: "Pilih salah satu untuk menambah eksemplar, atau buat judul baru.",
                        duration: 7000,
                    });
                }
                setLookupSources(["Katalog Lokal"]);
                setShowISBNScanner(false);
            } else {
                setLookupStatus('not_found');
                setLookupSources([]);
                setIsbnCandidates([]);
                setUploadedCover(null);
                setSelectedCatalogId("");
                toast.info("ISBN belum ada di koleksi.", {
                    description: "Isi judul dan data buku secara manual.",
                    duration: 6000,
                });
                setCatalog(prev => ({
                    ...prev,
                    title: "",
                    author: "",
                    publisher: "",
                    isbn: isbnToLookup,
                    coverUrl: undefined,
                    localFound: false,
                    totalExemplars: undefined,
                    ddcCategory: "UNSORTED",
                    description: "",
                }));
            }
        } catch (error) {
            if (seq !== lookupSeqRef.current) return;
            setLookupStatus('idle');
            toast.error("Gagal menghubungi server. Periksa koneksi lalu coba lagi.");
        } finally {
            if (seq === lookupSeqRef.current) setLoading(false);
        }
    };

    const pickCatalog = (c: any) => {
        setSelectedCatalogId(c.id);
        // Sampul milik kandidat yang dipilih (bukan milik judul lain).
        // Unggahan sebelumnya tidak berlaku karena target berubah.
        setUploadedCover(null);
        setCatalog(prev => ({
            ...prev,
            title: c.title,
            author: c.author || prev.author,
            localFound: true,
            totalExemplars: c.totalExemplars,
            coverUrl: c.cover || undefined,
        }));
        toast.success(`Eksemplar akan masuk ke "${c.title}".`);
    };

    const useNewTitle = () => {
        setSelectedCatalogId("");
        setUploadedCover(null);
        // Judul baru TIDAK mewarisi sampul judul lain (bug lama: judul baru
        // memakai sampul judul pertama). User bisa unggah sampul sendiri.
        setCatalog(prev => ({ ...prev, title: "", author: "", localFound: false, totalExemplars: undefined, coverUrl: undefined }));
        toast.info("Isi judul baru — akan tersimpan sebagai katalog terpisah dengan ISBN ini.");
    };

    // Dipakai dari tab "Cari Judul": user ingin menambah judul BARU. Bila field
    // ISBN diisi, cek dulu ke katalog — jika ISBN itu sudah dipakai judul lain,
    // tampilkan picker (tambah eksemplar vs judul baru). Bila tidak, langsung
    // kosongkan form untuk judul baru.
    const startTitleFromSearch = async () => {
        const manual = isbn.trim();
        if (!manual) {
            setSelectedCatalogId("");
            setUploadedCover(null);
            setCatalog(prev => ({ ...prev, title: "", author: "", localFound: false, totalExemplars: undefined, isbn: "", coverUrl: undefined }));
            toast.info("Isi data judul baru di bawah. Tambahkan ISBN bila ada.");
            return;
        }
        await triggerISBNLookup(manual, { preferNewTitle: true });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Sampul hanya milik judul ini: judul baru tidak mewarisi
            // sampul judul lain, sampul hasil unggahan sesi ini boleh
            // menimpa (coverOverwrite = true).
            const selectedCandidate = isbnCandidates.find((c: any) => c.id === selectedCatalogId);
            const uploaded = uploadedCover && uploadedCover.catalogId === selectedCatalogId
                ? uploadedCover.url
                : undefined;
            const coverState = resolveCoverState({
                uploadedUrl: uploaded,
                ownedUrl: selectedCandidate?.cover || (selectedCatalogId ? catalog.coverUrl : undefined),
                isNewTitle: !selectedCatalogId,
            });
            const result: any = await goPost("/api/library/assets/bind", {
                qrCode,
                location,
                catalog: {
                    ...catalog,
                    cover: coverState.coverUrl, // Map frontend coverUrl to backend cover
                    coverOverwrite: coverState.coverOverwrite,
                    category: overrideCategory || catalog.ddcCategory || "UNSORTED",
                    catalogId: selectedCatalogId || undefined,
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
                setStep(1);
                setIsbnCandidates([]);
                setSelectedCatalogId("");
                setUploadedCover(null);
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
                <Button variant="outline" size="icon" onClick={() => router.back()} className="shrink-0 border-slate-200 bg-white shadow-sm hover:bg-slate-50">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight truncate">Binding Buku Baru</h1>
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
                        <div className="flex flex-col sm:flex-row gap-2">
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
                                        <p className="font-medium mb-0.5">Sudah pernah mendaftarkan buku ini?</p>
                                        <p>Gunakan tab <strong>Cari Judul</strong> untuk mencari judul yang sudah ada di koleksi — eksemplar baru otomatis menyatu dengan katalog yang sama.</p>
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
                                            Mencari di katalog perpustakaan...
                                        </div>
                                    )}

                                    {!searchLoading && searchPerformed && searchResults.length === 0 && (
                                        <div className="text-xs rounded-md p-3 border border-amber-200 bg-amber-50 text-amber-800">
                                            <p className="font-medium mb-1">Tidak ada judul &quot;{searchQuery}&quot; di koleksi</p>
                                            <p>Isi data buku di bawah untuk menambahkan <strong>judul baru</strong>. Jika ISBN-nya sudah dipakai judul lain, keduanya tetap tersimpan sebagai katalog terpisah.</p>
                                        </div>
                                    )}

                                    {searchResults.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs text-muted-foreground">
                                                Menampilkan halaman {searchPage} — {searchResults.length} judul
                                                {searchTotal > 0 ? ` dari ${searchTotal}` : ""} di koleksi. Pilih salah satu untuk menambah eksemplar:
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

                                    {/* Buku baru: ISBN manual + tombol buat judul baru */}
                                    <div className="rounded-lg border border-dashed border-primary/40 bg-muted/40 p-3 space-y-2">
                                        <p className="text-xs font-semibold text-foreground">Menambah judul baru?</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            Isi ISBN (opsional) lalu tekan tombol. Jika ISBN sudah dipakai judul lain, Anda bisa memilih
                                            tambah eksemplar atau tetap membuat judul baru.
                                        </p>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <div className="relative flex-1">
                                                <QrCode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    className="pl-8"
                                                    placeholder="ISBN (opsional)..."
                                                    value={isbn}
                                                    onChange={(e) => setIsbn(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); startTitleFromSearch(); } }}
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                className="w-full sm:w-auto shrink-0"
                                                onClick={startTitleFromSearch}
                                                disabled={loading}
                                            >
                                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                                                Judul Baru
                                            </Button>
                                        </div>
                                        {catalog.isbn && !catalog.title?.trim() && (
                                            <p className="text-[10px] text-amber-700 dark:text-amber-400">
                                                ISBN aktif: <span className="font-mono">{catalog.isbn}</span> — isi Judul di bawah.
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="space-y-3 pt-4 border-t">
                            {lookupStatus === 'not_found' && (
                                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 rounded-md flex items-start gap-2 mb-2">
                                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                                    <div className="text-xs text-amber-800 dark:text-amber-300">
                                        <p className="font-semibold">ISBN ini belum ada di koleksi perpustakaan</p>
                                        <p>Silakan isi <strong>Judul</strong> dan <strong>Penulis</strong> manual di bawah, atau gunakan tab <strong>Cari Judul</strong> bila bukunya sudah pernah didaftarkan.</p>
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
                                    onCoverChange={(url) => {
                                        // Unggahan berlaku untuk judul yang sedang dipilih.
                                        setUploadedCover({ url, catalogId: selectedCatalogId });
                                        setCatalog((prev) => ({ ...prev, coverUrl: url }));
                                    }}
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
                                        {catalog.localFound && isbnCandidates.length === 0 && (
                                            <p className="text-[10px] text-success font-medium">
                                                Sudah ada {catalog.totalExemplars} eksemplar di koleksi. Ini akan menjadi eksemplar ke-{Number(catalog.totalExemplars) + 1}.
                                            </p>
                                        )}
                                        {isbnCandidates.length >= 1 && (
                                            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                                                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                                    {isbnCandidates.length > 1
                                                        ? `ISBN ini dipakai ${isbnCandidates.length} judul berbeda. Eksemplar ini masuk ke:`
                                                        : "ISBN ini sudah terdaftar. Pilih tujuan eksemplar:"}
                                                </p>
                                                <div className="space-y-1.5">
                                                    {isbnCandidates.map((c: any) => (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            onClick={() => pickCatalog(c)}
                                                            className={`w-full text-left rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                                                                selectedCatalogId === c.id
                                                                    ? "border-green-500 bg-green-50 dark:bg-green-950/30 font-semibold"
                                                                    : "border-amber-200 dark:border-amber-800 bg-white dark:bg-transparent hover:bg-amber-100/60"
                                                            }`}
                                                        >
                                                            {c.cover && (
                                                                <img
                                                                    src={c.cover}
                                                                    alt=""
                                                                    className="w-5 h-7 rounded object-cover border border-border inline-block align-middle mr-1.5"
                                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                                />
                                                            )}
                                                            {c.title}
                                                            <span className="ml-1.5 text-[10px] text-muted-foreground">
                                                                ({c.totalExemplars} eksemplar{c.author ? ` · ${c.author}` : ""})
                                                            </span>
                                                        </button>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={useNewTitle}
                                                        className={`w-full text-left rounded-md border border-dashed px-2.5 py-1.5 text-xs ${
                                                            selectedCatalogId === ""
                                                                ? "border-green-500 bg-green-50 dark:bg-green-950/30 font-semibold"
                                                                : "border-amber-300 text-amber-700 dark:text-amber-400 hover:bg-amber-100/60"
                                                        }`}
                                                    >
                                                        + Judul lain (buat katalog baru dengan ISBN ini)
                                                    </button>
                                                </div>
                                                {selectedCatalogId === "" && (
                                                    <p className="text-[10px] text-amber-700 dark:text-amber-400">
                                                        Isi <strong>Judul</strong> buku baru di bawah — akan tersimpan sebagai katalog terpisah dengan ISBN ini.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div className="grid gap-3">
                                            <Label htmlFor="isbn">ISBN <span className="text-xs text-muted-foreground">(opsional)</span></Label>
                                            <Input
                                                id="isbn"
                                                className="font-mono"
                                                placeholder="mis. 9786022916628"
                                                value={catalog.isbn}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    setCatalog(prev => ({ ...prev, isbn: v }));
                                                    setIsbn(v);
                                                }}
                                            />
                                        </div>
                                        <div className="grid gap-3">
                                            <Label htmlFor="author">Penulis <span className="text-xs text-muted-foreground">(opsional)</span></Label>
                                            <Input
                                                id="author"
                                                value={catalog.author}
                                                onChange={(e) => setCatalog({...catalog, author: e.target.value})}
                                            />
                                        </div>
                                        <div className="grid gap-3 sm:col-span-2">
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
                                        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-secondary/10 p-4 backdrop-blur-sm shadow-sm space-y-3">
                                            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-accent to-secondary opacity-60" />
                                            
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
                                                            <span className="text-[10px] text-muted-foreground font-medium uppercase">Rak Otomatis</span>
                                                            <p className="font-semibold text-foreground">{getAllShelves().find(s => s.value === location)?.label || location}</p>
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

                        <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 mt-6">
                            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setStep(1)}>Kembali</Button>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                {!catalog.title?.trim() && (
                                    <span className="text-xs text-amber-600 font-medium text-center sm:text-right">Judul wajib diisi</span>
                                )}
                                <Button className="w-full sm:w-auto" onClick={() => setStep(3)} disabled={!catalog.title?.trim()}>Lanjut</Button>
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
                                <span>Rak: {getAllShelves().find((sh) => sh.value === location)?.label || location}</span>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4">
                            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setStep(2)}>Edit Data</Button>
                            <Button className="gap-2 w-full sm:w-auto" onClick={handleSave} disabled={loading}>
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

