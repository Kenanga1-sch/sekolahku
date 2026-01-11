"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  ArrowRight,
  Search,
  Newspaper,
  Megaphone,
  Award,
  Users,
  RefreshCw,
} from "lucide-react";
import { pb } from "@/lib/pocketbase";
import type { Announcement } from "@/types";

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

// Fallback mock data if no data in PocketBase
const mockNews = [
  {
    id: "1",
    title: "Pembukaan Pendaftaran Siswa Baru Tahun Ajaran 2024/2025",
    excerpt: "Pendaftaran siswa baru telah dibuka secara online melalui sistem SPMB terintegrasi.",
    published_at: "2024-01-15",
    category: "spmb",
    is_featured: true,
  },
  {
    id: "2",
    title: "Prestasi Gemilang di Olimpiade Matematika",
    excerpt: "Siswa SD Negeri 1 berhasil meraih medali emas dalam Olimpiade Matematika tingkat provinsi.",
    published_at: "2024-01-10",
    category: "prestasi",
    is_featured: true,
  },
];

export default function BeritaPage() {
  const [news, setNews] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const result = await pb.collection("announcements").getFullList<Announcement>({
        filter: "is_published = true",
        sort: "-published_at",
      });

      if (result.length > 0) {
        setNews(result);
      } else {
        // Use mock data if no announcements in PocketBase
        setNews(mockNews as unknown as Announcement[]);
      }
    } catch (error) {
      console.error("Failed to fetch news:", error);
      setNews(mockNews as unknown as Announcement[]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredNews = news.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.excerpt || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeTab === "all" || item.category === activeTab;
    return matchesSearch && matchesCategory;
  });

  const featuredNews = news.filter(item => item.is_featured);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <section className="relative pt-32 pb-24">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <Skeleton className="h-8 w-48 mx-auto" />
              <Skeleton className="h-12 w-96 mx-auto" />
              <Skeleton className="h-6 w-80 mx-auto" />
            </div>
          </div>
        </section>
        <section className="py-12">
          <div className="container grid md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-video" />
                <CardHeader>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    );
  }

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
      {featuredNews.length > 0 && (
        <section className="py-12 -mt-8 relative z-10">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="grid md:grid-cols-2 gap-6"
            >
              {featuredNews.slice(0, 2).map((item) => (
                <Card
                  key={item.id}
                  className="border-none shadow-xl bg-white dark:bg-zinc-900 overflow-hidden group hover:shadow-2xl transition-shadow"
                >
                  <div className="aspect-video bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 relative">
                    <div className="absolute top-4 left-4">
                      <Badge className={getCategoryColor(item.category || "")}>
                        {getCategoryLabel(item.category || "")}
                      </Badge>
                    </div>
                    <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">
                      Featured
                    </Badge>
                  </div>
                  <CardHeader>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Calendar className="h-4 w-4" />
                      {item.published_at ? new Date(item.published_at).toLocaleDateString("id-ID", {
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
                    <p className="text-muted-foreground line-clamp-2 mb-4">{item.excerpt}</p>
                    <Link href={`/berita/${item.slug || item.id}`}>
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
      )}

      {/* All News with Filter */}
      <section className="py-16">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <h2 className="text-2xl font-bold">Semua Berita</h2>
            <div className="flex gap-4 items-center">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari berita..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => { setIsLoading(true); fetchNews(); }}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
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

            <TabsContent value={activeTab} className="mt-0">
              {filteredNews.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Tidak ada berita ditemukan</p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {filteredNews.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="h-full border-none shadow-lg hover:shadow-xl transition-all group bg-white dark:bg-zinc-900">
                        <div className="aspect-video bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 relative">
                          <div className="absolute top-3 left-3">
                            <Badge className={getCategoryColor(item.category || "")}>
                              {getCategoryLabel(item.category || "")}
                            </Badge>
                          </div>
                        </div>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {item.published_at ? new Date(item.published_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }) : "-"}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-2">
                            {item.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {item.excerpt}
                          </p>
                          <Link
                            href={`/berita/${item.slug || item.id}`}
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
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
