"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { goGet } from "@/lib/api-client";
import { showError, showSuccess } from "@/lib/toast";
import { createTugas, updateTugas, type Tugas } from "@/lib/tugas";
import { FileUploader } from "./file-uploader";

interface TugasFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tugas yang diedit (null = mode buat baru). */
  tugas?: Tugas | null;
  onSaved?: (t: Tugas) => void;
}

interface Subject {
  id: string;
  name: string;
  code?: string;
}

function millisToInput(millis?: number | null): string {
  if (!millis) return "";
  const d = new Date(millis);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inputToMillis(s: string): number | null {
  if (!s) return null;
  const ms = new Date(s).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function TugasFormDialog({ open, onOpenChange, tugas, onSaved }: TugasFormDialogProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    subjectId: "",
    attachmentUrl: "",
    attachmentName: "",
    dueAt: "",
    allowLate: true,
  });

  const isEdit = !!tugas;

  // Prefill saat edit; reset saat buat baru.
  useEffect(() => {
    if (!open) return;
    if (tugas) {
      setForm({
        title: tugas.title,
        description: tugas.description || "",
        subjectId: tugas.subjectId || "",
        attachmentUrl: tugas.attachmentUrl || "",
        attachmentName: tugas.attachmentName || "",
        dueAt: millisToInput(tugas.dueAt),
        allowLate: tugas.allowLate,
      });
    } else {
      setForm({
        title: "",
        description: "",
        subjectId: "",
        attachmentUrl: "",
        attachmentName: "",
        dueAt: "",
        allowLate: true,
      });
    }
  }, [open, tugas]);

  // Daftar mapel untuk dropdown (hanya sekali).
  useEffect(() => {
    if (subjects.length) return;
    (async () => {
      try {
        const res: any = await goGet("/api/academic/subjects");
        setSubjects(res || []);
      } catch {
        // dropdown mapel opsional — gagal tidak fatal
      }
    })();
  }, [subjects.length]);

  const handleSave = async () => {
    const title = form.title.trim();
    if (!title) {
      showError("Judul tugas wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title,
        description: form.description.trim(),
        subjectId: form.subjectId || undefined,
        attachmentUrl: form.attachmentUrl || undefined,
        attachmentName: form.attachmentName || undefined,
        dueAt: inputToMillis(form.dueAt),
        allowLate: form.allowLate,
      };
      const saved = isEdit ? await updateTugas(tugas!.id, body) : await createTugas(body);
      showSuccess(isEdit ? "Tugas diperbarui" : "Tugas berhasil dibuat & siswa diberi tahu");
      onOpenChange(false);
      if (saved && onSaved) onSaved(saved);
    } catch (err: any) {
      showError(err?.message || (isEdit ? "Gagal memperbarui tugas" : "Gagal membuat tugas"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Tugas" : "Buat Tugas / PR"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perubahan berlaku untuk seluruh siswa kelas Anda."
              : "Tugas akan diberikan ke seluruh siswa aktif di kelas yang Anda walai."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="tugas-title">Judul Tugas *</Label>
            <Input
              id="tugas-title"
              placeholder="mis. PR Matematika Halaman 12"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tugas-subject">Mata Pelajaran</Label>
            <Select value={form.subjectId} onValueChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}>
              <SelectTrigger id="tugas-subject">
                <SelectValue placeholder="Pilih mapel (opsional)" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tugas-desc">Instruksi / Deskripsi</Label>
            <Textarea
              id="tugas-desc"
              placeholder="Tuliskan instruksi pengerjaan untuk siswa..."
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Lampiran (opsional)</Label>
            <FileUploader
              value={form.attachmentUrl}
              fileName={form.attachmentName}
              onChange={(url, name) =>
                setForm((f) => ({ ...f, attachmentUrl: url || "", attachmentName: name || "" }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tugas-due">Batas Waktu Pengumpulan</Label>
            <DateInput
              id="tugas-due"
              type="datetime-local"
              value={form.dueAt}
              onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">Kosongkan jika tanpa batas waktu.</p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 dark:border-zinc-800">
            <div>
              <Label htmlFor="tugas-late" className="cursor-pointer">
                Boleh kumpul terlambat
              </Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Siswa tetap bisa mengumpulkan setelah batas waktu (ditandai terlambat).
              </p>
            </div>
            <Switch
              id="tugas-late"
              checked={form.allowLate}
              onCheckedChange={(v) => setForm((f) => ({ ...f, allowLate: v }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
            {saving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Menyimpan…
              </>
            ) : isEdit ? (
              "Simpan Perubahan"
            ) : (
              "Buat Tugas"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TugasFormDialog;
