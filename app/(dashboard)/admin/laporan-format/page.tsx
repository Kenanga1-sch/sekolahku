"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  Braces,
  Upload,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { goGet, goPost, goPut, goDelete } from "@/lib/api-client";
import { REPORT_VARIABLE_MODULES, getVariableModule } from "@/lib/report-variables";
import type { ReportVariableGroup } from "@/lib/report-variables";

interface TemplateRow {
  id: number | string;
  code: string;
  name: string;
  category: string;
  module?: string;
  description?: string;
  paperSize?: string;
  orientation?: string;
  layoutJson?: string;
  filePath?: string;
  isDefault?: boolean;
}

/** Modul yang bisa dipilih saat membuat format (di luar "umum"). */
const SELECTABLE_MODULES = REPORT_VARIABLE_MODULES;

export default function LaporanFormatPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", category: "Umum", module: "umum" });

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await goGet("/api/reports/templates");
      if (res?.success && Array.isArray(res.data)) setTemplates(res.data);
    } catch {
      toast.error("Gagal memuat daftar format laporan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, TemplateRow[]>();
    for (const t of templates) {
      const key = t.module || "umum";
      const arr = map.get(key) || [];
      arr.push(t);
      map.set(key, arr);
    }
    // Urutkan mengikuti urutan katalog modul, lalu sisa modul tak dikenal.
    const known = REPORT_VARIABLE_MODULES.map((m) => m.module);
    return Array.from(map.entries()).sort(
      (a, b) => known.indexOf(a[0]) - known.indexOf(b[0]),
    );
  }, [templates]);

  const moduleLabel = (module: string) => getVariableModule(module).label;

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast.error("Nama format wajib diisi");
      return;
    }
    const q = new URLSearchParams({
      new: "1",
      module: form.module,
      name: form.name.trim(),
      category: form.category.trim() || "Umum",
    });
    setCreateOpen(false);
    router.push(`/admin/laporan-builder?${q.toString()}`);
  };

  const handleOpen = (t: TemplateRow) => {
    router.push(`/admin/laporan-builder?id=${t.id}`);
  };

  const handleDuplicate = async (t: TemplateRow) => {
    try {
      const res: any = await goGet(`/api/reports/templates/${t.id}`);
      const full = res?.data;
      if (!full) throw new Error("not found");
      const code = `${t.code}_COPY_${Date.now().toString(36).toUpperCase()}`;
      const payload = {
        code,
        name: `${t.name} (Salinan)`,
        category: t.category,
        module: t.module || "umum",
        description: t.description || "",
        paperSize: t.paperSize || "A4",
        orientation: t.orientation || "portrait",
        layoutJson: full.layoutJson || "{}",
        isDefault: false,
      };
      const created: any = await goPost("/api/reports/templates", payload);
      if (created?.success) {
        toast.success("Format diduplikasi");
        void load();
      } else {
        toast.error(created?.error || "Gagal menduplikasi format");
      }
    } catch {
      toast.error("Gagal menduplikasi format");
    }
  };

  const handleSetDefault = async (t: TemplateRow) => {
    try {
      const updated: any = await goPut(`/api/reports/templates/${t.id}/default`, {});
      if (updated?.success) {
        toast.success("Dijadikan format default modul");
        void load();
      } else {
        toast.error(updated?.error || "Gagal mengubah default");
      }
    } catch {
      toast.error("Gagal mengubah default");
    }
  };

  const [uploadingId, setUploadingId] = useState<string | null>(null);

  /** Upload berkas .xlsx sebagai template file-based (validasi di server). */
  const handleUploadXlsx = async (t: TemplateRow, file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Hanya berkas .xlsx yang didukung");
      return;
    }
    setUploadingId(String(t.id));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/reports/templates/${t.id}/file`,
        { method: "POST", body: fd, credentials: "include" }
      );
      const json: any = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        toast.success(`Template "${t.name}" diperbarui`, {
          description: json?.data?.filePath || undefined,
        });
        void load();
      } else {
        toast.error(json?.error || "Gagal mengunggah template");
      }
    } catch {
      toast.error("Gagal mengunggah template");
    } finally {
      setUploadingId(null);
    }
  };

  const handleDownloadXlsx = (t: TemplateRow) => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || ""}/api/reports/templates/${t.id}/file`;
  };

  const handleDelete = async (t: TemplateRow) => {
    if (!window.confirm(`Hapus format "${t.name}"?`)) return;
    try {
      const res: any = await goDelete(`/api/reports/templates/${t.id}`);
      if (res?.success) {
        toast.success("Format dihapus");
        void load();
      } else {
        toast.error(res?.error || "Gagal menghapus format");
      }
    } catch {
      toast.error("Gagal menghapus format");
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
            <div className="rounded-xl border border-blue-100/30 bg-blue-50 p-2 text-blue-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-blue-400">
              <FileText className="h-6 w-6" />
            </div>
            Format Laporan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola semua format laporan: buat format baru, hubungkan ke modul, dan buka di Studio Format.
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Buat Format Baru
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          Belum ada format laporan. Klik <b>Buat Format Baru</b> untuk memulai.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([module, rows]) => (
            <div key={module} className="rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{moduleLabel(module)}</h2>
                  <Badge variant="secondary" className="text-[10px]">
                    {rows.length} format
                  </Badge>
                  {rows.some((r) => r.filePath) ? (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <FileSpreadsheet className="h-3 w-3" /> Excel
                    </Badge>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => setExpanded(expanded === module ? null : module)}
                >
                  <Braces className="h-3.5 w-3.5" />
                  Variabel
                  {expanded === module ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              {expanded === module ? (
                <VariablePreview module={module} />
              ) : null}

              <ul className="divide-y">
                {rows.map((t) => (
                  <li key={String(t.id)} className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{t.name}</span>
                        {t.isDefault ? (
                          <Badge className="text-[10px]">Default</Badge>
                        ) : null}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                        {t.code} · {t.category} · {t.paperSize} {t.orientation}
                        {t.filePath ? ` · 📄 ${t.filePath}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {t.filePath ? (
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => handleDownloadXlsx(t)}>
                          <Download className="h-3.5 w-3.5" /> .xlsx
                        </Button>
                      ) : null}
                      <label
                        className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-input bg-background px-2 text-[11px] font-medium hover:bg-accent"
                        title="Unggah template Excel (.xlsx) — menggantikan berkas saat ini"
                      >
                        {uploadingId === String(t.id) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Excel
                        <input
                          type="file"
                          accept=".xlsx"
                          className="hidden"
                          disabled={uploadingId === String(t.id)}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) void handleUploadXlsx(t, f);
                          }}
                        />
                      </label>
                      <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => handleOpen(t)}>
                        <Pencil className="h-3.5 w-3.5" /> Buka
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplikat" onClick={() => handleDuplicate(t)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px]"
                        title="Jadikan default modul"
                        disabled={t.isDefault}
                        onClick={() => handleSetDefault(t)}
                      >
                        Default
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600 hover:text-red-700"
                        title="Hapus"
                        onClick={() => handleDelete(t)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Format Baru</DialogTitle>
            <DialogDescription>
              Tentukan nama, kategori, dan peruntukan modul. Tekan Enter untuk masuk ke kertas kerja.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Nama Format</label>
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                placeholder="mis. Laporan Rekap Nilai"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Kategori</label>
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="mis. Akademik"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Peruntukan Modul</label>
              <Select value={form.module} onValueChange={(v) => setForm((f) => ({ ...f, module: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELECTABLE_MODULES.map((m) => (
                    <SelectItem key={m.module} value={m.module}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Modul menentukan variabel yang tampil lebih dulu, tapi kertas kerja tetap bisa memakai variabel modul lain.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleCreate}>
              Lanjut ke Kertas Kerja
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Pratinjau variabel yang tersedia untuk sebuah modul. */
function VariablePreview({ module }: { module: string }) {
  const def = getVariableModule(module);
  return (
    <div className="space-y-2 border-b bg-muted/30 px-4 py-3">
      {def.groups.map((g: ReportVariableGroup) => (
        <div key={`${g.scope}-${g.label}`}>
          <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
            {g.label} {g.scope === "rekap" ? "· rekap" : "· baris"}
          </div>
          <div className="flex flex-wrap gap-1">
            {g.fields.map((f) => {
              const token = g.scope === "row" ? `{${f.token}}` : `{{${f.token}}}`;
              return (
                <Badge key={f.token} variant="outline" className="font-mono text-[10px]">
                  {token}
                </Badge>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
