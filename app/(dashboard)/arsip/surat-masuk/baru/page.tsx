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

export default function CreateSuratMasukPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type !== "application/pdf") {
                toast.error("Hanya file PDF yang diperbolehkan");
                return;
            }
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
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

            const res = await fetch("/api/arsip/surat-masuk", {
                method: "POST",
                body: data,
            });

            if (!res.ok) throw new Error("Gagal menyimpan surat");

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
            <div className="flex items-center gap-4">
                <Link href="/arsip/surat-masuk">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Catat Surat Masuk</h1>
                    <p className="text-muted-foreground text-sm">Input data surat dan upload hasil scan</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 h-full min-h-0">
                {/* Left: Form */}
                <Card className="overflow-y-auto h-full scrollbar-thin">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            Data Surat
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>File Scan Surat (PDF) *</Label>
                                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition cursor-pointer relative">
                                    <Input 
                                        type="file" 
                                        className="absolute inset-0 opacity-0 cursor-pointer" 
                                        accept="application/pdf"
                                        onChange={handleFileChange}
                                        required
                                    />
                                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                    <p className="text-sm font-medium">{file ? file.name : "Klik untuk upload PDF"}</p>
                                    <p className="text-xs text-muted-foreground">Maksimal 10MB</p>
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

                {/* Right: PDF Preview */}
                <div className="h-full min-h-[400px]">
                    <PDFViewer url={previewUrl} className="h-full shadow-md" />
                </div>
            </div>
        </div>
    );
}
