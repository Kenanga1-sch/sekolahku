"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, RefreshCw, Search, MoreHorizontal, Pencil, Eye, EyeOff, Star, Trash2, Loader2, X, ImageIcon } from "lucide-react";
import Image from "next/image";
import type { useAnnouncements } from "./use-announcements";

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

type AnnouncementsHook = ReturnType<typeof useAnnouncements>;

const RichTextEditor = dynamic(() => import("@/components/rich-text-editor").then((mod) => mod.RichTextEditor), {
  loading: () => <div className="border rounded-lg p-4 h-[250px] bg-muted/30 animate-pulse" />, ssr: false,
});

const announcementCategories = [
  { value: "spmb", label: "SPMB" }, { value: "prestasi", label: "Prestasi" },
  { value: "kegiatan", label: "Kegiatan" }, { value: "pengumuman", label: "Pengumuman" },
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

export function AnnouncementsTab(hook: AnnouncementsHook) {
  const {
    announcements, loading, search, setSearch, filtered, dialogOpen, setDialogOpen, editingId,
    deleteId, setDeleteId, isSaving, form, setForm, isThumbnailUploading,
    resetForm, openCreate, openEdit, handleSubmit, handleDelete, togglePublish, toggleFeatured, fetchAnnouncements,
    handleThumbnailUpload,
  } = hook;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari judul atau isi pengumuman..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={() => fetchAnnouncements()}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Tambah Baru</Button>
        </div>
      </div>

      <DataTable
        data={filtered}
        getRowId={(item) => item.id}
        loading={loading}
        emptyTitle="Belum ada pengumuman"
        emptyDescription="Pengumuman dan berita yang dibuat akan tampil di sini."
        columns={[
          {
            key: "title",
            header: "Judul",
            card: "title",
            render: (item) => (
              <div><p className="font-medium line-clamp-1">{item.title}</p><p className="text-xs text-muted-foreground line-clamp-1">{item.excerpt}</p></div>
            ),
          },
          {
            key: "category",
            header: "Kategori",
            card: "field",
            render: (item) => (
              <Badge className={getCategoryColor(item.category || "")}>
                {announcementCategories.find((c) => c.value === item.category)?.label || item.category}
              </Badge>
            ),
          },
          {
            key: "isPublished",
            header: "Status",
            card: "field",
            render: (item) => (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={item.isPublished ? "border-green-500 text-green-600" : ""}>
                  {item.isPublished ? "Terbit" : "Draft"}
                </Badge>
                {item.isFeatured && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
              </div>
            ),
          },
          {
            key: "publishedAt",
            header: "Tanggal",
            card: "field",
            render: (item) => (
              <span className="text-muted-foreground text-sm">
                {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("id-ID") : item.createdAt ? new Date(item.createdAt).toLocaleDateString("id-ID") : "-"}
              </span>
            ),
          },
        ]}
        actions={(item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(item)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => togglePublish(item.id, item.isPublished ?? false)}>
                {item.isPublished ? <><EyeOff className="h-4 w-4 mr-2" />Jadikan Draft</> : <><Eye className="h-4 w-4 mr-2" />Terbitkan</>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleFeatured(item.id, item.isFeatured ?? false)}>
                <Star className="h-4 w-4 mr-2" />{item.isFeatured ? "Hapus Featured" : "Jadikan Featured"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}>
                <Trash2 className="h-4 w-4 mr-2" />Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Pengumuman" : "Tambah Pengumuman Baru"}</DialogTitle>
            <DialogDescription>{editingId ? "Perbarui konten pengumuman" : "Buat pengumuman atau berita baru"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Judul</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: generateSlug(e.target.value) })} placeholder="Judul pengumuman" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="excerpt">Ringkasan (Excerpt)</Label>
              <Textarea id="excerpt" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="Ringkasan singkat pengumuman" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                <SelectContent>{announcementCategories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Konten</Label>
              <RichTextEditor content={form.content} onChange={(v: string) => setForm({ ...form, content: v })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thumbnail">Thumbnail/Gambar Sampul</Label>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" disabled={isThumbnailUploading} className="relative">
                  {isThumbnailUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  <span className="ml-2">{isThumbnailUploading ? "Mengupload..." : "Pilih Gambar"}</span>
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleThumbnailUpload} disabled={isThumbnailUploading} />
                </Button>
                {form.thumbnail && (
                  <div className="relative h-10 w-16 rounded overflow-hidden bg-muted">
                    <Image src={form.thumbnail} alt="Preview" fill className="object-cover" />
                    <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-5 w-5 bg-black/50 text-white rounded-full" onClick={() => setForm({ ...form, thumbnail: "" })}><X className="h-3 w-3" /></Button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch id="isPublished" checked={form.isPublished} onCheckedChange={(v) => setForm({ ...form, isPublished: v })} />
                <Label htmlFor="isPublished" className="text-sm cursor-pointer">Langsung Terbitkan</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="isFeatured" checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} />
                <Label htmlFor="isFeatured" className="text-sm cursor-pointer">Jadikan Featured</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Batal</Button>
            <Button type="button" onClick={handleSubmit} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengumuman?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Pengumuman akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}