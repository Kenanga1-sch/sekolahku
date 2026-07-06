"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    ArrowLeft,
    Loader2,
    FileText,
    Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { goGet, goPut } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

const DOCUMENT_TYPES = [
    { value: "transkrip", label: "Transkrip Nilai" },
    { value: "daftar_1", label: "Daftar 1 (Buku Induk)" },
    { value: "laporan_kegiatan", label: "Laporan Kegiatan" },
    { value: "laporan_keuangan", label: "Laporan Keuangan" },
    { value: "lainnya", label: "Laporan Lainnya" },
];

interface SchoolDocument {
    id: string;
    documentType: string;
    title: string;
    recipient: string;
    referenceId?: string | null;
    filePath: string;
    createdBy?: string | null;
    createdAt: number;
    updatedAt?: number;
}

export default function EditDocumentPage() {
    const router = useRouter();
    const params = useParams();
    const docId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [doc, setDoc] = useState<SchoolDocument | null>(null);

    const [editTitle, setEditTitle] = useState("");
    const [editType, setEditType] = useState("");
    const [editRecipient, setEditRecipient] = useState("");

    useEffect(() => {
        const loadDoc = async () => {
            setLoading(true);
            try {
                const res = await goGet(`/api/arsip/dokumen/${docId}`);
                if (res.success && res.data) {
                    setDoc(res.data);
                    setEditTitle(res.data.title || "");
                    setEditType(res.data.documentType || "");
                    setEditRecipient(res.data.recipient || "");
                } else {
                    toast.error("Dokumen tidak ditemukan");
                    router.push("/arsip/dokumen");
                }
            } catch (err) {
                console.error(err);
                toast.error("Gagal memuat data dokumen");
                router.push("/arsip/dokumen");
            } finally {
                setLoading(false);
            }
        };
        if (docId) loadDoc();
    }, [docId, router]);

    const handleSave = async () => {
        if (!editTitle.trim()) {
            toast.error("Judul dokumen tidak boleh kosong");
            return;
        }
        if (!editRecipient.trim()) {
            toast.error("Penerima tidak boleh kosong");
            return;
        }
        setSubmitting(true);
        try {
            const res = await goPut(`/api/arsip/dokumen/${docId}`, {
                title: editTitle,
                documentType: editType,
                recipient: editRecipient,
            });
            if (res.success) {
                toast.success("Metadata dokumen berhasil diperbarui!");
                router.push("/arsip/dokumen");
            } else {
                throw new Error(res.error || "Gagal memperbarui");
            }
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Gagal memperbarui dokumen");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-3 animate-in fade-in duration-300">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                <p className="text-xs text-muted-foreground font-semibold">Memuat data dokumen...</p>
            </div>
        );
    }

    if (!doc) return null;

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center gap-3 border-b pb-5 border-slate-100 dark:border-zinc-800">
                <Button variant="ghost" size="icon" onClick={() => router.push("/arsip/dokumen")} className="rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-3">
                        <FileText className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                        Edit Metadata Dokumen
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1 font-medium">
                        Perbarui judul, tipe, atau penerima dokumen yang sudah diarsipkan
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Edit Form */}
                <div className="lg:col-span-2">
                    <Card className="border-slate-100 dark:border-zinc-800 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Metadata Dokumen</CardTitle>
                            <CardDescription>Edit informasi dasar dokumen (file fisik tidak berubah)</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Judul Dokumen</Label>
                                <Input
                                    placeholder="Judul dokumen..."
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tipe Dokumen</Label>
                                    <select
                                        value={editType}
                                        onChange={(e) => setEditType(e.target.value)}
                                        className="w-full h-10 px-3 py-2 border rounded-xl bg-background border-input text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        {DOCUMENT_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Penerima / Sasaran</Label>
                                    <Input
                                        placeholder="Nama penerima..."
                                        value={editRecipient}
                                        onChange={(e) => setEditRecipient(e.target.value)}
                                        className="rounded-xl"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Info Sidebar */}
                <div>
                    <Card className="border-slate-100 dark:border-zinc-800 shadow-sm sticky top-6">
                        <CardHeader>
                            <CardTitle className="text-lg">Info Dokumen</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-xs space-y-2 border-b pb-4">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">ID:</span>
                                    <span className="font-mono text-slate-700 dark:text-zinc-300 text-[10px]">{doc.id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tanggal Dibuat:</span>
                                    <span className="font-bold text-slate-800 dark:text-zinc-200">{formatDate(new Date(doc.createdAt).toISOString())}</span>
                                </div>
                                {doc.updatedAt && doc.updatedAt !== doc.createdAt && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Terakhir Diubah:</span>
                                        <span className="font-bold text-slate-800 dark:text-zinc-200">{formatDate(new Date(doc.updatedAt).toISOString())}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">File:</span>
                                    <span className="font-medium text-slate-700 dark:text-zinc-300 truncate max-w-[180px]" title={doc.filePath}>
                                        {doc.filePath.split('/').pop() || doc.filePath.split('\\').pop()}
                                    </span>
                                </div>
                            </div>

                            <Button
                                className="w-full gap-2 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-semibold shadow-sm border-0 transition-all rounded-xl"
                                onClick={handleSave}
                                disabled={submitting}
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Simpan Perubahan
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full rounded-xl"
                                onClick={() => router.push("/arsip/dokumen")}
                                disabled={submitting}
                            >
                                Batal
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
