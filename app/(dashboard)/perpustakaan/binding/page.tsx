"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QRScanner } from "@/components/ui/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Book, QrCode, Search, Check, Loader2, ArrowLeft, ArrowRight, Save, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CatalogData {
    title: string;
    author: string;
    publisher?: string;
    year?: number;
    isbn?: string;
    coverUrl?: string;
}

export default function LibraryBindingPage() {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [qrCode, setQrCode] = useState("");
    const [isbn, setIsbn] = useState("");
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState("RAK-A1");
    const [catalog, setCatalog] = useState<CatalogData>({
        title: "",
        author: "",
        publisher: "",
        year: new Date().getFullYear(),
        isbn: "",
    });

    // Step 1: Scan QR Identity
    const handleQRScan = (code: string) => {
        setQrCode(code);
        toast.success(`QR Code Terdeteksi: ${code}`);
        setStep(2);
    };

    // Step 2: ISBN Lookup
    const handleISBNLookup = async () => {
        if (!isbn) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/library/isbn/${isbn}`);
            if (res.ok) {
                const data = await res.json();
                setCatalog({
                    title: data.title || "",
                    author: data.author || "",
                    publisher: data.publisher || "",
                    year: data.year || new Date().getFullYear(),
                    isbn: isbn,
                    coverUrl: data.coverUrl
                });
                toast.success("Data buku ditemukan!");
            } else {
                toast.error("Buku tidak ditemukan di database online.");
                setCatalog(prev => ({ ...prev, isbn }));
            }
        } catch (error) {
            toast.error("Gagal menghubungi server catalog.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/library/assets/bind", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    qrCode,
                    location,
                    catalog
                })
            });

            const result = await res.json();
            if (result.success) {
                toast.success("Buku berhasil didaftarkan!");
                // Reset for next book
                setQrCode("");
                setIsbn("");
                setCatalog({ title: "", author: "", publisher: "", year: new Date().getFullYear(), isbn: "" });
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
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
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
                        <QRScanner onScan={handleQRScan} className="max-w-[300px] mx-auto" />
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
                        <div className="space-y-2">
                            <Label>Scan/Input ISBN</Label>
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
                            <div className="grid gap-2">
                                <Label htmlFor="title">Judul Buku</Label>
                                <Input
                                    id="title"
                                    value={catalog.title}
                                    onChange={(e) => setCatalog({...catalog, title: e.target.value})}
                                    placeholder="Contoh: Laskar Pelangi"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="author">Penulis</Label>
                                    <Input
                                        id="author"
                                        value={catalog.author}
                                        onChange={(e) => setCatalog({...catalog, author: e.target.value})}
                                        placeholder="Andrea Hirata"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="publisher">Penerbit</Label>
                                    <Input
                                        id="publisher"
                                        value={catalog.publisher}
                                        onChange={(e) => setCatalog({...catalog, publisher: e.target.value})}
                                        placeholder="Bentang Pustaka"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between mt-6">
                            <Button variant="outline" onClick={() => setStep(1)}>Kembali</Button>
                            <Button onClick={() => setStep(3)} disabled={!catalog.title || !catalog.author}>Lanjut</Button>
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
                            <div className="text-xs text-muted-foreground flex gap-4">
                                <span>ISBN: {catalog.isbn || '-'}</span>
                                <span>Penerbit: {catalog.publisher || '-'}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Lokasi Rak</Label>
                            <Select value={location} onValueChange={setLocation}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Rak" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="RAK-A1">Rak A1 (Fiksi)</SelectItem>
                                    <SelectItem value="RAK-A2">Rak A2 (Non-Fiksi)</SelectItem>
                                    <SelectItem value="RAK-B1">Rak B1 (Sains)</SelectItem>
                                    <SelectItem value="RAK-C1">Rak C1 (Referensi)</SelectItem>
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
