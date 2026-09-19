"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X, Loader2 } from "lucide-react";
import { goPost } from "@/lib/api-client";
import { showError } from "@/lib/toast";

interface FileUploaderProps {
  value?: string;
  fileName?: string;
  onChange: (url: string | null, name: string | null) => void;
  disabled?: boolean;
  folder?: string;
  label?: string;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

/** Uploader lampiran tugas: gambar atau PDF (maks 5 MB, sesuai backend). */
export function FileUploader({ value, fileName, onChange, disabled, folder = "tugas", label = "Lampiran" }: FileUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      showError("Hanya gambar (JPG/PNG/WebP/GIF) atau PDF yang diperbolehkan");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError("Ukuran file maksimal 5 MB");
      return;
    }
    setIsUploading(true);
    try {
      let uploadFile = file;
      if (file.type.startsWith("image/")) {
        try {
          const { compressImage } = await import("@/lib/utils");
          uploadFile = await compressImage(file, 1280, 0.85);
        } catch {
          // Kompresi gagal tidak fatal — unggah berkas aslinya
        }
      }
      const form = new FormData();
      form.append("file", uploadFile);
      form.append("folder", folder);
      const res = await goPost<{ success: boolean; url: string }>("/api/upload", form);
      if (!res?.url) throw new Error("Upload gagal: server tidak mengembalikan URL");
      onChange(res.url, file.name);
    } catch (err: any) {
      showError(err?.message || "Gagal mengunggah file");
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
    const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(value);
    return (
      <div className="space-y-2">
        {isImage ? (
          <div className="group relative w-fit overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900">
            <img src={value} alt={fileName || "Lampiran"} className="max-h-40 max-w-full object-contain" loading="lazy" />
            {!disabled && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                title="Hapus lampiran"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
            <FileText className="h-5 w-5 flex-shrink-0 text-rose-600" />
            <a href={value} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
              {fileName || "Lihat lampiran"}
            </a>
            {!disabled && (
              <button type="button" onClick={handleRemove} className="text-slate-400 hover:text-rose-600" title="Hapus lampiran">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
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
        className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-blue-400 hover:bg-blue-50/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/30 dark:hover:bg-blue-950/20"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span>Mengunggah file...</span>
          </>
        ) : (
          <>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
              <Upload className="h-4 w-4" />
            </div>
            <span className="font-medium">{label}</span>
            <span className="text-[11px] text-muted-foreground/70">Gambar atau PDF — maksimal 5 MB</span>
          </>
        )}
      </button>
    </div>
  );
}

export default FileUploader;
