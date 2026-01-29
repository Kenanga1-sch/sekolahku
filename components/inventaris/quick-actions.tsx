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
];

import { useAuthStore } from "@/lib/stores/auth-store";
import { useEffect, useState } from "react";

export function QuickActionsPanel() {
    const { user } = useAuthStore();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const isAdmin = isMounted && ["superadmin", "admin"].includes(user?.role || "");

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Aksi Cepat</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {QUICK_ACTIONS.map((action) => {
                        // Logic: Hide strict Admin features from non-admins
                        // Restricted: Data Ruangan (/ruangan), Stok Opname (/opname)
                        // Laporan (/laporan) - maybe keep visible or restrict? User didn't explicitly ask context for Laporan but safe to keep unless asked.
                        // Actually, user said: "data ruangan dan stok opname masih muncul... Sembunyikan juga menu aset"
                        // Implementation: Filter strict paths
                        if (!isAdmin && (action.href.includes("ruangan") || action.href.includes("opname"))) {
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
