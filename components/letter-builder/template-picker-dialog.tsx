"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, FolderOpen, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { goGet, goPost, goDelete } from "@/lib/api-client";

/**
 * Template modular surat.
 *
 * Template disimpan di tabel `letter_templates` yang sudah ada dengan
 * `type = "MODULAR"`; kolom `content` menampung JSON LetterDocumentData
 * (hasil serializeDocument). Ini memakai ulang endpoint template yang ada.
 */

interface TemplateRow {
  id: string;
  name: string;
  category?: string;
  type?: string;
  content?: string | null;
  updatedAt?: string;
}

export interface ModularTemplate {
  id: string;
  name: string;
  documentJson: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** JSON dokumen saat ini, untuk disimpan sebagai template. */
  currentDocumentJson: string;
  /** Nama default saat menyimpan (mis. jenis surat). */
  defaultName: string;
  /** Kategori (mis. jenis surat) yang dikirim ke backend. */
  category: string;
  /** Dipanggil saat pengguna memilih template untuk dimuat. */
  onLoad: (tpl: ModularTemplate) => void;
}

export function TemplatePickerDialog({
  open,
  onOpenChange,
  currentDocumentJson,
  defaultName,
  category,
  onLoad,
}: Props) {
  const [mode, setMode] = useState<"load" | "save">("load");
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState(defaultName);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res: any = await goGet("/api/eoffice/letter-templates?perPage=100");
      const rows: TemplateRow[] = Array.isArray(res?.data) ? res.data : [];
      setTemplates(rows.filter((t) => String(t.type || "").toUpperCase() === "MODULAR"));
    } catch {
      toast.error("Gagal memuat template modular");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSaveName(defaultName);
      setMode("load");
      fetchTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    const name = saveName.trim();
    if (!name) {
      toast.error("Nama template wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const res: any = await goPost("/api/eoffice/letter-templates", {
        name,
        category: category || "Umum",
        type: "MODULAR",
        content: currentDocumentJson,
      });
      if (res?.success !== false) {
        toast.success("Template modular disimpan");
        onOpenChange(false);
      } else {
        toast.error(res?.error || "Gagal menyimpan template");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus template "${name}"?`)) return;
    try {
      await goDelete(`/api/eoffice/letter-templates/${id}`);
      toast.success("Template dihapus");
      fetchTemplates();
    } catch {
      toast.error("Gagal menghapus template");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Template Modular</DialogTitle>
          <DialogDescription>
            Simpan susunan surat sebagai template, atau muat template yang sudah ada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg border p-1">
          <Button
            type="button"
            variant={mode === "load" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => setMode("load")}
          >
            <FolderOpen className="h-4 w-4" /> Muat
          </Button>
          <Button
            type="button"
            variant={mode === "save" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => setMode("save")}
          >
            <Save className="h-4 w-4" /> Simpan
          </Button>
        </div>

        {mode === "save" ? (
          <div className="space-y-2">
            <Label className="text-xs">Nama Template</Label>
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="mis. Surat Undangan Rapat (Standar)"
            />
          </div>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {loading ? (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
              </p>
            ) : templates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada template modular tersimpan.
              </p>
            ) : (
              templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    {t.category && (
                      <Badge variant="outline" className="mt-0.5 text-[10px]">
                        {t.category}
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={!t.content}
                    onClick={() => {
                      if (!t.content) return;
                      onLoad({ id: t.id, name: t.name, documentJson: t.content });
                      onOpenChange(false);
                    }}
                  >
                    Muat
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(t.id, t.name)}
                    aria-label={`Hapus template ${t.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          {mode === "save" && (
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Simpan Template
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
