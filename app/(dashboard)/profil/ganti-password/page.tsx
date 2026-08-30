"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, Lock, ArrowRight, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { goPost } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import { evaluatePasswordStrength, validatePasswordStrength } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

const strengthColors = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-emerald-500",
];

const checkItems = [
  { key: "length" as const, label: "Minimal 8 karakter" },
  { key: "uppercase" as const, label: "Huruf besar (A-Z)" },
  { key: "lowercase" as const, label: "Huruf kecil (a-z)" },
  { key: "number" as const, label: "Angka (0-9)" },
  { key: "symbol" as const, label: "Simbol (!@#$)" },
];

export default function GantiPasswordPage() {
    const router = useRouter();
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const strength = evaluatePasswordStrength(newPassword);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!oldPassword || !newPassword || !confirmPassword) {
            setError("Semua field wajib diisi");
            return;
        }

        const strengthError = validatePasswordStrength(newPassword);
        if (strengthError) {
            setError(strengthError);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Konfirmasi password tidak cocok");
            return;
        }

        if (oldPassword === newPassword) {
            setError("Password baru tidak boleh sama dengan password lama");
            return;
        }

        setIsLoading(true);
        try {
            await goPost("/api/profile", {
                currentPassword: oldPassword,
                newPassword: newPassword,
            });
            
            setSuccess(true);
            showSuccess("Password berhasil diubah!");
            
            // Redirect to overview after 2 seconds
            setTimeout(() => {
                router.push("/overview");
            }, 2000);
        } catch (err: any) {
            setError(err.message || "Gagal mengubah password. Pastikan password lama benar.");
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="max-w-md w-full mx-4 text-center">
                    <CardContent className="pt-12 pb-8 space-y-4">
                        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <CardTitle className="text-xl">Password Berhasil Diubah!</CardTitle>
                        <CardDescription>
                            Anda akan dialihkan ke dashboard dalam beberapa detik...
                        </CardDescription>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="max-w-md w-full mx-4">
                <CardHeader className="space-y-1 pb-6">
                    <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-2">
                        <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <CardTitle className="text-xl text-center">Ganti Password</CardTitle>
                    <CardDescription className="text-center">
                        Anda wajib mengganti password untuk melanjutkan. Password baru akan digunakan untuk login berikutnya.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4 border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="oldPassword">Password Saat Ini</Label>
                            <Input
                                id="oldPassword"
                                type="password"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">Password Baru</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min. 8 karakter"
                                autoComplete="new-password"
                            />
                            {newPassword.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 flex gap-1">
                                            {[0, 1, 2, 3, 4].map((i) => (
                                                <div
                                                    key={i}
                                                    className={cn(
                                                        "h-1.5 flex-1 rounded-full transition-colors",
                                                        i <= strength.score ? strengthColors[strength.score] : "bg-zinc-200 dark:bg-zinc-800"
                                                    )}
                                                />
                                            ))}
                                        </div>
                                        <span className={cn(
                                            "text-xs font-medium",
                                            strength.score >= 3 ? "text-green-600 dark:text-green-400" :
                                            strength.score === 2 ? "text-yellow-600 dark:text-yellow-400" :
                                            "text-red-600 dark:text-red-400"
                                        )}>
                                            {strength.label}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                        {checkItems.map((item) => {
                                            const ok = strength.checks[item.key];
                                            return (
                                                <div key={item.key} className="flex items-center gap-1.5 text-xs">
                                                    {ok ? (
                                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                                    ) : (
                                                        <XCircle className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-600 shrink-0" />
                                                    )}
                                                    <span className={ok ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}>
                                                        {item.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">Gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol agar lebih aman.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Ulangi password baru"
                                autoComplete="new-password"
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 bg-gradient-to-br from-amber-600 to-amber-800 text-white font-medium"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Menyimpan...
                                </div>
                            ) : (
                                <div className="flex items-center justify-center group">
                                    Simpan Password Baru
                                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
