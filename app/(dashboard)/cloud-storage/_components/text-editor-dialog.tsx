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

  useEffect(() => {
    let cancelled = false;
    if (file) {
      setLoading(true);
      cloud
        .fetchTextContent(file.id)
        .then((text) => {
          if (!cancelled) setContent(text);
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

  const handleSave = async () => {
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Catatan Baru" : `Edit: ${file?.name}`}</DialogTitle>
        </DialogHeader>

        {isNew && (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama catatan (mis. catatan-rapat.md)"
          />
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
            />
            <p className="text-right text-xs text-neutral-400">
              {lines} baris • {cloud.formatBytes(new Blob([content]).size)}
            </p>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
