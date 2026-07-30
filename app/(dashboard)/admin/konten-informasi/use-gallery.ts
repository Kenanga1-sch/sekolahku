"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { goGet, goPost, goDelete, goPut } from "@/lib/api-client";
import { toast } from "sonner";

interface GalleryItem {
  id: string; title: string; category: string; imageUrl: string; createdAt: string;
}

interface GalleryStats {
  total: number; categories: Record<string, number>; storage: { used: number; unit: string };
}

const fetcher = (url: string) => goGet(url);

type GalleryViewMode = "grid" | "list";
export type GallerySortMode = "newest" | "oldest" | "a-z" | "z-a";

export function useGallery(active: boolean) {
  const [filterCategory, setFilterCategory] = useState("all");
  const { data: galleryData, isLoading } = useSWR(
    active ? `/api/gallery?category=${filterCategory}` : null,
    fetcher
  );
  const { data: statsData, isLoading: statsLoading } = useSWR<GalleryStats>(
    active ? "/api/gallery/stats" : null,
    fetcher
  );

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<GalleryViewMode>("grid");
  const [sortMode, setSortMode] = useState<GallerySortMode>("newest");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);

  const items = (galleryData?.data as GalleryItem[]) || [];
  const stats: GalleryStats | null = statsData || null;

  const processed = items
    .filter((item) => item.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortMode) {
        case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "a-z": return a.title.localeCompare(b.title);
        case "z-a": return b.title.localeCompare(a.title);
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const lightboxIndex = lightboxItem ? processed.findIndex((i) => i.id === lightboxItem.id) : -1;

  const toggleSelection = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selected.length === processed.length) setSelected([]);
    else setSelected(processed.map((item) => item.id));
  };

  const refresh = () => {
    mutate(`/api/gallery?category=${filterCategory}`);
    mutate("/api/gallery/stats");
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Hapus ${selected.length} foto terpilih?`)) return;
    try {
      await goPost("/api/gallery/bulk-delete", { ids: selected });
      toast.success(`${selected.length} foto berhasil dihapus`);
      setSelected([]);
      setSelectionMode(false);
      refresh();
    } catch { toast.error("Gagal menghapus foto"); }
  };

  const handleSingleDelete = async (id: string) => {
    if (!confirm("Hapus foto ini?")) return;
    try { await goDelete(`/api/gallery/${id}`); toast.success("Foto dihapus"); refresh(); }
    catch { toast.error("Gagal menghapus"); }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingItem) return;
    const formData = new FormData(e.currentTarget);
    try {
      await goPut(`/api/gallery/${editingItem.id}`, { title: formData.get("title"), category: formData.get("category") });
      toast.success("Foto diperbarui");
      setEditOpen(false);
      setEditingItem(null);
      refresh();
    } catch { toast.error("Gagal update foto"); }
  };

  return {
    items, stats, isLoading, statsLoading, search, setSearch,
    filterCategory, setFilterCategory, viewMode, setViewMode, sortMode, setSortMode,
    selected, selectionMode, setSelectionMode, toggleSelection, selectAll,
    uploadOpen, setUploadOpen, editingItem, setEditingItem, editOpen, setEditOpen,
    lightboxItem, setLightboxItem, lightboxIndex,
    processed, refresh, handleBulkDelete, handleSingleDelete, handleUpdate,
  };
}