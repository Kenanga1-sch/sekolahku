"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound, Loader2, Mail, MessageSquare, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { getSchoolLogo } from "@/lib/school-logo";
import { APP_VERSION, goPost } from "@/lib/api-client";

// Pesan respons SELALU generik agar tidak bisa dipakai untuk menebak apakah
// sebuah email terdaftar atau tidak (anti user-enumeration).
const GENERIC_MESSAGE =
  "Jika email terdaftar, kami telah mengirim tautan reset";
const RATE_LIMIT_MESSAGE = "Terlalu banyak permintaan, coba lagi nanti";

const BottomGradient = () => {
  return (
    <>
      <span className="group-hover/btn:opacity-100 block transition duration-500 opacity-0 absolute h-px w-full -bottom-px inset-x-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
      <span className="group-hover/btn:opacity-100 blur-sm block transition duration-500 opacity-0 absolute h-px w-1/2 mx-auto -bottom-px inset-x-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
    </>
  );
};

export default function LupaPasswordPage() {
  const { settings } = useSchoolSettings();
  const schoolLogo = getSchoolLogo(settings?.school_logo);
  const adminEmail = settings?.school_email || "admin@sekolah.sch.id";

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    setIsError(false);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setIsLoading(true);
    try {
      // Alur pengiriman email reset dijalankan oleh backend. Respons apa pun
      // (email ada maupun tidak) ditampilkan dengan pesan generik yang sama
      // supaya tidak membocorkan status pendaftaran akun.
      await goPost("/api/auth/forgot-password", { email: trimmedEmail }, { skipRetry: true });
    } catch (err: any) {
      if (err?.status === 429) {
        setMessage(RATE_LIMIT_MESSAGE);
        setIsError(true);
        setIsLoading(false);
        return;
      }
      // Error lain (termasuk endpoint yang belum tersedia) tetap ditampilkan
      // sebagai pesan generik — bukan pesan yang mengungkap status email.
    } finally {
      setIsLoading(false);
    }

    setMessage(GENERIC_MESSAGE);
    setIsError(false);
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
        <h1 className="text-3xl font-bold tracking-tight text-zinc-800 dark:text-white">Lupa Password</h1>
        <p className="text-muted-foreground text-sm">
          Masukkan email akun Anda untuk menerima tautan reset password
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

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex flex-col space-y-2 w-full">
            <label
              htmlFor="email"
              className="text-sm font-medium text-stone-600 dark:text-stone-300"
            >
              Email
            </label>
            <div className="relative group/btn">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-stone-400 dark:text-stone-500 z-10" />
              <Input
                id="email"
                name="email"
                type="email"
                required
                aria-label="Email"
                autoComplete="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="pl-9 h-11 bg-stone-50/50 dark:bg-zinc-900/50 border-stone-200 dark:border-zinc-800 focus-visible:ring-0 focus-visible:border-cyan-500 transition-all duration-300"
              />
              <BottomGradient />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-gradient-to-br from-black to-neutral-600 block dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 text-white rounded-md font-medium shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:shadow-[0px_1px_0px_0px_var(--zinc-800)_inset,0px_-1px_0px_0px_var(--zinc-800)_inset] hover:opacity-90 transition-opacity"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengirim...
              </div>
            ) : (
              <div className="flex items-center justify-center group">
                Kirim Tautan Reset
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            )}
            <BottomGradient />
          </Button>
        </form>

        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
            Demi keamanan data, reset password juga dapat dilakukan oleh
            Administrator Sekolah jika email tidak lagi aktif. Silakan hubungi
            kontak di bawah ini.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Email Administrator</p>
              <a href={`mailto:${adminEmail}`} className="text-sm font-medium text-primary hover:underline">
                {adminEmail}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MessageSquare className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Telepon / WhatsApp</p>
              <span className="text-sm font-medium">{settings?.school_phone || "-"}</span>
            </div>
          </div>
          {settings?.school_address && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Alamat: {settings.school_address}
            </p>
          )}
        </div>

        <Link href="/login" className="block">
          <Button
            type="button"
            className="w-full h-11 bg-gradient-to-br from-black to-neutral-600 block dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 text-white rounded-md font-medium shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:shadow-[0px_1px_0px_0px_var(--zinc-800)_inset,0px_-1px_0px_0px_var(--zinc-800)_inset] hover:opacity-90 transition-opacity"
          >
            Kembali ke Halaman Login
          </Button>
        </Link>
      </div>

      <div className="text-center">
        <span className="text-xs text-muted-foreground font-mono tracking-widest select-none">
          {APP_VERSION}
        </span>
      </div>
    </motion.div>
  );
}
