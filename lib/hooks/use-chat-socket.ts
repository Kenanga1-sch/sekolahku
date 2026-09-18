/**
 * useChatSocket — manajer koneksi WebSocket chat (singleton).
 *
 * - connect saat user terautentikasi, disconnect saat logout
 * - reconnect exponential backoff (1s → 2s → 4s … cap 30s), reset setelah
 *   koneksi sukses
 * - heartbeat: server mengirim {"type":"ping"} tiap 30s, kita balas pong
 * - typing: kirim event ke server (throttle 1s di sisi pengirim)
 * - semua event server di-decode dan diterapkan ke chat-store
 *
 * Dipasang sekali di layout dashboard & portal ortu (client component).
 */

"use client";

import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/auth";
import { useChatStore, type ChatMessage } from "@/lib/stores/chat-store";
import { logger } from "@/lib/logger";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const TYPING_THROTTLE_MS = 1_000;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let activeUserId: string | null = null;
/** Handler event yang dipasang oleh hook (butuh router untuk toast action). */
let onEvent: ((raw: string) => void) | null = null;

/** Tipe event yang datang dari server (minimal: type). */
interface ServerEvent {
  type: string;
  data?: unknown;
}

/** Payload per-event, menyesuaikan struktur yang dikirim backend. */
interface ConversationUpdatePayload {
  conversationId: string;
  lastMessage: ChatMessage;
}
interface TypingPayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}
interface ReadPayload {
  conversationId: string;
  lastReadAt: number;
}
interface PresencePayload {
  userId: string;
  online: boolean;
}

function buildWsUrl(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
  if (apiBase) {
    return apiBase.replace(/^http/, "ws") + "/api/chat/ws";
  }
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/api/chat/ws`;
}

function sendRaw(payload: string) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(payload);
    } catch {
      // koneksi bermasalah — reconnect loop yang akan memulihkan.
    }
  }
}

/** Buka socket (satu implementasi untuk connect & reconnect). */
function openSocket() {
  if (typeof window === "undefined") return;
  const user = auth();
  if (!user?.user?.id) {
    activeUserId = null;
    return;
  }
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  const url = buildWsUrl();
  if (!url) return;

  activeUserId = user.user.id;
  useChatStore.getState().setSocketState(
    reconnectAttempt === 0 ? "connecting" : "reconnecting"
  );

  try {
    socket = new WebSocket(url);
  } catch (err) {
    logger.error("[chat-ws] gagal membuat socket:", undefined, err as Error);
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    reconnectAttempt = 0;
    useChatStore.getState().setSocketState("connected");
  };

  socket.onmessage = (e) => {
    if (typeof e.data === "string") onEvent?.(e.data);
  };

  socket.onerror = () => {
    logger.error("[chat-ws] socket error");
  };

  socket.onclose = () => {
    socket = null;
    useChatStore.getState().setSocketState("disconnected");
    // Reconnect hanya bila masih ada sesi (logout = disconnect disengaja).
    if (activeUserId && auth()?.user?.id === activeUserId) {
      scheduleReconnect();
    }
  };
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const delay = Math.min(
    RECONNECT_BASE_MS * 2 ** reconnectAttempt,
    RECONNECT_MAX_MS
  );
  reconnectAttempt += 1;
  useChatStore.getState().setSocketState("reconnecting");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSocket();
  }, delay);
}

function disconnectSocket() {
  activeUserId = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempt = 0;
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  useChatStore.getState().setSocketState("disconnected");
}

export function useChatSocket() {
  const router = useRouter();

  const handleEvent = useCallback(
    (raw: string) => {
      let ev: ServerEvent;
      try {
        ev = JSON.parse(raw) as ServerEvent;
      } catch {
        return;
      }
      const s = useChatStore.getState();
      switch (ev.type) {
        case "ping":
          sendRaw(JSON.stringify({ type: "pong" }));
          return;
        case "message": {
          const msg = ev.data as ChatMessage;
          if (!msg?.id) return;
          s.addMessage(msg);
          const isMine = auth()?.user.id === msg.senderId;
          if (!isMine && s.activeConversationId !== msg.conversationId) {
            s.bumpUnread(msg.conversationId);
            const conv = s.conversations.find((c) => c.id === msg.conversationId);
            const senderName = conv?.otherUser?.name || "Pesan baru";
            const myRole = auth()?.user?.role;
            const base = myRole === "orangtua" ? "/parent/chat" : "/chat";
            toast(senderName, {
              description: msg.content || "Mengirim lampiran",
              action: {
                label: "Buka",
                onClick: () =>
                  router.push(`${base}?c=${msg.conversationId}`),
              },
            });
          }
          s.touchConversation(msg.conversationId, msg);
          return;
        }
        case "conversation_updated": {
          const d = ev.data as ConversationUpdatePayload;
          if (d?.conversationId && d?.lastMessage) {
            s.touchConversation(d.conversationId, d.lastMessage);
          }
          return;
        }
        case "typing": {
          const d = ev.data as TypingPayload;
          if (d?.conversationId && d?.userId) {
            s.setTyping(d.conversationId, d.userId, Boolean(d.isTyping));
          }
          return;
        }
        case "read": {
          const d = ev.data as ReadPayload;
          if (d?.conversationId && d?.lastReadAt) {
            s.markConvRead(d.conversationId, d.lastReadAt, false);
          }
          return;
        }
        case "presence": {
          const d = ev.data as PresencePayload;
          if (d?.userId) s.setPresence(d.userId, Boolean(d.online));
          return;
        }
        default:
          return;
      }
    },
    [router]
  );

  useEffect(() => {
    onEvent = handleEvent;
    const user = auth();
    if (user?.user?.id) openSocket();
    return () => {
      onEvent = null;
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { openSocket, disconnectSocket };
}

/**
 * Kirim indikator typing ke server. Throttle 1s per percakapan agar
 * tidak membanjiri socket saat user mengetik cepat.
 */
const lastTypingSent: Record<string, number> = {};
export function sendTyping(conversationId: string, isTyping: boolean) {
  const now = Date.now();
  const last = lastTypingSent[conversationId] || 0;
  if (isTyping && now - last < TYPING_THROTTLE_MS) return;
  if (isTyping) lastTypingSent[conversationId] = now;
  else delete lastTypingSent[conversationId];
  sendRaw(JSON.stringify({ type: "typing", data: { conversationId, isTyping } }));
}
