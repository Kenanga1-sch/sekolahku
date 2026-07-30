"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, Newspaper, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MediaEmbed } from "@/components/ui/media-embed";
import { containerVariants, itemVariants, newsCategories } from "../use-landing";
import type { Announcement } from "@/types";

interface BeritaSectionProps {
  landingTexts: { news_desc: string };
  news: Announcement[];
  newsSearch: string;
  setNewsSearch: (v: string) => void;
  newsFilter: string;
  setNewsFilter: (v: string) => void;
  filteredNews: Announcement[];
  selectedNews: Announcement | null;
  setSelectedNews: (v: Announcement | null) => void;
}

export function BeritaSection({ landingTexts, news, newsSearch, setNewsSearch, newsFilter, setNewsFilter, filteredNews, selectedNews, setSelectedNews }: BeritaSectionProps) {
  return (
    <>
      <section id="berita" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-20%" }} variants={containerVariants}
          className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6">
          <motion.div variants={itemVariants} className="space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Berita & Pengumuman</h2>
            <p className="text-zinc-400 leading-relaxed text-sm">{landingTexts.news_desc}</p>
          </motion.div>
          <motion.div variants={itemVariants} className="space-y-4">
            {news.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-500 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800">Belum ada kabar sekolah.</div>
            ) : (
              news.slice(0, 2).map((item) => (
                <div key={item.id} onClick={() => setSelectedNews(item)}
                  className="group flex flex-col rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-900/40 hover:bg-zinc-900/60 active:scale-[0.98] active:translate-y-[1px] transition-all duration-300 cursor-pointer backdrop-blur-md">
                  {item.thumbnail && (
                    <div className="h-44 w-full relative overflow-hidden bg-zinc-950 shrink-0">
                      <MediaEmbed url={item.thumbnail} alt={item.title} fill className="absolute inset-0 w-full h-full transition-transform group-hover:scale-105 duration-500" />
                    </div>
                  )}
                  <div className="p-5 space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <Badge className="bg-zinc-900/80 text-zinc-300 border border-zinc-800/80">{item.category}</Badge>
                      <span className="text-zinc-500 flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(item.published_at || 0).toLocaleDateString("id-ID")}</span>
                    </div>
                    <h4 className="font-bold text-sm text-zinc-100 line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors">{item.title}</h4>
                    <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">{item.excerpt || (item.content ? item.content.replace(/<[^>]*>/g, "") : "")}</p>
                  </div>
                </div>
              ))
            )}
            <Link href="/berita" className="block">
              <Button variant="outline" className="w-full h-11 rounded-full border-zinc-800 bg-zinc-900/20 text-zinc-200 hover:bg-zinc-900/60 font-bold transition-all mt-2 active:scale-[0.98] active:translate-y-[1px]">
                Lihat Semua Berita & Pengumuman
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* News Detail Sheet */}
      <Sheet open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-zinc-950 border-l border-zinc-900 text-zinc-50">
          <SheetHeader><SheetTitle className="text-white">Detail Berita</SheetTitle></SheetHeader>
          {selectedNews && (
            <div className="mt-6 space-y-5">
              {selectedNews.thumbnail && (
                <div className="w-full aspect-video relative rounded-xl overflow-hidden bg-zinc-900">
                  <MediaEmbed url={selectedNews.thumbnail} alt={selectedNews.title} fill className="object-cover" />
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-[10px] text-zinc-400">
                <Badge className="bg-zinc-800 text-zinc-300">{selectedNews.category}</Badge>
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(selectedNews.published_at || 0).toLocaleDateString("id-ID")}</span>
              </div>
              <h2 className="text-xl font-bold text-white">{selectedNews.title}</h2>
              <div className="text-sm text-zinc-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: selectedNews.content || "" }} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}