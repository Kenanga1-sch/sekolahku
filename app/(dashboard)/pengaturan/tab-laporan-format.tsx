"use client";

import { useEffect, useMemo, useState } from "react";

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
  BookOpen,
  Search,
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
import {
  FILL_VARIABLE_MODULES,
  getFillVariableModule,
  type FillVariable,
} from "@/lib/config/report-variables";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

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
  kind?: "" | "xlsx" | "docx";
  isDefault?: boolean;
}

/** Template file-based (.xlsx/.docx) vs grid lama (layout_json). */
const isFileBased = (t: TemplateRow) => !!t.filePath || t.kind === "xlsx" || t.kind === "docx";

const kindBadge = (t: TemplateRow) => {
  if (t.kind === "xlsx" || (!t.kind && t.filePath?.endsWith(".xlsx"))) return "Excel";
  if (t.kind === "docx" || (!t.kind && t.filePath?.endsWith(".docx"))) return "Word";
  return "Grid";
};

/** Modul yang bisa dipilih saat membuat format (di luar "umum"). */
const SELECTABLE_MODULES = FILL_VARIABLE_MODULES;

export default function TabLaporanFormat({ initialSub = "format" }: { initialSub?: "format" | "kamus" }) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"format" | "kamus">(initialSub);

  const [form, setForm] = useState({
    name: "",
    category: "Umum",
    module: "umum",
    kind: "xlsx" as "xlsx" | "docx",
    paperSize: "A4",
    orientation: "landscape" as "portrait" | "landscape",
  });

  // Dialog edit pengaturan (nama/kategori/ukuran kertas/orientasi).
  const [editT, setEditT] = useState<TemplateRow | null>(null);
  const [editForm, setEditForm] = useState({ name: "", category: "", paperSize: "A4", orientation: "portrait" });

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

  useEffect(() => {
    setActiveTab(initialSub);
  }, [initialSub]);

  const handleTabChange = (v: "format" | "kamus") => {
    setActiveTab(v);
    try {
      const url = new URL(window.location.href);
      if (v === "kamus") url.searchParams.set("sub", "kamus");
      else url.searchParams.delete("sub");
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* abaikan */
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, TemplateRow[]>();
    for (const t of templates) {
      const key = t.module || "umum";
      const arr = map.get(key) || [];
      arr.push(t);
      map.set(key, arr);
    }
    // Urutkan mengikuti urutan katalog modul, lalu sisa modul tak dikenal.
    const known = FILL_VARIABLE_MODULES.map((m) => m.module);
    return Array.from(map.entries()).sort(
      (a, b) => known.indexOf(a[0]) - known.indexOf(b[0]),
    );
  }, [templates]);

  const moduleLabel = (module: string) => getFillVariableModule(module)?.label ?? module;

  /** Buat slot template file (.xlsx/.docx) — berkas diunggah setelahnya via tombol Upload. */
  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Nama format wajib diisi");
      return;
    }
    const moduleKey = form.module || "umum";
    const kind = form.kind;
    const base = form.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "TEMPLATE";
    const payload = {
      code: `RPT_${base}_${Date.now().toString(36).toUpperCase()}`,
      name: form.name.trim(),
      category: form.category.trim() || "Umum",
      module: moduleKey,
      description: `Template ${kind === "xlsx" ? "Excel" : "Word"} — unggah berkas via tombol Upload.`,
      paperSize: form.paperSize,
      orientation: form.orientation,
      layoutJson: "",
      filePath: "",
      kind,
      isDefault: false,
    };
    setCreateOpen(false);
    try {
      const created: any = await goPost("/api/reports/templates", payload);
      if (created?.success) {
        toast.success("Slot template dibuat — unggah berkas .xlsx/.docx via tombol Upload");
        void load();
      } else {
        toast.error(created?.error || "Gagal membuat slot template");
      }
    } catch {
      toast.error("Gagal membuat slot template");
    }
  };

  /** Buka dialog edit pengaturan template (ukuran kertas dipakai saat cetak PDF/Excel). */
  const handleOpenEdit = (t: TemplateRow) => {
    setEditT(t);
    setEditForm({
      name: t.name,
      category: t.category || "Umum",
      paperSize: t.paperSize || "A4",
      orientation: (t.orientation as "portrait" | "landscape") || "portrait",
    });
  };

  const handleEdit = async () => {
    if (!editT) return;
    if (!editForm.name.trim()) {
      toast.error("Nama format wajib diisi");
      return;
    }
    try {
      const res: any = await goPut(`/api/reports/templates/${editT.id}`, {
        code: editT.code,
        name: editForm.name.trim(),
        category: editForm.category.trim() || "Umum",
        module: editT.module || "umum",
        description: editT.description || "",
        paperSize: editForm.paperSize,
        orientation: editForm.orientation,
        layoutJson: editT.layoutJson || "",
        filePath: editT.filePath || "",
        kind: editT.kind || "",
        isDefault: editT.isDefault || false,
      });
      if (res?.success) {
        toast.success("Pengaturan format diperbarui");
        setEditT(null);
        void load();
      } else {
        toast.error(res?.error || "Gagal memperbarui format");
      }
    } catch {
      toast.error("Gagal memperbarui format");
    }
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
        layoutJson: full.layoutJson || "",
        filePath: "",
        kind: full.kind || "",
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

  /** Upload berkas template (.xlsx rekap / .docx naratif; validasi di server). */
  const handleUploadTemplate = async (t: TemplateRow, file: File) => {
    const ext = file.name.toLowerCase().endsWith(".xlsx")
      ? ".xlsx"
      : file.name.toLowerCase().endsWith(".docx")
        ? ".docx"
        : "";
    if (!ext) {
      toast.error("Hanya berkas .xlsx/.docx yang didukung");
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

  const handleDownloadTemplate = (t: TemplateRow) => {
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
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Kelola format laporan per modul: template file (.xlsx rekap / .docx naratif)
          diunggah–diunduh di sini; token {"{{...}}"} untuk template ada di tab Kamus Variabel.
        </p>
        <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Buat Slot Template
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as "format" | "kamus")}>
        <TabsList>
          <TabsTrigger value="format" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Daftar Format
          </TabsTrigger>
          <TabsTrigger value="kamus" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Kamus Variabel
          </TabsTrigger>
        </TabsList>
        <TabsContent value="format">
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          Belum ada format laporan. Klik <b>Buat Slot Template</b> untuk memulai.
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
                        {t.code} · {t.category} ·{" "}
                        {kindBadge(t) === "Word" ? "halaman ikut file Word" : `${t.paperSize} ${t.orientation}`}
                        {t.filePath ? ` · 📄 ${t.filePath}` : ""}
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <Badge variant={isFileBased(t) ? "default" : "secondary"} className="text-[10px]">
                          {kindBadge(t)}
                        </Badge>
                        {isFileBased(t) ? (
                          <span className="text-[10px] text-muted-foreground">
                            Template file — kelola via upload/unduh, bukan Studio
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {t.filePath ? (
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => handleDownloadTemplate(t)}>
                          <Download className="h-3.5 w-3.5" /> {kindBadge(t) === "Word" ? ".docx" : ".xlsx"}
                        </Button>
                      ) : null}
                      <label
                        className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-input bg-background px-2 text-[11px] font-medium hover:bg-accent"
                        title="Unggah template (.xlsx rekap / .docx naratif) — menggantikan berkas saat ini"
                      >
                        {uploadingId === String(t.id) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Upload
                        <input
                          type="file"
                          accept=".xlsx,.docx"
                          className="hidden"
                          disabled={uploadingId === String(t.id)}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) void handleUploadTemplate(t, f);
                          }}
                        />
                      </label>
                      {isFileBased(t) ? null : (
                        <span className="text-[10px] text-amber-700">
                          Format lama (grid) tak lagi didukung — unggah file .xlsx/.docx
                        </span>
                      )}
                      <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" title="Pengaturan (ukuran kertas, orientasi, nama)" onClick={() => handleOpenEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
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
        </TabsContent>
        <TabsContent value="kamus">
          <KamusVariabelPanel />
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Slot Template</DialogTitle>
            <DialogDescription>
              Slot file-based: pilih jenis berkas, lalu unggah .xlsx/.docx via tombol Upload di daftar.
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
              <label className="mb-1 block text-xs font-medium">Jenis Template</label>
              <Select
                value={form.kind}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    kind: v as "xlsx" | "docx",
                    // Orientasi default mengikuti jenis: Excel landscape, Word portrait.
                    orientation: v === "xlsx" ? "landscape" : "portrait",
                  }))
                }
              >
                <SelectTrigger aria-label="Jenis template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (.xlsx) — rekap / tabel</SelectItem>
                  <SelectItem value="docx">Word (.docx) — naratif / surat</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Excel untuk rekap tabel (duplikasi baris + rumus hidup); Word untuk dokumen naratif (variabel + loop).
              </p>
            </div>
            {form.kind === "xlsx" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">Ukuran Kertas</label>
                    <Select value={form.paperSize} onValueChange={(v) => setForm((f) => ({ ...f, paperSize: v }))}>
                      <SelectTrigger aria-label="Ukuran kertas"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A4">A4 (210×297)</SelectItem>
                        <SelectItem value="F4">F4 / Folio (215×330)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Orientasi</label>
                    <Select value={form.orientation} onValueChange={(v) => setForm((f) => ({ ...f, orientation: v as "portrait" | "landscape" }))}>
                      <SelectTrigger aria-label="Orientasi"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">Potret</SelectItem>
                        <SelectItem value="landscape">Landscape</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Ukuran kertas dipakai saat cetak PDF (dialog browser) &amp; pengaturan cetak Excel.
                </p>
              </>
            ) : (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                Ukuran dan orientasi mengikuti pengaturan halaman di file Word; bagian potret dan landscape boleh dicampur.
              </p>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium">Peruntukan Modul</label>
              <Select value={form.module} onValueChange={(v) => setForm((f) => ({ ...f, module: v }))}>
                <SelectTrigger aria-label="Peruntukan modul">
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
                Modul menentukan variabel yang tampil di panel Variabel untuk disalin ke template.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleCreate}>
              Buat Slot
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog edit pengaturan: nama, kategori, ukuran kertas, orientasi */}
      <Dialog open={!!editT} onOpenChange={(o) => !o && setEditT(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Format Laporan</DialogTitle>
            <DialogDescription>
              {editT?.code} — ukuran kertas dipakai saat cetak PDF &amp; Excel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Nama Format</label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Kategori</label>
              <Input value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            {editT && kindBadge(editT) === "Word" ? (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                Ukuran dan orientasi mengikuti pengaturan halaman di file Word (boleh campuran potret/landscape).
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">Ukuran Kertas</label>
                  <Select value={editForm.paperSize} onValueChange={(v) => setEditForm((f) => ({ ...f, paperSize: v }))}>
                    <SelectTrigger aria-label="Ukuran kertas"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4 (210×297)</SelectItem>
                      <SelectItem value="F4">F4 / Folio (215×330)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Orientasi</label>
                  <Select value={editForm.orientation} onValueChange={(v) => setEditForm((f) => ({ ...f, orientation: v as "portrait" | "landscape" }))}>
                    <SelectTrigger aria-label="Orientasi"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Potret</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditT(null)}>Batal</Button>
            <Button onClick={handleEdit}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Entri token kamus variabel ({{...}}) siap salin. */
interface KamusEntry {
  token: string;
  label: string;
  hint: string;
  status?: "siap" | "rencana";
}

const KAMUS_TABS = FILL_VARIABLE_MODULES.map((m) => ({ key: m.module, label: m.label }));

function kamusEntries(module: string): KamusEntry[] {
  const mod = FILL_VARIABLE_MODULES.find((m) => m.module === module);
  if (!mod) return [];
  const out: KamusEntry[] = [];
  for (const g of mod.groups) {
    for (const v of g.variables as FillVariable[]) {
      out.push({
        token: v.name === "=..." ? "=SUM(...)" : `{{${v.name}}}`,
        label: `${g.label} · ${v.label}`,
        hint: v.description,
        status: v.status,
      });
    }
  }
  return out;
}

function KamusEntryRow({ e }: { e: KamusEntry }) {
  const copy = () => {
    navigator.clipboard.writeText(e.token).then(
      () => toast.success(`Disalin: ${e.token}`),
      () => toast.error("Gagal menyalin")
    );
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/50"
    >
      <code className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
        {e.token}
      </code>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{e.label}</span>
        <span className="block text-xs text-muted-foreground">{e.hint}</span>
      </span>
      <span className="mt-0.5 flex shrink-0 items-center gap-1">
        <Badge variant={e.status === "rencana" ? "outline" : "secondary"} className="text-[10px]">
          {e.status === "rencana" ? "Rencana" : "Siap"}
        </Badge>
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
    </button>
  );
}

function KamusVariabelPanel() {
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!searching) return [];
    const out: { module: string; moduleLabel: string; entries: KamusEntry[] }[] = [];
    for (const t of KAMUS_TABS) {
      const entries = kamusEntries(t.key).filter(
        (e) =>
          e.token.toLowerCase().includes(q) ||
          e.label.toLowerCase().includes(q) ||
          e.hint.toLowerCase().includes(q)
      );
      if (entries.length === 0) continue;
      out.push({ module: t.key, moduleLabel: t.label, entries });
    }
    return out;
  }, [q, searching]);
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <p className="text-sm text-muted-foreground">
          Daftar token yang bisa dipakai di template. Klik untuk menyalin.
        </p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari variabel..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      {searching ? (
        <div className="space-y-4">
          {searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground">Tidak ada variabel yang cocok.</p>
          )}
          {searchResults.map((r) => (
            <Card key={r.module}>
              <CardContent className="space-y-2 pt-4">
                <h2 className="text-sm font-semibold">{r.moduleLabel}</h2>
                <div className="grid gap-2 md:grid-cols-2">
                  {r.entries.map((e) => (
                    <KamusEntryRow key={`${r.module}-${e.token}`} e={e} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Tabs defaultValue={KAMUS_TABS[0]?.key}>
          <TabsList className="h-auto flex-wrap">
            {KAMUS_TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {KAMUS_TABS.map((t) => {
            const entries = kamusEntries(t.key);
            return (
              <TabsContent key={t.key} value={t.key} className="space-y-4">
                <Card>
                  <CardContent className="space-y-2 pt-4">
                    <h2 className="text-sm font-semibold">
                      Template Excel &amp; Surat{" "}
                      <span className="font-normal text-muted-foreground">(substitusi {"{{...}}"})</span>
                    </h2>
                    {entries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Belum ada variabel terdaftar untuk modul ini.
                      </p>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2">
                        {entries.map((e) => (
                          <KamusEntryRow key={e.token} e={e} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
      <p className="text-xs text-muted-foreground">
        Template memakai sintaks {"{{nama}}"} (mis. {"{{sekolah_nama}}"}, {"{{nama}}"}). Variabel
        berstatus &quot;Rencana&quot; belum dieksekusi — hanya referensi untuk format baru.
      </p>
    </div>
  );
}

/** Pratinjau variabel yang tersedia untuk sebuah modul. */
function VariablePreview({ module }: { module: string }) {
  const def = getFillVariableModule(module);
  if (!def) {
    return (
      <div className="border-b bg-muted/30 px-4 py-3 text-[11px] text-muted-foreground">
        Belum ada variabel terdaftar untuk modul ini.
      </div>
    );
  }
  return (
    <div className="space-y-2 border-b bg-muted/30 px-4 py-3">
      {def.groups.map((g) => (
        <div key={g.label}>
          <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
            {g.label}
          </div>
          <div className="flex flex-wrap gap-1">
            {g.variables.map((v) => (
              <Badge key={v.name} variant="outline" className="font-mono text-[10px]">
                {v.name === "=..." ? "=SUM(...)" : `{{${v.name}}}`}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
