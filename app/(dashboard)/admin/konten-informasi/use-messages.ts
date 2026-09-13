"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getContactMessagesAction, markMessageAsReadAction, deleteMessageAction, updateMessageStatusAction } from "@/actions/contact";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  category?: string;
  status?: string;
  ticket?: string;
  isRead: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ContactMessagePayload {
  items?: ContactMessage[];
  total?: number;
  page?: number;
  perPage?: number;
  totalPages?: number;
}

function normalizeMessages(payload: unknown): ContactMessagePayload {
  if (Array.isArray(payload)) {
    return { items: payload, total: payload.length, page: 1, perPage: payload.length, totalPages: 1 };
  }
  if (payload && typeof payload === "object") {
    const response = payload as { data?: ContactMessagePayload | ContactMessage[] };
    if (Array.isArray(response.data)) {
      return { items: response.data, total: response.data.length, page: 1, perPage: response.data.length, totalPages: 1 };
    }
    if (response.data && typeof response.data === "object") {
      return response.data as ContactMessagePayload;
    }
  }
  return { items: [], total: 0, page: 1, perPage: 20, totalPages: 1 };
}

export function useMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [pagination, setPagination] = useState<ContactMessagePayload>({ total: 0, page: 1, perPage: 20, totalPages: 1 });

  const fetchMessages = useCallback(async (cat: string, silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await getContactMessagesAction(cat || undefined);
      if (res.success) {
        const payload = normalizeMessages(res.data);
        setMessages(payload.items || []);
        setPagination(payload);
      } else {
        setError(res.error || "Gagal memuat pesan");
        toast.error(res.error || "Gagal memuat pesan");
      }
    } catch (err) {
      console.error(err);
      setError("Gagal memuat pesan");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchMessages(category, true);
  }, [category, fetchMessages]);

  useEffect(() => { fetchMessages(""); }, [fetchMessages]);

  // Ganti filter kategori lalu muat ulang.
  const changeCategory = useCallback((cat: string) => {
    setCategory(cat);
    fetchMessages(cat);
  }, [fetchMessages]);

  const handleMarkAsRead = useCallback(async (msgId: string) => {
    const res = await markMessageAsReadAction(msgId);
    if (res.success) {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, isRead: true } : m)));
    } else {
      toast.error(res.error || "Gagal memperbarui status pesan");
    }
  }, []);

  const handleUpdateStatus = useCallback(async (msgId: string, status: string) => {
    const res = await updateMessageStatusAction(msgId, status);
    if (res.success) {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status, isRead: true } : m)));
      toast.success("Status laporan diperbarui");
    } else {
      toast.error(res.error || "Gagal memperbarui status");
    }
  }, []);

  const handleDelete = useCallback(async (msgId: string) => {
    const res = await deleteMessageAction(msgId);
    if (res.success) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      setPagination((prev) => ({ ...prev, total: Math.max((prev.total || 1) - 1, 0) }));
      toast.success("Pesan berhasil dihapus");
    } else {
      toast.error(res.error || "Gagal menghapus pesan");
    }
  }, []);

  return { messages, loading, refreshing, error, pagination, category, changeCategory, refresh, handleMarkAsRead, handleUpdateStatus, handleDelete };
}

