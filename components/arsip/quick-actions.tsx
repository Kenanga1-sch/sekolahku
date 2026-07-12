"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    FileText, 
    Send, 
    Inbox, 
    BookOpen,
    Settings,
    Plus,
} from "lucide-react";

const QUICK_ACTIONS = [
    {
        title: "Reg. Surat Masuk",
        description: "AI Gemini",
        icon: Plus,
        href: "/arsip/surat-masuk/baru",
        color: "text-indigo-500",
        bgColor: "bg-indigo-500/10 hover:bg-indigo-500/20",
    },
    {
        title: "Arsip Masuk",
        description: "Kelola arsip surat",
        icon: Inbox,
        href: "/arsip/surat-masuk",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10 hover:bg-blue-500/20",
    },
    {
        title: "Buat Keluar",
        description: "Draf surat dinas",
        icon: FileText,
        href: "/admin/surat/template",
        color: "text-purple-500",
        bgColor: "bg-purple-500/10 hover:bg-purple-500/20",
    },
    {
        title: "Arsip Keluar",
        description: "TTE & QR",
        icon: Send,
        href: "/arsip/surat-keluar",
        color: "text-green-500",
        bgColor: "bg-green-500/10 hover:bg-green-500/20",
    },
    {
        title: "Buku Agenda",
        description: "Laporan bulanan",
        icon: BookOpen,
        href: "/arsip/laporan",
        color: "text-orange-500",
        bgColor: "bg-orange-500/10 hover:bg-orange-500/20",
    },
    {
        title: "Pengaturan",
        description: "Klasifikasi surat",
        icon: Settings,
        href: "/arsip/pengaturan",
        color: "text-rose-500",
        bgColor: "bg-rose-500/10 hover:bg-rose-500/20",
    },
    {
        title: "Dokumen Sekolah",
        description: "DMS",
        icon: FileText,
        href: "/arsip/dokumen",
        color: "text-teal-500",
        bgColor: "bg-teal-500/10 hover:bg-teal-500/20",
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
