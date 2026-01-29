"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    QrCode,
    Users,
    ClipboardCheck,
    Clock,
    BarChart3,
    CreditCard,
    Landmark,
    Settings2,
} from "lucide-react";

const QUICK_ACTIONS = [
    {
        title: "Scan QR",
        description: "Transaksi cepat",
        icon: QrCode,
        href: "/tabungan/scan",
        color: "text-green-500",
        bgColor: "bg-green-500/10 hover:bg-green-500/20",
    },
    {
        title: "Siswa",
        description: "Kelola data",
        icon: Users,
        href: "/tabungan/siswa",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10 hover:bg-blue-500/20",
    },

    {
        title: "Riwayat",
        description: "Lihat transaksi",
        icon: Clock,
        href: "/tabungan/riwayat",
        color: "text-purple-500",
        bgColor: "bg-purple-500/10 hover:bg-purple-500/20",
    },
    {
        title: "Laporan",
        description: "Export data",
        icon: BarChart3,
        href: "/tabungan/laporan",
        color: "text-indigo-500",
        bgColor: "bg-indigo-500/10 hover:bg-indigo-500/20",
    },


];

export function QuickActionsPanel() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {QUICK_ACTIONS.map((action) => (
                <Link key={action.title} href={action.href} className="group relative">
                    <div className={`absolute inset-0 bg-gradient-to-br ${action.title === 'Scan QR' ? 'from-green-500/20 to-emerald-500/20' : 'from-blue-500/10 to-indigo-500/10'} rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    <Card className="relative h-full border-muted/40 hover:border-primary/20 hover:shadow-lg transition-all duration-300 dark:bg-zinc-900/50 backdrop-blur-sm overflow-hidden group-hover:-translate-y-1">
                         <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity`}>
                            <action.icon className={`w-16 h-16 ${action.color}`} />
                        </div>
                        <CardContent className="p-5 flex flex-col justify-between h-full">
                            <div className={`w-12 h-12 rounded-xl ${action.bgColor} flex items-center justify-center mb-4 ring-1 ring-white/20 shadow-sm`}>
                                <action.icon className={`h-6 w-6 ${action.color}`} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">{action.title}</h3>
                                <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            ))}
        </div>
    );
}
