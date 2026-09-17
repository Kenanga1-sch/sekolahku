"use client";

import { useCallback, useRef, useState } from "react";
import { Paperclip, Send, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { goFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { useChatConversation } from "@/lib/hooks/use-chat";
import { sendTyping } from "@/lib/hooks/use-chat-socket";

const MAX_FILE_MB = 5;

interface ChatComposerProps {
  conversationId: string;
}

export function ChatComposer({ conversationId }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<{
    url: string;
    kind: string;
    name: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const { sendMessage, sending } = useChatConversation(conversationId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleSend = useCallback(async () => {
    const content = text;
    if (!content.trim() && !attachment) return;
    const att = attachment;
    setText("");
    setAttachment(null);
    // Reset tinggi textarea.
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendTyping(conversationId, false);
    await sendMessage(content, att || undefined);
  }, [text, attachment, conversationId, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter = kirim (desktop), Shift+Enter = baris baru.
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      // sendTyping sudah throttle 1s secara internal.
      sendTyping(conversationId, e.target.value.trim().length > 0);
    },
    [conversationId]
  );

  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Ukuran file maksimal ${MAX_FILE_MB} MB`);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "chat");
      const res = await goFetch<{ success: boolean; url: string }>(
        "/api/upload",
        { method: "POST", body: form, skipRetry: true }
      );
      if (res?.success && res.url) {
        const isImage = file.type.startsWith("image/");
        setAttachment({
          url: res.url,
          kind: isImage ? "image" : "file",
          name: file.name,
        });
      } else {
        toast.error("Gagal mengunggah file");
      }
    } catch {
      toast.error("Gagal mengunggah file");
    } finally {
      setUploading(false);
    }
  }, []);

  return (
    <div className="border-t bg-background p-2.5 sm:p-3">
      {attachment && (
        <div className="flex items-center gap-2 mb-2 bg-muted rounded-lg px-2.5 py-1.5 text-sm">
          {attachment.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attachment.url}
              alt={attachment.name}
              className="h-9 w-9 rounded object-cover"
            />
          ) : (
            <span className="text-xs truncate max-w-[200px]">
              {attachment.name}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 ml-auto"
            onClick={() => setAttachment(null)}
            aria-label="Hapus lampiran"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || sending}
          aria-label="Lampirkan file"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Tulis pesan…"
          rows={1}
          className={cn(
            "min-h-[38px] max-h-32 resize-none rounded-2xl py-2 text-sm leading-snug"
          )}
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          onClick={handleSend}
          disabled={sending || (!text.trim() && !attachment)}
          aria-label="Kirim pesan"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
