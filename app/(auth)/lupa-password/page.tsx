"use client";

import { motion } from "framer-motion";
import { KeyRound, Mail, MessageSquare, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { getSchoolLogo } from "@/lib/school-logo";
import { APP_VERSION } from "@/lib/api-client";

export default function LupaPasswordPage() {
  const { settings } = useSchoolSettings();
  const schoolLogo = getSchoolLogo(settings?.school_logo);
  const adminEmail = settings?.school_email || "admin@sekolah.sch.id";

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
          Reset password dilakukan oleh Administrator Sekolah
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
            Demi keamanan data, reset password <strong>tidak dilakukan otomatis</strong> lewat website.
            Silakan hubungi Administrator Sekolah melalui kontak di bawah ini.
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
          <Button className="w-full h-11 rounded-xl">
            Kembali ke Halaman Login
          </Button>
        </Link>
      </div>

      <div className="text-center">
        <span className="text-xs text-muted-foreground/40 font-mono tracking-widest select-none">
          {APP_VERSION}
        </span>
      </div>
    </motion.div>
  );
}
