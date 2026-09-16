"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Database, Settings, Users } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import TabSekolah from "./tab-sekolah";
import TabUsers from "./tab-users";
import TabSystemLogs from "./tab-system-logs";
import TabBackup from "./tab-backup";

export default function PengaturanPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
    const isAdmin = user?.role === "admin" || user?.role === "superadmin";

    useEffect(() => {
        if (!authLoading && (!isAuthenticated || !isAdmin)) {
            router.replace("/overview");
        }
    }, [authLoading, isAdmin, isAuthenticated, router]);

    if (authLoading || !user) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto pb-10">
                <div className="h-10 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-800" />
                <div className="h-14 w-full animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
                <div className="h-[420px] w-full animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Pengaturan</h1>
                <p className="text-sm text-muted-foreground">
                    Kelola data sekolah, pengguna, aktivitas sistem, dan backup Telegram.
                </p>
            </div>

            <Tabs defaultValue="sekolah" className="w-full">
                <TabsList className="grid grid-cols-2 overflow-x-auto rounded-xl bg-slate-100/80 dark:bg-zinc-900/80 border border-slate-200/40 dark:border-zinc-800/40 p-1 sm:grid-cols-4">
                    <TabsTrigger value="sekolah" className="min-w-[150px] rounded-lg px-3 py-2 text-xs font-semibold">
                        <Settings className="mr-2 h-4 w-4" />
                        Pengaturan Sekolah
                    </TabsTrigger>
                    <TabsTrigger value="users" className="min-w-[150px] rounded-lg px-3 py-2 text-xs font-semibold">
                        <Users className="mr-2 h-4 w-4" />
                        Manajemen Pengguna
                    </TabsTrigger>
                    <TabsTrigger value="system-logs" className="min-w-[150px] rounded-lg px-3 py-2 text-xs font-semibold">
                        <Activity className="mr-2 h-4 w-4" />
                        Log Aktivitas Sistem
                    </TabsTrigger>
                    <TabsTrigger value="backup" className="min-w-[150px] rounded-lg px-3 py-2 text-xs font-semibold">
                        <Database className="mr-2 h-4 w-4" />
                        Backup Telegram
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="sekolah" className="pt-4">
                    <TabSekolah />
                </TabsContent>
                <TabsContent value="users" className="pt-4">
                    <TabUsers />
                </TabsContent>
                <TabsContent value="system-logs" className="pt-4">
                    <TabSystemLogs />
                </TabsContent>
                <TabsContent value="backup" className="pt-4">
                    <TabBackup />
                </TabsContent>
            </Tabs>
        </div>
    );
}
