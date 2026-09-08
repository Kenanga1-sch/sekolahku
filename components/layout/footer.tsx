"use client";

import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { getSchoolLogo } from "@/lib/school-logo";
import { usePathname } from "next/navigation";
import Image from "next/image";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { settings } = useSchoolSettings();
  const pathname = usePathname();
  const schoolLogo = getSchoolLogo(settings?.school_logo);

  if (pathname?.startsWith("/kiosk")) return null;

  return (
    <footer className="bg-[#065F46] text-white/90 w-full">
      <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 rounded-xl bg-white/10 p-1.5 overflow-hidden">
                <Image src={schoolLogo} alt="Logo" fill className="object-contain p-0.5" />
              </div>
              <div>
                <p className="font-bold text-lg text-white">{settings?.school_name || "SDN 1 Kenanga"}</p>
                <p className="text-xs text-white/60">Website Sekolah Terpadu</p>
              </div>
            </div>
            <p className="text-sm text-white/70 leading-relaxed max-w-xs">
              Membangun generasi cerdas dan berkarakter melalui pendidikan berkualitas.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider">Tautan Cepat</h3>
            <div className="flex flex-col gap-2.5">
              <Link href="/" className="text-sm text-white/70 hover:text-[#A7F3D0] transition-colors">Beranda</Link>
              <Link href="/spmb" className="text-sm text-white/70 hover:text-[#A7F3D0] transition-colors">Pendaftaran Siswa Baru</Link>
              <Link href="/layanan" className="text-sm text-white/70 hover:text-[#A7F3D0] transition-colors">Layanan</Link>
              <Link href="/login" className="text-sm text-white/70 hover:text-[#A7F3D0] transition-colors">Masuk Dashboard</Link>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider">Kontak</h3>
            <div className="flex flex-col gap-3">
              {settings?.school_address && (
                <div className="flex items-start gap-2.5 text-sm text-white/70">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-[#A7F3D0]" />
                  <span>{settings.school_address}</span>
                </div>
              )}
              {settings?.school_phone && (
                <div className="flex items-center gap-2.5 text-sm text-white/70">
                  <Phone className="h-4 w-4 shrink-0 text-[#A7F3D0]" />
                  <span>{settings.school_phone}</span>
                </div>
              )}
              {settings?.school_email && (
                <div className="flex items-center gap-2.5 text-sm text-white/70">
                  <Mail className="h-4 w-4 shrink-0 text-[#A7F3D0]" />
                  <span>{settings.school_email}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 text-center">
          <p className="text-xs text-white/50">
            &copy; {currentYear} {settings?.school_name || "SDN 1 Kenanga"}. Hak cipta dilindungi.
          </p>
        </div>
      </div>
    </footer>
  );
}
