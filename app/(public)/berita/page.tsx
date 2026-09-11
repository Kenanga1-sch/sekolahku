"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Calendar, ArrowLeft, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { goGet } from "@/lib/api-client";
import { normalizePublicPath } from "@/lib/utils";
import { Reveal } from "@/components/public/motion";

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  category?: string | null;
  thumbnail?: string | null;
  published_at?: string | null;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function BeritaPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await goGet<NewsItem[]>("/api/public/news");
        if (!cancelled) {
          setNews(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Gagal memuat berita. Coba lagi nanti.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-public-bg">
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-emerald-800 hover:text-emerald-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Beranda
        </Link>

        <header className="mb-10">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-emerald-700">
            <Newspaper className="h-4 w-4" />
            Berita Sekolah
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a2e1a] sm:text-4xl">
            Berita &amp; Pengumuman
          </h1>
          <p className="mt-3 text-[#4b6b4b]">
            Informasi terbaru dari UPTD SDN 1 Kenanga Sindang, Indramayu.
          </p>
        </header>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border border-public-border bg-white shadow-sm"
              />
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </p>
        )}

        {!loading && !error && news.length === 0 && (
          <div className="rounded-xl border border-public-border bg-white p-12 text-center shadow-sm">
            <Newspaper className="mx-auto mb-4 h-12 w-12 text-emerald-300" />
            <h2 className="text-lg font-semibold text-[#1a2e1a]">
              Belum ada berita
            </h2>
            <p className="mt-2 text-sm text-[#4b6b4b]">
              Pengumuman dari sekolah akan tampil di halaman ini.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {news.map((item, i) => (
            <Reveal key={item.id} delay={i * 50}>
              <Link
                href={`/berita/detail?slug=${encodeURIComponent(item.slug)}`}
                className="block rounded-xl border border-public-border bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <article className="flex flex-col gap-4 sm:flex-row">
                  {item.thumbnail && (
                    <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg sm:w-44">
                      <Image
                        src={normalizePublicPath(item.thumbnail)}
                        alt={item.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {item.category && (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          {item.category}
                        </Badge>
                      )}
                      {item.published_at && (
                        <span className="flex items-center gap-1 text-xs text-[#4b6b4b]">
                          <Calendar className="h-3 w-3" />
                          {formatDate(item.published_at)}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold leading-snug text-[#1a2e1a]">
                      {item.title}
                    </h2>
                    {item.excerpt && (
                      <p className="mt-1 line-clamp-2 text-sm text-[#4b6b4b]">
                        {item.excerpt}
                      </p>
                    )}
                  </div>
                </article>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
