"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Book, Search, X, LayoutGrid, List, Loader2, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, TablePagination } from "@/components/data-table";
import { getPublicBooks, type PublicBook, GetPublicBooksOptions } from "@/lib/library/public-catalog";
import { useSortableData } from "@/hooks/use-sortable-data";
import { BookGrid } from "./book-grid";
import { CATEGORIES } from "./constants";

const PAGE_SIZE_OPTIONS = [12, 24, 48];
const DEFAULT_PAGE_SIZE = 24;
const VIEW_KEY = "katalog-view-mode";

type ViewMode = "grid" | "list";

export default function PublicCatalogPage() {
  const [books, setBooks] = useState<PublicBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Search: `searchInput` = nilai kotak (instan), `searchQuery` = yang di-fetch (debounced)
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);

  // Tampilan: default grid, dibaca dari localStorage setelah mount (hindari hydration mismatch)
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [viewReady, setViewReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Muat preferensi tampilan
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(VIEW_KEY) : null;
    if (saved === "list" || saved === "grid") setViewMode(saved);
    setViewReady(true);
  }, []);

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch {
      /* localStorage bisa diblokir; abaikan */
    }
  };

  // Debounce input pencarian (300ms) — hindari request tiap ketikan
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const options: GetPublicBooksOptions = {
        page,
        perPage,
        search: searchQuery || undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
      };
      const result = await getPublicBooks(options);
      setBooks(result.items || []);
      setTotalItems(result.totalItems || 0);
      setTotalPages(result.totalPages || 1);
    } catch (error) {
      console.error("Failed to load books:", error);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, searchQuery, categoryFilter]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const { sortedData: sortedBooks, sortConfig, requestSort } = useSortableData(books);

  const hasActiveFilter = searchQuery !== "" || categoryFilter !== "all";

  const resetFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setCategoryFilter("all");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 sm:mb-3">
          Katalog Perpustakaan
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto px-2">
          Jelajahi koleksi buku perpustakaan sekolah kami. Ketersediaan ditampilkan secara real-time.
        </p>
      </div>

      {/* Search & Filter — mobile-first: search di atas, filter di bawah */}
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3">
          {/* Search dengan tombol clear */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari judul, penulis, atau ISBN..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 pr-9 h-10"
              inputMode="search"
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Bersihkan pencarian"
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Baris filter: kategori + jumlah + toggle tampilan */}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 flex-1 min-w-[140px] text-sm">
                <SlidersHorizontal className="h-4 w-4 mr-1.5 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={perPage.toString()}
              onValueChange={(v) => {
                setPerPage(parseInt(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[104px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} / hal
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Toggle tampilan grid/list */}
            <div className="flex border rounded-md overflow-hidden shrink-0">
              <Button
                type="button"
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                aria-label="Tampilan grid"
                aria-pressed={viewMode === "grid"}
                className="rounded-none h-9 w-9"
                onClick={() => changeView("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                aria-label="Tampilan daftar"
                aria-pressed={viewMode === "list"}
                className="rounded-none h-9 w-9"
                onClick={() => changeView("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {hasActiveFilter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-9 text-muted-foreground"
              >
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ringkasan hasil */}
      {!loading && (
        <p className="text-sm text-muted-foreground px-1">
          {totalItems > 0
            ? `Menampilkan ${books.length} dari ${totalItems} judul buku`
            : "Tidak ada buku yang cocok"}
        </p>
      )}

      {/* Konten: grid (default) atau list */}
      {viewReady && viewMode === "grid" ? (
        <BookGrid books={sortedBooks} loading={loading} />
      ) : (
        <div className="rounded-lg border bg-card">
          <DataTable
            data={loading ? [] : sortedBooks}
            getRowId={(item) => item.id}
            loading={loading}
            sortConfig={sortConfig}
            onSort={requestSort}
            emptyTitle="Belum ada buku"
            emptyDescription="Gunakan filter untuk mencari koleksi yang ingin Anda pinjam."
            columns={[
              {
                key: "cover",
                header: "Sampul",
                card: "hidden",
                render: (book: PublicBook) => (
                  <div className="w-12 h-16 rounded overflow-hidden border bg-muted flex items-center justify-center">
                    {book.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={book.cover}
                        alt={book.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/images/placeholder-book.png";
                        }}
                      />
                    ) : (
                      <Book className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                ),
              },
              {
                key: "title",
                header: "Judul",
                sortable: true,
                card: "title",
                render: (book: PublicBook) => (
                  <Link href={`/katalog-buku/detail?id=${book.id}`}>
                    <p className="font-medium hover:text-primary transition-colors">{book.title}</p>
                  </Link>
                ),
              },
              {
                key: "author",
                header: "Penulis",
                sortable: true,
                card: "field",
                render: (book: PublicBook) => book.author || "-",
              },
              {
                key: "isbn",
                header: "ISBN",
                card: "field",
                render: (book: PublicBook) => book.isbn || "-",
              },
              {
                key: "category",
                header: "Kategori",
                sortable: true,
                card: "field",
                render: (book: PublicBook) => (
                  <Badge variant="secondary">
                    {CATEGORIES.find((c) => c.value === book.category)?.label || book.category}
                  </Badge>
                ),
              },
              {
                key: "availability",
                header: "Ketersediaan",
                sortable: false,
                card: "field",
                render: (book: PublicBook) => (
                  <div className="flex items-center gap-2">
                    <Badge variant={book.availableCount > 0 ? "default" : "destructive"}>
                      {book.availableCount} / {book.totalExemplars}
                    </Badge>
                    {book.availableCount === 0 && book.totalExemplars > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Habis
                      </Badge>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Paginasi */}
      {!loading && books.length > 0 && (
        <TablePagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          label={`${totalItems} judul`}
        />
      )}
    </div>
  );
}
