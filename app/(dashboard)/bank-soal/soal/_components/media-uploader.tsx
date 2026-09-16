"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { goPost } from "@/lib/api-client";
import { showError } from "@/lib/toast";

interface MediaUploaderProps {
  value?: string;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export function MediaUploader({ value, onChange, disabled }: MediaUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      showError("Hanya file gambar yang diperbolehkan (JPG, PNG, WebP, GIF)");
      return;
    }
    setIsUploading(true);
    try {
      // Kompres dulu untuk mempercepat upload (backend juga auto-resize)
      let uploadFile = file;
      try {
        const { compressImage } = await import("@/lib/utils");
        uploadFile = await compressImage(file, 1280, 0.85);
      } catch {
        // Kompresi gagal tidak fatal — unggah berkas aslinya
      }

      const form = new FormData();
      form.append("file", uploadFile);
      form.append("folder", "bank-soal");
      const res = await goPost<{ success: boolean; url: string }>("/api/upload", form);
      if (!res?.url) throw new Error("Upload gagal: server tidak mengembalikan URL");
      onChange(res.url);
    } catch (err: any) {
      showError(err?.message || "Gagal mengunggah gambar");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (value) {
    return (
      <div className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 w-fit max-w-full">
        <img
          src={value}
          alt="Lampiran soal"
          className="max-h-48 max-w-full object-contain"
          loading="lazy"
        />
        {!disabled && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
            title="Hapus gambar"
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
        accept="image/jpeg,image/png,image/webp,image/gif"
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
            <span>Mengunggah gambar...</span>
          </>
        ) : (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
              <Upload className="h-5 w-5" />
            </div>
            <span className="font-medium">Klik untuk mengunggah gambar</span>
            <span className="text-[11px] text-muted-foreground/70">
              JPG, PNG, WebP, atau GIF — maksimal 5 MB
            </span>
          </>
        )}
      </button>
    </div>
  );
}

export default MediaUploader;
