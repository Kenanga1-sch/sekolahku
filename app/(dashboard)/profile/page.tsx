"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    User,
    Mail,
    Phone,
    Lock,
    Save,
    Loader2,
    CheckCircle,
    AlertCircle,
    Shield,
    Camera,
    Calendar,
    Activity,
    History,
    Globe,
    ChevronRight,
    Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { goGet, goPatch, goPost } from "@/lib/api-client";
import { compressImage } from "@/lib/utils";
import { toast } from "sonner";

export default function ProfilePage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading, refreshSession } = useAuthStore();
    const [isProfileLoading, setIsProfileLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [activeTab, setActiveTab] = useState("personal");

    // Profile state
    const [profile, setProfile] = useState({
        name: "",
        fullName: "",
        username: "",
        email: "",
        phone: "",
        image: "",
    });
    const [isUploading, setIsUploading] = useState(false);

    // Password state
    const [passwords, setPasswords] = useState({
        current: "",
        new: "",
        confirm: "",
    });

    // Logs state
    const [logs, setLogs] = useState<any[]>([]);
    const [logsTotal, setLogsTotal] = useState(0);
    const [logsPage, setLogsPage] = useState(1);
    const [logsTotalPages, setLogsTotalPages] = useState(1);
    const [isLogsLoading, setIsLogsLoading] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push("/login?redirect=/profile");
        }
    }, [authLoading, isAuthenticated, router]);

    // Update profile local state when user from global store is loaded
    useEffect(() => {
        if (user?.id) {
            const newProfile = {
                name: user.name || "",
                fullName: (user as any).fullName || user.name || "",
                username: (user as any).username || "",
                email: user.email || "",
                phone: user.phone || "",
                image: user.image || "",
            };
            setProfile(newProfile);
        }
    }, [user]);

    // Fetch full profile info from API
    useEffect(() => {
        if (!isAuthenticated || authLoading) return;

        let active = true;
        const fetchProfile = async () => {
            setIsProfileLoading(true);
            try {
                const result: any = await goGet("/api/profile");
                if (!active) return;
                setProfile({
                    name: result?.name || user?.name || "",
                    fullName: result?.fullName || (user as any)?.fullName || result?.name || "",
                    username: result?.username || (user as any)?.username || "",
                    email: result?.email || user?.email || "",
                    phone: result?.phone || user?.phone || "",
                    image: result?.image || user?.image || "",
                });
            } catch (err) {
                console.error("Failed to fetch profile:", err);
            } finally {
                if (active) setIsProfileLoading(false);
            }
        };

        fetchProfile();
        return () => {
            active = false;
        };
    }, [authLoading, isAuthenticated, user]);

    // Load logs when active tab is activity or page changes
    useEffect(() => {
        if (activeTab === "activity" && isAuthenticated) {
            fetchLogs(logsPage);
        }
    }, [activeTab, logsPage, isAuthenticated]);

    const fetchLogs = async (page: number) => {
        setIsLogsLoading(true);
        try {
            const res: any = await goGet(`/api/profile/logs?page=${page}&limit=10`);
            if (res) {
                setLogs(res.items || []);
                setLogsTotal(res.totalItems || 0);
                setLogsTotalPages(res.totalPages || 1);
                setLogsPage(res.page || page);
            }
        } catch (err) {
            console.error("Failed to fetch logs:", err);
            toast.error("Gagal memuat log aktivitas");
        } finally {
            setIsLogsLoading(false);
        }
    };

    const syncUserCookie = async (nextProfile: typeof profile) => {
        if (typeof document === "undefined" || !user) return;

        const nextUser = {
            id: user.id,
            role: user.role,
            email: nextProfile.email || user.email,
            name: nextProfile.name,
            fullName: nextProfile.fullName,
            username: nextProfile.username,
            phone: nextProfile.phone,
            image: nextProfile.image,
        };
        document.cookie = `user_info=${encodeURIComponent(JSON.stringify(nextUser))}; path=/; SameSite=Lax`;
        await refreshSession();
    };

    const handleSaveProfile = async () => {
        if (!user) return;
        setIsSaving(true);
        setError(null);

        try {
            const result: any = await goPatch("/api/profile", { 
                name: profile.name, 
                fullName: profile.fullName,
                username: profile.username,
                phone: profile.phone,
                image: profile.image || null,
            });
            
            const nextProfile = {
                name: result?.user?.name || profile.name,
                fullName: result?.user?.fullName || profile.fullName || profile.name,
                username: result?.user?.username || profile.username,
                email: result?.user?.email || profile.email,
                phone: result?.user?.phone || profile.phone,
                image: result?.user?.image || profile.image || "",
            };
            setProfile(nextProfile);
            await syncUserCookie(nextProfile);
            setSaved(true);
            toast.success("Informasi profil berhasil diperbarui!");
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            console.error("Failed to update profile:", err);
            setError(err.message || "Gagal menyimpan profil. Silakan coba lagi.");
            toast.error(err.message || "Gagal memperbarui profil.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Berkas harus berupa gambar");
            return;
        }

        setIsUploading(true);
        try {
            const compressed = await compressImage(file, 256, 0.85);
            const formData = new FormData();
            formData.append("file", compressed);
            formData.append("folder", "profiles");

            const res: any = await goPost("/api/upload", formData);
            if (res.success && res.url) {
                const updatedImage = res.url;
                setProfile(prev => ({ ...prev, image: updatedImage }));
                
                // Save automatically
                const result: any = await goPatch("/api/profile", {
                    name: profile.name,
                    fullName: profile.fullName,
                    username: profile.username,
                    phone: profile.phone,
                    image: updatedImage,
                });
                
                const nextProfile = {
                    name: result?.user?.name || profile.name,
                    fullName: result?.user?.fullName || profile.fullName,
                    username: result?.user?.username || profile.username,
                    email: result?.user?.email || profile.email,
                    phone: result?.user?.phone || profile.phone,
                    image: result?.user?.image || updatedImage || "",
                };
                await syncUserCookie(nextProfile);
                toast.success("Foto profil berhasil diperbarui");
            } else {
                toast.error("Gagal mengunggah foto profil");
            }
        } catch (err) {
            console.error("Upload avatar error:", err);
            toast.error("Terjadi kesalahan saat mengunggah foto");
        } finally {
            setIsUploading(false);
        }
    };

    const resolveImageUrl = (path?: string) => {
        if (!path) return undefined;
        if (path.startsWith("http") || path.startsWith("/")) return path;
        return `/uploads/${path}`;
    };

    const handleChangePassword = async () => {
        if (!user) return;
        setPasswordError(null);
        setPasswordSuccess(false);

        if (passwords.new !== passwords.confirm) {
            setPasswordError("Password baru tidak cocok");
            return;
        }

        if (passwords.new.length < 8) {
            setPasswordError("Password minimal 8 karakter");
            return;
        }

        setIsChangingPassword(true);

        try {
            await goPatch("/api/profile", {
                oldPassword: passwords.current,
                password: passwords.new,
                passwordConfirm: passwords.confirm,
            });

            setPasswords({ current: "", new: "", confirm: "" });
            setPasswordSuccess(true);
            toast.success("Password berhasil diubah!");
            setTimeout(() => setPasswordSuccess(false), 3000);
        } catch (err: any) {
            console.error("Failed to change password:", err);
            setPasswordError(err.message || "Gagal mengubah password.");
            toast.error(err.message || "Gagal mengubah password.");
        } finally {
            setIsChangingPassword(false);
        }
    };

    const getActionIcon = (action: string) => {
        switch (action.toUpperCase()) {
            case "LOGIN":
                return <Globe className="h-4 w-4" />;
            case "LOGOUT":
                return <Globe className="h-4 w-4 opacity-70" />;
            case "CREATE":
                return <Save className="h-4 w-4" />;
            case "UPDATE":
                return <User className="h-4 w-4" />;
            case "DELETE":
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            default:
                return <Activity className="h-4 w-4" />;
        }
    };

    const getFriendlyActionBadge = (action: string) => {
        switch (action.toUpperCase()) {
            case "LOGIN":
                return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200">LOGIN</Badge>;
            case "UPDATE":
                return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200">UPDATE</Badge>;
            case "DELETE":
                return <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200">DELETE</Badge>;
            case "CREATE":
                return <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border-sky-200">CREATE</Badge>;
            default:
                return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{action}</Badge>;
        }
    };

    if (authLoading || !user || isProfileLoading) {
        return (
            <div className="space-y-6 max-w-5xl mx-auto p-4 animate-pulse">
                <div className="h-32 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
                <div className="flex gap-4 -mt-10 px-6">
                    <div className="h-20 w-20 rounded-full bg-slate-300 dark:bg-zinc-700 border-4 border-white dark:border-zinc-950" />
                    <div className="space-y-2 mt-12 flex-1">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <div className="grid lg:grid-cols-3 gap-6 pt-8">
                    <div className="lg:col-span-2 space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                    <Skeleton className="h-60 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            {/* Header Profil Premium */}
            <Card className="overflow-hidden border-slate-200/80 dark:border-zinc-800/80 shadow-md bg-white dark:bg-zinc-950 relative">
                <div className="h-36 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 relative overflow-hidden">
                    {/* Decorative Blobs */}
                    <div className="absolute top-[-50px] right-[-50px] w-48 h-48 rounded-full bg-white/10 blur-xl pointer-events-none" />
                    <div className="absolute bottom-[-30px] left-[10%] w-32 h-32 rounded-full bg-black/10 blur-lg pointer-events-none" />
                    <div className="absolute inset-0 bg-black/10 backdrop-blur-xs" />
                </div>
                <div className="px-6 pb-6 relative flex flex-col sm:flex-row items-center sm:items-end gap-5 -mt-14">
                    <div className="relative group h-28 w-28 rounded-full border-4 border-white dark:border-zinc-950 shadow-2xl overflow-hidden bg-slate-100 dark:bg-zinc-900 shrink-0">
                        <Avatar className="h-full w-full">
                            <AvatarImage src={resolveImageUrl(profile.image)} className="object-cover" />
                            <AvatarFallback className="text-3xl font-extrabold bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-700 dark:from-violet-950 dark:to-indigo-950 dark:text-violet-300">
                                {profile.name ? profile.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "U"}
                            </AvatarFallback>
                        </Avatar>
                        
                        <Label 
                            htmlFor="avatar-upload" 
                            className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center cursor-pointer text-white text-[10px] font-bold gap-1.5 text-center px-1"
                        >
                            <Camera className="h-5 w-5 text-white" />
                            {isUploading ? "Mengunggah..." : "Ubah Foto"}
                        </Label>
                        <input 
                            type="file" 
                            id="avatar-upload" 
                            accept="image/*" 
                            onChange={handleAvatarUpload}
                            disabled={isUploading}
                            className="hidden" 
                        />
                    </div>
                    <div className="flex-1 text-center sm:text-left space-y-1.5 pb-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start gap-2.5">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white leading-none tracking-tight flex items-center justify-center sm:justify-start gap-1.5">
                                {profile.fullName || profile.name || "User"}
                                <Sparkles className="h-4.5 w-4.5 text-amber-500 fill-amber-500 animate-pulse" />
                            </h2>
                            <Badge className="w-fit self-center sm:self-auto capitalize bg-violet-100 hover:bg-violet-150 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 dark:hover:bg-violet-950/60 font-semibold border-violet-200/50">
                                {user.role || "User"}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 font-medium">
                            <Mail className="h-3.5 w-3.5 text-slate-400" /> {profile.email}
                            {profile.username && (
                                <>
                                    <span className="text-slate-300 dark:text-slate-700">•</span>
                                    <span className="font-semibold text-slate-500 dark:text-slate-400">@{profile.username}</span>
                                </>
                            )}
                        </p>
                    </div>
                </div>
            </Card>

            <Tabs defaultValue="personal" onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-3 w-full max-w-lg mx-auto mb-6 bg-slate-150/80 dark:bg-zinc-900/80 border border-slate-200/40 dark:border-zinc-800/40 p-1 rounded-xl">
                    <TabsTrigger value="personal" className="flex items-center gap-1.5 py-2.5 rounded-lg transition-all">
                        <User className="h-4 w-4" />
                        Profil Saya
                    </TabsTrigger>
                    <TabsTrigger value="security" className="flex items-center gap-1.5 py-2.5 rounded-lg transition-all">
                        <Shield className="h-4 w-4" />
                        Keamanan
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="flex items-center gap-1.5 py-2.5 rounded-lg transition-all">
                        <History className="h-4 w-4" />
                        Aktivitas
                    </TabsTrigger>
                </TabsList>

                {/* Personal Tab */}
                <TabsContent value="personal" className="space-y-6">
                    <div className="grid lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <Card className="border-slate-200/80 dark:border-zinc-800/80 shadow-xs bg-white dark:bg-zinc-950">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg font-bold">
                                        <User className="h-5 w-5 text-violet-500" />
                                        Detail Profil Pengguna
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Perbarui nama lengkap, username unik, dan informasi kontak Anda.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    {saved && (
                                        <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 animate-in fade-in slide-in-from-top-1">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            <AlertDescription className="text-green-800 dark:text-green-200 text-xs font-semibold">
                                                Profil berhasil disimpan!
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {error && (
                                        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1 text-xs">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">{error}</AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="fullName" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nama Lengkap</Label>
                                            <Input
                                                id="fullName"
                                                className="bg-transparent focus-visible:ring-violet-500"
                                                value={profile.fullName}
                                                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                                                placeholder="Nama lengkap sesuai identitas"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="name" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nama Panggilan / Tampilan</Label>
                                            <Input
                                                id="name"
                                                className="bg-transparent focus-visible:ring-violet-500"
                                                value={profile.name}
                                                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                                placeholder="Nama panggilan"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="username" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Username</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">@</span>
                                                <Input
                                                    id="username"
                                                    className="pl-7 bg-transparent focus-visible:ring-violet-500"
                                                    value={profile.username}
                                                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                                                    placeholder="username_unik"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="phone" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nomor Telepon</Label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="phone"
                                                    className="pl-10 bg-transparent focus-visible:ring-violet-500"
                                                    value={profile.phone}
                                                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                                    placeholder="08xxxxxxxxxx"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Email Akses</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="email"
                                                className="pl-10 bg-muted/50 text-muted-foreground border-slate-200/50 cursor-not-allowed"
                                                value={profile.email}
                                                disabled
                                                readOnly
                                            />
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground italic mt-1">
                                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                            Email tidak dapat diubah demi keamanan validasi akun Anda.
                                        </div>
                                    </div>

                                    <Separator className="my-2 border-slate-100 dark:border-zinc-800" />

                                    <Button 
                                        onClick={handleSaveProfile} 
                                        disabled={isSaving} 
                                        className="w-full gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold shadow-md shadow-violet-500/10 py-5 transition-all duration-300"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="h-4.5 w-4.5 animate-spin" />
                                        ) : (
                                            <Save className="h-4.5 w-4.5" />
                                        )}
                                        Simpan Perubahan
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>

                        <div>
                            {/* Account Details Panel */}
                            <Card className="border-slate-200/80 dark:border-zinc-800/80 shadow-xs bg-white dark:bg-zinc-950 h-full flex flex-col">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-lg font-bold">
                                        <Shield className="h-5 w-5 text-violet-500" />
                                        Detail Akun
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Hak akses sistem dan detail status
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm flex-1 flex flex-col justify-between">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-slate-50/50 dark:bg-zinc-900/50 p-3 rounded-lg border border-slate-100 dark:border-zinc-800/60">
                                            <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs">Role / Hak Akses</span>
                                            <Badge className="capitalize px-3 py-0.5 font-bold text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:text-indigo-400">
                                                {user.role || "User"}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between items-center bg-slate-50/50 dark:bg-zinc-900/50 p-3 rounded-lg border border-slate-100 dark:border-zinc-800/60">
                                            <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs">Status Akun</span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                                                <CheckCircle className="h-4 w-4" /> AKTIF
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center bg-slate-50/50 dark:bg-zinc-900/50 p-3 rounded-lg border border-slate-100 dark:border-zinc-800/60">
                                            <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs">Verifikasi Email</span>
                                            <span className="font-bold text-green-600 dark:text-green-400 text-xs flex items-center gap-1.5">
                                                <CheckCircle className="h-4 w-4" /> TERVERIFIKASI
                                            </span>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 text-[11px] text-muted-foreground flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-violet-500" />
                                        <span>Terakhir login pada hari ini</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security" className="space-y-6">
                    <div className="grid lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <Card className="border-slate-200/80 dark:border-zinc-800/80 shadow-xs bg-white dark:bg-zinc-950">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg font-bold">
                                        <Lock className="h-5 w-5 text-violet-500" />
                                        Ubah Password Akun
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Ganti password Anda secara berkala untuk menjaga keamanan akun.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {passwordSuccess && (
                                        <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 animate-in fade-in slide-in-from-top-1">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            <AlertDescription className="text-green-800 dark:text-green-200 text-xs font-semibold">
                                                Password berhasil diperbarui!
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {passwordError && (
                                        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1 text-xs">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">{passwordError}</AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="current" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Password Saat Ini</Label>
                                        <Input
                                            id="current"
                                            type="password"
                                            value={passwords.current}
                                            onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                            placeholder="********"
                                            className="bg-transparent focus-visible:ring-violet-500"
                                        />
                                    </div>

                                    <Separator className="my-2 border-slate-100 dark:border-zinc-850" />

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="new" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Password Baru</Label>
                                            <Input
                                                id="new"
                                                type="password"
                                                value={passwords.new}
                                                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                                placeholder="Minimal 8 karakter"
                                                className="bg-transparent focus-visible:ring-violet-500"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="confirm" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Konfirmasi Password Baru</Label>
                                            <Input
                                                id="confirm"
                                                type="password"
                                                value={passwords.confirm}
                                                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                                placeholder="Ulangi password baru"
                                                className="bg-transparent focus-visible:ring-violet-500"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleChangePassword}
                                        disabled={isChangingPassword || !passwords.current || !passwords.new || !passwords.confirm}
                                        className="w-full gap-2 mt-2"
                                        variant="outline"
                                    >
                                        {isChangingPassword ? (
                                            <Loader2 className="h-4.5 w-4.5 animate-spin" />
                                        ) : (
                                            <Lock className="h-4.5 w-4.5 text-violet-500" />
                                        )}
                                        Perbarui Password Akun
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>

                        <div>
                            {/* Security Tips Card */}
                            <Card className="border-slate-200/80 dark:border-zinc-800/80 shadow-xs bg-white dark:bg-zinc-950 h-full">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-sm font-bold">
                                        <Shield className="h-4.5 w-4.5 text-violet-500" />
                                        Tips Keamanan Akun
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-xs text-muted-foreground space-y-3.5">
                                    <div className="flex gap-2">
                                        <ChevronRight className="h-4 w-4 text-violet-500 shrink-0" />
                                        <span>Gunakan kombinasi huruf besar, angka, dan simbol pada password baru Anda.</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <ChevronRight className="h-4 w-4 text-violet-500 shrink-0" />
                                        <span>Ganti sandi secara berkala minimal 3 bulan sekali.</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <ChevronRight className="h-4 w-4 text-violet-500 shrink-0" />
                                        <span>Hindari menggunakan password yang sama dengan website/akun media sosial lain.</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <ChevronRight className="h-4 w-4 text-violet-500 shrink-0" />
                                        <span>Jangan membagikan kredensial login atau email verifikasi akun Sekolahku kepada siapa pun.</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity" className="space-y-6">
                    <Card className="border-slate-200/80 dark:border-zinc-800/80 shadow-xs bg-white dark:bg-zinc-950">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg font-bold">
                                <Activity className="h-5 w-5 text-violet-500" />
                                Log Aktivitas Akun Anda
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Riwayat aktivitas keamanan, login, dan perubahan profil akun Anda.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isLogsLoading ? (
                                <div className="space-y-3 py-6">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="flex gap-4 items-center">
                                            <Skeleton className="h-10 w-10 rounded-full" />
                                            <div className="space-y-2 flex-1">
                                                <Skeleton className="h-4 w-1/3" />
                                                <Skeleton className="h-3 w-1/4" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : logs.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground text-xs font-semibold flex flex-col items-center justify-center gap-2">
                                    <History className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                                    Belum ada catatan aktivitas untuk akun Anda.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-3.5">
                                        {logs.map((log) => (
                                            <div 
                                                key={log.id} 
                                                className="flex gap-4 p-4 rounded-xl border border-slate-100 dark:border-zinc-900 bg-slate-50/20 dark:bg-zinc-900/10 hover:bg-slate-50/50 dark:hover:bg-zinc-900/35 transition-all duration-200"
                                            >
                                                <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-100/50 dark:border-violet-900/35">
                                                    {getActionIcon(log.action)}
                                                </div>
                                                <div className="flex-1 space-y-1.5 min-w-0">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                                                                {log.details || "Aktivitas Akun"}
                                                            </span>
                                                            {getFriendlyActionBadge(log.action)}
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                                                            {log.createdAt ? new Date(log.createdAt).toLocaleString("id-ID", {
                                                                day: "numeric",
                                                                month: "short",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit"
                                                            }) : ""}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground items-center font-medium">
                                                        <span className="flex items-center gap-1">
                                                            <Globe className="h-3.5 w-3.5 text-slate-400" />
                                                            {log.ipAddress || "System Connection"}
                                                        </span>
                                                        <span className="text-slate-200 dark:text-slate-800">|</span>
                                                        <span className="truncate max-w-[280px]" title={log.userAgent}>
                                                            {log.userAgent || "Unknown Browser"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Pagination Controls */}
                                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-800">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs font-semibold"
                                            disabled={logsPage === 1 || isLogsLoading}
                                            onClick={() => setLogsPage(prev => Math.max(prev - 1, 1))}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="text-[11px] text-muted-foreground font-semibold">
                                            Halaman {logsPage} dari {logsTotalPages} ({logsTotal} Log)
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs font-semibold"
                                            disabled={logsPage === logsTotalPages || isLogsLoading}
                                            onClick={() => setLogsPage(prev => Math.min(prev + 1, logsTotalPages))}
                                        >
                                            Selanjutnya
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
