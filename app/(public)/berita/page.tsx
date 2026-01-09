"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  ArrowRight,
  Search,
  Newspaper,
  Megaphone,
  Award,
  Users,
} from "lucide-react";

// Sample news data
const allNews = [
  {
    id: 1,
    title: "Pembukaan Pendaftaran Siswa Baru Tahun Ajaran 2024/2025",
    excerpt: "Pendaftaran siswa baru telah dibuka secara online. Daftarkan putra-putri Anda sekarang melalui sistem SPMB terintegrasi.",
    date: "2024-01-15",
    category: "spmb",
    featured: true,
  },
  {
    id: 2,
    title: "Prestasi Gemilang di Olimpiade Matematika Tingkat Provinsi",
    excerpt: "Siswa SD Negeri 1 berhasil meraih medali emas dalam Olimpiade Matematika tingkat provinsi yang diselenggarakan di Jakarta.",
    date: "2024-01-10",
    category: "prestasi",
    featured: true,
  },
  {
    id: 3,
    title: "Kegiatan Pentas Seni Akhir Tahun 2023",
    excerpt: "Sekolah mengadakan pentas seni tahunan yang diikuti oleh seluruh siswa dengan berbagai pertunjukan menarik.",
    date: "2024-01-05",
    category: "kegiatan",
    featured: false,
  },
  {
    id: 4,
    title: "Peringatan Hari Guru Nasional 2023",
    excerpt: "SD Negeri 1 mengadakan acara peringatan Hari Guru Nasional dengan berbagai kegiatan apresiasi untuk para pendidik.",
    date: "2023-11-25",
    category: "kegiatan",
    featured: false,
  },
  {
    id: 5,
    title: "Juara Umum Lomba Cerdas Cermat Tingkat Kecamatan",
    excerpt: "Tim cerdas cermat sekolah berhasil meraih juara umum dalam kompetisi antar sekolah dasar se-kecamatan.",
    date: "2023-11-20",
    category: "prestasi",
    featured: false,
  },
  {
    id: 6,
    title: "Pengumuman Libur Akhir Semester Ganjil",
    excerpt: "Informasi jadwal libur akhir semester ganjil tahun ajaran 2023/2024 untuk seluruh siswa.",
    date: "2023-12-15",
    category: "pengumuman",
    featured: false,
  },
];

const categories = [
  { value: "all", label: "Semua", icon: Newspaper },
  { value: "spmb", label: "SPMB", icon: Users },
  { value: "prestasi", label: "Prestasi", icon: Award },
  { value: "kegiatan", label: "Kegiatan", icon: Calendar },
  { value: "pengumuman", label: "Pengumuman", icon: Megaphone },
];

function getCategoryColor(category: string) {
  switch (category) {
    case "spmb": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "prestasi": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "kegiatan": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "pengumuman": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    default: return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

function getCategoryLabel(category: string) {
  return categories.find(c => c.value === category)?.label || category;
}

export default function BeritaPage() {
  const featuredNews = allNews.filter(news => news.featured);
  
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-blue-50/50 dark:bg-blue-900/10" />
        <div className="absolute -top-20 -right-20 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />

        <div className="container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center space-y-6"
          >
            <Badge variant="outline" className="px-4 py-1.5 rounded-full">
              <Newspaper className="h-3 w-3 mr-1" />
              Berita & Pengumuman
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Kabar Terbaru
            </h1>
            <p className="text-lg text-muted-foreground">
              Informasi terkini seputar kegiatan, prestasi, dan pengumuman penting dari sekolah.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Featured News */}
      <section className="py-12 -mt-8 relative z-10">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid md:grid-cols-2 gap-6"
          >
            {featuredNews.map((news, index) => (
              <Card
                key={news.id}
                className="border-none shadow-xl bg-white dark:bg-zinc-900 overflow-hidden group hover:shadow-2xl transition-shadow"
              >
                <div className="aspect-video bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 relative">
                  <div className="absolute top-4 left-4">
                    <Badge className={getCategoryColor(news.category)}>
                      {getCategoryLabel(news.category)}
                    </Badge>
                  </div>
                  <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">
                    Featured
                  </Badge>
                </div>
                <CardHeader>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(news.date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors line-clamp-2">
                    {news.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground line-clamp-2 mb-4">{news.excerpt}</p>
                  <Link href={`/berita/${news.id}`}>
                    <Button variant="link" className="p-0 h-auto gap-2">
                      Baca Selengkapnya
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        </div>
      </section>

      {/* All News with Filter */}
      <section className="py-16">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <h2 className="text-2xl font-bold">Semua Berita</h2>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari berita..." className="pl-10" />
            </div>
          </div>

          <Tabs defaultValue="all" className="space-y-8">
            <TabsList className="bg-zinc-100/50 dark:bg-zinc-900/50 p-1.5 rounded-full shadow-inner h-auto flex-wrap backdrop-blur-sm border border-black/5 dark:border-white/5">
              {categories.map((cat) => (
                <TabsTrigger
                  key={cat.value}
                  value={cat.value}
                  className="rounded-full data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm gap-2 px-6 py-2.5 transition-all"
                >
                  <cat.icon className="h-4 w-4" />
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="mt-0">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {allNews.map((news, index) => (
                  <motion.div
                    key={news.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="h-full border-none shadow-lg hover:shadow-xl transition-all group bg-white dark:bg-zinc-900">
                      <div className="aspect-video bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 relative">
                        <div className="absolute top-3 left-3">
                          <Badge className={getCategoryColor(news.category)}>
                            {getCategoryLabel(news.category)}
                          </Badge>
                        </div>
                      </div>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(news.date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-2">
                          {news.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {news.excerpt}
                        </p>
                        <Link
                          href={`/berita/${news.id}`}
                          className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 gap-1"
                        >
                          Selengkapnya
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            </TabsContent>

            {/* Filter by category tabs */}
            {categories.slice(1).map((cat) => (
              <TabsContent key={cat.value} value={cat.value} className="mt-0">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {allNews
                    .filter((news) => news.category === cat.value)
                    .map((news, index) => (
                      <motion.div
                        key={news.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="h-full border-none shadow-lg hover:shadow-xl transition-all group bg-white dark:bg-zinc-900">
                          <div className="aspect-video bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 relative">
                            <div className="absolute top-3 left-3">
                              <Badge className={getCategoryColor(news.category)}>
                                {getCategoryLabel(news.category)}
                              </Badge>
                            </div>
                          </div>
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(news.date).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-2">
                              {news.title}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {news.excerpt}
                            </p>
                            <Link
                              href={`/berita/${news.id}`}
                              className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 gap-1"
                            >
                              Selengkapnya
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                </motion.div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>
    </div>
  );
}
