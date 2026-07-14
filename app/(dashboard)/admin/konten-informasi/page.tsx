"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import useSWR, { mutate } from "swr";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { goGet, goPost, goPatch, goDelete, goPut } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import { compressImage } from "@/lib/utils";
import type { Announcement } from "@/types";

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
  EyeOff,
  Star,
  X,
  Check,
  Mail,
  MailOpen,
  Megaphone,
  Newspaper,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

// Server Actions for Messages
import {
  getContactMessagesAction,
  markMessageAsReadAction,
  deleteMessageAction,
} from "@/actions/contact";

// Sub-components for Gallery
import { GalleryStatsCards } from "@/components/gallery/stats-cards";
import { EnhancedUploadZone } from "@/components/gallery/upload-zone";
import { ImageLightbox } from "@/components/gallery/image-lightbox";

// Fetcher
const fetcher = (url: string) => goGet(url);

// --- STATIC DEFINITIONS & HELPER FUNCTIONS ---

// Gallery
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

type GalleryViewMode = "grid" | "list";
type GallerySortMode = "newest" | "oldest" | "a-z" | "z-a";

// Announcements
const announcementCategories = [
  { value: "spmb", label: "SPMB" },
  { value: "prestasi", label: "Prestasi" },
  { value: "kegiatan", label: "Kegiatan" },
  { value: "pengumuman", label: "Pengumuman" },
];

function getAnnouncementCategoryColor(category: string) {
  switch (category) {
    case "spmb": return "bg-blue-100 text-blue-700";
    case "prestasi": return "bg-amber-100 text-amber-700";
    case "kegiatan": return "bg-green-100 text-green-700";
    case "pengumuman": return "bg-purple-100 text-purple-700";
    default: return "bg-zinc-100 text-zinc-700";
  }
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type AdminAnnouncement = Announcement & {
  isPublished?: boolean;
  isFeatured?: boolean;
  publishedAt?: string;
  createdAt?: string;
};

function normalizeAnnouncement(item: any): AdminAnnouncement {
  return {
    ...item,
    isPublished: Boolean(item.isPublished ?? item.is_published),
    isFeatured: Boolean(item.isFeatured ?? item.is_featured),
    publishedAt: item.publishedAt ?? item.published_at,
    createdAt: item.createdAt ?? item.created_at ?? item.created,
  };
}

// Lazy load heavy Rich Text Editor
const RichTextEditor = dynamic(
  () => import("@/components/rich-text-editor").then((mod) => mod.RichTextEditor),
  {
    loading: () => <div className="border rounded-lg p-4 h-[250px] bg-muted/30 animate-pulse" />,
    ssr: false,
  }
);

// Messages
interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  isRead: boolean;
  createdAt?: string;
}

interface ContactMessagePayload {
  items?: ContactMessage[];
  total?: number;
  page?: number;
  perPage?: number;
  totalPages?: number;
}

