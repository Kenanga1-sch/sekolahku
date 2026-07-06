"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Upload, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PDFViewer } from "@/components/arsip/pdf-viewer";
import { toast } from "sonner";
import { goPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export default function CreateSuratMasukPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    
    const [formData, setFormData] = useState({
        originalNumber: "",
        sender: "",
        subject: "",
        dateOfLetter: new Date().toISOString().split("T")[0],
        receivedAt: new Date().toISOString().split("T")[0],
        notes: "",
        classificationCode: ""
    });

    const processUploadedFile = async (selectedFile: File) => {
        const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
        if (!allowedTypes.includes(selectedFile.type)) {
            toast.error("Hanya file PDF atau Gambar (JPG, PNG) yang diperbolehkan");
            return;
        }
        setFile(selectedFile);
        setPreviewUrl(URL.createObjectURL(selectedFile));

        // Memicu analisis AI secara otomatis
        setAnalyzing(true);
        const uploadToast = toast.loading("Gemini AI sedang membaca dan mengekstrak dokumen...");

        try {
            const data = new FormData();
            data.append("file", selectedFile);

            const res: any = await goPost("/api/arsip/surat-masuk/analyze-ai", data);
            toast.dismiss(uploadToast);

            if (res.error) {
                throw new Error(res.error);
            }

            if (res.ai_enabled === false) {
                toast.info("AI tidak aktif (API Key belum diatur). Silakan isi data secara manual.");
            } else if (res.data) {
                const ext = res.data;
                setFormData(prev => ({
                    ...prev,
                    originalNumber: ext.originalNumber || prev.originalNumber,
                    sender: ext.sender || prev.sender,
                    subject: ext.subject || prev.subject,
                    dateOfLetter: ext.dateOfLetter || prev.dateOfLetter,
                    classificationCode: ext.classificationCode || prev.classificationCode,
                    notes: ext.notes || prev.notes,
                }));
                toast.success("AI berhasil mengekstrak data surat!");
            }
        } catch (err: any) {
            toast.dismiss(uploadToast);
            console.error("AI Analysis failed:", err);
            toast.error("Gagal melakukan analisis AI. Silakan isi formulir secara manual.");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            await processUploadedFile(selectedFile);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            await processUploadedFile(droppedFile);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!file) {
            toast.error("Mohon upload file surat (PDF)");
            return;
        }

        setLoading(true);
        
        try {
            const data = new FormData();
            data.append("file", file);
            data.append("originalNumber", formData.originalNumber);
            data.append("sender", formData.sender);
            data.append("subject", formData.subject);
            data.append("dateOfLetter", formData.dateOfLetter);
            data.append("receivedAt", formData.receivedAt);
            if (formData.notes) data.append("notes", formData.notes);
            if (formData.classificationCode) data.append("classificationCode", formData.classificationCode);

            const res: any = await goPost("/api/arsip/surat-masuk", data);

            if (res.error) throw new Error(res.error || "Gagal menyimpan surat");

            toast.success("Surat masuk berhasil dicatat");
            router.push("/arsip/surat-masuk");
        } catch (error) {
            console.error(error);
            toast.error("Terjadi kesalahan saat menyimpan");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col gap-4">
            <div className="space-y-2">
                <Link href="/arsip">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="p-0 h-auto text-muted-foreground hover:text-slate-900 dark:hover:text-white hover:bg-transparent -ml-1 flex items-center gap-1.5 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Kembali ke E-Arsip
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Catat Surat Masuk</h1>
                    <p className="text-muted-foreground text-sm">Input data surat dan upload hasil scan</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 h-full min-h-0">
                {/* Left: Form */}
                <Card className="overflow-y-auto h-full scrollbar-thin relative">
                    {analyzing && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-4 rounded-xl">
                            <div className="w-12 h-12 rounded-full border-4 border-slate-200 dark:border-zinc-800 border-t-indigo-600 animate-spin" />
                            <div className="text-center space-y-1">
                                <h4 className="font-bold text-slate-800 dark:text-slate-200">Gemini AI sedang bekerja</h4>
                                <p className="text-xs text-muted-foreground max-w-xs px-6">
                                    Membaca isi berkas PDF dan mengekstrak metadata surat (nomor, tanggal, pengirim, dll.) secara otomatis...
                                </p>
                            </div>
                        </div>
                    )}
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            Data Surat
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">File Scan Surat (PDF / Gambar) *</Label>
                                <div 
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={cn(
                                        "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer relative min-h-[160px]",
                                        isDragOver 
                                            ? "border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 scale-[1.01] shadow-md shadow-indigo-100 dark:shadow-none" 
                                            : "border-slate-300 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900"
                                    )}
                                >
                                    <Input 
                                        type="file" 
                                        className="absolute inset-0 opacity-0 cursor-pointer" 
                                        accept="application/pdf,image/jpeg,image/png,image/jpg"
                                        onChange={handleFileChange}
                                        required={!file}
                                    />
                                    <Upload className={cn("h-10 w-10 mb-3 transition-colors", isDragOver ? "text-indigo-600 animate-bounce" : "text-muted-foreground")} />
                                    {isDragOver ? (
                                        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Lepaskan berkas untuk mengunggah...</p>
                                    ) : (
                                        <>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                {file ? file.name : "Klik atau seret berkas ke sini"}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">PDF atau Gambar (Maksimal 10MB)</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nomor Surat (Asli) *</Label>
                                    <Input 
                                        placeholder="Nomor tertera di kop surat"
                                        value={formData.originalNumber}
                                        onChange={e => setFormData({...formData, originalNumber: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Kode Klasifikasi</Label>
                                    <Input 
                                        placeholder="Contoh: 421"
                                        value={formData.classificationCode}
                                        onChange={e => setFormData({...formData, classificationCode: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Pengirim *</Label>
                                <Input 
                                    placeholder="Instansi / Perorangan"
                                    value={formData.sender}
                                    onChange={e => setFormData({...formData, sender: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Perihal / Ringkasan Isi *</Label>
                                <Textarea 
                                    placeholder="Ringkasan isi surat..."
                                    className="resize-none"
                                    rows={3}
                                    value={formData.subject}
                                    onChange={e => setFormData({...formData, subject: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tanggal Surat *</Label>
                                    <Input 
                                        type="date"
                                        value={formData.dateOfLetter}
                                        onChange={e => setFormData({...formData, dateOfLetter: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tanggal Diterima *</Label>
                                    <Input 
                                        type="date"
                                        value={formData.receivedAt}
                                        onChange={e => setFormData({...formData, receivedAt: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Catatan Tambahan</Label>
                                <Textarea 
                                    placeholder="Keterangan kondisi fisik surat, dsb..."
                                    rows={2}
                                    value={formData.notes}
                                    onChange={e => setFormData({...formData, notes: e.target.value})}
                                />
                            </div>

                            <div className="pt-4">
                                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11" disabled={loading}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Simpan & Generate No. Agenda
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Right: Preview (PDF or Image) */}
                <div className="h-full min-h-[400px] border dark:border-zinc-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-2">
                    {previewUrl ? (
                        file?.type.startsWith("image/") ? (
                            <img src={previewUrl} alt="Preview scan surat" className="max-w-full max-h-full object-contain rounded-lg shadow-md border" />
                        ) : (
                            <PDFViewer url={previewUrl} className="w-full h-full shadow-md rounded-lg" />
                        )
                    ) : (
                        <div className="text-muted-foreground text-sm text-center p-8 space-y-2">
                            <Upload className="h-10 w-10 text-slate-300 dark:text-zinc-700 mx-auto" />
                            <p className="font-medium">Belum ada dokumen yang diunggah</p>
                            <p className="text-xs text-slate-400">Pilih berkas PDF atau foto scan surat masuk untuk melihat pratinjau</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

