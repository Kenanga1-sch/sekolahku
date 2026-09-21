"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Book, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, TablePagination } from "@/components/data-table";
import { getPublicBooks, type PublicBook, GetPublicBooksOptions } from "@/lib/library/public-catalog";
import { getAllDDCCategories } from "@/lib/library/ddc-mapping";
import { useSortableData } from "@/hooks/use-sortable-data";

// Category constants from DDC mapping (matches backend)
const CATEGORIES = [
  { value: "000_COMPUTER", label: "000 - Komputer & Informasi" },
  { value: "100_PHILOSOPHY", label: "100 - Filsafat & Psikologi" },
  { value: "200_RELIGION", label: "200 - Agama" },
  { value: "300_SOCIAL", label: "300 - Ilmu Sosial" },
  { value: "400_LANGUAGE", label: "400 - Bahasa" },
  { value: "500_SCIENCE", label: "500 - Sains & Matematika" },
  { value: "600_TECHNOLOGY", label: "600 - Teknologi & Kesehatan" },
  { value: "700_ART", label: "700 - Seni & Olahraga" },
  { value: "800_LITERATURE", label: "800 - Sastra" },
  { value: "900_HISTORY", label: "900 - Sejarah & Geografi" },
];

const DEFAULT_PAGE_SIZE = 20;

export default function PublicCatalogPage() {
  const [books, setBooks] = useState<PublicBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);

  const { sortedData: sortedBooks, sortConfig, requestSort } = useSortableData(books);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold tracking-tight mb-3">Katalog Perpustakaan</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Jelajahi koleksi buku perpustakaan sekolah kami. Tampilkan ketersediaan buku secara real-time.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari judul, penulis, atau ISBN..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            
            {/* Category Filter Dropdown */}
            <div className="w-[180px]">
              <label className="text-sm text-muted-foreground mb-1 block">Kategori</label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">Semua Kategori</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Items per page */}
            <div className="w-[120px]">
              <label className="text-sm text-muted-foreground mb-1 block">Baris</label>
              <select
                value={perPage.toString()}
                onChange={(e) => {
                  setPerPage(parseInt(e.target.value));
                  setPage(1);
                }}
                className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="10">10 Baris</option>
                <option value="20">20 Baris</option>
                <option value="50">50 Baris</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {!loading && (
        <div className="text-sm text-muted-foreground">
          Menampilkan {books.length} dari {totalPages * perPage} buku tersedia
        </div>
      )}

      {/* Table */}
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
                  <img
                    src={book.cover}
                    alt={book.title}
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
              <Link href={`/perpustakaan/buku/${book.id}`}>
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
                <Badge
                  variant={book.availableCount > 0 ? "default" : "destructive"}
                >
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

      {/* Pagination */}
      {!loading && books.length > 0 && (
        <TablePagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          label={`${books.length} buku`}
        />
      )}
    </div>
  );
}
