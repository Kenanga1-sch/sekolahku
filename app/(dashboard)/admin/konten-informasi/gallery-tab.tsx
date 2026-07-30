"use client";

import Image from "next/image";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { GalleryStatsCards } from "@/components/gallery/stats-cards";
import { EnhancedUploadZone } from "@/components/gallery/upload-zone";
import { ImageLightbox } from "@/components/gallery/image-lightbox";
import { Plus, Search, LayoutGrid, List, ArrowUpDown, Eye, Pencil, Trash2, MoreHorizontal, CheckSquare, Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { useGallery } from "./use-gallery";
import type { GallerySortMode } from "./use-gallery";

type GalleryHook = ReturnType<typeof useGallery>;

const galleryCategories = [
  { value: "all", label: "Semua Kategori" },
  { value: "kegiatan", label: "Kegiatan Sekolah" },
  { value: "fasilitas", label: "Fasilitas" },
  { value: "prestasi", label: "Prestasi" },
  { value: "lainnya", label: "Lainnya" },
];

const gallerySortOptions = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "a-z", label: "A - Z" },
  { value: "z-a", label: "Z - A" },
];

export function GalleryTab(hook: GalleryHook) {
  const {
    items, stats, isLoading, statsLoading, search, setSearch,
    filterCategory, setFilterCategory, viewMode, setViewMode, sortMode, setSortMode,
    selected, selectionMode, setSelectionMode, toggleSelection, selectAll,
    uploadOpen, setUploadOpen, editingItem, setEditingItem, editOpen, setEditOpen,
    lightboxItem, setLightboxItem, lightboxIndex,
    processed, refresh, handleBulkDelete, handleSingleDelete, handleUpdate,
  } = hook;

  const currentLightboxIndex = lightboxIndex;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <GalleryStatsCards stats={stats} isLoading={statsLoading} />

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari foto..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterCategory} onValueChange={(v: string) => setFilterCategory(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>{galleryCategories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sortMode} onValueChange={(v: string) => setSortMode(v as GallerySortMode)}>
            <SelectTrigger className="w-[140px]"><ArrowUpDown className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
            <SelectContent>{gallerySortOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md overflow-hidden">
            <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" className="rounded-none h-9 w-9" onClick={() => setViewMode("grid")}><LayoutGrid className="h-4 w-4" /></Button>
            <Button variant={viewMode === "list" ? "default" : "ghost"} size="icon" className="rounded-none h-9 w-9" onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
          </div>
          <Button variant={selectionMode ? "default" : "outline"} size="sm" onClick={() => { setSelectionMode(!selectionMode); if (selectionMode) selectAll(); }}>
            <CheckSquare className="h-4 w-4 mr-2" />Pilih
          </Button>
          {selectionMode && selected.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-2" />Hapus ({selected.length})
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={isLoading} onClick={refresh}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)}><Plus className="h-4 w-4 mr-2" />Upload Foto</Button>
        </div>
      </div>

      {/* Gallery Content */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {processed.map((item) => (
            <div key={item.id} className={cn("group relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer", selectionMode ? (selected.includes(item.id) ? "border-primary" : "border-transparent") : "hover:border-primary/50")}>
              {selectionMode && (
                <div className="absolute top-2 left-2 z-20">
                  <Checkbox checked={selected.includes(item.id)} onClick={() => toggleSelection(item.id)} />
                </div>
              )}
              <Image src={item.imageUrl} alt={item.title} fill className="object-cover" onClick={() => { if (!selectionMode) setLightboxItem(item); else toggleSelection(item.id); }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-0 left-0 right-0 p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <p className="text-xs text-white/70 capitalize">{item.category}</p>
              </div>
              {!selectionMode && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 bg-black/50 text-white hover:bg-black/70"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => setLightboxItem(item)}><Eye className="mr-2 h-4 w-4" /> Lihat</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditingItem(item); setEditOpen(true); }}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => handleSingleDelete(item.id)}><Trash2 className="mr-2 h-4 w-4" /> Hapus</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <div className="divide-y">
            {processed.map((item) => (
              <div key={item.id} className={cn("flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer", selected.includes(item.id) && "bg-primary/5")}
                onClick={() => selectionMode ? toggleSelection(item.id) : setLightboxItem(item)}>
                {selectionMode && <Checkbox checked={selected.includes(item.id)} onClick={(e) => e.stopPropagation()} onCheckedChange={() => toggleSelection(item.id)} />}
                <div className="h-16 w-16 relative rounded-lg overflow-hidden bg-muted shrink-0"><Image src={item.imageUrl} alt={item.title} fill className="object-cover" /></div>
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{item.title}</p><p className="text-sm text-muted-foreground capitalize">{item.category}</p></div>
                <div className="text-sm text-muted-foreground hidden md:block">{format(new Date(item.createdAt), "d MMM yyyy", { locale: idLocale })}</div>
                {!selectionMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingItem(item); setEditOpen(true); }}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleSingleDelete(item.id); }}><Trash2 className="mr-2 h-4 w-4" /> Hapus</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl">Upload Foto</DialogTitle></DialogHeader>
          <EnhancedUploadZone onUploadComplete={refresh} onClose={() => setUploadOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Foto</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            {editingItem && (
              <div className="relative h-40 w-full rounded-lg overflow-hidden bg-muted mb-4">
                <Image src={editingItem.imageUrl} alt={editingItem.title} fill className="object-cover" />
              </div>
            )}
            <div className="space-y-2"><Label htmlFor="edit-title">Judul</Label><Input id="edit-title" name="title" defaultValue={editingItem?.title} required /></div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Kategori</Label>
              <Select name="category" defaultValue={editingItem?.category}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kegiatan">Kegiatan Sekolah</SelectItem>
                  <SelectItem value="fasilitas">Fasilitas</SelectItem>
                  <SelectItem value="prestasi">Prestasi</SelectItem>
                  <SelectItem value="lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Batal</Button>
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
        onEdit={(item) => { setEditingItem(item); setEditOpen(true); }}
        onDelete={handleSingleDelete}
        hasNext={currentLightboxIndex >= 0 && currentLightboxIndex < processed.length - 1}
        hasPrev={currentLightboxIndex > 0}
        onNext={() => { if (currentLightboxIndex >= 0 && currentLightboxIndex < processed.length - 1) setLightboxItem(processed[currentLightboxIndex + 1]); }}
        onPrev={() => { if (currentLightboxIndex > 0) setLightboxItem(processed[currentLightboxIndex - 1]); }}
      />
    </div>
  );
}