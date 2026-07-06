"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  GraduationCap,
  Award,
  BookOpen,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Newspaper,
  LayoutDashboard,
  ShieldCheck,
  Zap,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import dynamic from 'next/dynamic';
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";

const SchoolMap = dynamic(() => import('@/components/landing/school-map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
});

const Hero3DCanvas = dynamic(() => import("./hero-3d-canvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[320px] sm:h-[450px] md:h-[550px] lg:h-[600px] xl:h-[650px] flex items-center justify-center bg-zinc-50 dark:bg-zinc-950/20 rounded-2xl border border-zinc-200/50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>
  ),
});

interface HomeClientProps {
  settings: any | null; 
  news: any[];
  activePeriod: any | null;
  studentCount: number;
}

export function HomeClient({ settings, news, activePeriod, studentCount }: HomeClientProps) {
  const schoolName = settings?.school_name || "UPTD SDN 1 Kenanga";

  // Calculate dynamic stats
  const displayStats = [
    { icon: Users, label: "Total Siswa", value: studentCount > 0 ? `${studentCount}+` : "...", color: "text-blue-500", bg: "bg-blue-500/10" },
    { icon: GraduationCap, label: "Tenaga Pengajar", value: "32", color: "text-green-500", bg: "bg-green-500/10" },
    { icon: Award, label: "Prestasi", value: "50+", color: "text-amber-500", bg: "bg-amber-500/10" },
    { icon: BookOpen, label: "Ekstrakurikuler", value: "12", color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  const features = [
    {
      title: "Kurikulum Merdeka",
      description: "Pembelajaran berpusat pada siswa dengan fleksibilitas tinggi.",
      header: (
        <div className="flex flex-1 w-full h-full min-h-[10rem] rounded-xl overflow-hidden relative group">
          <img 
            src="/images/kurikulum_merdeka.png" 
            alt="Kurikulum Merdeka"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ),
      icon: <LayoutDashboard className="h-4 w-4 text-blue-500" />,
    },
    {
      title: "Fasilitas Modern",
      description: "Laboratorium komputer, perpustakaan digital, dan ruang kelas AC.",
      header: (
        <div className="flex flex-1 w-full h-full min-h-[10rem] rounded-xl overflow-hidden relative group">
          <img 
            src="/images/fasilitas_modern.png" 
            alt="Fasilitas Modern"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ),
      icon: <Sparkles className="h-4 w-4 text-amber-500" />,
    },
    {
      title: "Lingkungan Aman",
      description: "Pengawasan CCTV 24 jam dan sistem keamanan terpadu satu pintu.",
      header: (
        <div className="flex flex-1 w-full h-full min-h-[10rem] rounded-xl overflow-hidden relative group">
          <img 
            src="/images/lingkungan_aman.png" 
            alt="Lingkungan Aman"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ),
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black">
      
      {/* 1. HERO SECTION: Split Screen with 3D Canvas */}
      <section className="relative w-full overflow-hidden bg-slate-50 dark:bg-zinc-950 border-b border-zinc-200/50 dark:border-zinc-800/20">
        {/* Playful background blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] aspect-square rounded-full bg-blue-200/10 dark:bg-blue-900/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[35%] aspect-square rounded-full bg-amber-200/10 dark:bg-amber-900/5 blur-[100px] pointer-events-none" />
        
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />
        
        <div className="container px-4 md:px-6 relative z-10 mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center min-h-[100dvh] pt-24 pb-12 lg:py-32">
            
            {/* Left Column: Typography & CTAs */}
            <div className="lg:col-span-7 flex flex-col justify-center text-left space-y-6">
              <div className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/30 dark:border-blue-900/30 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <BadgeCheck className="h-3.5 w-3.5" />
                Terakreditasi A (Unggul)
              </div>
              
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 leading-[1.15]">
                Membentuk Generasi <span className="text-blue-600 dark:text-blue-400">Cerdas</span>, Berkarakter & <span className="text-amber-500">Berprestasi</span>
              </h1>
              
              <p className="text-lg text-slate-600 dark:text-zinc-400 max-w-[50ch] leading-relaxed">
                Selamat datang di {schoolName}. Kami menyediakan lingkungan belajar yang aman, suportif, dan inovatif untuk menumbuhkan potensi terbaik setiap anak didik sejak dini.
              </p>
              
              <div className="flex flex-wrap items-center gap-4 pt-2">
                {settings?.spmb_is_open && (
                  <Link href="/spmb/daftar">
                    <Button size="lg" className="h-12 px-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]">
                      Daftar Sekarang
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                )}
                <Link href="/profil/visi-misi">
                  <Button variant="outline" size="lg" className="h-12 px-8 rounded-full border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 hover:bg-zinc-100 text-slate-700 dark:text-zinc-200 font-semibold active:scale-[0.98]">
                    Tentang Kami
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Right Column: 3D Interactive Scene */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <Hero3DCanvas />
            </div>
            
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container relative z-10 px-4 pt-6 pb-12 sm:pt-8 sm:pb-16 md:px-6 mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-6"
        >
          {displayStats.map((stat, index) => (
            <Card key={index} className="border border-zinc-200/50 dark:border-zinc-850 shadow-md bg-white dark:bg-zinc-900">
              <CardContent className="flex flex-col items-center space-y-3 p-4 text-center sm:p-5 lg:space-y-4 lg:p-6">
                <div className={`rounded-2xl p-3 sm:p-4 ${stat.bg} ${stat.color}`}>
                  <stat.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight sm:text-3xl text-slate-900 dark:text-zinc-550">{stat.value}</h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 mt-1">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      </section>

      {/* 2. ACETERNITY FEATURE: Bento Grid */}
      <section className="w-full bg-white pt-8 pb-16 dark:bg-black sm:pt-10 md:pt-14 md:pb-28">
         <div className="container px-4 md:px-6 mx-auto">
            <div className="text-center mb-16">
                 <h2 className="text-3xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-zinc-50">Keunggulan Kami</h2>
                 <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Fasilitas dan program unggulan untuk mendukung tumbuh kembang siswa secara maksimal.</p>
            </div>
            <BentoGrid className="max-w-4xl mx-auto">
                {features.map((item, i) => (
                    <BentoGridItem
                        key={i}
                        title={item.title}
                        description={item.description}
                        header={item.header}
                        icon={item.icon}
                        className={i === 1 ? "md:col-span-1" : ""}
                    />
                ))}
            </BentoGrid>
         </div>
      </section>

      {/* SPMB CTA Section */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 text-zinc-900 dark:text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff22_1px,transparent_1px)] [background-size:20px_20px] opacity-50" />
        
        <div className="container relative z-10 px-4 md:px-6 mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 border-none backdrop-blur-md px-4 py-1.5 text-sm">
                {activePeriod?.academic_year || "Tahun Ajaran Baru"}
              </Badge>
              <h2 className="text-3xl md:text-5xl font-bold leading-tight">
                Bergabunglah Menjadi Bagian dari Keluarga Besar Kami
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 text-lg leading-relaxed">
                Proses pendaftaran mudah dan transparan melalui SPMB Jalur Domisili.
                Pantau status pendaftaran secara real-time.
              </p>

              <div className="flex flex-wrap gap-4 pt-4">
                {settings?.spmb_is_open && (
                  <Link href="/spmb/daftar">
                    <Button size="lg" className="rounded-full h-12 px-8 text-base bg-primary text-white hover:bg-primary/90 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100">
                      Daftar Sekarang
                    </Button>
                  </Link>
                )}
                <Link href="/spmb/tracking">
                  <Button size="lg" variant="outline" className="rounded-full h-12 px-8 text-base border-zinc-300 dark:border-white/20 bg-transparent text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-white/10">
                    Cek Status Pendaftaran
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative hidden lg:block">
              {/* Map Visualization */}
              <div className="relative z-10 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-xl rounded-2xl p-6 border border-zinc-200 dark:border-white/10 shadow-2xl">
                <div className="aspect-[4/3] rounded-lg bg-zinc-100 dark:bg-zinc-900/50 relative overflow-hidden border border-zinc-200 dark:border-white/5">
                  <div className="absolute inset-0 w-full h-full">
                    <SchoolMap 
                      lat={settings?.school_lat || -2.072254} 
                      lng={settings?.school_lng || 101.395614}
                      schoolName={settings?.school_name} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* News Section */}
      <section className="py-12 md:py-20 bg-zinc-50 dark:bg-zinc-950/50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Kabar Terbaru</h2>
              <p className="text-muted-foreground text-lg">Informasi terkini seputar kegiatan dan prestasi sekolah.</p>
            </div>
            <Link href="/berita">
              <Button variant="outline" className="rounded-full">
                Lihat Semua Berita
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>

          {news.length > 0 ? (
            <div className={cn(
              "grid gap-8",
              news.length === 1 ? "max-w-md mx-auto" : "md:grid-cols-2 lg:grid-cols-3"
            )}>
              {news.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Card className="h-full border-none shadow-lg hover:shadow-xl transition-all duration-300 group bg-white dark:bg-zinc-900 overflow-hidden flex flex-col">
                    <div className="aspect-video relative overflow-hidden bg-muted">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                          onError={(e) => {
                            const fallbackLogo = settings?.school_logo 
                              ? (settings.school_logo.startsWith("http") || settings.school_logo.startsWith("/") 
                                ? settings.school_logo 
                                : `/uploads/${settings.school_logo}`) 
                              : "/logo.png";
                            e.currentTarget.src = fallbackLogo; 
                            e.currentTarget.className = "absolute inset-0 w-full h-full object-contain p-8 opacity-20";
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center">
                          <Newspaper className="h-10 w-10 text-muted-foreground/20" />
                        </div>
                      )}
                    </div>
                    <CardHeader>
                      <CardTitle className="text-xl group-hover:text-primary transition-colors line-clamp-2">
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between">
                      <div className="prose prose-sm dark:prose-invert line-clamp-2 mb-6 text-muted-foreground" dangerouslySetInnerHTML={{ __html: item.content || "" }} />
                      <Link href={`/berita/detail?slug=${item.slug || item.id}`} className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors mt-auto">
                        Baca Selengkapnya
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="col-span-full py-12 text-center text-muted-foreground bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
              <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Belum ada berita terbaru yang dipublikasikan.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
