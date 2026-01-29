"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    FileText, 
    Send, 
    Inbox, 
    Clock, 
    Plus,
    Search,
    BookOpen
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

export default function ArsipDashboard() {
    const [stats, setStats] = useState({
        suratMasuk: 0,
        suratKeluar: 0,
        pendingTasks: 0
    });

    useEffect(() => {
        fetch("/api/arsip/stats")
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(err => console.error(err));
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">E-Arsip</h1>
                    <p className="text-muted-foreground">
                        Sistem Informasi Manajemen Persuratan Digital
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/arsip/surat-masuk/baru">
                        <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                            <Plus className="h-4 w-4" />
                            Surat Masuk
                        </Button>
                    </Link>
                    <Link href="/arsip/surat-keluar/baru">
                        <Button variant="outline" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Surat Keluar
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Surat Masuk</CardTitle>
                        <Inbox className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.suratMasuk}</div>
                        <p className="text-xs text-muted-foreground">
                            Dokumen digital tersimpan
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Surat Keluar</CardTitle>
                        <Send className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.suratKeluar}</div>
                        <p className="text-xs text-muted-foreground">
                            Dokumen diterbitkan
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Disposisi Menunggu</CardTitle>
                        <Clock className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingTasks}</div>
                        <p className="text-xs text-muted-foreground">
                            Perlu tindak lanjut
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Access Menu */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Link href="/arsip/surat-masuk">
                    <Card className="hover:bg-slate-50 transition-colors cursor-pointer border-l-4 border-l-blue-500">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Inbox className="h-5 w-5 text-blue-500" />
                                Arsip Surat Masuk
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Kelola surat masuk, disposisi, dan pencarian dokumen.
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/arsip/surat-keluar">
                    <Card className="hover:bg-slate-50 transition-colors cursor-pointer border-l-4 border-l-green-500">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Send className="h-5 w-5 text-green-500" />
                                Arsip Surat Keluar
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Booking nomor surat, drafting, dan arsip surat keluar.
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Card className="hover:bg-slate-50 transition-colors cursor-pointer border-l-4 border-l-purple-500 opacity-70">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-purple-500" />
                            Buku Agenda (Laporan)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Cetak laporan buku agenda surat masuk dan keluar.
                            <br/>(Segera Hadir)
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
