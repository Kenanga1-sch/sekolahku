"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Printer,
  Save,
  FileDown,
  Plus,
  Settings2,
  Undo2,
  Redo2,
  Download,
  Upload,
  FileSpreadsheet,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { goGet, goPost, goPut } from "@/lib/api-client";
import { getSchoolLogo } from "@/lib/school-logo";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
import {
  createDefaultReportDocument,
  deserializeReportDocument,
  serializeReportDocument,
  type ReportDocumentData,
  type ReportPaperSize,
  type ReportOrientation,
} from "@/lib/config/report-document";
import { ReportBlockEditor } from "@/components/report-builder/report-block-editor";
import { ReportBlockPalette } from "@/components/report-builder/report-block-palette";
import { createReportBlockInstance } from "@/lib/config/report-blocks";
import type { LetterSchoolData } from "@/lib/letter-pdf";
import type { ReportPdfInput } from "@/lib/report-pdf";

const ReportPdfPreview = dynamic<ReportPdfInput>(
  () => import("@/components/report-builder/report-pdf-preview").then((m) => m.ReportPdfPreview),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Memuat pratinjau PDF laporan...</div> }
);

// Mock Dataset untuk testing di Studio Laporan
const DEFAULT_MOCK_DATASET = [
  { no: 1, nisn: "0051234501", nama: "Ahmad Fauzi", kelas: "8A", total_setoran: 500000, total_penarikan: 100000, saldo_akhir: 400000, status: "Aktif" },
  { no: 2, nisn: "0051234502", nama: "Budi Santoso", kelas: "8A", total_setoran: 750000, total_penarikan: 200000, saldo_akhir: 550000, status: "Aktif" },
  { no: 3, nisn: "0051234503", nama: "Citra Dewi", kelas: "8B", total_setoran: 1200000, total_penarikan: 300000, saldo_akhir: 900000, status: "Aktif" },
  { no: 4, nisn: "0051234504", nama: "Dian Permata", kelas: "8B", total_setoran: 300000, total_penarikan: 50000, saldo_akhir: 250000, status: "Aktif" },
];

