"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    BookMarked, 
    RotateCcw, 
    UserCheck, 
    Plus,
    QrCode,
    ExternalLink,
} from "lucide-react";

const QUICK_ACTIONS = [
    {
        title: "Pinjam Buku",
        description: "Catat peminjaman baru",
        icon: BookMarked,
        href: "/perpustakaan/peminjaman?action=borrow",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10 hover:bg-blue-500/20",
    },
    {
        title: "Kembalikan Buku",
        description: "Proses pengembalian",
        icon: RotateCcw,
        href: "/perpustakaan/peminjaman?action=return",
        color: "text-green-500",
        bgColor: "bg-green-500/10 hover:bg-green-500/20",
    },
    {
        title: "Catat Kunjungan",
        description: "Rekap kunjungan harian",
        icon: UserCheck,
        href: "/kiosk",
        color: "text-purple-500",
        bgColor: "bg-purple-500/10 hover:bg-purple-500/20",
        external: true,
    },
    {
        title: "Tambah Buku",
        description: "Koleksi baru",
        icon: Plus,
        href: "/perpustakaan/buku?action=add",
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
];

export function QuickActionsPanel() {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Aksi Cepat</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {QUICK_ACTIONS.map((action) => (
                        <Link 
                            key={action.title} 
                            href={action.href}
                            target={action.external ? "_blank" : undefined}
                        >
                            <Button
                                variant="ghost"
                                className={`w-full h-auto flex-col gap-2 p-4 ${action.bgColor} transition-all duration-200 group`}
                            >
                                <div className={`p-2 rounded-xl ${action.bgColor}`}>
                                    <action.icon className={`h-5 w-5 ${action.color}`} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium flex items-center gap-1">
                                        {action.title}
                                        {action.external && (
                                            <ExternalLink className="h-3 w-3 opacity-50" />
                                        )}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
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
