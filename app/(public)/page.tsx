"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  GraduationCap,
  Users,
  BookOpen,
  Briefcase,
  ArrowRight,
  MapPin,
  Calendar,
  Newspaper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { goGet } from "@/lib/api-client";
import { siteConfig } from "@/lib/config";
import { Reveal, EASE_OUT } from "@/components/public/motion";

interface HomepageData {
  success?: boolean;
  settings?: {
    school_name?: string;
    school_address?: string;
    current_academic_year?: string;
    spmb_is_open?: boolean;
  };
  news?: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    category?: string | null;
    thumbnail?: string | null;
    published_at?: string | null;
  }>;
  activePeriod?: {
    name?: string;
    academic_year?: string;
    quota?: number;
  } | null;
  stats?: {
    studentCount?: number;
  };
}

interface StaffItem {
  id: string;
  name: string;
  position?: string;
  photoUrl?: string;
  category?: string;
}

interface GalleryItem {
  id: string;
  title: string;
  imageUrl: string;
  category?: string;
}

export default function PublicHomepage() {
  const reduce = useReducedMotion();
  const [data, setData] = useState<HomepageData | null>(null);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  useEffect(() => {
    goGet("/api/public/homepage", { ttl: 60_000 })
      .then((json: HomepageData) => setData(json))
      .catch(() => setData(null));

    goGet("/api/public/staff?perPage=8", { ttl: 300_000 })
      .then((json: { data?: StaffItem[] }) => setStaff(Array.isArray(json?.data) ? json.data : []))
      .catch(() => setStaff([]));

    goGet("/api/public/gallery?perPage=6", { ttl: 120_000 })
      .then((json: { data?: GalleryItem[] }) => setGallery(Array.isArray(json?.data) ? json.data : []))
      .catch(() => setGallery([]));
  }, []);

  const schoolName = data?.settings?.school_name || siteConfig.school.name;
  const schoolAddress = data?.settings?.school_address || siteConfig.school.address;
  const academicYear = data?.settings?.current_academic_year || data?.activePeriod?.academic_year || siteConfig.academicYear.current;
  const spmbOpen = data?.settings?.spmb_is_open || !!data?.activePeriod;
  const studentCount = data?.stats?.studentCount ?? 0;
  const news = (data?.news ?? []).slice(0, 4);

  return (
    <div className="flex flex-col bg-[#FFF8E7]">
      <section className="relative min-h-[90dvh] md:min-h-[85dvh] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#A7F3D0]/30 via-[#FFF8E7] to-[#FFF8E7]" />
        <div className="absolute top-0 right-0 w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-[#A7F3D0]/20 blur-[80px] pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-20 md:py-24 w-full">
          <div className="max-w-2xl space-y-6">
            <Reveal delay={0}>
              <Badge className="bg-[#065F46]/10 text-[#065F46] border-[#065F46]/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                Tahun Ajaran {academicYear}
              </Badge>
            </Reveal>

            <Reveal delay={0.08}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-[#1a2e1a] leading-[1.1]">
                {schoolName}
              </h1>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="text-lg md:text-xl text-[#4b6b4b] leading-relaxed max-w-[55ch]">
                Membangun generasi cerdas dan berkarakter melalui pendidikan berkualitas yang terintegrasi teknologi.
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/spmb">
                  <Button className="bg-[#065F46] text-white hover:bg-[#047857] rounded-full px-6 h-11 text-sm font-medium active:scale-[0.97] transition-transform">
                    {spmbOpen ? "Daftar Sekarang" : "Info Pendaftaran"}
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </Link>
                <Link href="/layanan">
                  <Button variant="outline" className="rounded-full border-[#065F46]/30 text-[#065F46] hover:bg-[#A7F3D0]/40 px-6 h-11 text-sm font-medium active:scale-[0.97] transition-transform">
                    Layanan Sekolah
                  </Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { label: "Siswa Aktif", value: studentCount > 0 ? studentCount.toLocaleString("id-ID") : "-", icon: Users },
              { label: "Guru & Staf", value: staff.length > 0 ? `${staff.length}+` : "-", icon: GraduationCap },
              { label: "Tahun Ajaran", value: academicYear, icon: Calendar },
              { label: "Program", value: "SPMB", icon: BookOpen },
            ].map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.06}>
                <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-[#FFF8E7] border border-[#d1e7dd]">
                  <div className="h-10 w-10 rounded-xl bg-[#065F46] text-white flex items-center justify-center mb-3">
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-[#065F46]">{stat.value}</p>
                  <p className="text-xs md:text-sm text-[#4b6b4b] mt-1 font-medium">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal>
            <h2 className="text-2xl md:text-3xl font-bold text-[#1a2e1a] mb-4">Layanan Sekolah</h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-[#4b6b4b] mb-10 max-w-[55ch]">Akses cepat ke layanan digital untuk siswa, orang tua, dan guru.</p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[
              { title: "Cek Saldo Tabungan", desc: "Periksa saldo tabungan siswa secara mandiri.", href: "/layanan/cek-saldo", icon: Briefcase },
              { title: "Mutasi Masuk", desc: "Formulir permohonan pindah masuk sekolah.", href: "/layanan/mutasi-masuk", icon: ArrowRight },
              { title: "Mutasi Keluar", desc: "Formulir permohonan pindah keluar sekolah.", href: "/layanan/mutasi-keluar", icon: ArrowRight },
              { title: "Lacak Status SPMB", desc: "Cek status pendaftaran siswa baru.", href: "/spmb/tracking", icon: GraduationCap },
              { title: "Verifikasi Berkas", desc: "Verifikasi dokumen pendaftaran SPMB.", href: "/spmb/verify", icon: BookOpen },
              { title: "Kiosk Kelas", desc: "Scan presensi dan tabungan dari HP guru.", href: "/kiosk-kelas", icon: Users },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.05}>
                <Link href={item.href} className="group flex items-start gap-4 p-5 rounded-2xl bg-white border border-[#d1e7dd] hover:border-[#065F46]/30 hover:shadow-md transition-all active:scale-[0.98]">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-[#A7F3D0] text-[#065F46] flex items-center justify-center group-hover:bg-[#065F46] group-hover:text-white transition-colors">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1a2e1a] text-sm">{item.title}</h3>
                    <p className="text-xs text-[#4b6b4b] mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {spmbOpen && (
        <section className="py-16 md:py-20 bg-[#065F46] text-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <Reveal>
                <div className="space-y-5">
                  <Badge className="bg-white/10 text-white border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                    Pendaftaran Dibuka
                  </Badge>
                  <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                    {data?.activePeriod?.name || "Penerimaan Siswa Baru"}
                  </h2>
                  <p className="text-white/80 leading-relaxed max-w-[50ch]">
                    Segera daftarkan putra-putri Anda. Kuota terbatas untuk tahun ajaran {data?.activePeriod?.academic_year || academicYear}.
                  </p>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Link href="/spmb/daftar">
                      <Button className="bg-white text-[#065F46] hover:bg-[#A7F3D0] rounded-full px-6 h-11 text-sm font-semibold active:scale-[0.97] transition-transform">
                        Daftar Sekarang
                        <ArrowRight className="h-4 w-4 ml-1.5" />
                      </Button>
                    </Link>
                    <Link href="/spmb">
                      <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-full px-6 h-11 text-sm font-medium active:scale-[0.97] transition-transform">
                        Lihat Info Lengkap
                      </Button>
                    </Link>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Kuota", value: data?.activePeriod?.quota ?? "-" },
                    { label: "Tahun Ajaran", value: data?.activePeriod?.academic_year || academicYear },
                    { label: "Jalur", value: "Domisili" },
                    { label: "Status", value: "Dibuka" },
                  ].map((item) => (
                    <div key={item.label} className="p-4 rounded-2xl bg-white/10 border border-white/10">
                      <p className="text-white/60 text-xs font-medium uppercase tracking-wider">{item.label}</p>
                      <p className="text-xl font-bold mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      )}

      {news.length > 0 && (
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <Reveal>
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-[#1a2e1a]">Berita Terbaru</h2>
                  <p className="text-[#4b6b4b] mt-2 text-sm">Informasi dan pengumuman terkini dari sekolah.</p>
                </div>
              </div>
            </Reveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {news.map((item, i) => (
                <Reveal key={item.id} delay={i * 0.06}>
                  <div className="group flex flex-col h-full rounded-2xl border border-[#d1e7dd] bg-[#FFF8E7] overflow-hidden hover:shadow-md transition-shadow">
                    {item.thumbnail ? (
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <Image src={item.thumbnail} alt={item.title} fill sizes="(max-width: 768px) 100vw, 25vw" className="object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                      </div>
                    ) : (
                      <div className="aspect-[16/10] bg-[#A7F3D0]/30 flex items-center justify-center">
                        <Newspaper className="h-8 w-8 text-[#065F46]/40" />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-4 gap-2">
                      {item.category && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#065F46]">{item.category}</span>
                      )}
                      <h3 className="text-sm font-semibold text-[#1a2e1a] leading-snug line-clamp-2">{item.title}</h3>
                      {item.excerpt && <p className="text-xs text-[#4b6b4b] line-clamp-2 leading-relaxed">{item.excerpt}</p>}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="py-16 md:py-20">
          <div className="max-w-6xl mx-auto px-4">
            <Reveal>
              <h2 className="text-2xl md:text-3xl font-bold text-[#1a2e1a] mb-10">Galeri Kegiatan</h2>
            </Reveal>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {gallery.map((item, i) => (
                <Reveal key={item.id} delay={i * 0.06}>
                  <div className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#A7F3D0]/20">
                    <Image src={item.imageUrl} alt={item.title} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover group-hover:scale-[1.04] transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-4">
                      <p className="text-white text-sm font-medium">{item.title}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {staff.length > 0 && (
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <Reveal>
              <h2 className="text-2xl md:text-3xl font-bold text-[#1a2e1a] mb-4">Guru & Tenaga Kependidikan</h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="text-[#4b6b4b] mb-10 max-w-[55ch]">Tim pendidik berdedikasi yang membimbing siswa setiap hari.</p>
            </Reveal>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
              {staff.map((person, i) => (
                <Reveal key={person.id} delay={i * 0.05}>
                  <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-[#FFF8E7] border border-[#d1e7dd]">
                    <div className="h-16 w-16 md:h-20 md:w-20 rounded-full overflow-hidden bg-[#A7F3D0] mb-3">
                      {person.photoUrl ? (
                        <Image src={person.photoUrl} alt={person.name} width={80} height={80} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[#065F46]">
                          <Users className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-[#1a2e1a] line-clamp-1">{person.name}</h3>
                    {person.position && <p className="text-xs text-[#4b6b4b] mt-0.5 line-clamp-1">{person.position}</p>}
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
            <div className="rounded-3xl bg-[#065F46] p-8 md:p-12 text-center text-white">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Siap Bergabung?</h2>
              <p className="text-white/80 mb-8 max-w-md mx-auto">Daftarkan putra-putri Anda dan jadilah bagian dari keluarga besar {schoolName}.</p>
              <Link href="/spmb">
                <Button className="bg-white text-[#065F46] hover:bg-[#A7F3D0] rounded-full px-8 h-12 text-sm font-semibold active:scale-[0.97] transition-transform">
                  Mulai Pendaftaran
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
