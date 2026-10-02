"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Calendar, ArrowLeft, Newspaper, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { goGet } from "@/lib/api-client";
import { sanitizeHTML, escapeHTML } from "@/lib/security";

interface NewsDetail {
  id: string;
  title: string;
  slug: string;
  content?: string | null;
  excerpt?: string | null;
  category?: string | null;
  thumbnail?: string | null;
  published_at?: string | null;
  author?: string | null;
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

function NewsDetailContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug");

  const [item, setItem] = useState<NewsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("Berita tidak ditemukan.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await goGet<NewsDetail>(
          `/api/public/news/${encodeURIComponent(slug)}`
        );
        if (!cancelled) setItem(data);
      } catch {
        if (!cancelled) setError("Berita tidak ditemukan atau sudah dihapus.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-3/4 animate-pulse rounded bg-emerald-100" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-emerald-100" />
        <div className="h-64 animate-pulse rounded-xl bg-emerald-100" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-12 text-center">
        <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-400" />
        <h2 className="text-lg font-semibold text-foreground">
          {error || "Berita tidak ditemukan"}
        </h2>
        <Link
          href="/berita"
          className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline"
        >
          Lihat semua berita
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {item.category && (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              {item.category}
            </Badge>
          )}
          {item.published_at && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(item.published_at)}
            </span>
          )}
          {item.author && (
            <span className="text-xs text-muted-foreground">
              Oleh {escapeHTML(item.author)}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {item.title}
        </h1>
        {item.excerpt && (
          <p className="mt-3 text-lg text-muted-foreground">{item.excerpt}</p>
        )}
      </header>

      {/* Konten rich-text disanitasi sebelum render — data berasal dari DB
          dan bisa jadi membawa payload dari editor. */}
      <div
        className="prose prose-emerald max-w-none text-foreground prose-img:rounded-lg prose-a:text-emerald-700"
        dangerouslySetInnerHTML={{ __html: sanitizeHTML(item.content ?? "") }}
      />

      <hr className="my-8 border-public-border" />

      <Link
        href="/berita"
        className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke daftar berita
      </Link>
    </article>
  );
}

export default function BeritaDetailPage() {
  return (
    <div className="min-h-screen bg-public-bg">
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <Link
          href="/berita"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-emerald-800 hover:text-emerald-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Berita
        </Link>
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-muted-foreground">
              <Newspaper className="h-4 w-4 animate-pulse" />
              Memuat…
            </div>
          }
        >
          <NewsDetailContent />
        </Suspense>
      </div>
    </div>
  );
}
