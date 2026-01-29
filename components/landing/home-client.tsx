"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll } from "framer-motion";
import {
  Users,
  GraduationCap,
  Award,
  BookOpen,
  ArrowRight,
  PlayCircle,
  CheckCircle,
  Sparkles,
  ChevronRight,
  MapPin,
  Calendar,
  Newspaper,
  LayoutDashboard,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import dynamic from 'next/dynamic';
import { AuroraBackground } from "@/components/ui/aurora-background";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";

const SchoolMap = dynamic(() => import('@/components/landing/school-map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
});

// Animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      stiffness: 50,
      damping: 20
    }
  },
};

interface HomeClientProps {
  settings: any | null; 
  news: any[];
  activePeriod: any | null;
  studentCount: number;
}

export function HomeClient({ settings, news, activePeriod, studentCount }: HomeClientProps) {
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
      header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-neutral-200 dark:from-neutral-900 dark:to-neutral-800 to-neutral-100 items-center justify-center"><BookOpen className="h-10 w-10 text-neutral-500" /></div>,
      icon: <LayoutDashboard className="h-4 w-4 text-neutral-500" />,
    },
    {
      title: "Fasilitas Modern",
      description: "Laboratorium komputer, perpustakaan digital, dan ruang kelas AC.",
      header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-neutral-200 dark:from-neutral-900 dark:to-neutral-800 to-neutral-100 items-center justify-center"><Zap className="h-10 w-10 text-neutral-500" /></div>,
      icon: <Sparkles className="h-4 w-4 text-neutral-500" />,
    },
    {
      title: "Lingkungan Aman",
      description: "Pengawasan CCTV 24 jam dan sistem keamanan terpadu satu pintu.",
      header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-neutral-200 dark:from-neutral-900 dark:to-neutral-800 to-neutral-100 items-center justify-center"><ShieldCheck className="h-10 w-10 text-neutral-500" /></div>,
      icon: <CheckCircle className="h-4 w-4 text-neutral-500" />,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950/50">
      
      {/* 1. ACETERNITY HERO: Aurora Background */}
      <AuroraBackground className="h-screen">
        <motion.div
          initial={{ opacity: 0.0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.3,
            duration: 0.8,
            ease: "easeInOut",
          }}
          className="relative flex flex-col gap-4 items-center justify-center px-4"
        >
          <div className="text-3xl md:text-7xl font-bold dark:text-white text-center">
             Mewujudkan Generasi <br />
             <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">Cerdas & Berkarakter</span>
          </div>
          
          <div className="font-light text-base md:text-2xl dark:text-neutral-200 py-4 max-w-2xl text-center">
             <TextGenerateEffect words={`${settings?.school_name || "SD Negeri 1"} berkomitmen memberikan pendidikan terbaik dengan kurikulum modern yang terintegrasi teknologi.`} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
             {settings?.spmb_is_open && (
                <Link href="/spmb/daftar">
                    <Button size="lg" className="bg-black dark:bg-white rounded-full w-fit text-white dark:text-black px-8 py-6 text-lg font-bold shadow-xl transition-transform hover:scale-105">
                      Daftar Sekarang
                    </Button>
                </Link>
             )}
             <Link href="/profil/visi-misi">
                <Button variant="outline" size="lg" className="rounded-full px-8 py-6 text-lg border-2 bg-transparent hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                     Tentang Kami
                </Button>
             </Link>
          </div>
        </motion.div>
      </AuroraBackground>

      {/* Stats Section */}
      <section className="relative z-20 -mt-20 container px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8"
        >
          {displayStats.map((stat, index) => (
            <Card key={index} className="border-none shadow-xl shadow-gray-200/50 dark:shadow-none bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold tracking-tight">{stat.value}</h3>
                  <p className="text-sm font-medium text-muted-foreground mt-1">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      </section>

      {/* 2. ACETERNITY FEATURE: Bento Grid */}
      <section className="py-20 md:py-32 bg-white dark:bg-black w-full">
         <div className="container px-4 md:px-6">
            <div className="text-center mb-16">
                 <h2 className="text-3xl md:text-5xl font-bold mb-4">Keunggulan Kami</h2>
                 <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Fasilitas dan program unggulan untuk mendukung tumbuh kembang siswa.</p>
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
        
        <div className="container relative z-10 px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 border-none backdrop-blur-md px-4 py-1.5 text-sm">
                {activePeriod?.academic_year || "Tahun Ajaran Baru"}
              </Badge>
              <h2 className="text-3xl md:text-5xl font-bold leading-tight">
                Bergabunglah Menjadi Bagian dari Keluarga Besar Kami
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 text-lg leading-relaxed">
                Proses pendaftaran mudah dan transparan dengan sistem zonasi digital.
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
                            e.currentTarget.src = "/logo.png"; 
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
                      <Link href={`/berita/${item.slug || item.id}`} className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors mt-auto">
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
