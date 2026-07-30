"use client";

import { useState, useCallback, useEffect } from "react";
import { goGet, goPost, goPatch, goDelete } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import { compressImage } from "@/lib/utils";
import type { Announcement } from "@/types";

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

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function useAnnouncements(active: boolean) {
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [isThumbnailUploading, setIsThumbnailUploading] = useState(false);

  const [form, setForm] = useState({
    title: "", slug: "", excerpt: "", content: "", category: "pengumuman",
    thumbnail: "", isPublished: false, isFeatured: false,
  });

  const fetchAnnouncements = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data: any = await goGet("/api/announcements?all=true&limit=100");
      setAnnouncements((data.data || []).map(normalizeAnnouncement));
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
      showError("Gagal memuat pengumuman");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (active) fetchAnnouncements(); }, [active, fetchAnnouncements]);

  const resetForm = () => {
    setForm({ title: "", slug: "", excerpt: "", content: "", category: "pengumuman", thumbnail: "", isPublished: false, isFeatured: false });
    setEditingId(null);
    setDialogOpen(false);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (item: Announcement) => {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      slug: item.slug || "",
      excerpt: item.excerpt || "",
      content: item.content || "",
      category: item.category || "pengumuman",
      thumbnail: item.thumbnail || "",
      isPublished: item.isPublished || false,
      isFeatured: item.isFeatured || false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const data = {
        title: form.title,
        slug: form.slug || generateSlug(form.title),
        excerpt: form.excerpt,
        content: form.content,
        category: form.category,
        thumbnail: form.thumbnail,
        is_published: form.isPublished,
        is_featured: form.isFeatured,
      };
      if (editingId) {
        await goPatch(`/api/announcements/${editingId}`, data);
        showSuccess("Pengumuman berhasil diperbarui");
      } else {
        await goPost("/api/announcements", data);
        showSuccess("Pengumuman baru berhasil dibuat");
      }
      fetchAnnouncements(true);
      resetForm();
    } catch (error: any) {
      showError(error.message || "Gagal menyimpan pengumuman");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await goDelete(`/api/announcements/${deleteId}`);
      setDeleteId(null);
      showSuccess("Pengumuman berhasil dihapus");
      fetchAnnouncements(true);
    } catch (error: any) {
      showError(error.message || "Gagal menghapus pengumuman");
    }
  };

  const togglePublish = async (id: string, current: boolean) => {
    try {
      await goPatch(`/api/announcements/${id}`, { is_published: !current });
      fetchAnnouncements(true);
    } catch { showError("Gagal merubah status terbit"); }
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    try {
      await goPatch(`/api/announcements/${id}`, { is_featured: !current });
      fetchAnnouncements(true);
    } catch { showError("Gagal merubah status featured"); }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsThumbnailUploading(true);
    let uploadFile = file;
    try {
      if (file.type.startsWith("image/")) uploadFile = await compressImage(file, 1024, 0.85);
    } catch { /* ignore */ }
    const formDataUpload = new FormData();
    formDataUpload.append("file", uploadFile);
    formDataUpload.append("folder", "announcements");
    try {
      const data: any = await goPost("/api/upload", formDataUpload);
      if (data.error) throw new Error(data.error || "Upload failed");
      setForm((prev) => ({ ...prev, thumbnail: data.url }));
    } catch (error) {
      showError("Gagal mengupload gambar: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally { setIsThumbnailUploading(false); }
  };

  const filtered = announcements.filter(
    (a) => a.title?.toLowerCase().includes(search.toLowerCase()) || a.excerpt?.toLowerCase().includes(search.toLowerCase())
  );

  return {
    announcements, loading, search, setSearch, filtered,
    dialogOpen, setDialogOpen, editingId, deleteId, setDeleteId, isSaving, form, setForm,
    isThumbnailUploading, resetForm, openCreate, openEdit,
    handleSubmit, handleDelete, togglePublish, toggleFeatured, handleThumbnailUpload, fetchAnnouncements,
  };
}