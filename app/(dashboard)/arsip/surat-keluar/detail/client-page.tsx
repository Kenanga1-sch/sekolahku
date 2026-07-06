"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PDFViewer } from "@/components/arsip/pdf-viewer";
import { toast } from "sonner";
import { formatDate, normalizePublicPath } from "@/lib/utils";
import { goGet, goPatch } from "@/lib/api-client";

interface SuratKeluarDetail {
    id: string;
    mailNumber: string;
    recipient: string;
    subject: string;
    dateOfLetter: string;
    status: string;
    classification: { name: string; code: string } | null;
    filePath: string | null;
    finalFilePath: string | null;
    creator: { name?: string; fullName?: string } | null;
    agendaNumber?: string;
    verifiedBy?: string;
    verifiedAt?: string;
    digitalSignature?: string;
    revisionNote?: string;
}

export default function SuratKeluarDetailPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [data, setData] = useState<SuratKeluarDetail | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Upload State
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const result: any = await goGet(`/api/arsip/surat-keluar/detail?id=${searchParams.get('id')}`);
            setData(result.data || result);
        } catch (error) {
            console.error(error);
            toast.error("Gagal memuat surat");
        } finally {
            setLoading(false);
        }
    }, [searchParams.get('id')]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleUpload = async () => {
        if (!uploadFile) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", uploadFile);
            
            const res: any = await goPatch(`/api/arsip/surat-keluar/detail?id=${searchParams.get('id')}`, formData);

            if (res.error) throw new Error(res.error || "Gagal upload");

            toast.success("File arsip berhasil diupload");
            setUploadFile(null);
            loadData();
        } catch (error) {
            console.error(error);
            toast.error("Gagal mengupload file");
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="p-8 text-center bg-muted animate-pulse rounded-xl h-96"></div>;
    if (!data) return <div className="p-8 text-center">Data tidak ditemukan</div>;

    const isDraft = data.status === "Draft";
    const hasFinalFile = !!data.finalFilePath;

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Draft": return "bg-gray-500";
            case "Terverifikasi": return "bg-green-600";
            default: return "bg-blue-600";
        }
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col gap-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-2">
                    <Link href="/arsip/surat-keluar">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="p-0 h-auto text-muted-foreground hover:text-slate-900 dark:hover:text-white hover:bg-transparent -ml-1 flex items-center gap-1.5 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Kembali ke Surat Keluar
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            {data.mailNumber}
                            <Badge className={getStatusColor(data.status)}>{data.status}</Badge>
                        </h1>
                        <p className="text-muted-foreground text-sm flex items-center gap-2">
                            <span>Penerima: {data.recipient}</span>
                            <span>•</span>
                            <span>{formatDate(data.dateOfLetter)}</span>
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 h-full min-h-0">
                {/* Left: Info & Upload */}
                <div className="flex flex-col gap-6 overflow-y-auto">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base text-muted-foreground uppercase tracking-wide">Informasi Surat</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-lg leading-tight">{data.subject}</h3>
                            </div>
                            <div className="grid grid-cols-1 gap-4 text-sm">
                                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border">
                                    <p className="text-muted-foreground text-xs mb-1">Tujuan Kepada</p>
                                    <p className="font-medium text-base">{data.recipient}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                     <div>
                                        <p className="text-muted-foreground">Klasifikasi</p>
                                        <p className="font-medium">
                                            {data.classification ? `${data.classification.code} - ${data.classification.name}` : "-"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Dibuat Oleh</p>
                                        <p className="font-medium">{data.creator?.fullName || data.creator?.name || "-"}</p>
                                    </div>
                                </div>
                                {data.status === "Terverifikasi" && (
                                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800 space-y-2">
                                        <p className="text-xs text-green-700 dark:text-green-400 font-semibold uppercase">Verifikasi</p>
                                        {data.agendaNumber && (
                                            <div>
                                                <p className="text-muted-foreground text-xs">Agenda Number</p>
                                                <p className="font-medium text-sm">{data.agendaNumber}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-muted-foreground text-xs">Diverifikasi Oleh</p>
                                            <p className="font-medium text-sm">{data.verifiedBy || "-"}</p>
                                        </div>
                                        {data.verifiedAt && (
                                            <div>
                                                <p className="text-muted-foreground text-xs">Tanggal Verifikasi</p>
                                                <p className="font-medium text-sm">{formatDate(data.verifiedAt)}</p>
                                            </div>
                                        )}
                                        {data.digitalSignature && (
                                            <div>
                                                <p className="text-muted-foreground text-xs">Tanda Tangan Elektronik</p>
                                                <img src={data.digitalSignature} alt="TTD" className="max-h-16 mt-1 object-contain border rounded bg-white" />
                                            </div>
                                        )}
                                    </div>
                                )}
                                {data.revisionNote && (
                                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                                        <p className="text-xs text-red-700 dark:text-red-400 font-semibold uppercase mb-1">Catatan Revisi</p>
                                        <p className="text-sm">{data.revisionNote}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Upload Section */}
                    <Card className={`border-l-4 ${hasFinalFile ? "border-l-green-500" : "border-l-orange-500"}`}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {hasFinalFile ? (
                                    <>
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        Arsip Tersimpan
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="h-5 w-5 text-orange-500" />
                                        Upload Arsip Final
                                    </>
                                )}
                            </CardTitle>
                            <CardDescription>
                                {hasFinalFile 
                                    ? "Surat ini sudah memiliki arsip digital final (bertanda tangan)." 
                                    : "Silakan upload hasil scan surat yang sudah ditandatangani dan distempel basah."
                                }
                            </CardDescription>
                        </CardHeader>
                        {!hasFinalFile && (
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>File Scan (PDF)</Label>
                                    <Input 
                                        type="file" 
                                        accept="application/pdf"
                                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                    />
                                </div>
                                <Button 
                                    onClick={handleUpload} 
                                    disabled={!uploadFile || uploading}
                                    className="w-full"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Mengupload...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="mr-2 h-4 w-4" />
                                            Upload & Arsipkan
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        )}
                        {hasFinalFile && (
                            <CardContent>
                                <Button 
                                    variant="outline" 
                                    className="w-full"
                                    onClick={() => document.getElementById("reupload-area")?.classList.toggle("hidden")}
                                >
                                    Update File Arsip (Re-upload)
                                </Button>
                                <div id="reupload-area" className="hidden mt-4 space-y-4 pt-4 border-t">
                                     <div className="space-y-2">
                                        <Label>File Scan Baru (PDF)</Label>
                                        <Input 
                                            type="file" 
                                            accept="application/pdf"
                                            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                        />
                                    </div>
                                    <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
                                        Simpan Perubahan
                                    </Button>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                </div>

                {/* Right: PDF Viewer */}
                <div className="h-full min-h-[500px] border-l pl-6 hidden lg:block">
                     <PDFViewer url={data.finalFilePath || data.filePath} className="h-full shadow-lg" />
                </div>
                {/* Mobile PDF Link */}
                 <div className="lg:hidden">
                    {(data.finalFilePath || data.filePath) ? (
                        <Button variant="outline" className="w-full" onClick={() => window.open(normalizePublicPath(data.finalFilePath || data.filePath), "_blank")}>
                            Lihat File PDF
                        </Button>
                    ) : (
                         <div className="p-8 text-center border-2 border-dashed rounded-xl text-muted-foreground">
                            Preview PDF belum tersedia
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


