"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { goPost } from "@/lib/api-client";
import { showError } from "@/lib/toast";

interface MediaUploaderProps {
  value?: string;
  onChange: (url: string | null, mediaType?: string | null) => void;
  disabled?: boolean;
  /** Jenis media yang diizinkan. Default: gambar saja (perilaku lama). */
  allow?: "image" | "audio" | "video" | "all";
}

const ACCEPT: Record<string, string> = {
  image: "image/jpeg,image/png,image/webp,image/gif",
  audio: "audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/mp4",
  video: "video/mp4,video/webm,video/ogg",
};

function mediaTypeOf(mime: string): string | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return null;
}

export function MediaUploader({ value, onChange, disabled, allow = "image" }: MediaUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedType, setUploadedType] = useState<string>("image");
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = allow === "all" ? [ACCEPT.image, ACCEPT.audio, ACCEPT.video].join(",") : ACCEPT[allow];
  const allowLabel =
    allow === "audio" ? "audio (MP3, WAV, OGG)"
    : allow === "video" ? "video (MP4, WebM)"
    : allow === "all" ? "gambar, audio, atau video"
    : "gambar (JPG, PNG, WebP, GIF)";

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
      showError(`Hanya file ${allowLabel} yang diperbolehkan`);
      return;
    }
    if (allow !== "all" && !file.type.startsWith(`${allow}/`)) {
      showError(`Hanya file ${allowLabel} yang diperbolehkan`);
      return;
    }
    const detected = mediaTypeOf(file.type);
    if (!detected) {
      showError("Tipe file tidak dikenali");
      return;
    }
    setIsUploading(true);
    try {
      // Kompres gambar saja (audio/video diunggah apa adanya).
      let uploadFile = file;
      if (detected === "image") {
        try {
          const { compressImage } = await import("@/lib/utils");
          uploadFile = await compressImage(file, 1280, 0.85);
        } catch {
          // Kompresi gagal tidak fatal — unggah berkas aslinya
        }
      }

      const form = new FormData();
      form.append("file", uploadFile);
      form.append("folder", "bank-soal");
      const res = await goPost<{ success: boolean; url: string }>("/api/upload", form);
      if (!res?.url) throw new Error("Upload gagal: server tidak mengembalikan URL");
      setUploadedType(detected);
      onChange(res.url, detected);
    } catch (err: any) {
      showError(err?.message || "Gagal mengunggah media");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    onChange(null, null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (value) {
    const type = uploadedType || "image";
    return (
      <div className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 w-fit max-w-full p-2">
        {type === "image" ? (
          <img
            src={value}
            alt="Lampiran soal"
            className="max-h-48 max-w-full object-contain"
            loading="lazy"
          />
        ) : type === "audio" ? (
          <audio controls src={value} className="max-w-full" />
        ) : (
          <video controls src={value} className="max-h-48 max-w-full" />
        )}
        {!disabled && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
            title="Hapus media"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled || isUploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isUploading}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/30 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span>Mengunggah...</span>
          </>
        ) : (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
              <Upload className="h-5 w-5" />
            </div>
            <span className="font-medium">Klik untuk mengunggah</span>
            <span className="text-[11px] text-muted-foreground/70">
              {allowLabel} — maksimal 5 MB
            </span>
          </>
        )}
      </button>
    </div>
  );
}

export default MediaUploader;
