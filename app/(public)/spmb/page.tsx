"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  MapPin,
  Users,
  FileText,
  Search,
  CheckCircle2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { goGet } from "@/lib/api-client";
import { siteConfig } from "@/lib/config";
import { Reveal } from "@/components/public/motion";

interface LandingData {
  isOpen?: boolean;
  period?: {
    name?: string;
    academic_year?: string;
    start_date?: string;
    end_date?: string;
    quota?: number;
    registered?: number;
    committee_name?: string;
  } | null;
  settings?: {
    school_name?: string;
    school_address?: string;
    max_distance_km?: number;
  };
}

const steps = [
  { icon: FileText, title: "Isi Formulir", desc: "Lengkapi data calon siswa dan orang tua secara daring." },
  { icon: Search, title: "Verifikasi Berkas", desc: "Panitia memverifikasi data dan dokumen yang diunggah." },
  { icon: CheckCircle2, title: "Pengumuman", desc: "Cek hasil seleksi melalui halaman lacak status." },
  { icon: Users, title: "Daftar Ulang", desc: "Siswa yang diterima melakukan daftar ulang di sekolah." },
];

const requirements = [
  "Fotokopi Kartu Keluarga (KK)",
  "Fotokopi Akta Kelahiran",
  "Pas Foto 3x4 latar merah",
  "Fotokopi KTP Orang Tua/Wali",
  "Surat Keterangan dari TK/RA (jika ada)",
  "Bukti domisili (untuk Jalur Domisili)",
];

export default function SPMBLandingPage() {
  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    goGet("/api/public/spmb/landing", { ttl: 60_000 })
      .then((json: LandingData) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const isOpen = data?.isOpen ?? false;
  const period = data?.period;
  const schoolName = data?.settings?.school_name || siteConfig.school.name;
  const maxDistance = data?.settings?.max_distance_km || 3;

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";

  return (
    <div className="flex flex-col bg-[#FFF8E7]">
      <section className="relative min-h-[80dvh] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#A7F3D0]/30 via-[#FFF8E7] to-[#FFF8E7]" />
        <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-[#A7F3D0]/20 blur-[80px] pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-16 md:py-24 w-full">
          <div className="max-w-2xl space-y-6">
            <Reveal>
              <Badge className="bg-[#065F46]/10 text-[#065F46] border-[#065F46]/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                {isOpen ? "Pendaftaran Dibuka" : "Pendaftaran Ditutup"}
              </Badge>
            </Reveal>

            <Reveal delay={0.08}>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-[#1a2e1a] leading-[1.1]">
                Penerimaan Siswa Baru
              </h1>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="text-base md:text-lg text-[#4b6b4b] leading-relaxed max-w-[55ch]">
                {period?.name || `SPMB ${siteConfig.academicYear.current}`} — Jalur Domisili untuk wilayah sekitar {schoolName}. {isOpen ? "Daftar sebelum kuota terisi." : "Pantau halaman ini untuk info periode berikutnya."}
              </p>
            </Reveal>

            {isOpen && (
              <Reveal delay={0.24}>
                <Link href="/spmb/daftar">
                  <Button className="bg-[#065F46] text-white hover:bg-[#047857] rounded-full px-6 h-11 text-sm font-semibold active:scale-[0.97] transition-transform">
                    Daftar Sekarang
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </Link>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      {isOpen && period && (
        <section className="py-12 md:py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[
                { label: "Kuota", value: period.quota ?? "-", icon: Users },
                { label: "Sudah Mendaftar", value: period.registered ?? 0, icon: CheckCircle2 },
                { label: "Dibuka", value: formatDate(period.start_date), icon: CalendarDays },
                { label: "Ditutup", value: formatDate(period.end_date), icon: Clock },
              ].map((item, i) => (
                <Reveal key={item.label} delay={i * 0.06}>
                  <div className="p-5 rounded-2xl bg-[#FFF8E7] border border-[#d1e7dd]">
                    <div className="flex items-center gap-2 text-[#4b6b4b] mb-2">
                      <item.icon className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wider">{item.label}</span>
                    </div>
                    <p className="text-xl font-bold text-[#065F46]">{item.value}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal>
            <h2 className="text-2xl md:text-3xl font-bold text-[#1a2e1a] mb-10">Alur Pendaftaran</h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {steps.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.06}>
                <div className="relative p-5 rounded-2xl bg-white border border-[#d1e7dd] h-full">
                  <span className="absolute top-4 right-4 text-3xl font-bold text-[#A7F3D0]">{String(i + 1).padStart(2, "0")}</span>
                  <div className="h-10 w-10 rounded-xl bg-[#065F46] text-white flex items-center justify-center mb-4">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-[#1a2e1a] text-sm">{step.title}</h3>
                  <p className="text-xs text-[#4b6b4b] mt-1.5 leading-relaxed">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal>
            <h2 className="text-2xl md:text-3xl font-bold text-[#1a2e1a] mb-4">Syarat Dokumen</h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-[#4b6b4b] mb-10 max-w-[55ch]">Siapkan dokumen berikut sebelum mengisi formulir pendaftaran.</p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requirements.map((req, i) => (
              <Reveal key={req} delay={i * 0.05}>
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#FFF8E7] border border-[#d1e7dd]">
                  <CheckCircle2 className="h-5 w-5 text-[#065F46] shrink-0 mt-0.5" />
                  <span className="text-sm text-[#1a2e1a]">{req}</span>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2}>
            <div className="mt-8 p-5 rounded-2xl bg-[#A7F3D0]/30 border border-[#065F46]/20 flex items-start gap-3">
              <MapPin className="h-5 w-5 text-[#065F46] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#065F46] text-sm">Jalur Domisili</p>
                <p className="text-sm text-[#4b6b4b] mt-1 leading-relaxed">
                  Calon siswa harus berdomisili dalam radius {maxDistance} km dari sekolah. Lokasi rumah diverifikasi melalui peta saat pendaftaran.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal>
            <div className="rounded-3xl bg-[#065F46] p-8 md:p-12 text-center text-white">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                {isOpen ? "Jangan Sampai Ketinggalan" : "Butuh Bantuan?"}
              </h2>
              <p className="text-white/80 mb-8 max-w-md mx-auto">
                {isOpen
                  ? `Kuota terbatas. Daftarkan putra-putri Anda sebelum ${formatDate(period?.end_date)}.`
                  : `Hubungi panitia ${period?.committee_name || "PPDB"} di sekolah untuk informasi lebih lanjut.`}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {isOpen && (
                  <Link href="/spmb/daftar">
                    <Button className="bg-white text-[#065F46] hover:bg-[#A7F3D0] rounded-full px-6 h-11 text-sm font-semibold active:scale-[0.97] transition-transform">
                      Daftar Sekarang
                    </Button>
                  </Link>
                )}
                <Link href="/spmb/tracking">
                  <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-full px-6 h-11 text-sm font-medium active:scale-[0.97] transition-transform">
                    Lacak Status Pendaftaran
                  </Button>
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
