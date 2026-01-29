"use client";

import { GraduationCap, Quote } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { WavyBackground } from "@/components/ui/wavy-background";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { settings } = useSchoolSettings();

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Side - Visual & Branding */}
      <div className="hidden lg:flex relative flex-col justify-between bg-zinc-900 text-white overflow-hidden">
        <WavyBackground 
             className="max-w-4xl mx-auto pb-40 flex flex-col justify-between h-full p-12"
             colors={["#38bdf8", "#818cf8", "#c084fc", "#e879f9", "#22d3ee"]}
             backgroundFill="#18181b" 
        >
            {/* Content Container - z-index handled by component but ensuring layout */}
            <div className="relative z-10 flex flex-col h-full justify-between w-full">
              <Link href="/" className="flex items-center gap-3 w-fit">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur border border-white/20">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-lg leading-tight">{settings?.school_name || "Sekolah"}</p>
                  <p className="text-xs text-white/70">Website Sekolah Terpadu</p>
                </div>
              </Link>

              <div className="space-y-6 max-w-lg">
                <Quote className="h-10 w-10 text-white/50" />
                <blockquote className="text-2xl font-medium leading-relaxed tracking-tight">
                  &ldquo;Pendidikan bukan persiapan untuk hidup. Pendidikan adalah hidup itu sendiri.&rdquo;
                </blockquote>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
                    JD
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold">John Dewey</p>
                    <p className="text-white/60">Filsuf Pendidikan</p>
                  </div>
                </div>
              </div>

              <div className="text-xs text-white/40 flex justify-between items-center w-full">
                <p>© {new Date().getFullYear()} {settings?.school_name || "Sekolah"}</p>
                <div className="flex gap-4">
                  <Link href="/kontak" className="hover:text-white transition-colors">Bantuan</Link>
                  <Link href="/berita" className="hover:text-white transition-colors">Berita</Link>
                </div>
              </div>
            </div>
        </WavyBackground>
      </div>

      {/* Right Side - Form */}
      <div className="flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-background relative">
        <div className="w-full max-w-[400px] space-y-6 mx-auto">
          {/* Mobile Logo (Visible only on small screens) */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg text-primary-foreground">
              <GraduationCap className="h-7 w-7" />
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
