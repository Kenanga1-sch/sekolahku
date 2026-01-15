"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { GraduationCap, Mail, Phone, MapPin, Facebook, Instagram, Youtube, ArrowRight } from "lucide-react";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { settings } = useSchoolSettings();

  return (
    <footer className="bg-zinc-950 text-slate-200 border-t border-white/5 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="container py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12">
          {/* Brand & Newsletter */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-orange-500 shadow-lg shadow-primary/20">
                <GraduationCap className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="font-bold text-xl text-white">{settings?.school_name || "Sekolah"}</p>
                <p className="text-sm text-slate-400">Website Sekolah Terpadu</p>
              </div>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Membangun generasi cerdas dan berkarakter mulia melalui pendidikan
              berkualitas yang terintegrasi dengan teknologi modern.
            </p>

            <div className="space-y-2">
              <p className="text-sm font-medium text-white">Berlangganan Newsletter</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Email Anda"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-primary/50"
                />
                <Button size="icon" className="bg-primary hover:bg-primary/90">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2 lg:col-start-6 space-y-6">
            <h3 className="font-semibold text-white text-lg">Menu Utama</h3>
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
                    className="text-slate-400 hover:text-primary transition-colors hover:translate-x-1 inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* SPMB Links */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="font-semibold text-white text-lg">Pendaftaran</h3>
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
                    className="text-slate-400 hover:text-primary transition-colors hover:translate-x-1 inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="lg:col-span-3 space-y-6">
            <h3 className="font-semibold text-white text-lg">Hubungi Kami</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 group">
                <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <span className="text-slate-400 text-sm leading-relaxed">
                  {settings?.school_address || "Alamat Sekolah"}
                </span>
              </li>
              <li className="flex items-center gap-3 group">
                <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <span className="text-slate-400 text-sm">{settings?.school_phone || "-"}</span>
              </li>
              <li className="flex items-center gap-3 group">
                <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <span className="text-slate-400 text-sm">{settings?.school_email || "-"}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Bottom Bar */}
      <div className="container py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-sm">
            © {currentYear} {settings?.school_name || "Sekolah"}. All rights reserved.
          </p>

          <div className="flex gap-4">
            {[Facebook, Instagram, Youtube].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary hover:text-white transition-all hover:-translate-y-1 text-slate-400"
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
