/**
 * Chat store (zustand) — state real-time fitur chat.
 *
 * Sumber kebenaran pesan adalah backend; store ini menampung:
 *  - daftar percakapan (di-fetch via REST, diupdate oleh event WS)
 *  - pesan per percakapan (di-fetch via REST, ditambah oleh event WS)
 *  - indikator typing & presence per user
 *  - status koneksi socket
 *
 * Dedup pesan berdasarkan id: pesan yang dikirim via POST akan juga
 * dikirim balik ke tab pengirim melalui WS (supaya tab lain sinkron),
 * sehingga event message bisa menerima pesan yang sudah ada.
 */

import { create } from "zustand";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachmentUrl: string | null;
  attachmentKind: string | null;
  attachmentName: string | null;
  createdAt: number;
  editedAt?: number | null;
  deletedAt?: number | null;
}

export interface ChatUserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string | null;
}

export interface ChatConversation {
  id: string;
  type: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  otherUser: ChatUserSummary | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  otherLastReadAt: number;
}

export type SocketState = "disconnected" | "connecting" | "connected" | "reconnecting";

interface ChatState {
  socketState: SocketState;
  conversations: ChatConversation[];
  /** Pesan per percakapan, terurut kronologis. */
  messagesByConv: Record<string, ChatMessage[]>;
  /** Cursor pagination per percakapan (createdAt pesan terlama). */
  cursorByConv: Record<string, number | null>;
  hasMoreByConv: Record<string, boolean>;
  /** User yang sedang mengetik: key `${convId}:${userId}`. */
  typing: Record<string, boolean>;
  /** User online: userId -> true. */
  presence: Record<string, boolean>;
  /** Percakapan yang sedang dibuka (untuk suppress notifikasi toast). */
  activeConversationId: string | null;

  setSocketState: (s: SocketState) => void;
  setConversations: (convs: ChatConversation[]) => void;
  upsertConversation: (conv: ChatConversation) => void;
  /** Update percakapan karena ada pesan baru (dipindah ke atas). */
  touchConversation: (convId: string, lastMessage: ChatMessage) => void;
  setMessages: (convId: string, messages: ChatMessage[], opts?: { prepend?: boolean }) => void;
  setPagination: (convId: string, cursor: number | null, hasMore: boolean) => void;
  addMessage: (msg: ChatMessage) => void;
  markConvRead: (convId: string, lastReadAt: number, byMe: boolean) => void;
  bumpUnread: (convId: string) => void;
  setTyping: (convId: string, userId: string, isTyping: boolean) => void;
  setPresence: (userId: string, online: boolean) => void;
  setActiveConversation: (convId: string | null) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  socketState: "disconnected",
  conversations: [],
  messagesByConv: {},
  cursorByConv: {},
  hasMoreByConv: {},
  typing: {},
  presence: {},
  activeConversationId: null,

  setSocketState: (s) => set({ socketState: s }),

  setConversations: (convs) => set({ conversations: convs }),

  upsertConversation: (conv) =>
    set((state) => {
      const idx = state.conversations.findIndex((c) => c.id === conv.id);
      const next = state.conversations.slice();
      if (idx >= 0) next[idx] = { ...next[idx], ...conv };
      else next.unshift(conv);
      return { conversations: next };
    }),

  touchConversation: (convId, lastMessage) =>
    set((state) => {
      const idx = state.conversations.findIndex((c) => c.id === convId);
      if (idx < 0) return state;
      const next = state.conversations.slice();
      const conv = next[idx];
      next.splice(idx, 1);
      conv.lastMessage = lastMessage;
      conv.updatedAt = lastMessage.createdAt;
      next.unshift(conv);
      return { conversations: next };
    }),

  setMessages: (convId, messages, opts) =>
    set((state) => {
      const existing = opts?.prepend
        ? state.messagesByConv[convId] || []
        : [];
      const merged = opts?.prepend
        ? [...messages, ...existing]
        : messages;
      return {
        messagesByConv: { ...state.messagesByConv, [convId]: merged },
      };
    }),

  setPagination: (convId, cursor, hasMore) =>
    set((state) => ({
      cursorByConv: { ...state.cursorByConv, [convId]: cursor },
      hasMoreByConv: { ...state.hasMoreByConv, [convId]: hasMore },
    })),

  addMessage: (msg) =>
    set((state) => {
      const list = state.messagesByConv[msg.conversationId] || [];
      // Dedup by id: tab pengirim sudah punya pesan ini dari respons POST.
      if (list.some((m) => m.id === msg.id)) return state;
      return {
        messagesByConv: {
          ...state.messagesByConv,
          [msg.conversationId]: [...list, msg],
        },
      };
    }),

  markConvRead: (convId, lastReadAt, byMe) =>
    set((state) => {
      const conversations = state.conversations.map((c) => {
        if (c.id !== convId) return c;
        return {
          ...c,
          unreadCount: byMe ? 0 : c.unreadCount,
          otherLastReadAt: byMe ? c.otherLastReadAt : lastReadAt,
        };
      });
      return { conversations };
    }),

  bumpUnread: (convId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId ? { ...c, unreadCount: c.unreadCount + 1 } : c
      ),
    })),

  setTyping: (convId, userId, isTyping) =>
    set((state) => {
      const key = `${convId}:${userId}`;
      const next = { ...state.typing };
      if (isTyping) next[key] = true;
      else delete next[key];
      return { typing: next };
    }),

  setPresence: (userId, online) =>
    set((state) => {
      if (state.presence[userId] === online) return state;
      return { presence: { ...state.presence, [userId]: online } };
    }),

  setActiveConversation: (convId) => set({ activeConversationId: convId }),

  reset: () =>
    set({
      socketState: "disconnected",
      conversations: [],
      messagesByConv: {},
      cursorByConv: {},
      hasMoreByConv: {},
      typing: {},
      presence: {},
      activeConversationId: null,
    }),
}));

/** Helper: jumlah total pesan belum dibaca (untuk badge). */
export function totalUnread(state: ChatState): number {
  return state.conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
}
