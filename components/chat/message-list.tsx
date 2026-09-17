"use client";

import { useCallback, useEffect, useRef } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "@/components/chat/message-bubble";
import { useChatConversation } from "@/lib/hooks/use-chat";
import { useChatStore, type ChatMessage } from "@/lib/stores/chat-store";
import { auth } from "@/lib/auth";

function dayLabel(ts: number): string {
  const d = new Date(ts);
  if (isToday(d)) return "Hari ini";
  if (isYesterday(d)) return "Kemarin";
  return format(d, "d MMMM yyyy");
}

export function MessageList({ conversationId }: { conversationId: string }) {
  const {
    messages,
    hasMore,
    loading,
    loadMessages,
    loadOlder,
    markRead,
  } = useChatConversation(conversationId);
  const otherUser = useChatStore(
    (s) => s.conversations.find((c) => c.id === conversationId)?.otherUser ?? null
  );
  const otherLastReadAt = useChatStore(
    (s) => s.conversations.find((c) => c.id === conversationId)?.otherLastReadAt ?? 0
  );
  const isTyping = useChatStore((s) =>
    Object.keys(s.typing).some((k) => k.startsWith(`${conversationId}:`))
  );

  const myId = auth()?.user.id;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const nearBottom = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  // Muat pesan awal sekali per percakapan, lalu tandai dibaca.
  useEffect(() => {
    let cancelled = false;
    const loaded = useChatStore.getState().messagesByConv[conversationId];
    const p = loaded ? Promise.resolve() : loadMessages();
    p.finally(() => {
      if (cancelled) return;
      markRead();
      requestAnimationFrame(() => scrollToBottom("auto"));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Pesan masuk saat percakapan aktif → tandai dibaca + auto-scroll.
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.senderId !== myId) markRead();
    if (nearBottom.current) scrollToBottom("smooth");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const handleScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    nearBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const handleLoadOlder = useCallback(() => {
    const prevH = viewportRef.current?.scrollHeight ?? 0;
    loadOlder().then(() => {
      requestAnimationFrame(() => {
        if (viewportRef.current) {
          // Pertahankan posisi baca saat pesan lama disisipkan di atas.
          viewportRef.current.scrollTop =
            viewportRef.current.scrollHeight - prevH;
          nearBottom.current = false;
        }
      });
    });
  }, [loadOlder]);

  // Kelompokkan per hari untuk separator.
  const groups: { label: string; items: ChatMessage[] }[] = [];
  for (const m of messages) {
    const label = dayLabel(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(m);
    else groups.push({ label, items: [m] });
  }

  const typingName =
    isTyping && otherUser?.name ? otherUser.name.split(" ")[0] : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex justify-center py-1.5">
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLoadOlder}
            disabled={loading}
            className="text-xs h-7"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Muat pesan lama"
            )}
          </Button>
        )}
      </div>
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4"
      >
        <div className="flex flex-col gap-1.5 py-2">
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col gap-1.5">
              <div className="flex justify-center my-1">
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {g.label}
                </span>
              </div>
              {g.items.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isMine={m.senderId === myId}
                  otherUser={otherUser}
                  readByOther={otherLastReadAt >= m.createdAt}
                  showAvatar={
                    i === g.items.length - 1 ||
                    g.items[i + 1].senderId !== m.senderId
                  }
                />
              ))}
            </div>
          ))}
          {typingName && (
            <div className="flex items-end gap-2">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-sm">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground mb-1">
                {typingName} sedang mengetik…
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
