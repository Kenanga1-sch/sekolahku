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
} from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSession } from "next-auth/react";

export default function ProfilePage() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
    const [isSaving, setIsSaving] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    const [profile, setProfile] = useState({
        name: "",
        email: "",
        phone: "",
    });

    const [passwords, setPasswords] = useState({
        current: "",
        new: "",
        confirm: "",
    });

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push("/login?redirect=/profile");
        }
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (user?.id) {
            // Only update if values are different to prevent infinite loop
            const newProfile = {
                name: user.name || "",
                email: user.email || "",
                phone: user.phone || "",
            };
            setProfile((prev) => {
                if (prev.name !== newProfile.name || 
                    prev.email !== newProfile.email || 
                    prev.phone !== newProfile.phone) {
                    return newProfile;
                }
                return prev;
            });
        }
    }, [user?.id, user?.name, user?.email, user?.phone]);

    const handleSaveProfile = async () => {
        if (!user) return;
        setIsSaving(true);
        setError(null);

        try {
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: profile.name, phone: profile.phone }),
            });
            
            if (!res.ok) throw new Error(await res.text());
            
            await update({ name: profile.name }); // Update session
            
            // setUser not needed as it comes from session
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error("Failed to update profile:", err);
            setError("Gagal menyimpan profil. Silakan coba lagi.");
        } finally {
            setIsSaving(false);
        }
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
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    oldPassword: passwords.current,
                    password: passwords.new,
                    passwordConfirm: passwords.confirm,
                }),
            });

            if (!res.ok) {
                 const data = await res.json();
                 throw new Error(data.error || "Gagal mengubah password");
            }

            setPasswords({ current: "", new: "", confirm: "" });
            setPasswordSuccess(true);
            setTimeout(() => setPasswordSuccess(false), 3000);
        } catch (err: any) {
            console.error("Failed to change password:", err);
            setPasswordError(err.message || "Gagal mengubah password.");
        } finally {
            setIsChangingPassword(false);
        }
    };

    if (authLoading || !user) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="grid lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-40" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold">Profil Saya</h1>
                <p className="text-muted-foreground">
                    Kelola informasi akun dan keamanan Anda
                </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Profile Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Informasi Profil
                        </CardTitle>
                        <CardDescription>
                            Update nama dan informasi kontak Anda
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {saved && (
                            <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-800 dark:text-green-200">
                                    Profil berhasil disimpan!
                                </AlertDescription>
                            </Alert>
                        )}

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Lengkap</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="name"
                                    className="pl-10"
                                    value={profile.name}
                                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                    placeholder="Nama lengkap"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    className="pl-10 bg-muted"
                                    value={profile.email}
                                    disabled
                                    readOnly
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Email tidak dapat diubah</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Nomor Telepon</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="phone"
                                    className="pl-10"
                                    value={profile.phone}
                                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                    placeholder="08xxxxxxxxxx"
                                />
                            </div>
                        </div>

                        <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full gap-2">
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Simpan Profil
                        </Button>
                    </CardContent>
                </Card>

                {/* Change Password */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Lock className="h-5 w-5" />
                            Ubah Password
                        </CardTitle>
                        <CardDescription>
                            Perbarui password akun Anda secara berkala
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {passwordSuccess && (
                            <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-800 dark:text-green-200">
                                    Password berhasil diubah!
                                </AlertDescription>
                            </Alert>
                        )}

                        {passwordError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{passwordError}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="current">Password Saat Ini</Label>
                            <Input
                                id="current"
                                type="password"
                                value={passwords.current}
                                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                placeholder="••••••••"
                            />
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label htmlFor="new">Password Baru</Label>
                            <Input
                                id="new"
                                type="password"
                                value={passwords.new}
                                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                placeholder="Minimal 8 karakter"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm">Konfirmasi Password Baru</Label>
                            <Input
                                id="confirm"
                                type="password"
                                value={passwords.confirm}
                                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                placeholder="Ulangi password baru"
                            />
                        </div>

                        <Button
                            onClick={handleChangePassword}
                            disabled={isChangingPassword || !passwords.current || !passwords.new || !passwords.confirm}
                            className="w-full gap-2"
                            variant="outline"
                        >
                            {isChangingPassword ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Lock className="h-4 w-4" />
                            )}
                            Ubah Password
                        </Button>
                    </CardContent>
                </Card>

                {/* Account Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Informasi Akun
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Role</span>
                            <span className="font-medium capitalize">{user.role || "User"}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Status</span>
                            <span className="font-medium text-green-600">Aktif</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Terakhir Login</span>
                            <span className="font-medium">
                                {new Date().toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                })}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
