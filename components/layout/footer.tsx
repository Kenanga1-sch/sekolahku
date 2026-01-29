"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { GraduationCap, Mail, Phone, MapPin, Facebook, Instagram, Youtube, ArrowRight } from "lucide-react";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { SparklesCore } from "@/components/ui/sparkles";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { settings } = useSchoolSettings();
  const pathname = usePathname();

  if (pathname?.startsWith("/kiosk")) return null;

  return (
    <footer className="bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-t border-zinc-200 dark:border-white/5 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Sparkles Effect */}
      <div className="absolute inset-0 w-full h-full pointer-events-none opacity-50">
        <SparklesCore
          id="tsparticlesfullpage"
          background="transparent"
          minSize={0.6}
          maxSize={1.4}
          particleDensity={50}
          className="w-full h-full"
          particleColor="#3b82f6"
        />
      </div>

      <div className="container py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12">
          {/* Brand & Newsletter */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 rounded-xl bg-zinc-100 dark:bg-white/5 p-2 overflow-hidden shadow-lg shadow-zinc-200 dark:shadow-white/5">
                <Image
                  src="/logo.png"
                  alt="Logo Sekolah"
                  fill
                  className="object-contain p-1"
                />
              </div>
              <div>
                <p className="font-bold text-xl text-zinc-900 dark:text-white">{settings?.school_name || "Sekolah"}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-500">Website Sekolah Terpadu</p>
              </div>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Membangun generasi cerdas dan berkarakter mulia melalui pendidikan
              berkualitas yang terintegrasi dengan teknologi modern.
            </p>

            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Berlangganan Newsletter</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Email Anda"
                  className="bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:ring-primary/50"
                />
                <Button size="icon" className="bg-primary hover:bg-primary/90">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="font-semibold text-zinc-900 dark:text-white text-lg">Menu Utama</h3>
            <ul className="space-y-3">
              {[
                { label: "Beranda", href: "/" },
                { label: "Visi & Misi", href: "/profil/visi-misi" },
                { label: "Berita Sekolah", href: "/berita" },
                { label: "Hubungi Kami", href: "/kontak" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-zinc-600 dark:text-zinc-400 hover:text-primary transition-colors hover:translate-x-1 inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* SPMB Links */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="font-semibold text-zinc-900 dark:text-white text-lg">Pendaftaran</h3>
            <ul className="space-y-3">
              {[
                { label: "Info SPMB", href: "/spmb" },
                { label: "Daftar Sekarang", href: "/spmb/daftar" },
                { label: "Cek Status", href: "/spmb/tracking" },
                { label: "Persyaratan", href: "/spmb#syarat" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-zinc-600 dark:text-zinc-400 hover:text-primary transition-colors hover:translate-x-1 inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="lg:col-span-4 space-y-6">
            <h3 className="font-semibold text-zinc-900 dark:text-white text-lg">Hubungi Kami</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-4 group">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors mt-1">
                  <MapPin className="h-4 w-4 text-primary group-hover:text-white transition-colors" />
                </div>
                <span className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                  {settings?.school_address || "Alamat Sekolah"}
                </span>
              </li>
              <li className="flex items-start gap-4 group">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors mt-1">
                  <Phone className="h-4 w-4 text-primary group-hover:text-white transition-colors" />
                </div>
                <span className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed mt-1.5">{settings?.school_phone || "-"}</span>
              </li>
              <li className="flex items-start gap-4 group">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors mt-1">
                  <Mail className="h-4 w-4 text-primary group-hover:text-white transition-colors" />
                </div>
                <span className="text-zinc-600 dark:text-zinc-400 text-sm break-all leading-relaxed mt-1.5">{settings?.school_email || "-"}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <Separator className="bg-zinc-200 dark:bg-white/10" />

      {/* Bottom Bar */}
      <div className="container py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-zinc-500 text-sm">
            © {currentYear} {settings?.school_name || "Sekolah"}. All rights reserved.
          </p>

          <div className="flex gap-4">
            {[Facebook, Instagram, Youtube].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center hover:bg-primary hover:text-white transition-all hover:-translate-y-1 text-zinc-500 dark:text-zinc-400"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
