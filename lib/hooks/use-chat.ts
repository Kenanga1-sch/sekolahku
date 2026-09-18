/**
 * useChat — akses data chat (REST) + integrasi store real-time.
 *
 * Semua panggilan REST memakai goGet/goPost (cookie session + CSRF token
 * otomatis). Pesan baru masuk lewat WS (use-chat-socket) dan ditambahkan
 * ke store oleh handler event; hook ini hanya membaca store.
 */

"use client";

import { useCallback, useState } from "react";
import { goGet, goPost } from "@/lib/api-client";
import { logger } from "@/lib/logger";
import {
  useChatStore,
  type ChatConversation,
  type ChatMessage,
  type ChatUserSummary,
} from "@/lib/stores/chat-store";
import { sendTyping } from "@/lib/hooks/use-chat-socket";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  total?: number;
}

interface HistoryResponse {
  data: ChatMessage[];
  nextCursor: number | null;
  hasMore: boolean;
}

/**
 * Referensi array kosong stabil. Selector zustand v5 (useSyncExternalStore)
 * tidak boleh mengembalikan reference baru saat tidak ada data — React
 * mendeteksinya sebagai perubahan state dan re-render tanpa henti
 * (Minified React error #185).
 */
const EMPTY_MESSAGES: ChatMessage[] = [];

export function useChat() {
  const conversations = useChatStore((s) => s.conversations);
  const socketState = useChatStore((s) => s.socketState);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);

  const loadConversations = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingConvs(true);
    setConvError(null);
    try {
      const res = await goGet<ApiResponse<ChatConversation[]>>("/api/chat/conversations");
      if (res?.success && Array.isArray(res.data)) {
        useChatStore.getState().setConversations(res.data);
      }
    } catch (err) {
      logger.error("[chat] gagal memuat percakapan:", undefined, err as Error);
      setConvError("Gagal memuat percakapan");
    } finally {
      if (showLoading) setLoadingConvs(false);
    }
  }, []);

  return {
    conversations,
    socketState,
    loadingConvs,
    convError,
    loadConversations,
  };
}

/**
 * useChatConversation — pesan & aksi dalam satu percakapan.
 */
export function useChatConversation(conversationId: string | null) {
  const messages = useChatStore((s) =>
    conversationId ? s.messagesByConv[conversationId] || EMPTY_MESSAGES : EMPTY_MESSAGES
  );
  const cursor = useChatStore((s) =>
    conversationId ? s.cursorByConv[conversationId] ?? null : null
  );
  const hasMore = useChatStore((s) =>
    conversationId ? s.hasMoreByConv[conversationId] ?? false : false
  );
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setActive = useCallback(() => {
    useChatStore.getState().setActiveConversation(conversationId);
    return () => {
      const cur = useChatStore.getState().activeConversationId;
      if (cur === conversationId) {
        useChatStore.getState().setActiveConversation(null);
      }
    };
  }, [conversationId]);

  const loadMessages = useCallback(
    async (opts?: { prepend?: boolean }) => {
      if (!conversationId) return;
      if (opts?.prepend && !hasMore) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: "50" });
        const cur = useChatStore.getState().cursorByConv[conversationId];
        if (opts?.prepend && cur != null) params.set("cursor", String(cur));
        const res = await goGet<ApiResponse<HistoryResponse>>(
          `/api/chat/conversations/${conversationId}/messages?${params.toString()}`
        );
        if (res?.success && res.data) {
          const { data, nextCursor, hasMore: more } = res.data;
          useChatStore.getState().setMessages(conversationId, data, opts);
          useChatStore.getState().setPagination(conversationId, nextCursor, more);
        }
      } catch (err) {
        logger.error("[chat] gagal memuat pesan:", undefined, err as Error);
        setError("Gagal memuat pesan");
      } finally {
        setLoading(false);
      }
    },
    [conversationId, hasMore]
  );

  const markRead = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await goPost<ApiResponse<{ lastReadAt: number }>>(
        `/api/chat/conversations/${conversationId}/read`
      );
      if (res?.success && res.data?.lastReadAt) {
        useChatStore
          .getState()
          .markConvRead(conversationId, res.data.lastReadAt, true);
      }
    } catch (err) {
      logger.error("[chat] gagal menandai dibaca:", undefined, err as Error);
    }
  }, [conversationId]);

  const sendMessage = useCallback(
    async (content: string, attachment?: { url: string; kind: string; name?: string }) => {
      if (!conversationId) return null;
      if (!content.trim() && !attachment) return null;
      setSending(true);
      setError(null);
      try {
        const res = await goPost<ApiResponse<ChatMessage>>(
          `/api/chat/conversations/${conversationId}/messages`,
          {
            content: content.trim(),
            attachmentUrl: attachment?.url || null,
            attachmentKind: attachment?.kind || null,
            attachmentName: attachment?.name || null,
          }
        );
        if (res?.success && res.data) {
          // Tambahkan ke store (WS akan mengirimkannya juga ke tab lain;
          // store mendedupiasi berdasarkan id).
          useChatStore.getState().addMessage(res.data);
          useChatStore.getState().touchConversation(conversationId, res.data);
          return res.data;
        }
        setError("Gagal mengirim pesan");
        return null;
      } catch (err) {
        logger.error("[chat] gagal mengirim pesan:", undefined, err as Error);
        setError("Gagal mengirim pesan");
        return null;
      } finally {
        setSending(false);
      }
    },
    [conversationId]
  );

  const notifyTyping = useCallback(
    (isTyping: boolean) => {
      if (conversationId) sendTyping(conversationId, isTyping);
    },
    [conversationId]
  );

  return {
    messages,
    cursor,
    hasMore,
    loading,
    sending,
    error,
    setActive,
    loadMessages,
    loadOlder: () => loadMessages({ prepend: true }),
    markRead,
    sendMessage,
    notifyTyping,
  };
}

/**
 * useNewConversation — cari user & mulai percakapan baru.
 */
export function useNewConversation() {
  const [users, setUsers] = useState<ChatUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const searchUsers = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await goGet<ApiResponse<ChatUserSummary[]>>(
        `/api/chat/users?q=${encodeURIComponent(q)}&limit=20`
      );
      if (res?.success && Array.isArray(res.data)) setUsers(res.data);
    } catch (err) {
      logger.error("[chat] gagal mencari user:", undefined, err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const createConversation = useCallback(
    async (participantId: string): Promise<string | null> => {
      setCreating(true);
      try {
        const res = await goPost<ApiResponse<{ id: string }>>(
          "/api/chat/conversations",
          { participantId }
        );
        return res?.success && res.data?.id ? res.data.id : null;
      } catch (err) {
        logger.error("[chat] gagal membuat percakapan:", undefined, err as Error);
        return null;
      } finally {
        setCreating(false);
      }
    },
    []
  );

  return { users, loading, creating, searchUsers, createConversation };
}
