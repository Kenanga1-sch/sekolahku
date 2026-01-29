"use client";
// Force rebuild to clear stale pocketbase dependency cache

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Star,
  RefreshCw,
  Loader2,
  Newspaper,
  Search,
  Upload,
  Image as ImageIcon,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { Announcement } from "@/types";

// Lazy load heavy Rich Text Editor
const RichTextEditor = dynamic(
  () => import("@/components/rich-text-editor").then(mod => mod.RichTextEditor),
  {
    loading: () => <div className="border rounded-lg p-4 h-[250px] bg-muted/30 animate-pulse" />,
    ssr: false
  }
);

const categories = [
  { value: "spmb", label: "SPMB" },
  { value: "prestasi", label: "Prestasi" },
  { value: "kegiatan", label: "Kegiatan" },
  { value: "pengumuman", label: "Pengumuman" },
];

function getCategoryColor(category: string) {
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

export default function AnnouncementsAdminPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    category: "pengumuman",
    thumbnail: "",
    is_published: false,
    is_featured: false,
  });
  const [isUploading, setIsUploading] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      if (!res.ok) throw new Error("Failed to fetch");
      const result = await res.json();
      setAnnouncements(result);
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const data = {
        ...formData,
        slug: formData.slug || generateSlug(formData.title),
      };

      if (editingId) {
        const res = await fetch(`/api/announcements/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to update");
      } else {
        const res = await fetch("/api/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to create");
      }

      fetchAnnouncements();
      resetForm();
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (item: Announcement) => {
    setEditingId(item.id);
    setFormData({
      title: item.title || "",
      slug: item.slug || "",
      excerpt: item.excerpt || "",
      content: item.content || "",
      category: item.category || "pengumuman",
      thumbnail: item.thumbnail || "",
      is_published: item.is_published || false,
      is_featured: item.is_featured || false,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/announcements/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setDeleteId(null);
      fetchAnnouncements();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const togglePublish = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: !current }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      fetchAnnouncements();
    } catch (error) {
      console.error("Failed to toggle publish:", error);
    }
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_featured: !current }),
      });
      if (!res.ok) throw new Error("Failed to toggle featured");
      fetchAnnouncements();
    } catch (error) {
      console.error("Failed to toggle featured:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      slug: "",
      excerpt: "",
    content: "",
    category: "pengumuman",
    thumbnail: "",
    is_published: false,
    is_featured: false,
  });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    formDataUpload.append("folder", "announcements");

    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formDataUpload,
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setFormData(prev => ({ ...prev, thumbnail: data.url }));
    } catch (error: any) {
      console.error("Upload error:", error);
      alert("Gagal mengupload gambar: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredAnnouncements = announcements.filter(
    (a) =>
      a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pengumuman & Berita</h1>
          <p className="text-muted-foreground">Kelola konten berita dan pengumuman</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setIsLoading(true); fetchAnnouncements(); }}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Baru
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari judul atau isi..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table */}
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
              {isLoading ? (
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
                      <Badge className={getCategoryColor(item.category || "")}>
                        {categories.find((c) => c.value === item.category)?.label || item.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={item.is_published ? "border-green-500 text-green-600" : ""}
                        >
                          {item.is_published ? "Terbit" : "Draft"}
                        </Badge>
                        {item.is_featured && (
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.published_at
                        ? new Date(item.published_at).toLocaleDateString("id-ID")
                        : new Date(item.created).toLocaleDateString("id-ID")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(item)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => togglePublish(item.id, item.is_published ?? false)}>
                            {item.is_published ? (
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
                          <DropdownMenuItem onClick={() => toggleFeatured(item.id, item.is_featured ?? false)}>
                            <Star className="h-4 w-4 mr-2" />
                            {item.is_featured ? "Hapus Featured" : "Jadikan Featured"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(item.id)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Pengumuman" : "Tambah Pengumuman Baru"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Perbarui konten pengumuman" : "Buat pengumuman atau berita baru"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Judul</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => {
                  setFormData({
                    ...formData,
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
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="url-friendly-slug"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Kategori</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
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
                value={formData.excerpt}
                onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                placeholder="Ringkasan singkat untuk preview"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Foto Sampul (Thumbnail)</Label>
              <div className="flex gap-4 items-start">
                {formData.thumbnail ? (
                  <div className="relative w-32 h-20 rounded-lg overflow-hidden border">
                    <img 
                      src={formData.thumbnail} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                    />
                    <button
                      onClick={() => setFormData({ ...formData, thumbnail: "" })}
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
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="cursor-pointer"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Format: JPG, PNG, WEBP. Maks 5MB.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Konten</Label>
              <RichTextEditor
                content={formData.content}
                onChange={(content) => setFormData({ ...formData, content })}
                placeholder="Tulis konten di sini..."
              />
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_published}
                  onCheckedChange={(c) => setFormData({ ...formData, is_published: c })}
                />
                <Label>Terbitkan</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_featured}
                  onCheckedChange={(c) => setFormData({ ...formData, is_featured: c })}
                />
                <Label>Featured</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving || !formData.title}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Simpan" : "Buat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
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
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
