"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
    Loader2
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
import { formatDate } from "@/lib/utils";
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
}

const STATUSES = ["", "Draft", "Menunggu Verifikasi", "Terverifikasi", "Revisi"];

export default function SuratKeluarPage() {
    const [data, setData] = useState<SuratKeluar[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

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
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Surat Keluar</h1>
                    <p className="text-muted-foreground text-sm">
                        Daftar surat yang diterbitkan (Out-Going Mail)
                    </p>
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
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Data Table */}
            <Card className="overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
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
                                <TableCell colSpan={6} className="text-center py-8">
                                    Memuat data...
                                </TableCell>
                            </TableRow>
                        ) : data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                    Belum ada surat keluar.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((item) => (
                                <TableRow key={item.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => window.location.href = `/arsip/surat-keluar/detail?id=${item.id}`}>
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
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {item.status === "Draft" && (
                                                    <DropdownMenuItem onClick={() => handleSubmitToVerification(item.id)} disabled={acting}>
                                                        <Send className="h-4 w-4 mr-2" />
                                                        Kirim ke Verifikasi
                                                    </DropdownMenuItem>
                                                )}
                                                {item.status === "Menunggu Verifikasi" && (
                                                    <>
                                                        <DropdownMenuItem onClick={() => setVerifyDialog({ open: true, id: item.id })}>
                                                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                                            Verifikasi & TTD
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => setRevisionDialog({ open: true, id: item.id })}>
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
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
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
        </div>
    );
}

