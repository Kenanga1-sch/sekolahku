"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import * as cloud from "@/lib/cloudstorage/api";
import type { CloudFile } from "@/lib/cloudstorage/api";

interface Props {
  /** Berkas yang diedit; `null` untuk membuat catatan baru. */
  file: CloudFile | null;
  /** Folder induk saat membuat catatan baru. */
  parentId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Editor teks ringan untuk berkas teks (.txt/.md/.json/…) dan catatan cepat.
 * Memuat isi via endpoint unduh, lalu menyimpan melalui PUT .../content.
 */
export function TextEditorDialog({ file, parentId, onClose, onSaved }: Props) {
  const isNew = !file;
  const [name, setName] = useState(file?.name ?? "");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [initialContent, setInitialContent] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (file) {
      setLoading(true);
      cloud
        .fetchTextContent(file.id)
        .then((text) => {
          if (!cancelled) {
            setContent(text);
            setInitialContent(text);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) toast.error(e instanceof Error ? e.message : "Gagal memuat isi");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Perubahan belum disimpan (catatan baru: ada isi atau nama).
  const dirty = isNew ? content.length > 0 || name.trim().length > 0 : content !== initialContent;

  /** Tutup dengan konfirmasi bila ada perubahan belum disimpan. */
  const requestClose = () => {
    if (dirty && !saving) {
      if (!window.confirm("Ada perubahan yang belum disimpan. Tutup tanpa menyimpan?")) return;
    }
    onClose();
  };

  const canSave = !loading && !saving && (!isNew || name.trim().length > 0);

  const handleSave = async () => {
    if (isNew && !name.trim()) {
      toast.error("Nama catatan wajib diisi");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await cloud.createNote(name.trim(), content, parentId);
        toast.success("Catatan dibuat");
      } else {
        await cloud.updateTextContent(file!.id, content);
        toast.success("Catatan disimpan");
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const lines = content.split("\n").length;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) requestClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Catatan Baru" : `Edit: ${file?.name}`}</DialogTitle>
        </DialogHeader>

        {isNew && (
          <div className="space-y-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama catatan (mis. catatan-rapat.md)"
              aria-label="Nama catatan"
              aria-invalid={name.trim().length === 0}
              autoFocus
            />
            {name.trim().length === 0 && (
              <p className="text-xs text-neutral-400">Nama wajib diisi untuk menyimpan.</p>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex h-[50vh] items-center justify-center text-neutral-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[50vh] resize-y font-mono text-sm"
              placeholder="Tulis di sini…"
              spellCheck={false}
              aria-label="Isi catatan"
            />
            <p className="text-right text-xs text-neutral-400">
              {lines} baris • {cloud.formatBytes(new Blob([content]).size)}
            </p>
          </>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={requestClose} className="w-full sm:w-auto">
            Batal
          </Button>
          <Button onClick={handleSave} disabled={!canSave} className="w-full gap-2 sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
