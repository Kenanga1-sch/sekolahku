"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Save, Send, Database, AlertCircle, CheckCircle, Info, UploadCloud } from "lucide-react";
import { goGet, goPut, goPost } from "@/lib/api-client";
import { toast } from "sonner";

interface BackupSettings {
    id: string;
    botToken: string;
    chatId: string;
    isEnabled: boolean;
    lastBackupAt: number;
}

export default function TabBackup() {
    const [settings, setSettings] = useState<BackupSettings>({
        id: "default",
        botToken: "",
        chatId: "",
        isEnabled: false,
        lastBackupAt: 0,
    });
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [fileToRestore, setFileToRestore] = useState<File | null>(null);

    useEffect(() => {
        let mounted = true;
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const res: any = await goGet("/api/settings/backup/telegram");
                if (mounted && res) {
                    setSettings(res);
                }
            } catch (err: any) {
                console.error("Gagal memuat pengaturan backup:", err);
                if (mounted) {
                    setError("Gagal memuat pengaturan. " + (err.message || ""));
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchSettings();
        return () => {
            mounted = false;
        };
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccessMsg(null);

        try {
            await goPut("/api/settings/backup/telegram", {
                botToken: settings.botToken,
                chatId: settings.chatId,
                isEnabled: settings.isEnabled,
            });
            
            setSuccessMsg("Pengaturan backup berhasil disimpan!");
            toast.success("Pengaturan backup disimpan");
            
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err: any) {
            console.error("Gagal menyimpan pengaturan backup:", err);
            setError(err.message || "Gagal menyimpan pengaturan. Silakan coba lagi.");
            toast.error("Gagal menyimpan pengaturan");
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestBackup = async () => {
        if (!settings.botToken || !settings.chatId) {
            toast.error("Bot Token dan Chat ID harus diisi dan disimpan terlebih dahulu");
            return;
        }

        setIsTesting(true);
        try {
            await goPost("/api/settings/backup/telegram/test", {});
            toast.success("Backup berhasil dikirim ke Telegram!");
            
            // Perbarui waktu lastBackupAt
            const res: any = await goGet("/api/settings/backup/telegram");
            if (res) {
                setSettings(prev => ({
                    ...prev,
                    lastBackupAt: res.lastBackupAt
                }));
            }
        } catch (err: any) {
            console.error("Gagal mengirim backup test:", err);
            toast.error("Gagal mengirim backup: " + (err.message || ""));
        } finally {
            setIsTesting(false);
        }
    };

    const handleRestore = async () => {
        if (!fileToRestore) {
            toast.error("Silakan pilih file zip backup terlebih dahulu");
            return;
        }

        if (!confirm("PERINGATAN: Melakukan restore akan MENIMPA dan MENGHAPUS seluruh database dan file upload saat ini. Apakah Anda yakin ingin melanjutkan?")) {
            return;
        }

        setIsRestoring(true);
        try {
            const formData = new FormData();
            formData.append("backup_file", fileToRestore);

            const res: any = await goPost("/api/settings/backup/telegram/restore", formData);
            
            toast.success(res?.message || "Restore berhasil, sistem sedang direstart...");
            setSuccessMsg(res?.message || "Restore berhasil. Server sedang direstart. Halaman akan dimuat ulang.");
            
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (err: any) {
            console.error("Gagal restore:", err);
            toast.error("Gagal melakukan restore: " + (err.message || ""));
            setError(err.message || "Gagal melakukan restore");
        } finally {
            setIsRestoring(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            </div>
        );
    }

    return (
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card className="border-slate-200/80 dark:border-zinc-800/80 shadow-xs bg-white dark:bg-zinc-950">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg font-bold">
                            <Database className="h-5 w-5 text-violet-500" />
                            Pengaturan Backup Telegram
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Atur bot Telegram untuk menerima file backup database (SQLite) secara otomatis setiap hari pukul 02:00 WIB.
                        </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-6">
                        {error && (
                            <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1 text-xs">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription className="font-medium">{error}</AlertDescription>
                            </Alert>
                        )}
                        
                        {successMsg && (
                            <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 animate-in fade-in slide-in-from-top-1 text-xs">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertDescription className="font-semibold text-green-800 dark:text-green-200">{successMsg}</AlertDescription>
                            </Alert>
                        )}

                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-100 dark:border-zinc-800">
                            <div className="space-y-0.5">
                                <Label htmlFor="enable-backup" className="text-sm font-bold text-slate-800 dark:text-slate-200">Aktifkan Backup Otomatis</Label>
                                <p className="text-[11px] text-muted-foreground">Kirim backup terjadwal secara otomatis</p>
                            </div>
                            <Switch
                                id="enable-backup"
                                checked={settings.isEnabled}
                                onCheckedChange={(checked) => setSettings({ ...settings, isEnabled: checked })}
                                className="data-[state=checked]:bg-emerald-500"
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="botToken" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Telegram Bot Token</Label>
                                <Input
                                    id="botToken"
                                    type="password"
                                    value={settings.botToken}
                                    onChange={(e) => setSettings({ ...settings, botToken: e.target.value })}
                                    placeholder="e.g. 123456789:ABCdefGHIjklmNOPQrsTUVwxyZ..."
                                    className="bg-transparent focus-visible:ring-violet-500"
                                />
                                <p className="text-[10px] text-muted-foreground">Dapatkan token dengan membuat bot melalui @BotFather di Telegram.</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="chatId" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Telegram Chat ID</Label>
                                <Input
                                    id="chatId"
                                    value={settings.chatId}
                                    onChange={(e) => setSettings({ ...settings, chatId: e.target.value })}
                                    placeholder="e.g. -1001234567890"
                                    className="bg-transparent focus-visible:ring-violet-500 font-mono text-sm"
                                />
                                <p className="text-[10px] text-muted-foreground">ID grup atau user tujuan (Gunakan tanda minus jika berupa ID Grup/Channel supergroup).</p>
                            </div>
                        </div>
                    </CardContent>
                    
                    <CardFooter className="flex items-center gap-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 pt-6">
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Simpan Pengaturan
                        </Button>
                        <Button
                            onClick={handleTestBackup}
                            disabled={isTesting || !settings.botToken || !settings.chatId}
                            variant="outline"
                            className="flex-1 gap-2 font-semibold hover:bg-violet-50 dark:hover:bg-violet-950 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800"
                        >
                            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Test Kirim Backup
                        </Button>
                    </CardFooter>
                </Card>
            </div>
            
            <div className="space-y-6">
                <Card className="border-slate-200/80 dark:border-zinc-800/80 shadow-xs bg-white dark:bg-zinc-950">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Info className="h-4 w-4 text-blue-500" />
                            Informasi Backup
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs space-y-4 text-muted-foreground">
                        <div className="space-y-1 pb-3 border-b border-slate-100 dark:border-zinc-800">
                            <p className="font-semibold text-slate-700 dark:text-slate-300">Terakhir Backup</p>
                            <p>
                                {settings.lastBackupAt 
                                    ? new Date(settings.lastBackupAt).toLocaleString('id-ID', {
                                        dateStyle: 'full',
                                        timeStyle: 'medium'
                                      })
                                    : "Belum pernah melakukan backup"}
                            </p>
                        </div>
                        
                        <div className="space-y-2 pt-1">
                            <p className="font-semibold text-slate-700 dark:text-slate-300">Cara Mendapatkan Chat ID:</p>
                            <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                                <li>Kirim pesan sembarang ke Bot Anda.</li>
                                <li>Buka <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> di browser.</li>
                                <li>Cari bagian <code>"chat": {"{"} "id": 12345678 {"}"}</code>.</li>
                                <li>Salin angka ID tersebut ke kolom Chat ID.</li>
                            </ol>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-red-200/80 dark:border-red-900/50 shadow-xs bg-red-50/50 dark:bg-red-950/20">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
                            <UploadCloud className="h-4 w-4" />
                            Restore Data
                        </CardTitle>
                        <CardDescription className="text-xs text-red-600/80 dark:text-red-400/80">
                            Unggah file .zip backup dari Telegram untuk memulihkan seluruh data (Database & Uploads).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="file"
                                accept=".zip"
                                onChange={(e) => setFileToRestore(e.target.files?.[0] || null)}
                                className="text-xs file:bg-red-100 file:text-red-700 file:border-0 file:rounded-md file:px-2 file:py-1 file:mr-2 hover:file:bg-red-200"
                            />
                        </div>
                        <Button
                            onClick={handleRestore}
                            disabled={!fileToRestore || isRestoring}
                            variant="destructive"
                            className="w-full text-xs font-semibold gap-2"
                        >
                            {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                            Restore Sekarang
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
