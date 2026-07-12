"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    FileText, 
    Send, 
    Inbox, 
    Clock, 
    Plus,
    BookOpen,
    Settings,
    Sparkles,
    ChevronRight,
    ArrowRight,
    Loader2
} from "lucide-react";
import Link from "next/link";
import { goGet } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { QuickActionsPanel } from "@/components/arsip/quick-actions";

type Letter = {
    id: string;
    subject: string;
    sender?: string;
    recipient?: string;
    dateOfLetter: string;
    status: string;
    agendaNumber?: string;
    mailNumber?: string;
};

export default function ArsipDashboard() {
    const [stats, setStats] = useState({
        suratMasuk: 0,
        suratKeluar: 0,
        pendingTasks: 0
    });
    const [recentMasuk, setRecentMasuk] = useState<Letter[]>([]);
    const [recentKeluar, setRecentKeluar] = useState<Letter[]>([]);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [isLoadingLetters, setIsLoadingLetters] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setIsLoadingStats(true);
            try {
                const res: any = await goGet("/api/arsip/stats");
                const data = res.data || res;
                setStats({
                    suratMasuk: data.suratMasuk || 0,
                    suratKeluar: data.suratKeluar || 0,
                    pendingTasks: data.pendingTasks || 0
                });
            } catch (err) {
                console.error("Failed to fetch arsip stats:", err);
            } finally {
                setIsLoadingStats(false);
            }
        };

        const fetchLetters = async () => {
            setIsLoadingLetters(true);
            try {
                const [inboxRes, outboxRes] = await Promise.all([
                    goGet("/api/arsip/surat-masuk?perPage=5"),
                    goGet("/api/arsip/surat-keluar?perPage=5")
                ]);
                setRecentMasuk(inboxRes.items || inboxRes.data || []);
                setRecentKeluar(outboxRes.items || outboxRes.data || []);
            } catch (err) {
                console.error("Failed to fetch recent letters:", err);
            } finally {
                setIsLoadingLetters(false);
            }
        };

        fetchStats();
        fetchLetters();
    }, []);

    // Get status color for Surat Masuk
    const getStatusMasukBadge = (status: string) => {
        const s = status.toLowerCase();
        if (s === "disposed" || s === "disposisi") {
            return "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50";
        }
        if (s === "pending" || s === "menunggu") {
            return "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50";
        }
        return "bg-slate-50 text-slate-700 border-slate-200/60 dark:bg-zinc-900/40 dark:text-zinc-400 dark:border-zinc-800";
    };

    // Get status color for Surat Keluar
    const getStatusKeluarBadge = (status: string) => {
        const s = status.toLowerCase();
        if (s === "signed" || s === "ttd" || s === "completed") {
            return "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50";
        }
        if (s === "verified" || s === "disetujui") {
            return "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50";
        }
        if (s === "rejected" || s === "ditolak" || s === "revision") {
            return "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50";
        }
        if (s === "draft") {
            return "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50";
        }
        return "bg-slate-50 text-slate-700 border-slate-200/60 dark:bg-zinc-900/40 dark:text-zinc-400 dark:border-zinc-800";
    };

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-300">
            {/* Header Title Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-zinc-800 pb-5">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-3">
                        <div className="p-2 bg-blue-50 dark:bg-zinc-900 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-100/30 dark:border-zinc-800">
                            <FileText className="h-6 w-6" />
                        </div>
                        Layanan E-Arsip
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1 font-medium">
                        Sistem Informasi Manajemen Persuratan Sekolah & Laporan Digital berbasis AI
                    </p>
                </div>
            </div>

            {/* Stats Cards Dashboard */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-blue-500/30 dark:hover:border-blue-400/30 transition-colors duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Surat Masuk</span>
                        <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
                            <Inbox className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-zinc-50">
                            {isLoadingStats ? <Skeleton className="h-8 w-16" /> : stats.suratMasuk}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Dokumen digital terarsip</p>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-emerald-500/30 dark:hover:border-emerald-400/30 transition-colors duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Surat Keluar</span>
                        <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
                            <Send className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-zinc-50">
                            {isLoadingStats ? <Skeleton className="h-8 w-16" /> : stats.suratKeluar}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Dokumen resmi diterbitkan</p>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-amber-500/30 dark:hover:border-amber-400/30 transition-colors duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Disposisi Menunggu</span>
                        <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400">
                            <Clock className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-zinc-50">
                            {isLoadingStats ? <Skeleton className="h-8 w-16" /> : stats.pendingTasks}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Tanggapan/tindak lanjut staf</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Sections Grid */}
            <QuickActionsPanel />

            {/* Dokumen Terbaru Grid (Surat Masuk & Surat Keluar) */}
            <div className="grid gap-6 md:grid-cols-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
                {/* Surat Masuk Terbaru */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-zinc-800">
                        <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                            <Inbox className="h-4 w-4 text-blue-500" /> Surat Masuk Terbaru
                        </h2>
                        <Link href="/arsip/surat-masuk" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5">
                            Lihat Semua <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>

                    <div className="space-y-2">
                        {isLoadingLetters ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
                                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                                    <div className="flex-1 space-y-1.5 min-w-0">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3.5 w-1/2" />
                                    </div>
                                </div>
                            ))
                        ) : recentMasuk.length === 0 ? (
                            <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground text-xs font-medium">
                                Belum ada data surat masuk tercatat.
                            </div>
                        ) : (
                            recentMasuk.map((letter) => (
                                <Link 
                                    key={letter.id} 
                                    href={`/arsip/surat-masuk/detail?id=${letter.id}`}
                                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/40 shadow-sm hover:bg-slate-50 dark:hover:bg-zinc-900/80 transition-all group"
                                >
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center shrink-0">
                                            <Inbox className="h-4.5 w-4.5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {letter.subject}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground font-medium mt-0.5 truncate">
                                                Dari: <span className="text-slate-600 dark:text-zinc-300 font-semibold">{letter.sender}</span> • {formatDate(letter.dateOfLetter)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Badge className={`text-[9px] py-0 px-2 h-4.5 font-bold ${getStatusMasukBadge(letter.status)}`}>
                                            {letter.status.toUpperCase()}
                                        </Badge>
                                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                {/* Surat Keluar Terbaru */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-zinc-800">
                        <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                            <Send className="h-4 w-4 text-green-500" /> Surat Keluar Terbaru
                        </h2>
                        <Link href="/arsip/surat-keluar" className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline flex items-center gap-0.5">
                            Lihat Semua <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>

                    <div className="space-y-2">
                        {isLoadingLetters ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
                                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                                    <div className="flex-1 space-y-1.5 min-w-0">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3.5 w-1/2" />
                                    </div>
                                </div>
                            ))
                        ) : recentKeluar.length === 0 ? (
                            <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground text-xs font-medium">
                                Belum ada data surat keluar tercatat.
                            </div>
                        ) : (
                            recentKeluar.map((letter) => (
                                <Link 
                                    key={letter.id} 
                                    href={`/arsip/surat-keluar/detail?id=${letter.id}`}
                                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/40 shadow-sm hover:bg-slate-50 dark:hover:bg-zinc-900/80 transition-all group"
                                >
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="h-9 w-9 rounded-full bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400 flex items-center justify-center shrink-0">
                                            <Send className="h-4.5 w-4.5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                                                {letter.subject}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground font-medium mt-0.5 truncate">
                                                Kepada: <span className="text-slate-600 dark:text-zinc-300 font-semibold">{letter.recipient}</span> • {formatDate(letter.dateOfLetter)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Badge className={`text-[9px] py-0 px-2 h-4.5 font-bold ${getStatusKeluarBadge(letter.status)}`}>
                                            {letter.status.toUpperCase()}
                                        </Badge>
                                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
