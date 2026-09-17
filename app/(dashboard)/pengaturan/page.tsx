"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Database, LayoutTemplate, Settings, Sparkles, Users } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import TabUsers from "./tab-users";
import TabSystemLogs from "./tab-system-logs";
import TabBackup from "./tab-backup";
import TabProfil from "./tab-profil";
import TabLandingSections from "./tab-landing-sections";
import TabVisiMisi from "./tab-visi-misi";

export default function PengaturanPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
    const { settings, updateSettings } = useSchoolSettings();
    const isAdmin = user?.role === "admin" || user?.role === "superadmin";
    
    // Force re-render when user data changes
    const [, forceUpdate] = useState({});
    useEffect(() => {
        forceUpdate({});
    }, [user?.role]);
    
    if (authLoading || !user) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto pb-10">
                <div className="h-10 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-800" />
                <div className="h-14 w-full animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
                <div className="h-[420px] w-full animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
            </div>
        );
    }

    if (!isAuthenticated || !isAdmin) {
        return null;
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Pengaturan</h1>
                <p className="text-sm text-muted-foreground">
                    Kelola data sekolah, profil, pengguna, aktivitas sistem, dan backup Telegram.
                </p>
            </div>

            <Tabs defaultValue="profil" className="w-full">
                <TabsList className="w-full max-w-full h-auto flex-nowrap rounded-xl bg-slate-100/80 dark:bg-zinc-900/80 border-slate-200/40 dark:border-zinc-800/40 p-1">
                    <TabsTrigger value="profil" className="min-w-[140px] shrink-0 rounded-lg px-3 py-2 text-xs font-semibold">
                        <Settings className="h-4 w-4" />
                        Profil Sekolah
                    </TabsTrigger>
                    <TabsTrigger value="users" className="min-w-[140px] shrink-0 rounded-lg px-3 py-2 text-xs font-semibold">
                        <Users className="h-4 w-4" />
                        Manajemen Pengguna
                    </TabsTrigger>
                    <TabsTrigger value="system-logs" className="min-w-[140px] shrink-0 rounded-lg px-3 py-2 text-xs font-semibold">
                        <Activity className="h-4 w-4" />
                        Log Aktivitas
                    </TabsTrigger>
                    <TabsTrigger value="backup" className="min-w-[140px] shrink-0 rounded-lg px-3 py-2 text-xs font-semibold">
                        <Database className="h-4 w-4" />
                        Backup Telegram
                    </TabsTrigger>
                    <TabsTrigger value="visi-misi" className="min-w-[140px] shrink-0 rounded-lg px-3 py-2 text-xs font-semibold">
                        <Sparkles className="h-4 w-4" />
                        Visi & Misi
                    </TabsTrigger>
                    <TabsTrigger value="landing" className="min-w-[140px] shrink-0 rounded-lg px-3 py-2 text-xs font-semibold">
                        <LayoutTemplate className="h-4 w-4" />
                        Landing Halaman
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="profil" className="pt-4">
                    <TabProfil settings={settings} setSettings={updateSettings} />
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
                <TabsContent value="visi-misi" className="pt-4">
                    <TabVisiMisi settings={settings} setSettings={updateSettings} />
                </TabsContent>
                <TabsContent value="landing" className="pt-4">
                    <TabLandingSections settings={settings} setSettings={updateSettings} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
