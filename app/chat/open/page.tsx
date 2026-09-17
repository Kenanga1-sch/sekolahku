"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Halaman pembuka percakapan dari notifikasi (target_url notifikasi chat
 * selalu /chat/open?c=<id>). Mengarahkan ke portal yang sesuai sesuai role:
 * orang tua → /parent/chat?c=<id>, peran lain → /chat?c=<id>.
 */
function ChatOpenInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("c");

  useEffect(() => {
    if (!conversationId) {
      router.replace("/chat");
      return;
    }
    const role = auth()?.user?.role;
    const base = role === "orangtua" ? "/parent/chat" : "/chat";
    router.replace(`${base}?c=${conversationId}`);
  }, [router, conversationId]);

  return (
    <div className="flex items-center justify-center h-[60vh]">
      <p className="text-sm text-muted-foreground">Membuka percakapan…</p>
    </div>
  );
}

export default function ChatOpenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-sm text-muted-foreground">Membuka percakapan…</p>
        </div>
      }
    >
      <ChatOpenInner />
    </Suspense>
  );
}