export default function ReportBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("id");
  const { settings } = useSchoolSettings();

  const [doc, setDoc] = useState<ReportDocumentData>(() => createDefaultReportDocument());
  const [templateList, setTemplateList] = useState<any[]>([]);
  const [selectedTplId, setSelectedTplId] = useState<string>("");
  const [mockJson, setMockJson] = useState<string>(JSON.stringify(DEFAULT_MOCK_DATASET, null, 2));
  const [dataset, setDataset] = useState<Record<string, any>[]>(DEFAULT_MOCK_DATASET);
  const [mockModalOpen, setMockModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingDocx, setGeneratingDocx] = useState(false);

  // Stack Undo / Redo
  const [undoStack, setUndoStack] = useState<ReportDocumentData[]>([]);
  const [redoStack, setRedoStack] = useState<ReportDocumentData[]>([]);

  const updateDocWithUndo = (next: ReportDocumentData) => {
    setUndoStack((prev) => [...prev.slice(-20), doc]);
    setRedoStack([]);
    setDoc(next);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, doc]);
    setDoc(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, doc]);
    setDoc(next);
  };

  // Muat daftar template dari backend
  useEffect(() => {
    (async () => {
      try {
        const res: any = await goGet("/api/reports/templates");
        if (res?.success && Array.isArray(res.data)) {
          setTemplateList(res.data);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // Muat detail template jika ada query id
  useEffect(() => {
    if (!templateId) return;
    (async () => {
      try {
        const res: any = await goGet(`/api/reports/templates/${templateId}`);
        if (res?.success && res.data) {
          const tpl = res.data;
          setSelectedTplId(String(tpl.id));
          const restored = deserializeReportDocument(tpl.layoutJson);
          restored.reportCode = tpl.code;
          restored.reportName = tpl.name;
          restored.category = tpl.category;
          restored.paperSize = tpl.paperSize || "A4";
          restored.orientation = tpl.orientation || "portrait";
          setDoc(restored);
        }
      } catch (e) {
        toast.error("Gagal memuat template laporan");
      }
    })();
  }, [templateId]);

  // Data Sekolah untuk Kop
  const school: LetterSchoolData = useMemo(
    () => ({
      schoolName: settings.school_name || "SEKOLAH DEMO",
      npsn: settings.school_npsn || "",
      address: settings.school_address || "Jl. Pendidikan No. 1",
      phone: settings.school_phone || "021-123456",
      email: settings.school_email || "info@sekolah.sch.id",
      website: settings.school_website || "",
      logoUrl: getSchoolLogo(settings.school_logo),
      governanceLine: settings.governance_name || "PEMERINTAH KABUPATEN",
      departmentLine: settings.department_name || "DINAS PENDIDIKAN DAN KEBUDAYAAN",
      principalName: settings.principal_name || "Kepala Sekolah, M.Pd",
      principalNip: settings.principal_nip || "19800101 200501 1 001",
      stampUrl: settings.school_stamp || "",
    }),
    [settings]
  );

  const handleAddBlock = (blockId: string) => {
    const inst = createReportBlockInstance(blockId);
    if (!inst) return;
    const nextPages = doc.pages.map((p, idx) =>
      idx === 0 ? { ...p, blocks: [...p.blocks, inst] } : p
    );
    updateDocWithUndo({ ...doc, pages: nextPages });
  };

  const handleApplyMockJson = () => {
    try {
      const parsed = JSON.parse(mockJson);
      if (Array.isArray(parsed)) {
        setDataset(parsed);
        setMockModalOpen(false);
        toast.success("Dataset simulasi berhasil diperbarui");
      } else {
        toast.error("Dataset harus berupa array JSON object");
      }
    } catch {
      toast.error("Format JSON tidak valid");
    }
  };

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTplId(tplId);
    const found = templateList.find((t) => String(t.id) === tplId);
    if (found) {
      const restored = deserializeReportDocument(found.layoutJson);
      restored.reportCode = found.code;
      restored.reportName = found.name;
      restored.category = found.category;
      restored.paperSize = found.paperSize || "A4";
      restored.orientation = found.orientation || "portrait";
      updateDocWithUndo(restored);
      toast.success(`Template "${found.name}" dimuat`);
    }
  };

  const handleDownloadPdf = async () => {
    setGenerating(true);
    try {
      const { generateReportPdf } = await import("@/lib/report-pdf");
      const blob = await generateReportPdf({
        document: doc,
        school,
        dataset,
        fileName: doc.reportName || "Laporan",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.reportName || "Laporan"}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("PDF Laporan berhasil diunduh");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat PDF");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadDocx = async () => {
    setGeneratingDocx(true);
    try {
      const { generateReportDocx } = await import("@/lib/report-docx");
      const blob = await generateReportDocx({
        document: doc,
        school,
        dataset,
        fileName: doc.reportName || "Laporan",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.reportName || "Laporan"}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Word (.docx) berhasil diunduh");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat Word");
    } finally {
      setGeneratingDocx(false);
    }
  };

  const handleDownloadXlsx = async () => {
    try {
      const { generateReportXlsx } = await import("@/lib/report-xlsx");
      generateReportXlsx({
        document: doc,
        dataset,
        fileName: doc.reportName || "Laporan",
      });
      toast.success("Excel (.xlsx) berhasil diunduh");
    } catch (e) {
      toast.error("Gagal membuat Excel");
    }
  };

  const handlePrint = async () => {
    try {
      const { generateReportHtml } = await import("@/lib/report-html");
      const html = generateReportHtml({ document: doc, school, dataset });
      const w = window.open("", "_blank", "noopener,noreferrer");
      if (!w) {
        toast.error("Popup diblokir. Izinkan popup untuk mencetak.");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 400);
    } catch (e) {
      toast.error("Gagal menyiapkan cetak");
    }
  };

  const handleSaveTemplate = async () => {
    if (!doc.reportCode || !doc.reportName) {
      toast.error("Kode & Nama Template wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: doc.reportCode,
        name: doc.reportName,
        category: doc.category || "Umum",
        description: `Template format ${doc.reportName}`,
        paperSize: doc.paperSize,
        orientation: doc.orientation,
        layoutJson: serializeReportDocument(doc),
        isDefault: false,
      };

      if (selectedTplId) {
        const res: any = await goPut(`/api/reports/templates/${selectedTplId}`, payload);
        if (res?.success) toast.success("Template laporan berhasil diperbarui!");
        else toast.error(res?.error || "Gagal memperbarui template");
      } else {
        const res: any = await goPost("/api/reports/templates", payload);
        if (res?.success) {
          toast.success("Template laporan baru berhasil disimpan!");
          if (res.data?.id) setSelectedTplId(String(res.data.id));
        } else toast.error(res?.error || "Gagal menyimpan template");
      }
    } catch (e) {
      toast.error("Gagal menyimpan template ke server");
    } finally {
      setSaving(false);
    }
  };

  const handleExportJson = () => {
    const data = serializeReportDocument(doc);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ReportTemplate-${doc.reportCode || "CUSTOM"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.success("File JSON template berhasil diunduh");
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const restored = deserializeReportDocument(text);
        updateDocWithUndo(restored);
        toast.success("Template berhasil diimpor dari file JSON");
      } catch {
        toast.error("File JSON tidak valid");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="flex h-[calc(var(--app-vh,100dvh)-2rem)] min-h-0 flex-col gap-2 pb-20 md:gap-3 md:pb-0">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">Studio Desainer Format Laporan</h1>
            <p className="truncate text-xs text-muted-foreground">
              Rakit format laporan modular untuk diadopsi oleh berbagai modul di aplikasi.
            </p>
          </div>
        </div>
      </div>

      {/* Main Layout Desktop: Pratinjau Kiri Mentok & Menu Kanan */}
      <div className="min-h-0 flex-1 gap-3 lg:grid lg:grid-cols-[1fr_440px]">
        {/* Kolom Kiri: Live PDF Canvas Preview */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-card">
          <ReportPdfPreview document={doc} school={school} dataset={dataset} />
        </div>

        {/* Kolom Kanan: Seluruh Controls & Form Editor (Scrollable) */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {/* Card 1: Bilah Aksi Ekspor, Simpan & Presets */}
          <div className="rounded-lg border bg-card p-3 space-y-3">
            <div className="flex items-center justify-between gap-1.5 border-b pb-2">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  title="Undo (Batal)"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  title="Redo (Ulang)"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Pemilih Preset Template */}
              <div className="flex items-center gap-1.5 flex-1 max-w-[200px]">
                <Select value={selectedTplId} onValueChange={handleSelectTemplate}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Muat Template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templateList.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name} ({t.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setMockModalOpen(true)}
                title="Simulasi Data Laporan"
              >
                <Database className="h-3.5 w-3.5 mr-1 text-blue-600" /> Data Test
              </Button>
            </div>

            {/* Form Meta Template */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <Label className="text-[10px]">Kode Template</Label>
                <Input
                  className="h-7 text-xs font-mono"
                  placeholder="RPT_TABUNGAN"
                  value={doc.reportCode || ""}
                  onChange={(e) => updateDocWithUndo({ ...doc, reportCode: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px]">Nama Laporan</Label>
                <Input
                  className="h-7 text-xs"
                  placeholder="Laporan Rekapitulasi"
                  value={doc.reportName || ""}
                  onChange={(e) => updateDocWithUndo({ ...doc, reportName: e.target.value })}
                />
              </div>
            </div>

            {/* Pengaturan Kertas */}
            <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2">
              <div>
                <Label className="text-[10px]">Ukuran Kertas</Label>
                <Select
                  value={doc.paperSize}
                  onValueChange={(v) => updateDocWithUndo({ ...doc, paperSize: v as ReportPaperSize })}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                    <SelectItem value="F4">F4 / Folio (215 × 330 mm)</SelectItem>
                    <SelectItem value="LEGAL">Legal (216 × 356 mm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Orientasi</Label>
                <Select
                  value={doc.orientation}
                  onValueChange={(v) => updateDocWithUndo({ ...doc, orientation: v as ReportOrientation })}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Portrait (Tegak)</SelectItem>
                    <SelectItem value="landscape">Landscape (Mendatar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ekspor & Simpan Utama */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-t pt-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleExportJson}
                  title="Ekspor JSON"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <label className="cursor-pointer">
                  <input type="file" accept=".json" className="hidden" onChange={handleImportJson} />
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-background hover:bg-accent" title="Impor JSON">
                    <Upload className="h-3.5 w-3.5" />
                  </div>
                </label>
                <Button variant="outline" size="sm" onClick={handlePrint} title="Cetak HTML">
                  <Printer className="h-3.5 w-3.5 mr-1" /> Cetak
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={handleDownloadXlsx} title="Excel">
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-green-600" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={generating} title="PDF">
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileText className="h-3.5 w-3.5 mr-1" />} PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadDocx} disabled={generatingDocx} title="Word">
                  {generatingDocx ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileDown className="h-3.5 w-3.5 mr-1" />} Word
                </Button>
                <Button size="sm" onClick={handleSaveTemplate} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />} Simpan
                </Button>
              </div>
            </div>
          </div>

          {/* Card 2: Palet Blok Laporan */}
          <div className="rounded-lg border bg-card p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-blue-600" /> Tambah Blok Laporan
            </p>
            <ReportBlockPalette onAdd={handleAddBlock} />
          </div>

          {/* Card 3: Editor Susunan Blok */}
          <div className="flex min-h-[400px] flex-col rounded-lg border bg-card p-3">
            <ReportBlockEditor
              blocks={doc.pages[0]?.blocks || []}
              onChange={(nextBlocks) => {
                const nextPages = doc.pages.map((p, idx) =>
                  idx === 0 ? { ...p, blocks: nextBlocks } : p
                );
                updateDocWithUndo({ ...doc, pages: nextPages });
              }}
            />
          </div>
        </div>
      </div>

      {/* Modal Mock Dataset Tester */}
      <Dialog open={mockModalOpen} onOpenChange={setMockModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Simulasi Dataset Laporan (Array JSON)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Masukkan contoh data JSON mentah yang biasanya dikirim oleh modul lain (Tabungan, Inventaris, Presensi) untuk menguji format laporan.
            </p>
            <Textarea
              className="h-64 font-mono text-xs"
              value={mockJson}
              onChange={(e) => setMockJson(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setMockModalOpen(false)}>
                Batal
              </Button>
              <Button size="sm" onClick={handleApplyMockJson}>
                Terapkan Simulasi
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
