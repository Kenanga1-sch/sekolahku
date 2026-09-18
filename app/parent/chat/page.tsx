"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatLayout } from "@/components/chat/chat-layout";

/**
 * Halaman chat portal orang tua. Lihat (dashboard)/chat/page.tsx untuk
 * alasan memakai query param ?c=<id> dan Suspense.
 */
function ParentChatInner() {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("c");

  return (
    <div className="h-full rounded-lg border overflow-hidden bg-background">
      <ChatLayout conversationId={conversationId} basePath="/parent/chat" />
    </div>
  );
}

export default function ParentChatPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full rounded-lg border bg-muted animate-pulse" />
      }
    >
      <ParentChatInner />
    </Suspense>
  );
}
