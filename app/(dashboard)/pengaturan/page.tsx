"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Database, Settings, Users } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import TabSekolah from "./tab-sekolah";
import TabUsers from "./tab-users";
import TabSystemLogs from "./tab-system-logs";
import TabBackup from "./tab-backup";
import TabProfil from "./tab-profil";
import TabSistem from "./tab-sistem";
import TabLandingSections from "./tab-landing-sections";
import TabVisiMisi from "./tab-visi-misi";

export default function PengaturanPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
    const { settings, updateSettings } = useSchoolSettings();
    const isAdmin = user?.role === "admin" || user?.role === "superadmin";

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
                <TabsList className="grid grid-cols-2 overflow-x-auto rounded-xl bg-slate-100/80 dark:bg-zinc-900/80 border border-slate-200/40 dark:border-zinc-800/40 p-1 sm:grid-cols-4">
                    <TabsTrigger value="profil" className="min-w-[150px] rounded-lg px-3 py-2 text-xs font-semibold">
                        <Settings className="mr-2 h-4 w-4" />
                        Profil Sekolah
                    </TabsTrigger>
                    <TabsTrigger value="sekolah" className="min-w-[150px] rounded-lg px-3 py-2 text-xs font-semibold">
                        <Activity className="mr-2 h-4 w-4" />
                        Identitas & Kontak
                    </TabsTrigger>
                    <TabsTrigger value="sistem" className="min-w-[150px] rounded-lg px-3 py-2 text-xs font-semibold">
                        <Database className="mr-2 h-4 w-4" />
                        Sistem & Akademik
                    </TabsTrigger>
                    <TabsTrigger value="users" className="min-w-[150px] rounded-lg px-3 py-2 text-xs font-semibold">
                        <Users className="mr-2 h-4 w-4" />
                        Manajemen Pengguna
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="profil" className="pt-4">
                    <TabProfil settings={settings} setSettings={updateSettings} />
                </TabsContent>
                <TabsContent value="sekolah" className="pt-4">
                    <TabSekolah />
                </TabsContent>
                <TabsContent value="sistem" className="pt-4">
                    <TabSistem settings={settings} setSettings={updateSettings} />
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
                <TabsContent value="landing" className="pt-4">
                    <TabLandingSections settings={settings} setSettings={updateSettings} />
                </TabsContent>
                <TabsContent value="visi-misi" className="pt-4">
                    <TabVisiMisi settings={settings} setSettings={updateSettings} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
