"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Package,
    Home,
    ClipboardList,
    Plus,
    FileText,
    History,
    HandHeart,
} from "lucide-react";

const QUICK_ACTIONS = [
    {
        title: "Tambah Aset",
        description: "Input aset baru",
        icon: Plus,
        href: "/inventaris/aset?action=add",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10 hover:bg-blue-500/20",
    },
    {
        title: "Kelola Aset",
        description: "Lihat semua aset",
        icon: Package,
        href: "/inventaris/aset",
        color: "text-green-500",
        bgColor: "bg-green-500/10 hover:bg-green-500/20",
    },
    {
        title: "Data Ruangan",
        description: "Kelola ruangan",
        icon: Home,
        href: "/inventaris/ruangan",
        color: "text-purple-500",
        bgColor: "bg-purple-500/10 hover:bg-purple-500/20",
    },
    {
        title: "Stok Opname",
        description: "Audit fisik aset",
        icon: ClipboardList,
        href: "/inventaris/opname",
        color: "text-orange-500",
        bgColor: "bg-orange-500/10 hover:bg-orange-500/20",
    },
    {
        title: "Laporan",
        description: "Export data",
        icon: FileText,
        href: "/inventaris/laporan",
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10 hover:bg-cyan-500/20",
    },
    {
        title: "Riwayat Audit",
        description: "Log aktivitas aset",
        icon: History,
        href: "/inventaris/audit",
        color: "text-amber-500",
        bgColor: "bg-amber-500/10 hover:bg-amber-500/20",
    },
    {
        title: "Pengajuan Peminjaman",
        description: "Pinjam aset ruangan lain",
        icon: HandHeart,
        href: "/inventaris/peminjaman",
        color: "text-rose-500",
        bgColor: "bg-rose-500/10 hover:bg-rose-500/20",
    },
];

// Path menu khusus admin. Dicocokkan dengan includes() terhadap href aksi.
const ADMIN_ONLY_PATHS = ["ruangan", "opname", "audit", "laporan"];

import { useAuthStore } from "@/lib/stores/auth-store";
import { useEffect, useState } from "react";

export function QuickActionsPanel() {
    const { user } = useAuthStore();
    // isMounted tadinya untuk menghindari render mismatch SSR; komponen ini
    // memang client-only (dimuat lewat dynamic import dengan ssr:false di
    // inventaris-client), jadi cek peran bisa langsung.
    const isAdmin = ["superadmin", "admin"].includes(user?.role || "");

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Menu</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {QUICK_ACTIONS.map((action) => {
                        // Menu khusus admin disembunyikan dari peran lain.
                        if (!isAdmin && ADMIN_ONLY_PATHS.some(p => action.href.includes(p))) {
                            return null;
                        }

                        return (
                        <Link key={action.title} href={action.href}>
                            <Button
                                variant="ghost"
                                className={`w-full h-auto flex-col gap-2 p-4 ${action.bgColor} transition-all duration-200 group`}
                            >
                                <div className={`p-2 rounded-xl ${action.bgColor}`}>
                                    <action.icon className={`h-5 w-5 ${action.color}`} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium">{action.title}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {action.description}
                                    </p>
                                </div>
                            </Button>
                        </Link>
                    )})}
                </div>
            </CardContent>
        </Card>
    );
}
