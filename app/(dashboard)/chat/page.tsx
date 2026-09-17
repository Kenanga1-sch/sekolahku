"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatLayout } from "@/components/chat/chat-layout";

/**
 * Halaman chat dashboard. Id percakapan dibaca dari query param ?c=<id>
 * (bukan dynamic route) karena aplikasi adalah static export murni.
 * useSearchParams harus dibungkus Suspense saat prerender statis.
 */
function ChatInner() {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("c");

  return (
    <div className="h-[calc(100dvh-8.5rem)] md:h-full rounded-lg border overflow-hidden bg-background">
      <ChatLayout conversationId={conversationId} basePath="/chat" />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[calc(100dvh-8.5rem)] md:h-full rounded-lg border bg-muted animate-pulse" />
      }
    >
      <ChatInner />
    </Suspense>
  );
}
