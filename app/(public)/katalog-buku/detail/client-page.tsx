"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Book, Calendar, CheckCircle2, Clock, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPublicBook, type PublicBook } from "@/lib/library/public-catalog";
import { CATEGORIES } from "../constants";
import { showError, showSuccess } from "@/lib/toast";

export default function BookDetailClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [book, setBook] = useState<PublicBook | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (id) loadBook(id);
    else router.push("/katalog-buku");
  }, [id]);

  const loadBook = async (bookId: string) => {
    setLoading(true);
    try {
      const data = await getPublicBook(bookId);
      if (data) {
        setBook(data);
      } else {
        showError("Buku tidak ditemukan");
        router.push("/katalog-buku");
      }
    } catch (error) {
      console.error("Failed to load book:", error);
      showError("Gagal memuat detail buku");
      router.push("/katalog-buku");
    } finally {
      setLoading(false);
    }
  };

  const copyISBN = () => {
    if (!book?.isbn) return;
    navigator.clipboard.writeText(book.isbn);
    showSuccess("ISBN berhasil disalin!");
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
        <p className="text-muted-foreground">Memuat detail buku...</p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <Book className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Buku Tidak Ditemukan</h1>
        <p className="text-muted-foreground mb-6">Maaf, buku yang Anda cari tidak tersedia dalam katalog.</p>
        <Link href="/katalog-buku">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali ke Katalog
          </Button>
        </Link>
      </div>
    );
  }

  const isAvailable = book.availableCount > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/katalog-buku">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{book.title}</h1>
          <p className="text-muted-foreground">Klik "Pinjam Buku" jika Anda ingin memesan buku ini.</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Cover & Availability */}
        <Card className="md:col-span-1">
          <CardContent className="p-4 space-y-4">
            <div className="aspect-[3/4] bg-muted rounded-lg overflow-hidden flex items-center justify-center">
              {book.cover ? (
                <img
                  src={book.cover}
                  alt={book.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/images/placeholder-book.png";
                  }}
                />
              ) : (
                <Book className="h-12 w-12 text-muted-foreground/40" />
              )}
            </div>

            {/* Status Card */}
            <div className="space-y-2">
              <div className={`p-3 rounded-lg ${isAvailable ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {isAvailable ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <X className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-semibold">{isAvailable ? "Tersedia" : "Habis"}</span>
                </div>
                <div className="text-sm">
                  <p>
                    {book.availableCount} dari {book.totalExemplars} eksemplar tersedia
                  </p>
                  {!isAvailable && (
                    <p className="text-muted-foreground mt-1 text-xs italic">
                      Silakan coba lagi nanti atau hubungi petugas perpustakaan.
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Action Button (Login required) */}
              {isAvailable && (
                <Link href={`/login?redirect=/perpustakaan/booking-baru?asset=${book.id}`}>
                  <Button className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2 rotate-180" />
                    Pinjam Buku
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Book Details */}
        <Card className="md:col-span-2">
          <CardContent className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-muted-foreground w-24 flex-shrink-0">Penulis</span>
                <span className="text-base">{book.author || "-"}</span>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-muted-foreground w-24 flex-shrink-0">Penerbit</span>
                <span className="text-base">{book.publisher || "-"}</span>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-muted-foreground w-24 flex-shrink-0">Tahun</span>
                <span className="text-base">{book.year || "-"}</span>
              </div>

              <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-muted-foreground w-24 flex-shrink-0">Kategori</span>
                <Badge variant="secondary">
                  {CATEGORIES.find((c) => c.value === book.category)?.label || book.category}
                </Badge>
              </div>
            </div>

            {/* ISBN */}
            {book.isbn && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">ISBN</span>
                  <Button variant="ghost" size="sm" onClick={copyISBN} className="h-6 text-xs">
                    <Copy className="h-3 w-3 mr-1" />
                    Salin
                  </Button>
                </div>
                <code className="block p-2 bg-muted rounded-md text-sm font-mono break-all">
                  {book.isbn}
                </code>
              </div>
            )}

            {/* Description */}
            {book.description && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground block">Deskripsi</span>
                <p className="text-sm text-muted-foreground leading-relaxed">{book.description}</p>
              </div>
            )}

            {/* Metadata Footer */}
            <div className="pt-4 border-t">
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Ditambahkan: {new Date(book.createdAt).toLocaleDateString("id-ID")}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Terupdate: {new Date(book.updatedAt).toLocaleDateString("id-ID")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Related Information */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-3">Informasi Tambahan</h3>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Total Eksemplar:</strong> {book.totalExemplars}
            </div>
            <div>
              <strong>Kode QR:</strong>
              <code className="ml-2 px-2 py-1 bg-muted rounded text-xs font-mono">{book.id}</code>
            </div>
            <div>
              <strong>Status Aset:</strong> {book.status}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
