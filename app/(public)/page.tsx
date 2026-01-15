"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  pb,
  getSchoolSettings,
  getPublishedAnnouncements,
  getActiveSPMBPeriod,
  getFileUrl
} from "@/lib/pocketbase";
import type { SchoolSettings, Announcement, SPMBPeriod } from "@/types";

// Stats data
const stats = [
  { icon: Users, label: "Total Siswa", value: "450+", color: "text-blue-500", bg: "bg-blue-500/10" },
  { icon: GraduationCap, label: "Tenaga Pengajar", value: "32", color: "text-green-500", bg: "bg-green-500/10" },
  { icon: Award, label: "Prestasi", value: "50+", color: "text-amber-500", bg: "bg-amber-500/10" },
  { icon: BookOpen, label: "Ekstrakurikuler", value: "12", color: "text-purple-500", bg: "bg-purple-500/10" },
];

// Features for SPMB
const spmbFeatures = [
  "Pendaftaran online 24 jam",
  "Sistem zonasi terintegrasi",
  "Tracking status pendaftaran",
  "Upload dokumen digital",
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function HomePage() {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [news, setNews] = useState<Announcement[]>([]);
  const [activePeriod, setActivePeriod] = useState<SPMBPeriod | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const [settingsData, announcements, period] = await Promise.all([
          getSchoolSettings(),
          getPublishedAnnouncements(3),
          getActiveSPMBPeriod(),
        ]);
        setSettings(settingsData);
        setNews(announcements);
        setActivePeriod(period);
      } catch (error) {
        console.error("Initialization failed:", error);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950/50">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32 md:pt-40 md:pb-48">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] mix-blend-multiply animate-blob" />
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] mix-blend-multiply animate-blob animation-delay-2000" />
          <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-amber-500/20 rounded-full blur-[120px] mix-blend-multiply animate-blob animation-delay-4000" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02]" />
        </div>

        <div className="container relative z-10">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="flex flex-col items-center text-center max-w-4xl mx-auto space-y-8"
          >
            <motion.div variants={itemVariants}>
              {activePeriod ? (
                <Badge variant="outline" className="px-4 py-1.5 text-sm rounded-full border-primary/20 bg-primary/5 text-primary backdrop-blur-sm shadow-sm gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  Penerimaan Siswa Baru {activePeriod.academic_year} Dibuka!
                </Badge>
              ) : (
                <Badge variant="outline" className="px-4 py-1.5 text-sm rounded-full border-zinc-200 bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800">
                  Penerimaan Siswa Baru Sedang Ditutup
                </Badge>
              )}
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-blue-700 to-gray-900 dark:from-white dark:via-blue-400 dark:to-white pb-4 leading-tight"
            >
              Mewujudkan Generasi <br />
              <span className="text-primary relative inline-block">
                Cerdas
                <svg className="absolute w-full h-3 -bottom-1 left-0 text-amber-400 opacity-60" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                </svg>
              </span> & Berkarakter
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-xl md:text-2xl text-muted-foreground max-w-2xl leading-relaxed font-light"
            >
              {settings?.school_name || "SD Negeri 1"} berkomitmen memberikan pendidikan terbaik dengan kurikulum modern
              yang terintegrasi teknologi.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-4 pt-4">
              {settings?.spmb_is_open && (
                <Link href="/spmb/daftar">
                  <Button size="lg" className="rounded-full h-12 px-8 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all gap-2 group">
                    Daftar Sekarang
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              )}
              <Link href="/profil/visi-misi">
                <Button size="lg" variant="outline" className="rounded-full h-12 px-8 text-base hover:bg-muted/50 gap-2">
                  <PlayCircle className="h-4 w-4" />
                  Tentang Kami
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section Floating */}
      <section className="relative z-20 -mt-20 container px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8"
        >
          {stats.map((stat, index) => (
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

      {/* About Section */}
      <section className="py-32 relative overflow-hidden bg-white dark:bg-zinc-950">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] mask-image:linear-gradient(to_bottom,transparent,white,transparent)" />

        <div className="container px-4 md:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
                <Sparkles className="mr-2 h-4 w-4" />
                Keunggulan Kami
              </div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight text-gray-900 dark:text-white">
                Pendidikan Berkualitas untuk <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">Masa Depan Cerah</span>
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {settings?.school_name || "Sekolah kami"} menggabungkan kurikulum nasional dengan metode pembelajaran inovatif
                untuk mengembangkan potensi akademis dan non-akademis setiap siswa.
              </p>

              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                {[
                  "Kurikulum Merdeka Belajar",
                  "Fasilitas Modern & Lengkap",
                  "Guru Tersertifikasi",
                  "Ekstrakurikuler Beragam"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                    <div className="h-2 w-2 rounded-full bg-primary ring-4 ring-primary/20" />
                    <span className="font-medium text-lg">{item}</span>
                  </div>
                ))}
              </div>

              <div className="pt-6">
                <Link href="/profil/sejarah">
                  <Button variant="link" className="p-0 h-auto text-primary font-bold text-lg hover:no-underline group">
                    Pelajari Sejarah Sekolah
                    <ChevronRight className="h-5 w-5 ml-1 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="aspect-square rounded-[2.5rem] overflow-hidden border-8 border-white dark:border-zinc-800 shadow-2xl relative z-10 transition-transform hover:scale-[1.02] duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 flex flex-col items-center justify-center text-white p-8 text-center pattern-grid-lg">
                  <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl mb-6 shadow-inner ring-1 ring-white/20">
                    <GraduationCap className="h-20 w-20 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Lingkungan Belajar Kondusif</h3>
                  <p className="text-blue-100">Fasilitas lengkap untuk mendukung tumbuh kembang siswa</p>
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-500/20 rounded-full blur-[80px] -z-10 animate-pulse" />
              <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -z-10 animate-pulse animation-delay-1000" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* SPMB CTA Section */}
      <section className="py-24 bg-gradient-to-br from-zinc-900 to-zinc-950 text-white relative overflow-hidden">
        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-30" />

        <div className="container relative z-10 px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Badge className="bg-white/10 text-white hover:bg-white/20 border-none backdrop-blur-md px-4 py-1.5 text-sm">
                SPMB {activePeriod?.academic_year || "2024/2025"}
              </Badge>
              <h2 className="text-3xl md:text-5xl font-bold leading-tight">
                Bergabunglah Menjadi Bagian dari Keluarga Besar Kami
              </h2>
              <p className="text-zinc-400 text-lg leading-relaxed">
                Proses pendaftaran mudah dan transparan dengan sistem zonasi digital.
                Pantau status pendaftaran secara real-time.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {spmbFeatures.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg p-4 backdrop-blur-sm border border-white/5">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span className="font-medium">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 pt-4">
                {settings?.spmb_is_open && (
                  <Link href="/spmb/daftar">
                    <Button size="lg" className="rounded-full h-12 px-8 text-base bg-white text-zinc-900 hover:bg-zinc-100">
                      Daftar Sekarang
                    </Button>
                  </Link>
                )}
                <Link href="/spmb/tracking">
                  <Button size="lg" variant="outline" className="rounded-full h-12 px-8 text-base border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
                    Cek Status Pendaftaran
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative hidden lg:block">
              {/* Map Visualization Abstract */}
              <div className="relative z-10 bg-zinc-800/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
                <div className="aspect-[4/3] rounded-lg bg-zinc-900/50 relative overflow-hidden flex items-center justify-center border border-white/5">
                  <MapPin className="h-16 w-16 text-primary animate-bounce" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50" />
                </div>
                <div className="mt-6 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-zinc-400">Alamat Sekolah</p>
                    <p className="text-lg font-bold text-white line-clamp-1">{settings?.school_address || "Jakarta Pusat"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-400">Kuota Terbatas</p>
                    <p className="text-lg font-bold text-primary">{activePeriod?.quota || "100"} Siswa</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* News Section */}
      <section className="py-24 bg-zinc-50 dark:bg-zinc-950/50">
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

          <div className="grid md:grid-cols-3 gap-8">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <Card key={i} className="h-full overflow-hidden">
                  <div className="aspect-video bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                  <div className="p-6 space-y-4">
                    <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />
                    <div className="h-6 w-full bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />
                    <div className="h-4 w-2/3 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />
                  </div>
                </Card>
              ))
            ) : news.length > 0 ? (
              news.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Card className="h-full border-none shadow-lg hover:shadow-xl transition-all duration-300 group bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="aspect-video relative overflow-hidden bg-muted">
                      {item.thumbnail ? (
                        <img
                          src={getFileUrl(item, item.thumbnail)}
                          alt={item.title}
                          className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900" />
                      )}
                      <div className="absolute top-4 left-4">
                        <Badge className="bg-white/90 text-zinc-900 border-none backdrop-blur hover:bg-white shadow-sm capitalize">
                          {item.category || "Berita"}
                        </Badge>
                      </div>
                    </div>
                    <CardHeader>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Calendar className="h-4 w-4" />
                        {item.created ? new Date(item.created).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }) : "-"}
                      </div>
                      <CardTitle className="text-xl group-hover:text-primary transition-colors line-clamp-2">
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground line-clamp-2 mb-6">
                        {item.excerpt}
                      </p>
                      <Link href={`/berita/${item.slug || item.id}`} className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                        Baca Selengkapnya
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Belum ada berita terbaru yang dipublikasikan.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
