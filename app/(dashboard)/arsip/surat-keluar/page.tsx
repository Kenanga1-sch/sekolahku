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
    FileText
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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";

interface SuratKeluar {
    id: string;
    mailNumber: string;
    recipient: string;
    subject: string;
    dateOfLetter: string;
    status: string;
    classification: { name: string; code: string } | null;
}

export default function SuratKeluarPage() {
    const [data, setData] = useState<SuratKeluar[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
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
            const res = await fetch(`/api/arsip/surat-keluar?${params}`);
            const result = await res.json();
            setData(result.items);
            setTotalPages(result.totalPages);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Draft": return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
            case "Pending": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
            case "Selesai": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
            case "Arsip": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
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
                <Link href="/arsip/surat-keluar/baru">
                    <Button className="gap-2 bg-green-600 hover:bg-green-700">
                        <Plus className="h-4 w-4" />
                        Buat Surat / Booking Nomor
                    </Button>
                </Link>
            </div>

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
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" />
                        Status
                    </Button>
                    <Button variant="outline" className="gap-2">
                        <Calendar className="h-4 w-4" />
                        Tanggal
                    </Button>
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
                                <TableRow key={item.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => window.location.href = `/arsip/surat-keluar/${item.id}`}>
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
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/arsip/surat-keluar/${item.id}`}>
                                                        <FileText className="h-4 w-4 mr-2" />
                                                        Detail & Upload Arsip
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
        </div>
    );
}
