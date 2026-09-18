"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationList } from "@/components/chat/conversation-list";
import { MessageList } from "@/components/chat/message-list";
import { ChatComposer } from "@/components/chat/chat-composer";
import { NewConversationDialog } from "@/components/chat/new-conversation-dialog";
import { useChatStore } from "@/lib/stores/chat-store";
import { useChatConversation } from "@/lib/hooks/use-chat";
import { sendActiveConversation } from "@/lib/hooks/use-chat-socket";
import { cn } from "@/lib/utils";

interface ChatLayoutProps {
  /** null di halaman daftar; id di halaman percakapan. */
  conversationId: string | null;
  /** Prefix route: "/chat" atau "/parent/chat". */
  basePath: string;
}

export function ChatLayout({ conversationId, basePath }: ChatLayoutProps) {
  const router = useRouter();
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const conversation = useChatStore((s) =>
    conversationId ? s.conversations.find((c) => c.id === conversationId) : null
  );
  const { setActive } = useChatConversation(conversationId);

  // Tandai percakapan aktif (suppress toast + auto mark-read); bersihkan
  // saat keluar. setActive adalah useCallback yang bergantung conversationId.
  // Cleanup-nya WAJIB dikembalikan agar status pecakapan tidak tersangkut
  // setelah pengguna keluar (notifikasi untuk percakapan terakhir akan
  // tertekan selamanya). Beri tahu juga server via WS untuk gating push.
  useEffect(() => {
    const cleanup = setActive();
    sendActiveConversation(conversationId);
    return () => {
      cleanup();
      sendActiveConversation(null);
    };
  }, [setActive, conversationId]);

  const otherName = conversation?.otherUser?.name || "Percakapan";
  const otherId = conversation?.otherUser?.id || null;
  const online = useChatStore((s) =>
    otherId ? s.presence[otherId] === true : false
  );

  const showThread = Boolean(conversationId);

  return (
    <>
      <div className="flex h-full overflow-hidden bg-background">
        {/* Pane daftar — tersembunyi di mobile saat thread terbuka */}
        <div
          className={cn(
            "w-full md:w-[340px] md:border-r shrink-0 flex flex-col",
            showThread && "hidden md:flex"
          )}
        >
          <ConversationList
            basePath={basePath}
            activeId={conversationId}
            onNewClick={() => setNewDialogOpen(true)}
          />
        </div>

        {/* Pane thread */}
        <div
          className={cn(
            "flex-1 flex-col min-w-0",
            showThread ? "flex" : "hidden md:flex"
          )}
        >
          {showThread ? (
            <>
              <header className="flex items-center gap-2 border-b px-3 py-2.5 bg-background">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 md:hidden"
                  onClick={() => router.push(basePath)}
                  aria-label="Kembali"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{otherName}</p>
                  <p
                    className={cn(
                      "text-[10px]",
                      online ? "text-green-600" : "text-muted-foreground"
                    )}
                  >
                    {online ? "Sedang online" : "Offline"}
                  </p>
                </div>
              </header>
              <MessageList conversationId={conversationId as string} />
              <ChatComposer conversationId={conversationId as string} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Pilih percakapan</p>
                <p className="text-xs text-muted-foreground max-w-[240px]">
                  Pilih percakapan di samping atau mulai percakapan baru untuk
                  mengirim pesan.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <NewConversationDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        basePath={basePath}
      />
    </>
  );
}
