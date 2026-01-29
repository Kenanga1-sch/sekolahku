"use client";

import { useState, useCallback } from "react";
import useSWR, { mutate } from "swr";
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Loader2,
  Search,
  Filter,
  Pencil,
  CheckSquare,
  MoreHorizontal,
  LayoutGrid,
  List,
  ArrowUpDown,
  Eye,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

// Components
import { GalleryStatsCards } from "@/components/gallery/stats-cards";
import { EnhancedUploadZone } from "@/components/gallery/upload-zone";
import { ImageLightbox } from "@/components/gallery/image-lightbox";

interface GalleryItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  createdAt: string;
}

interface GalleryStats {
  total: number;
  categories: Record<string, number>;
  storage: { used: number; unit: string };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const categories = [
  { value: "all", label: "Semua Kategori" },
  { value: "kegiatan", label: "Kegiatan Sekolah" },
  { value: "fasilitas", label: "Fasilitas" },
  { value: "prestasi", label: "Prestasi" },
  { value: "lainnya", label: "Lainnya" },
];

const sortOptions = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "a-z", label: "A - Z" },
  { value: "z-a", label: "Z - A" },
];

type ViewMode = "grid" | "list";
type SortMode = "newest" | "oldest" | "a-z" | "z-a";

export default function AdminGalleryPage() {
  // Data fetching
  const [filterCategory, setFilterCategory] = useState("all");
  const { data: galleryData, isLoading } = useSWR(
    `/api/gallery?category=${filterCategory}`,
    fetcher
  );
  const { data: statsData, isLoading: statsLoading } = useSWR<{ total: number; categories: Record<string, number>; storage: { used: number; unit: string } }>(
    "/api/gallery/stats",
    fetcher
  );

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Dialogs
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);

  // Data
  const galleryItems = (galleryData?.data as GalleryItem[]) || [];
  const stats: GalleryStats | null = statsData || null;

  // Filter and sort
  const processedItems = galleryItems
    .filter((item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortMode) {
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "a-z":
          return a.title.localeCompare(b.title);
        case "z-a":
          return b.title.localeCompare(a.title);
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  // Lightbox navigation
  const currentLightboxIndex = lightboxItem
    ? processedItems.findIndex((i) => i.id === lightboxItem.id)
    : -1;

  // Selection handlers
  const toggleSelection = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedItems.length === processedItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(processedItems.map((item) => item.id));
    }
  };

  // Actions
  const refreshData = () => {
    mutate(`/api/gallery?category=${filterCategory}`);
    mutate("/api/gallery/stats");
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Hapus ${selectedItems.length} foto terpilih?`)) return;

    try {
      const res = await fetch("/api/gallery/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedItems }),
      });

      if (!res.ok) throw new Error("Gagal menghapus");

      toast.success(`${selectedItems.length} foto berhasil dihapus`);
      setSelectedItems([]);
      setIsSelectionMode(false);
      refreshData();
    } catch (error) {
      toast.error("Gagal menghapus foto");
    }
  };

  const handleSingleDelete = async (id: string) => {
    if (!confirm("Hapus foto ini?")) return;
    try {
      await fetch(`/api/gallery/${id}`, { method: "DELETE" });
      toast.success("Foto dihapus");
      refreshData();
    } catch (error) {
      toast.error("Gagal menghapus");
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingItem) return;

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const category = formData.get("category") as string;

    try {
      const res = await fetch(`/api/gallery/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category }),
      });

      if (!res.ok) throw new Error("Gagal update");

      toast.success("Foto diperbarui");
      setIsEditOpen(false);
      setEditingItem(null);
      refreshData();
    } catch (error) {
      toast.error("Gagal update foto");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Galeri Digital
          </h1>
          <p className="text-muted-foreground">
            Pusat media dan dokumentasi sekolah
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={refreshData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isSelectionMode ? (
            <>
              <Button variant="outline" onClick={() => setIsSelectionMode(false)}>
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={selectedItems.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus ({selectedItems.length})
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsSelectionMode(true)}>
                <CheckSquare className="mr-2 h-4 w-4" />
                Pilih
              </Button>
              <Button onClick={() => setIsUploadOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <GalleryStatsCards stats={stats} isLoading={statsLoading} />

      {/* Toolbar */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
        <div className="p-4 flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari foto..."
              className="pl-10 h-11 bg-white dark:bg-zinc-800"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full lg:w-[180px] h-11">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <SelectTrigger className="w-full lg:w-[140px] h-11">
                <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                className="rounded-none h-11 w-11"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                className="rounded-none h-11 w-11"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        {processedItems.length > 0 && (
          <div className="px-4 pb-3 text-sm text-muted-foreground">
            Menampilkan {processedItems.length} dari {galleryItems.length} foto
          </div>
        )}
      </Card>

      {/* Selection Bar */}
      {isSelectionMode && processedItems.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <Checkbox
            checked={
              selectedItems.length === processedItems.length &&
              processedItems.length > 0
            }
            onCheckedChange={selectAll}
            id="select-all"
          />
          <Label htmlFor="select-all" className="cursor-pointer font-medium">
            Pilih Semua ({processedItems.length})
          </Label>
          <span className="text-muted-foreground">
            • {selectedItems.length} dipilih
          </span>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Memuat galeri...</p>
        </div>
      ) : processedItems.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <ImageIcon className="h-16 w-16 mb-4 text-muted-foreground/30" />
            <p className="text-xl font-semibold mb-1">Tidak ada foto</p>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "Coba ubah kata kunci pencarian" : "Upload foto pertama Anda"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsUploadOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Upload Foto
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {processedItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                "group relative aspect-square rounded-xl overflow-hidden border bg-card cursor-pointer transition-all duration-200",
                selectedItems.includes(item.id)
                  ? "ring-2 ring-primary border-primary shadow-lg"
                  : "hover:shadow-xl hover:scale-[1.02]"
              )}
              onClick={() =>
                isSelectionMode ? toggleSelection(item.id) : setLightboxItem(item)
              }
            >
              <Image
                src={item.imageUrl}
                alt={item.title}
                fill
                className="object-cover"
              />

              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity flex flex-col justify-between p-3",
                  isSelectionMode || selectedItems.includes(item.id)
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                )}
              >
                <div className="flex justify-between items-start">
                  {isSelectionMode && (
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      className="data-[state=checked]:bg-primary border-white/70"
                    />
                  )}
                  {!isSelectionMode && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-white hover:bg-white/20 ml-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxItem(item);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" /> Lihat
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItem(item);
                            setIsEditOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSingleDelete(item.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="text-white">
                  <p className="font-semibold text-sm truncate">{item.title}</p>
                  <p className="text-xs text-white/70 capitalize">{item.category}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // List View
        <Card>
          <div className="divide-y">
            {processedItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                  selectedItems.includes(item.id) && "bg-primary/5"
                )}
                onClick={() =>
                  isSelectionMode ? toggleSelection(item.id) : setLightboxItem(item)
                }
              >
                {isSelectionMode && (
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => toggleSelection(item.id)}
                  />
                )}
                <div className="h-16 w-16 relative rounded-lg overflow-hidden bg-muted shrink-0">
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {item.category}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground hidden md:block">
                  {format(new Date(item.createdAt), "d MMM yyyy", {
                    locale: localeId,
                  })}
                </div>
                {!isSelectionMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem(item);
                          setIsEditOpen(true);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSingleDelete(item.id);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Upload Foto</DialogTitle>
          </DialogHeader>
          <EnhancedUploadZone
            onUploadComplete={refreshData}
            onClose={() => setIsUploadOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Foto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            {editingItem && (
              <div className="relative h-40 w-full rounded-lg overflow-hidden bg-muted mb-4">
                <Image
                  src={editingItem.imageUrl}
                  alt={editingItem.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-title">Judul</Label>
              <Input
                id="edit-title"
                name="title"
                defaultValue={editingItem?.title}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Kategori</Label>
              <Select name="category" defaultValue={editingItem?.category}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kegiatan">Kegiatan Sekolah</SelectItem>
                  <SelectItem value="fasilitas">Fasilitas</SelectItem>
                  <SelectItem value="prestasi">Prestasi</SelectItem>
                  <SelectItem value="lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit">Simpan Perubahan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <ImageLightbox
        item={lightboxItem}
        isOpen={!!lightboxItem}
        onClose={() => setLightboxItem(null)}
        onEdit={(item) => {
          setEditingItem(item);
          setIsEditOpen(true);
        }}
        onDelete={handleSingleDelete}
        hasNext={currentLightboxIndex < processedItems.length - 1}
        hasPrev={currentLightboxIndex > 0}
        onNext={() => {
          if (currentLightboxIndex < processedItems.length - 1) {
            setLightboxItem(processedItems[currentLightboxIndex + 1]);
          }
        }}
        onPrev={() => {
          if (currentLightboxIndex > 0) {
            setLightboxItem(processedItems[currentLightboxIndex - 1]);
          }
        }}
      />
    </div>
  );
}
