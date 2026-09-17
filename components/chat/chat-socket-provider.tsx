"use client";

import React, { useEffect } from "react";
import { useChatSocket } from "@/lib/hooks/use-chat-socket";
import { useChat } from "@/lib/hooks/use-chat";
import { auth } from "@/lib/auth";

/**
 * ChatSocketProvider — memasang koneksi WebSocket chat sekali untuk seluruh
 * aplikasi dan memuat daftar percakapan saat user terautentikasi.
 *
 * Diletakkan di layout dashboard & portal ortu. Karena aplikasi adalah
 * static export, seluruh logika bersifat client-side.
 */
export function ChatSocketProvider({ children }: { children: React.ReactNode }) {
  useChatSocket();
  const { loadConversations } = useChat();

  useEffect(() => {
    // Hanya muat percakapan bila ada sesi (cookie user_info).
    if (auth()?.user?.id) {
      loadConversations(false);
    }
  }, [loadConversations]);

  return <>{children}</>;
}
