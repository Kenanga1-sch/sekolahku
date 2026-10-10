"use client";

import { useState } from "react";
import { Download, ExternalLink, Pencil, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as cloud from "@/lib/cloudstorage/api";
import type { CloudFile } from "@/lib/cloudstorage/api";

interface Props {
  file: CloudFile;
  onClose: () => void;
  /** Buka editor teks (bila berkas dapat diedit). */
  onEdit?: () => void;
  /** Putar gambar sebesar deg derajat. */
  onRotate?: (deg: number) => void;
}

/**
 * Pratinjau inline: gambar, video, audio, PDF, teks. Untuk tipe lain
 * menampilkan metadata + tombol unduh. Menyediakan aksi edit teks & rotasi
 * gambar bila relevan.
 */
export function FilePreviewDialog({ file, onClose, onEdit, onRotate }: Props) {
  const kind = cloud.fileKind(file);
  const url = cloud.fileDownloadUrl(file.id);
  const downloadUrl = cloud.fileDownloadUrl(file.id, true);
  const canEdit = cloud.isEditableText(file);
  const isImage = kind === "image";
  const [loadError, setLoadError] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{file.name}</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[70vh] min-h-[240px] items-center justify-center overflow-auto rounded-lg bg-neutral-50 dark:bg-neutral-900">
          {loadError ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center text-neutral-500">
              <p>Gagal memuat pratinjau berkas.</p>
              <Button asChild size="sm">
                <a href={downloadUrl} download>
                  <Download className="mr-2 h-4 w-4" /> Unduh berkas
                </a>
              </Button>
            </div>
          ) : (
            <>
          {kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={file.name} className="max-h-[70vh] w-auto object-contain" onError={() => setLoadError(true)} />
          )}
          {kind === "video" && (
            <video src={url} controls className="max-h-[70vh] w-full" onError={() => setLoadError(true)}>
              Browser Anda tidak mendukung pemutar video.
            </video>
          )}
          {kind === "audio" && (
            <audio src={url} controls className="w-full px-6" onError={() => setLoadError(true)}>
              Browser Anda tidak mendukung pemutar audio.
            </audio>
          )}
          {kind === "pdf" && <iframe src={url} className="h-[70vh] w-full" title={file.name} />}
          {/* Dokumen (termasuk text/html) dirender tanpa sandbox = bisa
              mengeksekusi skrip pada origin aplikasi (vektor XSS tersimpan).
              sandbox="" mematikan skrip, form, & navigasi. */}
          {kind === "doc" && <iframe src={url} sandbox="" className="h-[70vh] w-full" title={file.name} />}
          {kind === "other" && (
            <div className="flex flex-col items-center gap-2 p-8 text-neutral-400">
              <p>Pratinjau tidak tersedia untuk tipe berkas ini.</p>
              <p className="text-xs">
                {file.mime_type || "application/octet-stream"} • {cloud.formatBytes(file.size)}
              </p>
            </div>
          )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-neutral-500">
            {cloud.formatBytes(file.size)} • {file.mime_type || "berkas"}
          </span>
          <div className="flex flex-wrap gap-2">
            {isImage && onRotate && (
              <>
                <Button variant="outline" size="sm" onClick={() => onRotate(270)} title="Putar ke kiri">
                  <RotateCw className="mr-2 h-4 w-4 -scale-x-100" /> Kiri
                </Button>
                <Button variant="outline" size="sm" onClick={() => onRotate(90)} title="Putar ke kanan">
                  <RotateCw className="mr-2 h-4 w-4" /> Kanan
                </Button>
              </>
            )}
            {canEdit && onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" /> Edit Teks
              </Button>
            )}
            <Button variant="outline" asChild size="sm">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Buka
              </a>
            </Button>
            <Button asChild size="sm">
              <a href={downloadUrl} download>
                <Download className="mr-2 h-4 w-4" /> Unduh
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