export default function KontenInformasiPage() {
  const [activeTab, setActiveTab] = useState<"pesan" | "pengumuman" | "galeri">("pesan");

  // ==========================================
  // 1. STATE & HANDLERS: PESAN MASUK (MESSAGES)
  // ==========================================
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesRefreshing, setMessagesRefreshing] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [messagesPagination, setMessagesPagination] = useState<ContactMessagePayload>({
    total: 0,
    page: 1,
    perPage: 20,
    totalPages: 1,
  });

  const normalizeMessages = (payload: unknown): ContactMessagePayload => {
    if (Array.isArray(payload)) {
      return { items: payload, total: payload.length, page: 1, perPage: payload.length, totalPages: 1 };
    }
    if (payload && typeof payload === "object") {
      const response = payload as { data?: ContactMessagePayload | ContactMessage[] };
      if (Array.isArray(response.data)) {
        return { items: response.data, total: response.data.length, page: 1, perPage: response.data.length, totalPages: 1 };
      }
      if (response.data && typeof response.data === "object") {
        return response.data;
      }
    }
    return { items: [], total: 0, page: 1, perPage: 20, totalPages: 1 };
  };

  const fetchMessages = async (silent = false) => {
    if (!silent) setMessagesLoading(true);
    setMessagesError("");
    try {
      const res = await getContactMessagesAction();
      if (res.success) {
        const payload = normalizeMessages(res.data);
        setMessages(payload.items || []);
        setMessagesPagination(payload);
      } else {
        setMessagesError(res.error || "Gagal memuat pesan");
        toast.error(res.error || "Gagal memuat pesan");
      }
    } catch (err) {
      console.error(err);
      setMessagesError("Gagal memuat pesan");
    } finally {
      setMessagesLoading(false);
      setMessagesRefreshing(false);
    }
  };

  useEffect(() => {
    if (activeTab === "pesan") {
      fetchMessages();
    }
  }, [activeTab]);

  const handleMarkAsRead = async (msgId: string) => {
    const res = await markMessageAsReadAction(msgId);
    if (res.success) {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, isRead: true } : m)));
      toast.success("Pesan ditandai sebagai sudah dibaca");
    } else {
      toast.error(res.error || "Gagal memperbarui status pesan");
    }
  };

  const handleMessageDelete = async (msgId: string) => {
    const res = await deleteMessageAction(msgId);
    if (res.success) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      setMessagesPagination((prev) => ({ ...prev, total: Math.max((prev.total || 1) - 1, 0) }));
      toast.success("Pesan berhasil dihapus");
    } else {
      toast.error(res.error || "Gagal menghapus pesan");
    }
  };

  // ==========================================
  // 2. STATE & HANDLERS: PENGUMUMAN
  // ==========================================
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [deleteAnnouncementId, setDeleteAnnouncementId] = useState<string | null>(null);
  const [isAnnouncementSaving, setIsAnnouncementSaving] = useState(false);
  const [announcementSearch, setAnnouncementSearch] = useState("");
  const [isThumbnailUploading, setIsThumbnailUploading] = useState(false);

  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    category: "pengumuman",
    thumbnail: "",
    isPublished: false,
    isFeatured: false,
  });

  const fetchAnnouncements = useCallback(async (silent = false) => {
    if (!silent) setAnnouncementsLoading(true);
    try {
      const data: any = await goGet("/api/announcements?all=true&limit=100");
      setAnnouncements((data.data || []).map(normalizeAnnouncement));
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
      showError("Gagal memuat pengumuman");
    } finally {
      setAnnouncementsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "pengumuman") {
      fetchAnnouncements();
    }
  }, [activeTab, fetchAnnouncements]);

  const handleAnnouncementSubmit = async () => {
    setIsAnnouncementSaving(true);
    try {
      const data = {
        title: announcementForm.title,
        slug: announcementForm.slug || generateSlug(announcementForm.title),
        excerpt: announcementForm.excerpt,
        content: announcementForm.content,
        category: announcementForm.category,
        thumbnail: announcementForm.thumbnail,
        is_published: announcementForm.isPublished,
        is_featured: announcementForm.isFeatured,
      };

      if (editingAnnouncementId) {
        await goPatch(`/api/announcements/${editingAnnouncementId}`, data);
        showSuccess("Pengumuman berhasil diperbarui");
      } else {
        await goPost("/api/announcements", data);
        showSuccess("Pengumuman baru berhasil dibuat");
      }

      fetchAnnouncements(true);
      resetAnnouncementForm();
    } catch (error: any) {
      console.error("Failed to save:", error);
      showError(error.message || "Gagal menyimpan pengumuman");
    } finally {
      setIsAnnouncementSaving(false);
    }
  };

  const handleAnnouncementEdit = (item: Announcement) => {
    setEditingAnnouncementId(item.id);
    setAnnouncementForm({
      title: item.title || "",
      slug: item.slug || "",
      excerpt: item.excerpt || "",
      content: item.content || "",
      category: item.category || "pengumuman",
      thumbnail: item.thumbnail || "",
      isPublished: item.isPublished || false,
      isFeatured: item.isFeatured || false,
    });
    setIsAnnouncementDialogOpen(true);
  };

  const handleAnnouncementDelete = async () => {
    if (!deleteAnnouncementId) return;
    try {
      await goDelete(`/api/announcements/${deleteAnnouncementId}`);
      setDeleteAnnouncementId(null);
      showSuccess("Pengumuman berhasil dihapus");
      fetchAnnouncements(true);
    } catch (error: any) {
      console.error("Failed to delete:", error);
      showError(error.message || "Gagal menghapus pengumuman");
    }
  };

  const toggleAnnouncementPublish = async (id: string, current: boolean) => {
    try {
      await goPatch(`/api/announcements/${id}`, { is_published: !current });
      fetchAnnouncements(true);
    } catch {
      showError("Gagal merubah status terbit");
    }
  };

  const toggleAnnouncementFeatured = async (id: string, current: boolean) => {
    try {
      await goPatch(`/api/announcements/${id}`, { is_featured: !current });
      fetchAnnouncements(true);
    } catch {
      showError("Gagal merubah status featured");
    }
  };

  const resetAnnouncementForm = () => {
    setAnnouncementForm({
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      category: "pengumuman",
      thumbnail: "",
      isPublished: false,
      isFeatured: false,
    });
    setEditingAnnouncementId(null);
    setIsAnnouncementDialogOpen(false);
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsThumbnailUploading(true);
    let uploadFile = file;
    try {
      if (file.type.startsWith("image/")) {
        uploadFile = await compressImage(file, 1024, 0.85);
      }
    } catch (error) {
      console.error("Compression failed:", error);
    }

    const formDataUpload = new FormData();
    formDataUpload.append("file", uploadFile);
    formDataUpload.append("folder", "announcements");

    try {
      const data: any = await goPost("/api/upload", formDataUpload);
      if (data.error) throw new Error(data.error || "Upload failed");

      setAnnouncementForm((prev) => ({ ...prev, thumbnail: data.url }));
    } catch (error) {
      console.error("Upload error:", error);
      showError("Gagal mengupload gambar: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsThumbnailUploading(false);
    }
  };

  const filteredAnnouncements = announcements.filter(
    (a) =>
      a.title?.toLowerCase().includes(announcementSearch.toLowerCase()) ||
      a.excerpt?.toLowerCase().includes(announcementSearch.toLowerCase())
  );

  // ==========================================
  // 3. STATE & HANDLERS: GALERI FOTO (GALLERY)
  // ==========================================
  const [filterGalleryCategory, setFilterGalleryCategory] = useState("all");
  const { data: galleryData, isLoading: galleryLoading } = useSWR(
    activeTab === "galeri" ? `/api/gallery?category=${filterGalleryCategory}` : null,
    fetcher
  );
  const { data: galleryStatsData, isLoading: galleryStatsLoading } = useSWR<GalleryStats>(
    activeTab === "galeri" ? "/api/gallery/stats" : null,
    fetcher
  );

  const [gallerySearch, setGallerySearch] = useState("");
  const [galleryViewMode, setGalleryViewMode] = useState<GalleryViewMode>("grid");
  const [gallerySortMode, setGallerySortMode] = useState<GallerySortMode>("newest");
  const [selectedGalleryItems, setSelectedGalleryItems] = useState<string[]>([]);
  const [isGallerySelectionMode, setIsGallerySelectionMode] = useState(false);

  const [isGalleryUploadOpen, setIsGalleryUploadOpen] = useState(false);
  const [editingGalleryItem, setEditingGalleryItem] = useState<GalleryItem | null>(null);
  const [isGalleryEditOpen, setIsGalleryEditOpen] = useState(false);
  const [galleryLightboxItem, setGalleryLightboxItem] = useState<GalleryItem | null>(null);

  const galleryItems = (galleryData?.data as GalleryItem[]) || [];
  const galleryStats: GalleryStats | null = galleryStatsData || null;

  const processedGalleryItems = galleryItems
    .filter((item) =>
      item.title.toLowerCase().includes(gallerySearch.toLowerCase())
    )
    .sort((a, b) => {
      switch (gallerySortMode) {
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

  const currentLightboxIndex = galleryLightboxItem
    ? processedGalleryItems.findIndex((i) => i.id === galleryLightboxItem.id)
    : -1;

  const toggleGallerySelection = (id: string) => {
    setSelectedGalleryItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllGallery = () => {
    if (selectedGalleryItems.length === processedGalleryItems.length) {
      setSelectedGalleryItems([]);
    } else {
      setSelectedGalleryItems(processedGalleryItems.map((item) => item.id));
    }
  };

  const refreshGalleryData = () => {
    mutate(`/api/gallery?category=${filterGalleryCategory}`);
    mutate("/api/gallery/stats");
  };

  const handleGalleryBulkDelete = async () => {
    if (!confirm(`Hapus ${selectedGalleryItems.length} foto terpilih?`)) return;

    try {
      await goPost("/api/gallery/bulk-delete", { ids: selectedGalleryItems });
      toast.success(`${selectedGalleryItems.length} foto berhasil dihapus`);
      setSelectedGalleryItems([]);
      setIsGallerySelectionMode(false);
      refreshGalleryData();
    } catch {
      toast.error("Gagal menghapus foto");
    }
  };

  const handleGallerySingleDelete = async (id: string) => {
    if (!confirm("Hapus foto ini?")) return;
    try {
      await goDelete(`/api/gallery/${id}`);
      toast.success("Foto dihapus");
      refreshGalleryData();
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const handleGalleryUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingGalleryItem) return;

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const category = formData.get("category") as string;

    try {
      await goPut(`/api/gallery/${editingGalleryItem.id}`, { title, category });
      toast.success("Foto diperbarui");
      setIsGalleryEditOpen(false);
      setEditingGalleryItem(null);
      refreshGalleryData();
    } catch {
      toast.error("Gagal update foto");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-8 w-8 text-primary" /> Pusat Informasi & Komunikasi
          </h1>
          <p className="text-muted-foreground text-sm">
            Manajemen galeri foto kegiatan, pengumuman berita sekolah, dan pesan masuk.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-muted">
        <button
          onClick={() => setActiveTab("pesan")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-[2px] ${
            activeTab === "pesan"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Pesan Masuk
        </button>
        <button
          onClick={() => setActiveTab("pengumuman")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-[2px] ${
            activeTab === "pengumuman"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Pengumuman & Berita
        </button>
        <button
          onClick={() => setActiveTab("galeri")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-[2px] ${
            activeTab === "galeri"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Galeri Foto
        </button>
      </div>

      {/* ==========================================
          TAB 1: PESAN MASUK
         ========================================== */}
      {activeTab === "pesan" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Log Formulir Kontak</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMessagesRefreshing(true);
                fetchMessages(true);
              }}
              disabled={messagesRefreshing || messagesLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${messagesRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <Card className="border-none shadow-xl bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20 text-blue-600">
                  <Mail className="h-5 w-5" />
                </div>
                <CardTitle>Daftar Pesan ({messagesPagination.total || messages.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {messagesError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                  {messagesError}
                </div>
              )}
              
              {messagesLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">Memuat pesan...</p>
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-zinc-50/50 dark:bg-white/5">
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Pengirim</TableHead>
                        <TableHead>Subjek</TableHead>
                        <TableHead>Pesan</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {messages.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            Belum ada pesan masuk.
                          </TableCell>
                        </TableRow>
                      ) : (
                        messages.map((msg) => (
                          <TableRow key={msg.id} className={`group hover:bg-zinc-50/50 dark:hover:bg-white/5 transition-colors ${!msg.isRead ? "bg-blue-50/30 dark:bg-blue-900/5" : ""}`}>
                            <TableCell>
                              {!msg.isRead ? (
                                <div className="h-2 w-2 rounded-full bg-blue-500" title="Belum dibaca" />
                              ) : (
                                <MailOpen className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="w-[180px] font-medium text-muted-foreground">
                              {msg.createdAt
                                ? format(new Date(msg.createdAt), "dd MMM yyyy HH:mm", {
                                    locale: idLocale,
                                  })
                                : "-"}
                            </TableCell>
                            <TableCell className="w-[250px]">
                              <div className="flex flex-col">
                                <span className={`${!msg.isRead ? "font-bold text-zinc-900 dark:text-white" : "font-medium text-zinc-700 dark:text-zinc-300"}`}>
                                  {msg.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {msg.email}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className={`w-[200px] ${!msg.isRead ? "font-bold" : "font-medium"}`}>
                              {msg.subject || "-"}
                            </TableCell>
                            <TableCell className="max-w-[400px]">
                              <p className={`truncate group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors ${!msg.isRead ? "text-zinc-900 dark:text-zinc-100 font-medium" : "text-muted-foreground"}`}>
                                {msg.message}
                              </p>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {!msg.isRead && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/20"
                                    onClick={() => handleMarkAsRead(msg.id)}
                                    title="Tandai sudah dibaca"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                                
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                                      title="Hapus pesan"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Hapus Pesan?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tindakan ini tidak dapat dibatalkan. Pesan dari <strong>{msg.name}</strong> akan dihapus permanen.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Batal</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleMessageDelete(msg.id)} className="bg-red-600 hover:bg-red-700">
                                        Hapus
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==========================================
          TAB 2: PENGUMUMAN & BERITA
         ========================================== */}
      {activeTab === "pengumuman" && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari judul atau isi pengumuman..."
                className="pl-10"
                value={announcementSearch}
                onChange={(e) => setAnnouncementSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" size="sm" onClick={() => { fetchAnnouncements(); }}>
                <RefreshCw className={`h-4 w-4 mr-2 ${announcementsLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => { resetAnnouncementForm(); setIsAnnouncementDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Baru
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Judul</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcementsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredAnnouncements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <Newspaper className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-muted-foreground">Belum ada pengumuman</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAnnouncements.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium line-clamp-1">{item.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{item.excerpt}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getAnnouncementCategoryColor(item.category || "")}>
                            {announcementCategories.find((c) => c.value === item.category)?.label || item.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={item.isPublished ? "border-green-500 text-green-600" : ""}
                            >
                              {item.isPublished ? "Terbit" : "Draft"}
                            </Badge>
                            {item.isFeatured && (
                              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.publishedAt
                            ? new Date(item.publishedAt).toLocaleDateString("id-ID")
                            : item.createdAt ? new Date(item.createdAt).toLocaleDateString("id-ID") : "-"}
                        </TableCell>

                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleAnnouncementEdit(item)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleAnnouncementPublish(item.id, item.isPublished ?? false)}>
                                {item.isPublished ? (
                                  <>
                                    <EyeOff className="h-4 w-4 mr-2" />
                                    Jadikan Draft
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Terbitkan
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleAnnouncementFeatured(item.id, item.isFeatured ?? false)}>
                                <Star className="h-4 w-4 mr-2" />
                                {item.isFeatured ? "Hapus Featured" : "Jadikan Featured"}
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteAnnouncementId(item.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Hapus
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Create/Edit Announcement Dialog */}
          <Dialog open={isAnnouncementDialogOpen} onOpenChange={setIsAnnouncementDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAnnouncementId ? "Edit Pengumuman" : "Tambah Pengumuman Baru"}</DialogTitle>
                <DialogDescription>
                  {editingAnnouncementId ? "Perbarui konten pengumuman" : "Buat pengumuman atau berita baru"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Judul</Label>
                  <Input
                    id="title"
                    value={announcementForm.title}
                    onChange={(e) => {
                      setAnnouncementForm({
                        ...announcementForm,
                        title: e.target.value,
                        slug: generateSlug(e.target.value),
                      });
                    }}
                    placeholder="Judul pengumuman"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug URL</Label>
                  <Input
                    id="slug"
                    value={announcementForm.slug}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, slug: e.target.value })}
                    placeholder="url-friendly-slug"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Kategori</Label>
                  <Select
                    value={announcementForm.category}
                    onValueChange={(v) => setAnnouncementForm({ ...announcementForm, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {announcementCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="excerpt">Ringkasan</Label>
                  <Textarea
                    id="excerpt"
                    value={announcementForm.excerpt}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, excerpt: e.target.value })}
                    placeholder="Ringkasan singkat untuk preview"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Foto Sampul / Video (Thumbnail)</Label>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-4 items-start">
                      {announcementForm.thumbnail ? (
                        <div className="relative w-32 h-20 rounded-lg overflow-hidden border">
                          <img 
                            src={
                              announcementForm.thumbnail.includes('youtube.com') || announcementForm.thumbnail.includes('youtu.be') 
                                ? `https://img.youtube.com/vi/${announcementForm.thumbnail.split('v=')[1]?.split('&')[0] || announcementForm.thumbnail.split('youtu.be/')[1]?.split('?')[0]}/hqdefault.jpg`
                                : announcementForm.thumbnail.includes('instagram.com') 
                                ? '/img/instagram-placeholder.png' // fallback icon
                                : announcementForm.thumbnail
                            } 
                            alt="Preview" 
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              // If it fails (e.g. invalid yt id), just show default
                              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/shapes/svg?seed=${announcementForm.thumbnail}`;
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setAnnouncementForm({ ...announcementForm, thumbnail: "" })}
                            className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-32 h-20 rounded-lg border border-dashed flex items-center justify-center bg-muted/50 text-muted-foreground">
                          <ImageIcon className="h-8 w-8 opacity-50" />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleThumbnailUpload}
                          disabled={isThumbnailUploading}
                          className="cursor-pointer"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Format: JPG, PNG, WEBP. Maks 5MB.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-px bg-border flex-1" />
                      <span className="text-xs text-muted-foreground">Atau Embed Tautan</span>
                      <div className="h-px bg-border flex-1" />
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        placeholder="https://youtube.com/watch?v=... atau instagram.com/p/..."
                        value={announcementForm.thumbnail?.startsWith('http') && !announcementForm.thumbnail?.includes('/uploads/') ? announcementForm.thumbnail : ''}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, thumbnail: e.target.value })}
                        disabled={isThumbnailUploading}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Konten</Label>
                  <RichTextEditor
                    content={announcementForm.content}
                    onChange={(content) => setAnnouncementForm({ ...announcementForm, content })}
                    placeholder="Tulis konten di sini..."
                  />
                </div>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={announcementForm.isPublished}
                      onCheckedChange={(c) => setAnnouncementForm({ ...announcementForm, isPublished: c })}
                    />
                    <Label>Terbitkan</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={announcementForm.isFeatured}
                      onCheckedChange={(c) => setAnnouncementForm({ ...announcementForm, isFeatured: c })}
                    />
                    <Label>Featured</Label>
                  </div>
                </div>

              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetAnnouncementForm}>
                  Batal
                </Button>
                <Button onClick={handleAnnouncementSubmit} disabled={isAnnouncementSaving || !announcementForm.title}>
                  {isAnnouncementSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingAnnouncementId ? "Simpan" : "Buat"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Announcement Confirmation */}
          <AlertDialog open={!!deleteAnnouncementId} onOpenChange={() => setDeleteAnnouncementId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus Pengumuman?</AlertDialogTitle>
                <AlertDialogDescription>
                  Pengumuman akan dihapus permanen dan tidak dapat dikembalikan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleAnnouncementDelete}
                  className="bg-destructive text-destructive-foreground"
                >
                  Hapus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* ==========================================
          TAB 3: GALERI FOTO (GALLERY)
         ========================================== */}
      {activeTab === "galeri" && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold">Galeri Foto Digital</h2>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button variant="outline" size="sm" onClick={refreshGalleryData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              {isGallerySelectionMode ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsGallerySelectionMode(false)}>
                    Batal
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleGalleryBulkDelete}
                    disabled={selectedGalleryItems.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus ({selectedGalleryItems.length})
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsGallerySelectionMode(true)}>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    Pilih
                  </Button>
                  <Button size="sm" onClick={() => setIsGalleryUploadOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Upload
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <GalleryStatsCards stats={galleryStats} isLoading={galleryStatsLoading} />

          {/* Toolbar */}
          <Card className="border-0 shadow-lg bg-gradient-to-r from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
            <div className="p-4 flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari foto..."
                  className="pl-10 h-11 bg-white dark:bg-zinc-800"
                  value={gallerySearch}
                  onChange={(e) => setGallerySearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 w-full lg:w-auto">
                <Select value={filterGalleryCategory} onValueChange={setFilterGalleryCategory}>
                  <SelectTrigger className="w-full lg:w-[180px] h-11">
                    <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {galleryCategories.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={gallerySortMode} onValueChange={(v) => setGallerySortMode(v as GallerySortMode)}>
                  <SelectTrigger className="w-full lg:w-[140px] h-11">
                    <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gallerySortOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex border rounded-lg overflow-hidden">
                  <Button
                    variant={galleryViewMode === "grid" ? "default" : "ghost"}
                    size="icon"
                    className="rounded-none h-11 w-11"
                    onClick={() => setGalleryViewMode("grid")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={galleryViewMode === "list" ? "default" : "ghost"}
                    size="icon"
                    className="rounded-none h-11 w-11"
                    onClick={() => setGalleryViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            {processedGalleryItems.length > 0 && (
              <div className="px-4 pb-3 text-sm text-muted-foreground">
                Menampilkan {processedGalleryItems.length} dari {galleryItems.length} foto
              </div>
            )}
          </Card>

          {/* Selection Bar */}
          {isGallerySelectionMode && processedGalleryItems.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <Checkbox
                checked={
                  selectedGalleryItems.length === processedGalleryItems.length &&
                  processedGalleryItems.length > 0
                }
                onCheckedChange={selectAllGallery}
                id="select-all"
              />
              <Label htmlFor="select-all" className="cursor-pointer font-medium">
                Pilih Semua ({processedGalleryItems.length})
              </Label>
              <span className="text-muted-foreground">
                - {selectedGalleryItems.length} dipilih
              </span>
            </div>
          )}

          {/* Content */}
          {galleryLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Memuat galeri...</p>
            </div>
          ) : processedGalleryItems.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <ImageIcon className="h-16 w-16 mb-4 text-muted-foreground/30" />
                <p className="text-xl font-semibold mb-1">Tidak ada foto</p>
                <p className="text-muted-foreground mb-4">
                  {gallerySearch ? "Coba ubah kata kunci pencarian" : "Upload foto pertama Anda"}
                </p>
                {!gallerySearch && (
                  <Button onClick={() => setIsGalleryUploadOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Upload Foto
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : galleryViewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {processedGalleryItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "group relative aspect-square rounded-xl overflow-hidden border bg-card cursor-pointer transition-all duration-200",
                    selectedGalleryItems.includes(item.id)
                      ? "ring-2 ring-primary border-primary shadow-lg"
                      : "hover:shadow-xl hover:scale-[1.02]"
                  )}
                  onClick={() =>
                    isGallerySelectionMode ? toggleGallerySelection(item.id) : setGalleryLightboxItem(item)
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
                      isGallerySelectionMode || selectedGalleryItems.includes(item.id)
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      {isGallerySelectionMode && (
                        <Checkbox
                          checked={selectedGalleryItems.includes(item.id)}
                          className="data-[state=checked]:bg-primary border-white/70"
                        />
                      )}
                      {!isGallerySelectionMode && (
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
                                setGalleryLightboxItem(item);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" /> Lihat
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingGalleryItem(item);
                                setIsGalleryEditOpen(true);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGallerySingleDelete(item.id);
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
                {processedGalleryItems.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                      selectedGalleryItems.includes(item.id) && "bg-primary/5"
                    )}
                    onClick={() =>
                      isGallerySelectionMode ? toggleGallerySelection(item.id) : setGalleryLightboxItem(item)
                    }
                  >
                    {isGallerySelectionMode && (
                      <Checkbox
                        checked={selectedGalleryItems.includes(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleGallerySelection(item.id)}
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
                        locale: idLocale,
                      })}
                    </div>
                    {!isGallerySelectionMode && (
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
                              setEditingGalleryItem(item);
                              setIsGalleryEditOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGallerySingleDelete(item.id);
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
          <Dialog open={isGalleryUploadOpen} onOpenChange={setIsGalleryUploadOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">Upload Foto</DialogTitle>
              </DialogHeader>
              <EnhancedUploadZone
                onUploadComplete={refreshGalleryData}
                onClose={() => setIsGalleryUploadOpen(false)}
              />
            </DialogContent>
          </Dialog>

          {/* Edit Gallery Item Dialog */}
          <Dialog open={isGalleryEditOpen} onOpenChange={setIsGalleryEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Foto</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleGalleryUpdate} className="space-y-4">
                {editingGalleryItem && (
                  <div className="relative h-40 w-full rounded-lg overflow-hidden bg-muted mb-4">
                    <Image
                      src={editingGalleryItem.imageUrl}
                      alt={editingGalleryItem.title}
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
                    defaultValue={editingGalleryItem?.title}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Kategori</Label>
                  <Select name="category" defaultValue={editingGalleryItem?.category}>
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
                    onClick={() => setIsGalleryEditOpen(false)}
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
            item={galleryLightboxItem}
            isOpen={!!galleryLightboxItem}
            onClose={() => setGalleryLightboxItem(null)}
            onEdit={(item) => {
              setEditingGalleryItem(item);
              setIsGalleryEditOpen(true);
            }}
            onDelete={handleGallerySingleDelete}
            hasNext={currentLightboxIndex < processedGalleryItems.length - 1}
            hasPrev={currentLightboxIndex > 0}
            onNext={() => {
              if (currentLightboxIndex < processedGalleryItems.length - 1) {
                setGalleryLightboxItem(processedGalleryItems[currentLightboxIndex + 1]);
              }
            }}
            onPrev={() => {
              if (currentLightboxIndex > 0) {
                setGalleryLightboxItem(processedGalleryItems[currentLightboxIndex - 1]);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
