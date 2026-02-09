"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    BookMarked, 
    RotateCcw, 
    UserCheck, 
    BookOpen,
    QrCode,
    ExternalLink,
    Printer,
    ScanBarcode,
    Users,
    TrendingUp,
} from "lucide-react";

const QUICK_ACTIONS = [
    {
        title: "Pinjam Buku",
        description: "Catat peminjaman baru",
        icon: BookMarked,
        href: "/perpustakaan/peminjaman",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10 hover:bg-blue-500/20",
    },
    {
        title: "Catat Kunjungan",
        description: "Rekap kunjungan harian",
        icon: UserCheck,
        href: "/perpustakaan/kunjungan/manual",
        color: "text-purple-500",
        bgColor: "bg-purple-500/10 hover:bg-purple-500/20",
    },
    {
        title: "Kelola Buku",
        description: "Manajemen koleksi",
        icon: BookOpen,
        href: "/perpustakaan/buku",
        color: "text-orange-500",
        bgColor: "bg-orange-500/10 hover:bg-orange-500/20",
    },
    {
        title: "Scan QR",
        description: "Mode kiosk",
        icon: QrCode,
        href: "/kiosk",
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10 hover:bg-cyan-500/20",
        external: true,
    },
    {
        title: "Binding Buku",
        description: "Scan QR & ISBN",
        icon: ScanBarcode,
        href: "/perpustakaan/binding",
        color: "text-indigo-500",
        bgColor: "bg-indigo-500/10 hover:bg-indigo-500/20",
    },
    {
        title: "Generator QR",
        description: "Cetak label massal",
        icon: Printer,
        href: "/perpustakaan/qr-generator",
        color: "text-pink-500",
        bgColor: "bg-pink-500/10 hover:bg-pink-500/20",
    },
    {
        title: "Kelola Anggota",
        description: "Manajemen anggota",
        icon: Users,
        href: "/perpustakaan/anggota",
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20",
    },
    {
        title: "Laporan",
        description: "Statistik & Export",
        icon: TrendingUp,
        href: "/perpustakaan/laporan",
        color: "text-rose-500",
        bgColor: "bg-rose-500/10 hover:bg-rose-500/20",
    },
];

export function QuickActionsPanel() {
    return (
        <Card>
            <CardHeader className="p-4 sm:pb-2">
                <CardTitle className="text-lg font-semibold">Menu</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4">
                    {QUICK_ACTIONS.map((action) => (
                        <Link 
                            key={action.title} 
                            href={action.href}
                            target={action.external ? "_blank" : undefined}
                            className="w-full"
                        >
                            <Button
                                variant="ghost"
                                className={`w-full h-full flex-col gap-2 p-3 sm:p-4 ${action.bgColor} transition-all duration-200 group rounded-xl overflow-hidden`}
                            >
                                <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl ${action.bgColor} group-hover:scale-110 transition-transform`}>
                                    <action.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${action.color}`} />
                                </div>
                                <div className="text-center w-full">
                                    <p className="text-xs sm:text-sm font-medium flex items-center justify-center gap-1">
                                        {action.title}
                                        {action.external && (
                                            <ExternalLink className="h-2 w-2 sm:h-3 sm:w-3 opacity-50" />
                                        )}
                                    </p>
                                    <p className="hidden sm:block text-[10px] text-muted-foreground line-clamp-1">
                                        {action.description}
                                    </p>
                                </div>
                            </Button>
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
