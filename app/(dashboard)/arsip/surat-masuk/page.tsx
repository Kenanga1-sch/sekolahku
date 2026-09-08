"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
    Plus,
    Search,
    Filter,
    Calendar,
    FileText,
    MoreHorizontal,
    ArrowLeft,
    Download,
    Loader2,
    CheckCircle2,
    Archive,
    ArchiveRestore
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable, TablePagination } from "@/components/data-table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import JSZip from "jszip";
import { formatDate, normalizePublicPath, extractFilename } from "@/lib/utils";
import { goGet, goPost } from "@/lib/api-client";

interface SuratMasuk {
    id: string;
    agendaNumber: string;
    originalNumber: string;
    sender: string;
    subject: string;
    receivedAt: string;
    status: string;
    classification: { name: string; code: string } | null;
    filePath?: string;
}

export default function SuratMasukPage() {
    const [data, setData] = useState<SuratMasuk[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [downloadingBatch, setDownloadingBatch] = useState(false);
    const [actingId, setActingId] = useState<string | null>(null);

    const handleStatusChange = async (id: string, status: "Selesai" | "Arsip") => {
        setActingId(id);
        try {
            await goPost(`/api/arsip/surat-masuk/status?id=${id}`, { status });
            toast.success(`Surat ditandai ${status.toLowerCase()}`);
            loadData();
        } catch {
            toast.error("Gagal mengubah status surat");
        } finally {
            setActingId(null);
        }
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                search,
                perPage: "20"
            });
            const result: any = await goGet(`/api/arsip/surat-masuk?${params}`);
            const items = result.items || result.data?.items || result.data || [];
            setData(Array.isArray(items) ? items : []);
            setTotalPages(result.totalPages || result.data?.totalPages || 1);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const toggleSelectAll = () => {
        if (selectedIds.length === data.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(data.map(item => item.id));
        }
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleDownloadSingle = async (item: SuratMasuk) => {
        const filePath = item.filePath;
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
        
        const prefix = item.agendaNumber;
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

                const filePath = item.filePath;
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

                    const prefix = item.agendaNumber;
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
            link.download = `Batch_Surat_Masuk_${dateStr}.zip`;
            
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
            case "Menunggu Disposisi": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
            case "Terdisposisi": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
            case "Selesai": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
            case "Arsip": return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
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
                        <h1 className="text-2xl font-bold tracking-tight">Surat Masuk</h1>
                        <p className="text-muted-foreground text-sm">
                            Daftar surat yang diterima (In-Coming Mail)
                        </p>
                    </div>
                </div>
                <Link href="/arsip/surat-masuk/baru">
                    <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4" />
                        Catat Surat Baru
                    </Button>
                </Link>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-xl border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Cari No Agenda, Pengirim, atau Perihal..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" />
                        Filter Status
                    </Button>
                    <Button variant="outline" className="gap-2">
                        <Calendar className="h-4 w-4" />
                        Tanggal
                    </Button>
                </div>
            </div>

            {/* Data Table */}
            <DataTable
                data={loading ? [] : data}
                getRowId={(item) => item.id}
                loading={loading}
                selectable
                selectedIds={selectedIds}
                onToggleSelect={toggleSelectOne}
                onToggleSelectAll={toggleSelectAll}
                onRowClick={(item) => window.location.href = `/arsip/surat-masuk/detail?id=${item.id}`}
                emptyTitle="Belum ada surat masuk"
                emptyDescription="Surat yang diterima akan tercatat di sini."
                actions={(item) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon-sm" className="h-8 w-8 text-muted-foreground hover:text-foreground bg-white border-slate-200 shadow-sm" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                                <Link href={`/arsip/surat-masuk/detail?id=${item.id}`}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    Detail & Disposisi
                                </Link>
                            </DropdownMenuItem>
                            {(item.status === "Terdisposisi" || item.status === "Menunggu Disposisi") && (
                                <DropdownMenuItem
                                    onClick={() => handleStatusChange(item.id, "Selesai")}
                                    disabled={actingId === item.id}
                                >
                                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                                    Tandai Selesai
                                </DropdownMenuItem>
                            )}
                            {item.status !== "Arsip" && (
                                <DropdownMenuItem
                                    onClick={() => handleStatusChange(item.id, "Arsip")}
                                    disabled={actingId === item.id}
                                >
                                    <Archive className="h-4 w-4 mr-2 text-slate-600" />
                                    Arsipkan
                                </DropdownMenuItem>
                            )}
                            {item.status === "Arsip" && (
                                <DropdownMenuItem
                                    onClick={() => handleStatusChange(item.id, "Selesai")}
                                    disabled={actingId === item.id}
                                >
                                    <ArchiveRestore className="h-4 w-4 mr-2 text-blue-600" />
                                    Buka dari Arsip
                                </DropdownMenuItem>
                            )}
                            {item.filePath && (
                                <DropdownMenuItem onClick={() => handleDownloadSingle(item)}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download File
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                columns={[
                    {
                        key: "agendaNumber",
                        header: "No. Agenda",
                        card: "field",
                        render: (item) => (
                            <span className="font-mono text-sm font-medium">
                                {item.agendaNumber}
                            </span>
                        ),
                    },
                    {
                        key: "sender",
                        header: "Pengirim",
                        card: "title",
                        render: (item) => (
                            <div>
                                <div className="font-semibold">{item.sender}</div>
                                <div className="text-xs text-muted-foreground">{item.originalNumber}</div>
                            </div>
                        ),
                    },
                    {
                        key: "subject",
                        header: "Perihal",
                        width: "40%",
                        card: "field",
                        cardSpan: "full",
                        render: (item) => (
                            <div>
                                <div className="line-clamp-2 text-sm">{item.subject}</div>
                                {item.classification && (
                                    <Badge variant="outline" className="mt-1 text-[10px] h-5">
                                        {item.classification.code} - {item.classification.name}
                                    </Badge>
                                )}
                            </div>
                        ),
                    },
                    {
                        key: "receivedAt",
                        header: "Tgl Terima",
                        card: "field",
                        render: (item) => (
                            <span className="text-sm">{formatDate(item.receivedAt)}</span>
                        ),
                    },
                    {
                        key: "status",
                        header: "Status",
                        card: "field",
                        render: (item) => (
                            <Badge variant="secondary" className={getStatusColor(item.status)}>
                                {item.status}
                            </Badge>
                        ),
                    },
                ]}
            />

            {/* Pagination */}
            {!loading && data.length > 0 && (
                <TablePagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    label={`${data.length} surat`}
                />
            )}

            {/* Floating Batch Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-4 rounded-2xl md:rounded-full shadow-2xl flex flex-wrap justify-center items-center gap-3 md:gap-6 animate-in slide-in-from-bottom-4 duration-300 max-w-[calc(100vw-2rem)]">
                    <span className="text-sm font-medium">
                        {selectedIds.length} surat terpilih
                    </span>
                    <div className="hidden md:block h-4 w-[1px] bg-slate-700" />
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

