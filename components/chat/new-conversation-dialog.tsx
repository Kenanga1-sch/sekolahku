"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useNewConversation } from "@/lib/hooks/use-chat";
import { useChatStore } from "@/lib/stores/chat-store";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefix route tujuan setelah percakapan dibuat. */
  basePath: string;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  basePath,
}: NewConversationDialogProps) {
  const router = useRouter();
  const { users, loading, creating, searchUsers, createConversation } =
    useNewConversation();
  const [query, setQuery] = useState("");
  const upsertConversation = useChatStore((s) => s.upsertConversation);
  const conversations = useChatStore((s) => s.conversations);

  // Muat daftar saat dialog dibuka. searchUsers di-dependensikan agar
  // dependency array stabil (useCallback di hook parent).
  useEffect(() => {
    if (open) {
      setQuery("");
      searchUsers("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setQuery(q);
      searchUsers(q);
    },
    [searchUsers]
  );

  const handleSelect = useCallback(
    async (userId: string) => {
      // Bila percakapan sudah ada, langsung buka (idempoten).
      const existing = conversations.find((c) => c.otherUser?.id === userId);
      if (existing) {
        onOpenChange(false);
        router.push(`${basePath}?c=${existing.id}`);
        return;
      }
      const convId = await createConversation(userId);
      if (convId) {
        // Masukkan placeholder ke store; detail lengkap akan terisi
        // setelah halaman percakapan memuat daftar.
        const other = users.find((u) => u.id === userId);
        if (other) {
          upsertConversation({
            id: convId,
            type: "direct",
            createdBy: "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            otherUser: other,
            lastMessage: null,
            unreadCount: 0,
            otherLastReadAt: 0,
          });
        }
        onOpenChange(false);
        router.push(`${basePath}?c=${convId}`);
      } else {
        toast.error("Gagal memulai percakapan");
        logger.error("[chat] createConversation mengembalikan null");
      }
    },
    [conversations, users, createConversation, upsertConversation, router, basePath, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-base">Percakapan Baru</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={handleSearch}
              placeholder="Cari nama atau email…"
              className="pl-8 h-9 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto px-2 pb-2">
          {loading && users.length === 0 ? (
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {query
                ? "Tidak ada pengguna yang cocok."
                : "Tidak ada pengguna lain yang aktif."}
            </p>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelect(u.id)}
                disabled={creating}
                className="flex items-center gap-3 w-full px-2 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={u.image || undefined} alt={u.name} />
                  <AvatarFallback className="text-xs">
                    {u.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? "")
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.role}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
