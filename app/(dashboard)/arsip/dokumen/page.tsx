"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
    Plus, 
    Search, 
    Filter, 
    MoreHorizontal,
    FileText,
    Loader2,
    ArrowLeft,
    Download,
    ChevronLeft,
    ChevronRight,
    Trash,
    Pencil
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
import { toast } from "sonner";
import { goGet, goDelete } from "@/lib/api-client";
import { formatDate, normalizePublicPath, extractFilename } from "@/lib/utils";

interface SchoolDocument {
    id: string;
    documentType: string;
    title: string;
    recipient: string;
    referenceId?: string | null;
    filePath: string;
    createdBy?: string | null;
    createdByName?: string;
    createdAt: number;
    updatedAt?: number;
}

const DOCUMENT_TYPES = [
    { value: "", label: "Semua Tipe" },
    { value: "transkrip", label: "Transkrip Nilai" },
    { value: "daftar_1", label: "Daftar 1 (Buku Induk)" },
    { value: "laporan_kegiatan", label: "Laporan Kegiatan" },
    { value: "laporan_keuangan", label: "Laporan Keuangan" },
    { value: "lainnya", label: "Laporan Lainnya" },
];

export default function SchoolDocumentsPage() {
    const router = useRouter();
    const [data, setData] = useState<SchoolDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalDocs, setTotalDocs] = useState(0);
    const [acting, setActing] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; title: string }>({
        open: false,
        id: "",
        title: ""
    });

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
                limit: "20",
                search,
                documentType: typeFilter
            });
            const result: any = await goGet(`/api/arsip/dokumen?${params}`);
            if (result.success) {
                setData(result.data || []);
                const limit = result.limit || 20;
                setTotalPages(Math.ceil((result.total || 0) / limit) || 1);
                setTotalDocs(result.total || 0);
            }
        } catch (err) {
            console.error("Gagal memuat dokumen:", err);
            toast.error("Gagal memuat daftar dokumen");
        } finally {
            setLoading(false);
        }
    }, [page, search, typeFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleDelete = async () => {
        if (!deleteDialog.id) return;
        setActing(true);
        try {
            const res = await goDelete(`/api/arsip/dokumen/${deleteDialog.id}`);
            if (res.success) {
                toast.success("Dokumen berhasil dihapus dari arsip");
                setDeleteDialog({ open: false, id: "", title: "" });
                loadData();
            }
        } catch (err) {
            toast.error("Gagal menghapus dokumen");
        } finally {
            setActing(false);
        }
    };

    const handleDownloadSingle = async (filePath: string, title: string) => {
        if (!filePath) {
            toast.error("File tidak tersedia");
            return;
        }
        const normalizedPath = normalizePublicPath(filePath);
        const filename = extractFilename(filePath) || "dokumen.pdf";
        
        let cleanName = filename;
        const hyphenIndex = cleanName.indexOf("-");
        if (hyphenIndex !== -1 && !isNaN(Number(cleanName.substring(0, hyphenIndex)))) {
            cleanName = cleanName.substring(hyphenIndex + 1);
        }
        
        const finalName = title ? `${title.replace(/[\/\s\\:]/g, "_")}_${cleanName}` : cleanName;

        const toastId = toast.loading("Mengunduh berkas...");
        try {
            const response = await fetch(normalizedPath);
            if (!response.ok) throw new Error("Gagal mengambil file");
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = finalName;
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

    const getDocTypeLabel = (type: string) => {
        const found = DOCUMENT_TYPES.find(t => t.value === type);
        return found ? found.label : type;
    };

    const getDocTypeColor = (type: string) => {
        switch (type) {
            case "transkrip": return "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400";
            case "daftar_1": return "bg-teal-50 text-teal-700 border-teal-200/60 dark:bg-teal-950/40 dark:text-teal-400";
            case "laporan_kegiatan": return "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400";
            case "laporan_keuangan": return "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400";
            default: return "bg-slate-50 text-slate-700 border-slate-200/60 dark:bg-zinc-900/40 dark:text-zinc-400";
        }
    };

    const isViewableInBrowser = (filePath: string) => {
        const ext = filePath.split('.').pop()?.toLowerCase();
        return ext === 'pdf' || ext === 'png' || ext === 'jpg' || ext === 'jpeg';
    };

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Header Title Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-5 border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/arsip")} className="rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-3">
                            <FileText className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                            Dokumen Sekolah (DMS)
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1 font-medium">
                            Penyimpanan & pembuatan transkrip, daftar Buku Induk, dan laporan digital terpadu
                        </p>
                    </div>
                </div>
                <Link href="/arsip/dokumen/buat">
                    <Button className="w-full md:w-auto gap-2 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-semibold shadow-sm border-0 transition-all">
                        <Plus className="h-4 w-4" />
                        Buat Dokumen Baru
                    </Button>
                </Link>
            </div>

            {/* Filter & Search Bar */}
            <Card className="p-4 border-slate-100 dark:border-zinc-800 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Cari judul dokumen atau nama penerima..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 rounded-xl"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-400 hidden md:block" />
                        <select 
                            value={typeFilter}
                            onChange={(e) => {
                                setTypeFilter(e.target.value);
                                setPage(1);
                            }}
                            className="w-full md:w-48 h-10 px-3 py-2 border rounded-xl bg-background border-input text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {DOCUMENT_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </Card>

            {/* Document Archives Table */}
            <Card className="border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                        <p className="text-xs text-muted-foreground font-semibold">Memuat berkas dokumen...</p>
                    </div>
                ) : data.length === 0 ? (
                    <div className="text-center py-20">
                        <FileText className="h-12 w-12 text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
                        <h3 className="font-bold text-slate-700 dark:text-zinc-300">Belum Ada Dokumen Terarsip</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                            Gunakan tombol di pojok kanan atas untuk membuat Transkrip Nilai, Daftar 1 Buku Induk, atau laporan digital lainnya.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
                                <TableRow>
                                    <TableHead className="font-bold">Judul Dokumen</TableHead>
                                    <TableHead className="font-bold">Tipe Berkas</TableHead>
                                    <TableHead className="font-bold">Penerima/Siswa</TableHead>
                                    <TableHead className="font-bold">Dibuat Oleh</TableHead>
                                    <TableHead className="font-bold">Tanggal Dibuat</TableHead>
                                    <TableHead className="w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((item) => (
                                    <TableRow 
                                        key={item.id} 
                                        className="hover:bg-muted/50 cursor-pointer" 
                                        onClick={() => {
                                        if (isViewableInBrowser(item.filePath)) {
                                            window.open(normalizePublicPath(item.filePath), "_blank");
                                        } else {
                                            handleDownloadSingle(item.filePath, item.title);
                                        }
                                    }}
                                    >
                                        <TableCell className="font-semibold text-slate-800 dark:text-zinc-200">
                                            {item.title}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`text-[10px] font-bold ${getDocTypeColor(item.documentType)}`}>
                                                {getDocTypeLabel(item.documentType)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-slate-600 dark:text-zinc-300 font-medium">
                                            {item.recipient}
                                        </TableCell>
                                        <TableCell className="text-slate-600 dark:text-zinc-300 font-medium text-sm">
                                            {item.createdByName || "-"}
                                        </TableCell>
                                        <TableCell className="text-slate-600 dark:text-zinc-350">
                                            {formatDate(new Date(item.createdAt).toISOString())}
                                        </TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="rounded-xl">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-xl">
                                                    <DropdownMenuItem onClick={() => {
                                                        if (isViewableInBrowser(item.filePath)) {
                                                            window.open(normalizePublicPath(item.filePath), "_blank");
                                                        } else {
                                                            handleDownloadSingle(item.filePath, item.title);
                                                        }
                                                    }}>
                                                        <FileText className="h-4 w-4 mr-2" /> {isViewableInBrowser(item.filePath) ? "Lihat Berkas" : "Download Berkas"}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDownloadSingle(item.filePath, item.title)}>
                                                        <Download className="h-4 w-4 mr-2" /> Download Berkas
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => router.push(`/arsip/dokumen/edit/${item.id}`)}>
                                                        <Pencil className="h-4 w-4 mr-2" /> Edit Metadata
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem 
                                                        className="text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50"
                                                        onClick={() => setDeleteDialog({ open: true, id: item.id, title: item.title })}
                                                    >
                                                        <Trash className="h-4 w-4 mr-2" /> Hapus Arsip
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </Card>

            {/* Document Count */}
            {!loading && data.length > 0 && (
                <div className="text-xs text-muted-foreground font-semibold">
                    Menampilkan {data.length} dari {totalDocs} dokumen
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-muted-foreground font-semibold">
                        Halaman {page} dari {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="rounded-xl"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="rounded-xl"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <Dialog 
                open={deleteDialog.open} 
                onOpenChange={(open) => !open && setDeleteDialog({ open: false, id: "", title: "" })}
            >
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Konfirmasi Hapus Dokumen</DialogTitle>
                        <DialogDescription>
                            Apakah Anda yakin ingin menghapus arsip dokumen <strong>{deleteDialog.title}</strong>? Berkas fisik dan catatan arsip akan dihapus secara permanen. Aksi ini tidak dapat dibatalkan.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteDialog({ open: false, id: "", title: "" })} disabled={acting} className="rounded-xl">
                            Batal
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={acting} className="rounded-xl bg-rose-600 hover:bg-rose-700">
                            {acting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Ya, Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
