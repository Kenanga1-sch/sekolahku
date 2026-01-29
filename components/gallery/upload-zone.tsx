"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Loader2, CheckCircle, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface UploadFile {
  file: File;
  preview: string;
  title: string;
  category: string;
  status: "pending" | "uploading" | "success" | "error";
  errorMessage?: string;
  progress: number;
}

interface EnhancedUploadZoneProps {
  onUploadComplete: () => void;
  onClose: () => void;
}

export function EnhancedUploadZone({ onUploadComplete, onClose }: EnhancedUploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      title: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
      category: "kegiatan",
      status: "pending",
      errorMessage: undefined,
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxSize: 5 * 1024 * 1024,
  });

  const updateFile = (index: number, updates: Partial<UploadFile>) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    );
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAllFiles = async () => {
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.status !== "pending") continue;

      updateFile(i, { status: "uploading", progress: 0 });

      const formData = new FormData();
      formData.append("file", file.file);
      formData.append("title", file.title);
      formData.append("category", file.category);

      try {
        // Simulate progress
        for (let p = 0; p <= 80; p += 20) {
          await new Promise((r) => setTimeout(r, 100));
          updateFile(i, { progress: p });
        }

        const res = await fetch("/api/gallery/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          updateFile(i, { status: "success", progress: 100 });
        } else {
          console.error(`Upload failed with status: ${res.status} ${res.statusText}`);
          let errorData;
          try {
            const text = await res.text();
            console.error("Raw response text:", text);
            try {
              errorData = JSON.parse(text);
            } catch {
               errorData = { error: `Server returned non-JSON error: ${text.substring(0, 100)}` };
            }
          } catch (e) {
             errorData = { error: "Could not read response body" };
          }
          
          console.error("Parsed error data:", errorData);
          throw new Error(errorData.error || `Upload failed: ${res.status}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Upload failed";
        updateFile(i, { status: "error", progress: 0, errorMessage: msg });
      }
    }

    setIsUploading(false);
    
    // Check if all succeeded
    const allSuccess = files.every(f => f.status === "success" || f.status === "pending");
    if (allSuccess && files.length > 0) {
      setTimeout(() => {
        onUploadComplete();
        onClose();
      }, 1000);
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const successCount = files.filter((f) => f.status === "success").length;

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300",
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-semibold">
            {isDragActive ? "Lepaskan file disini..." : "Drag & drop foto"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            atau klik untuk memilih file (max 5MB per file)
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">
              {files.length} file dipilih
              {successCount > 0 && (
                <span className="text-emerald-600 ml-2">
                  ({successCount} berhasil)
                </span>
              )}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFiles([])}
              disabled={isUploading}
            >
              Hapus Semua
            </Button>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {files.map((file, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-4 p-4 rounded-xl border bg-card transition-all",
                  file.status === "success" && "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20",
                  file.status === "error" && "border-red-500/50 bg-red-50/50 dark:bg-red-950/20"
                )}
              >
                {/* Thumbnail */}
                <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.preview}
                    alt={file.title}
                    className="h-full w-full object-cover"
                  />
                  {file.status === "uploading" && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                  {file.status === "success" && (
                    <div className="absolute inset-0 bg-emerald-500/80 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                  )}
                  {file.status === "error" && (
                    <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-white" />
                    </div>
                  )}
                </div>

                {/* Form */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Judul</Label>
                      <Input
                        value={file.title}
                        onChange={(e) => updateFile(index, { title: e.target.value })}
                        disabled={file.status !== "pending" || isUploading}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="w-32">
                      <Label className="text-xs">Kategori</Label>
                      <Select
                        value={file.category}
                        onValueChange={(v) => updateFile(index, { category: v })}
                        disabled={file.status !== "pending" || isUploading}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kegiatan">Kegiatan</SelectItem>
                          <SelectItem value="fasilitas">Fasilitas</SelectItem>
                          <SelectItem value="prestasi">Prestasi</SelectItem>
                          <SelectItem value="lainnya">Lainnya</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {file.status === "pending" && !isUploading && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 mt-5"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {file.status === "uploading" && (
                    <Progress value={file.progress} className="h-1" />
                  )}
                  {file.status === "error" && file.errorMessage && (
                    <p className="text-xs text-red-500 mt-1">{file.errorMessage}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose} disabled={isUploading}>
          Batal
        </Button>
        <Button
          onClick={uploadAllFiles}
          disabled={pendingCount === 0 || isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Mengupload...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload {pendingCount} File
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
