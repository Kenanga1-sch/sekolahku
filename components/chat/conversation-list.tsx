"use client";

import { format, isToday, isYesterday } from "date-fns";
import { MessageSquarePlus, Search } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { NoDataFound } from "@/components/empty-state";
import { useChat } from "@/lib/hooks/use-chat";
import { useChatStore, type ChatConversation } from "@/lib/stores/chat-store";
import { cn } from "@/lib/utils";
import { useState } from "react";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function lastMessageTime(ts: number): string {
  const d = new Date(ts);
  if (isToday(d)) return format(d, "HH.mm");
  if (isYesterday(d)) return "Kemarin";
  return format(d, "d/MM/yy");
}

interface ConversationListProps {
  /** Prefix route: "/chat" (dashboard) atau "/parent/chat" (portal ortu). */
  basePath: string;
  activeId?: string | null;
  onSelect?: (convId: string) => void;
  onNewClick?: () => void;
}

export function ConversationList({
  basePath,
  activeId,
  onSelect,
  onNewClick,
}: ConversationListProps) {
  const { conversations, loadingConvs } = useChat();
  const presence = useChatStore((s) => s.presence);
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? conversations.filter((c) =>
        c.otherUser?.name?.toLowerCase().includes(query.trim().toLowerCase())
      )
    : conversations;

  if (loadingConvs && conversations.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2.5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <NoDataFound message="Belum ada percakapan. Mulai chat dengan rekan sekolah." />
        {onNewClick && (
          <Button onClick={onNewClick} size="sm">
            <MessageSquarePlus className="h-4 w-4" />
            Percakapan Baru
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-2.5 border-b space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold flex-1">Pesan</h2>
          {onNewClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNewClick}
              className="h-7 text-xs"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Baru
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari percakapan…"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground p-6">
            Tidak ada percakapan yang cocok.
          </p>
        ) : (
          filtered.map((conv) => (
            <ConversationRow
              key={conv.id}
              conv={conv}
              basePath={basePath}
              active={conv.id === activeId}
              online={presence[conv.otherUser?.id || ""] === true}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ConversationRow({
  conv,
  basePath,
  active,
  online,
  onSelect,
}: {
  conv: ChatConversation;
  basePath: string;
  active: boolean;
  online: boolean;
  onSelect?: (convId: string) => void;
}) {
  const name = conv.otherUser?.name || "Pengguna";
  const preview = conv.lastMessage?.content || "Lampiran";
  const time = conv.lastMessage ? lastMessageTime(conv.lastMessage.createdAt) : "";

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 transition-colors cursor-pointer border-l-2",
        active
          ? "bg-muted border-l-blue-600"
          : "hover:bg-muted/50 border-l-transparent"
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={conv.otherUser?.image || undefined} alt={name} />
          <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
        </Avatar>
        {online && (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{name}</span>
          {time && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {time}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-xs truncate",
              conv.unreadCount > 0
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            )}
          >
            {preview}
          </span>
          {conv.unreadCount > 0 && (
            <Badge className="h-4.5 min-w-[18px] px-1 text-[10px] rounded-full shrink-0">
              {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(conv.id)}
        className="w-full text-left block"
      >
        {content}
      </button>
    );
  }
  return (
    <Link href={`${basePath}?c=${conv.id}`} className="block">
      {content}
    </Link>
  );
}
