"use client";

import { Folder, File as FileIcon, Image as ImageIcon, Video, Music, FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import * as cloud from "@/lib/cloudstorage/api";
import type { CloudFile } from "@/lib/cloudstorage/api";

export function KindIcon({ file, className }: { file: CloudFile; className?: string }) {
  const kind = cloud.fileKind(file);
  const cls = cn("h-6 w-6", className);
  switch (kind) {
    case "folder":
      return <Folder className={cn(cls, "text-emerald-600")} />;
    case "image":
      return <ImageIcon className={cn(cls, "text-sky-600")} />;
    case "video":
      return <Video className={cn(cls, "text-violet-600")} />;
    case "audio":
      return <Music className={cn(cls, "text-pink-600")} />;
    case "pdf":
      return <FileText className={cn(cls, "text-rose-600")} />;
    case "doc":
      return <FileText className={cn(cls, "text-amber-600")} />;
    default:
      return <FileIcon className={cn(cls, "text-neutral-500")} />;
  }
}

/** Format tanggal ringkas dari Unix seconds. */
export function formatDate(ts: number): string {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
