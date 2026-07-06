"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
    Plus, 
    Search, 
    Filter, 
    Calendar,
    Send,
    MoreHorizontal,
    FileText,
    CheckCircle,
    XCircle,
    Loader2,
    ArrowLeft,
    Download,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input as InputField } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import JSZip from "jszip";
import { formatDate, normalizePublicPath, extractFilename } from "@/lib/utils";
import { goGet, goPost } from "@/lib/api-client";
import { toast } from "sonner";

interface SuratKeluar {
    id: string;
    mailNumber: string;
    recipient: string;
    subject: string;
    dateOfLetter: string;
    status: string;
    classification: { name: string; code: string } | null;
    filePath?: string | null;
    finalFilePath?: string | null;
}

const STATUSES = ["", "Draft", "Menunggu Verifikasi", "Terverifikasi", "Revisi"];

export default function SuratKeluarPage() {
    const router = useRouter();
    const [data, setData] = useState<SuratKeluar[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [downloadingBatch, setDownloadingBatch] = useState(false);

    // Search input debounce logic
    useEffect(() => {
        const handler = setTimeout(() => {
            setSearch(searchQuery);
            setPage(1);
        }, 400);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                search,
                perPage: "20"
            });
            if (statusFilter) params.set("status", statusFilter);
            const result: any = await goGet(`/api/arsip/surat-keluar?${params}`);
            const items = result.items || result.data?.items || result.data || [];
            setData(Array.isArray(items) ? items : []);
            setTotalPages(result.totalPages || result.data?.totalPages || 1);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [page, search, statusFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const [verifyDialog, setVerifyDialog] = useState<{ open: boolean; id: string }>({ open: false, id: "" });
    const [revisionDialog, setRevisionDialog] = useState<{ open: boolean; id: string }>({ open: false, id: "" });
    const [signatureData, setSignatureData] = useState("");
    const [revisionNote, setRevisionNote] = useState("");
    const [acting, setActing] = useState(false);

    const handleVerify = async () => {
        if (!signatureData) { toast.error("Upload tanda tangan elektronik"); return; }
        setActing(true);
        try {
            await goPost(`/api/arsip/surat-keluar/verify?id=${verifyDialog.id}`, { digitalSignature: signatureData });
            toast.success("Surat berhasil diverifikasi!");
            setVerifyDialog({ open: false, id: "" });
            setSignatureData("");
            loadData();
        } catch { toast.error("Gagal verifikasi"); }
        finally { setActing(false); }
    };

    const handleRevision = async () => {
        if (!revisionNote) { toast.error("Isi catatan revisi"); return; }
        setActing(true);
        try {
            await goPost(`/api/arsip/surat-keluar/revision?id=${revisionDialog.id}`, { revisionNote });
            toast.success("Catatan revisi dikirim!");
            setRevisionDialog({ open: false, id: "" });
            setRevisionNote("");
            loadData();
        } catch { toast.error("Gagal mengirim revisi"); }
        finally { setActing(false); }
    };

    const handleSubmitToVerification = async (id: string) => {
        setActing(true);
        try {
            await goPost(`/api/arsip/surat-keluar/verify?id=${id}`, {});
            toast.success("Surat dikirim ke verifikasi!");
            loadData();
        } catch { toast.error("Gagal"); }
        finally { setActing(false); }
    };

    const toggleSelectAll = () => {
        const checkable = data.filter(item => item.filePath || item.finalFilePath);
        if (selectedIds.length === checkable.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(checkable.map(item => item.id));
        }
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleDownloadSingle = async (item: SuratKeluar) => {
        const filePath = item.finalFilePath || item.filePath;
        if (!filePath) {
            toast.error("File tidak tersedia");
            return;
        }
        const normalizedPath = normalizePublicPath(filePath);
        const filename = extractFilename(filePath) || "surat.pdf";
        
        let cleanName = filename;
        const hyphenIndex = cleanName.indexOf("-");
        if (hyphenIndex !== -1 && !isNaN(Number(cleanName.substring(0, hyphenIndex)))) {
            cleanName = cleanName.substring(hyphenIndex + 1);
        }
        
        const prefix = item.mailNumber;
        const uniqueName = prefix ? `${prefix.replace(/[\/\\]/g, "_")}_${cleanName}` : cleanName;

        const toastId = toast.loading("Mengunduh berkas...");
        try {
            const response = await fetch(normalizedPath);
            if (!response.ok) throw new Error("Gagal mengambil file");
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = uniqueName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            toast.success("Unduhan berhasil!");
        } catch (error) {
            console.error(error);
            toast.error("Gagal mendownload file");
        } finally {
            toast.dismiss(toastId);
        }
    };

    const handleDownloadBatch = async () => {
        if (selectedIds.length === 0) return;
        setDownloadingBatch(true);
        const toastId = toast.loading("Mengunduh berkas terpilih...");
        
        try {
            const zip = new JSZip();
            let addedCount = 0;

            await Promise.all(selectedIds.map(async (id) => {
                const item = data.find(d => d.id === id);
                if (!item) return;

                const filePath = item.finalFilePath || item.filePath;
                if (!filePath) return;

                try {
                    const normalizedPath = normalizePublicPath(filePath);
                    const response = await fetch(normalizedPath);
                    if (!response.ok) throw new Error("Gagal mengambil file");
                    const blob = await response.blob();
                    
                    const originalName = extractFilename(filePath) || "dokumen";
                    let cleanName = originalName;
                    const hyphenIndex = cleanName.indexOf("-");
                    if (hyphenIndex !== -1 && !isNaN(Number(cleanName.substring(0, hyphenIndex)))) {
                        cleanName = cleanName.substring(hyphenIndex + 1);
                    }

                    const prefix = item.mailNumber;
                    const uniqueName = prefix ? `${prefix.replace(/[\/\\]/g, "_")}_${cleanName}` : cleanName;

                    zip.file(uniqueName, blob);
                    addedCount++;
                } catch (err) {
                    console.error(`Gagal mendownload ${filePath}:`, err);
                }
            }));

            if (addedCount === 0) {
                toast.error("Tidak ada file yang berhasil diunduh.");
                toast.dismiss(toastId);
                return;
            }

            const content = await zip.generateAsync({ type: "blob" });
            const blobUrl = window.URL.createObjectURL(content);
            const link = document.createElement("a");
            link.href = blobUrl;
            
            const dateStr = new Date().toISOString().slice(0, 10);
            link.download = `Batch_Surat_Keluar_${dateStr}.zip`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);

            toast.success(`Berhasil mengunduh ${addedCount} berkas dalam file ZIP!`);
        } catch (error) {
            console.error("Batch download failed:", error);
            toast.error("Terjadi kesalahan saat memproses unduhan batch.");
        } finally {
            setDownloadingBatch(false);
            toast.dismiss(toastId);
            setSelectedIds([]);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Draft": return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
            case "Menunggu Verifikasi": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
            case "Terverifikasi": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
            case "Revisi": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
            default: return "bg-slate-100";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
                        <h1 className="text-2xl font-bold tracking-tight">Surat Keluar</h1>
                        <p className="text-muted-foreground text-sm">
                            Daftar surat yang diterbitkan (Out-Going Mail)
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/admin/surat/template">
                        <Button variant="outline" size="sm" className="gap-2">
                            <FileText className="h-4 w-4" />
                            Kelola Template
                        </Button>
                    </Link>
                    <Link href="/admin/surat/buat">
                        <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                            <Plus className="h-4 w-4" />
                            Buat Surat (Otomatis)
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Status Filter Tabs */}
            <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <TabsList>
                    <TabsTrigger value="">Semua</TabsTrigger>
                    <TabsTrigger value="Draft">Draft</TabsTrigger>
                    <TabsTrigger value="Menunggu Verifikasi">Menunggu Verifikasi</TabsTrigger>
                    <TabsTrigger value="Terverifikasi">Terverifikasi</TabsTrigger>
                    <TabsTrigger value="Revisi">Revisi</TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-xl border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Cari Nomor Surat, Tujuan, atau Perihal..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Data Table */}
            <Card className="overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[40px]">
                                <Checkbox 
                                    checked={data.length > 0 && selectedIds.length === data.filter(item => item.filePath || item.finalFilePath).length}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead>Nomor Surat</TableHead>
                            <TableHead>Tujuan</TableHead>
                            <TableHead className="w-[40%]">Perihal</TableHead>
                            <TableHead>Tgl Surat</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8">
                                    Memuat data...
                                </TableCell>
                            </TableRow>
                        ) : data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    Belum ada surat keluar.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((item) => (
                                <TableRow key={item.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => router.push(`/arsip/surat-keluar/detail?id=${item.id}`)}>
                                    <TableCell onClick={(e) => e.stopPropagation()} className="w-[40px]">
                                        {(item.filePath || item.finalFilePath) ? (
                                            <Checkbox 
                                                checked={selectedIds.includes(item.id)}
                                                onCheckedChange={() => toggleSelectOne(item.id)}
                                            />
                                        ) : null}
                                    </TableCell>
                                    <TableCell className="font-mono text-sm font-medium text-blue-600">
                                        {item.mailNumber}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-semibold">{item.recipient}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="line-clamp-2 text-sm">{item.subject}</div>
                                        {item.classification && (
                                            <Badge variant="outline" className="mt-1 text-[10px] h-5">
                                                {item.classification.code} - {item.classification.name}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {formatDate(item.dateOfLetter)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={getStatusColor(item.status)}>
                                            {item.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="icon-sm" className="h-8 w-8 text-muted-foreground hover:text-foreground bg-white border-slate-200 shadow-sm" onClick={(e) => e.stopPropagation()}>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {item.status === "Draft" && (
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleSubmitToVerification(item.id); }} disabled={acting}>
                                                        <Send className="h-4 w-4 mr-2" />
                                                        Kirim ke Verifikasi
                                                    </DropdownMenuItem>
                                                )}
                                                {item.status === "Menunggu Verifikasi" && (
                                                    <>
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setVerifyDialog({ open: true, id: item.id }); }}>
                                                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                                            Verifikasi & TTD
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRevisionDialog({ open: true, id: item.id }); }}>
                                                            <XCircle className="h-4 w-4 mr-2 text-red-600" />
                                                            Minta Revisi
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/arsip/surat-keluar/detail?id=${item.id}`}>
                                                        <FileText className="h-4 w-4 mr-2" />
                                                        Detail
                                                    </Link>
                                                </DropdownMenuItem>
                                                {(item.finalFilePath || item.filePath) && (
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownloadSingle(item); }}>
                                                        <Download className="h-4 w-4 mr-2" />
                                                        Download File
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t bg-card text-slate-900 dark:text-slate-100">
                        <div className="text-xs text-muted-foreground font-medium">
                            Halaman <span className="text-slate-900 dark:text-slate-100 font-bold">{page}</span> dari <span className="text-slate-900 dark:text-slate-100 font-bold">{totalPages}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                                disabled={page === 1}
                                className="h-8 text-xs font-semibold px-3 flex items-center gap-1 border-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-950"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                                Sebelumnya
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={page === totalPages}
                                className="h-8 text-xs font-semibold px-3 flex items-center gap-1 border-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-950"
                            >
                                Berikutnya
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Verify Dialog */}
            <Dialog open={verifyDialog.open} onOpenChange={(o) => { if (!o) setVerifyDialog({ open: false, id: "" }); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Verifikasi & Tanda Tangan Elektronik</DialogTitle>
                        <DialogDescription>Upload gambar tanda tangan untuk memverifikasi surat ini.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Tanda Tangan Elektronik</Label>
                            <InputField
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = () => setSignatureData(reader.result as string);
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                        </div>
                        {signatureData && (
                            <div className="border rounded-lg p-4 flex justify-center bg-white">
                                <img src={signatureData} alt="TTD" className="max-h-32 object-contain" />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setVerifyDialog({ open: false, id: "" }); setSignatureData(""); }}>Batal</Button>
                        <Button onClick={handleVerify} disabled={acting || !signatureData} className="bg-green-600 hover:bg-green-700">
                            {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                            Verifikasi & TTD
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Revision Dialog */}
            <Dialog open={revisionDialog.open} onOpenChange={(o) => { if (!o) setRevisionDialog({ open: false, id: "" }); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Minta Revisi Surat</DialogTitle>
                        <DialogDescription>Berikan catatan revisi kepada pembuat surat.</DialogDescription>
                    </DialogHeader>
                    <div>
                        <Label>Catatan Revisi</Label>
                        <Textarea
                            value={revisionNote}
                            onChange={(e) => setRevisionNote(e.target.value)}
                            placeholder="Jelaskan apa yang perlu diperbaiki..."
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRevisionDialog({ open: false, id: "" }); setRevisionNote(""); }}>Batal</Button>
                        <Button onClick={handleRevision} disabled={acting || !revisionNote} variant="destructive">
                            {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                            Kirim Revisi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Floating Batch Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-300">
                    <span className="text-sm font-medium">
                        {selectedIds.length} surat terpilih
                    </span>
                    <div className="h-4 w-[1px] bg-slate-700" />
                    <div className="flex gap-2">
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-slate-300 hover:text-white hover:bg-slate-800"
                            onClick={() => setSelectedIds([])}
                        >
                            Batal
                        </Button>
                        <Button 
                            size="sm" 
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                            onClick={handleDownloadBatch}
                            disabled={downloadingBatch}
                        >
                            {downloadingBatch ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4" />
                            )}
                            Download (ZIP)
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

