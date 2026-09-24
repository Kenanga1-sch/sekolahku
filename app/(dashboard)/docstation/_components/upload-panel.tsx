"use client";

import { useRef } from "react";
import { FileUp, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadPanelProps {
  files: File[];
  busy: boolean;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (name: string) => void;
  onNext: () => void;
  onBack: () => void;
}

/** Langkah 2 (print): unggah berkas yang akan dicetak. */
export function UploadPanel({
  files,
  busy,
  onAddFiles,
  onRemoveFile,
  onNext,
  onBack,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 py-4">
      <div className="space-y-1 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          Unggah Dokumen
        </h2>
        <p className="text-sm text-muted-foreground">
          Pilih berkas gambar (JPG/PNG) atau PDF untuk dicetak.
        </p>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center transition-all",
          "hover:border-primary hover:bg-primary/5",
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <FileUp className="h-7 w-7" />}
        </div>
        <div>
          <p className="font-bold text-foreground">Klik untuk memilih berkas</p>
          <p className="text-xs text-muted-foreground">JPG, PNG, atau PDF</p>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          onAddFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.name}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm"
            >
              <span className="truncate font-medium text-foreground">{f.name}</span>
              <button
                type="button"
                onClick={() => onRemoveFile(f.name)}
                className="ml-3 text-muted-foreground hover:text-destructive"
                aria-label={`Hapus ${f.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          Kembali
        </Button>
        <Button onClick={onNext} disabled={files.length === 0}>
          Lanjut ke Pengaturan
        </Button>
      </div>
    </section>
  );
}
