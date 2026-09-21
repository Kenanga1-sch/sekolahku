"use client";

import Link from "next/link";
import { Book, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PublicBook } from "@/lib/library/public-catalog";
import { CATEGORIES } from "./constants";

interface BookGridProps {
  books: PublicBook[];
  loading?: boolean;
}

function StockBadge({ book }: { book: PublicBook }) {
  const available = book.availableCount > 0;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-0 font-medium",
        available
          ? "bg-emerald-100 text-emerald-700"
          : "bg-red-100 text-red-700"
      )}
    >
      <Package className="h-3 w-3" />
      {available
        ? `${book.availableCount} tersedia`
        : "Stok habis"}
      {book.totalExemplars > 1 && (
        <span className="opacity-70">/ {book.totalExemplars}</span>
      )}
    </Badge>
  );
}

/** Skeleton kartu untuk keadaan memuat — menjaga layout stabil. */
export function BookGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[3/4] rounded-xl bg-muted" />
          <div className="mt-2 h-3.5 w-4/5 rounded bg-muted" />
          <div className="mt-1.5 h-3 w-3/5 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function BookGrid({ books, loading }: BookGridProps) {
  if (loading) return <BookGridSkeleton />;

  if (!books.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Book className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="font-medium">Belum ada buku</p>
        <p className="text-sm text-muted-foreground">
          Coba ubah kata kunci atau kategori pencarian.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
      {books.map((book) => (
        <Link
          key={book.id}
          href={`/katalog-buku/detail?id=${book.id}`}
          className="group flex flex-col"
        >
          {/* Cover — rasio 3/4 konsisten, mobile-first */}
          <div className="relative aspect-[3/4] rounded-xl overflow-hidden border bg-muted shadow-sm group-hover:shadow-md group-active:scale-[0.98] transition-all">
            {book.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={book.cover}
                alt={book.title}
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/images/placeholder-book.png";
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Book className="h-10 w-10 text-muted-foreground/30" />
              </div>
            )}

            {/* Badge stok mengambang di atas cover */}
            <div className="absolute top-2 left-2 right-2 flex">
              <StockBadge book={book} />
            </div>
          </div>

          {/* Metadata */}
          <div className="mt-2.5 flex flex-1 flex-col">
            <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {book.title}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {book.author || "Tanpa penulis"}
            </p>
            <div className="mt-1.5">
              <Badge variant="secondary" className="text-[10px] font-normal">
                {CATEGORIES.find((c) => c.value === book.category)?.label?.split(" - ")[0] ||
                  book.category}
              </Badge>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
