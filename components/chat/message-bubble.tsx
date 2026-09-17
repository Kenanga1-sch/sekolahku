"use client";

import { format } from "date-fns";
import { Check, CheckCheck, FileText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatUserSummary } from "@/lib/stores/chat-store";

interface MessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  otherUser?: ChatUserSummary | null;
  /** Pesan saya terbaca oleh lawan bicara (tick biru). */
  readByOther: boolean;
  /** Tampilkan avatar (hanya pesan lawan bicara, sisi kiri). */
  showAvatar?: boolean;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function MessageBubble({
  message,
  isMine,
  otherUser,
  readByOther,
  showAvatar,
}: MessageBubbleProps) {
  const time = format(new Date(message.createdAt), "HH.mm");
  const hasAttachment = Boolean(message.attachmentUrl);
  const isImage = message.attachmentKind === "image";

  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isMine ? "justify-end" : "justify-start"
      )}
    >
      {!isMine && showAvatar !== false && (
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage src={otherUser?.image || undefined} alt={otherUser?.name || ""} />
          <AvatarFallback className="text-[10px]">
            {initials(otherUser?.name || otherUser?.email || "?")}
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          "max-w-[78%] sm:max-w-[65%] rounded-2xl px-3 py-2 shadow-sm",
          isMine
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        {hasAttachment && isImage && (
          <a
            href={message.attachmentUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-1 rounded-lg overflow-hidden bg-black/5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.attachmentUrl || ""}
              alt={message.attachmentName || "lampiran"}
              className="max-h-52 w-auto object-cover"
            />
          </a>
        )}
        {hasAttachment && !isImage && (
          <a
            href={message.attachmentUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 mb-1 text-sm underline underline-offset-2",
              isMine ? "text-blue-50" : "text-blue-600"
            )}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate max-w-[180px]">
              {message.attachmentName || "Lampiran"}
            </span>
          </a>
        )}
        {message.content && (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        )}
        <div
          className={cn(
            "flex items-center gap-1 mt-0.5 text-[10px]",
            isMine ? "text-blue-100/80 justify-end" : "text-muted-foreground"
          )}
        >
          <span>{time}</span>
          {isMine &&
            (readByOther ? (
              <CheckCheck className="h-3 w-3" aria-label="Sudah dibaca" />
            ) : (
              <Check className="h-3 w-3" aria-label="Terkirim" />
            ))}
        </div>
      </div>
    </div>
  );
}
