"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { getSchoolLogo } from "@/lib/school-logo";
import { goPost } from "@/lib/api-client";

export default function ResetPasswordPage() {
  const { settings } = useSchoolSettings();
  const schoolLogo = getSchoolLogo(settings?.school_logo);
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    setIsError(false);

    if (password.length < 8) {
      setMessage("Password minimal 8 karakter");
      setIsError(true);
      return;
    }
    if (password !== confirm) {
      setMessage("Konfirmasi password tidak sama");
      setIsError(true);
      return;
    }

    setIsLoading(true);
    try {
      await goPost(
        "/api/auth/reset-password",
        { token, newPassword: password },
        { skipRetry: true },
      );
      setDone(true);
      setMessage("Password berhasil diperbarui. Silakan masuk dengan password baru.");
    } catch (err: any) {
      setMessage(err?.message || "Gagal memperbarui password");
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 w-full max-w-md mx-auto p-8 rounded-2xl bg-white/50 dark:bg-black/30 backdrop-blur-md border border-zinc-200/50 dark:border-white/10 shadow-xl"
    >
      <div className="space-y-2 text-center flex flex-col items-center">
        {schoolLogo ? (
          <img
            src={schoolLogo}
            alt="Logo Sekolah"
            className="h-16 w-16 object-contain mb-2 p-1.5 bg-white rounded-xl shadow-md border"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              target.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div className={`h-16 w-16 flex items-center justify-center rounded-xl bg-primary text-primary-foreground mb-2 shadow-md ${schoolLogo ? "hidden" : ""}`}>
          <KeyRound className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-800 dark:text-white">Atur Password Baru</h1>
        <p className="text-muted-foreground text-sm">
          Masukkan password baru untuk akun Anda.
        </p>
      </div>

      <div className="space-y-4">
        {message && (
          <Alert
            variant={isError ? "destructive" : "default"}
            className={
              isError
                ? "animate-in fade-in slide-in-from-top-2 border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400"
                : "animate-in fade-in slide-in-from-top-2 border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            }
          >
            {isError ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {!token && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Tautan tidak valid: token reset tidak ditemukan. Minta tautan baru ke administrator sekolah.
            </AlertDescription>
          </Alert>
        )}

        {!done && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex flex-col space-y-2 w-full">
              <label htmlFor="password" className="text-sm font-medium text-stone-600 dark:text-stone-300">
                Password Baru
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || !token}
                className="h-11 bg-stone-50/50 dark:bg-zinc-900/50 border-stone-200 dark:border-zinc-800 focus-visible:ring-0 focus-visible:border-cyan-500 transition-all duration-300"
              />
            </div>
            <div className="flex flex-col space-y-2 w-full">
              <label htmlFor="confirm" className="text-sm font-medium text-stone-600 dark:text-stone-300">
                Ulangi Password Baru
              </label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Ulangi password baru"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={isLoading || !token}
                className="h-11 bg-stone-50/50 dark:bg-zinc-900/50 border-stone-200 dark:border-zinc-800 focus-visible:ring-0 focus-visible:border-cyan-500 transition-all duration-300"
              />
            </div>

            <Button type="submit" disabled={isLoading || !token} className="w-full h-11">
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </div>
              ) : (
                <div className="flex items-center justify-center group">
                  Simpan Password
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </Button>
          </form>
        )}

        {done && (
          <Link href="/login" className="block">
            <Button className="w-full h-11">Masuk ke Akun</Button>
          </Link>
        )}

        {!done && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
              Tautan reset hanya berlaku 60 menit dan sekali pakai. Minta tautan baru
              ke administrator sekolah bila sudah kedaluwarsa.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
