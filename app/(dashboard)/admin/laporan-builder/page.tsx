"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { goGet, goPost, goPut } from "@/lib/api-client";
import { getSchoolLogo } from "@/lib/school-logo";
import { resolveUploadUrl } from "@/lib/upload-url";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
import {
  cellKey,
  createSheet,
  DEFAULT_COL_WIDTH_PX,
  MIN_COL_WIDTH_PX,
  MAX_COL_WIDTH_PX,
  PX_TO_PT,
  totalColWidthPx,
  type ReportWorkbook,
  type ReportDensity,
  type SheetCell,
  type ConditionalRule,
  type ReportShape,
  type ReportImage,
} from "@/lib/config/report-sheet";
import { REPORT_DENSITY_PRESETS } from "@/lib/config/report-document";
import {
  createDefaultWorkbook,
  deserializeWorkbook,
  serializeWorkbook,
} from "@/lib/report-engine-v3";
import { SheetGrid, type SheetGridHandle } from "@/components/report-builder/sheet-grid";
import { ReportRibbon, type RibbonVariableSample } from "@/components/report-builder/report-ribbon";
import { computePageBreaks, paperContentSizePt } from "@/lib/report-paginate";
import { useImmersiveLayout } from "@/lib/contexts/layout-chrome-context";
import type { LetterSchoolData } from "@/lib/letter-pdf";
import type { ReportPdfInput } from "@/lib/report-pdf";
import { schoolGlobalVars } from "@/lib/report-pdf";
import { extractVisualStyle, patchCells, type Bounds } from "@/lib/report-sheet-ops";

const ReportPdfPreview = dynamic<ReportPdfInput>(
  () => import("@/components/report-builder/report-pdf-preview").then((m) => m.ReportPdfPreview),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Memuat pratinjau PDF laporan...</div> }
);

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

  const [wb, setWb] = useState<ReportWorkbook>(() => createDefaultWorkbook());
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [selected, setSelected] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [selection, setSelection] = useState<Bounds>({ r0: 0, c0: 0, r1: 0, c1: 0 });
  const [templateList, setTemplateList] = useState<any[]>([]);
  const [selectedTplId, setSelectedTplId] = useState<string>("");
  const [mockJson, setMockJson] = useState<string>(JSON.stringify(DEFAULT_MOCK_DATASET, null, 2));
  const [dataset, setDataset] = useState<Record<string, any>[]>(DEFAULT_MOCK_DATASET);
  const [mockModalOpen, setMockModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPageBreaks, setShowPageBreaks] = useState(true);
  const [zoom, setZoom] = useState<number | null>(null);
  const [effectiveScale, setEffectiveScale] = useState(1);
  const [mergeState, setMergeState] = useState({ canMerge: false, isMerged: false });
  const [extraRows, setExtraRows] = useState(0);
  const [freezeCols, setFreezeCols] = useState(0);
  const [freezeRows, setFreezeRows] = useState(0);
  const [formatPainter, setFormatPainter] = useState<Partial<SheetCell> | null>(null);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [sortFilterOpen, setSortFilterOpen] = useState(false);
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterKey, setFilterKey] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [conditionalOpen, setConditionalOpen] = useState(false);
  const [condCol, setCondCol] = useState(-1);
  const [condOp, setCondOp] = useState<ConditionalRule["op"]>("gt");
  const [condValue, setCondValue] = useState("");
  const [condBg, setCondBg] = useState("#fee2e2");
  const [condColor, setCondColor] = useState("#b91c1c");
  const gridRef = useRef<SheetGridHandle>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const immersive = true;
  useImmersiveLayout(immersive);

  const [undoStack, setUndoStack] = useState<ReportWorkbook[]>([]);
  const [redoStack, setRedoStack] = useState<ReportWorkbook[]>([]);
  const lastSnapshotRef = useRef<number>(0);

  /**
   * Perbarui workbook. Snapshot undo hanya dibuat bila >800ms sejak snapshot
   * terakhir, sehingga ketikan cepat pada satu field tidak membanjiri undo.
   * Gunakan `{ force: true }` untuk aksi besar (template load, merge, dll).
   */
  const updateWb = useCallback(
    (next: ReportWorkbook, opts?: { force?: boolean }) => {
      const now = Date.now();
      if (opts?.force || now - lastSnapshotRef.current > 800) {
        setUndoStack((prev) => [...prev.slice(-20), wb]);
        setRedoStack([]);
        lastSnapshotRef.current = now;
      }
      setWb(next);
    },
    [wb]
  );

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, wb]);
    lastSnapshotRef.current = Date.now();
    setWb(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, wb]);
    lastSnapshotRef.current = Date.now();
    setWb(next);
  };

  useEffect(() => {
    (async () => {
      try {
        const res: any = await goGet("/api/reports/templates");
        if (res?.success && Array.isArray(res.data)) setTemplateList(res.data);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const applyTemplateMeta = (restored: ReportWorkbook, tpl: any): ReportWorkbook => {
    restored.reportCode = tpl.code;
    restored.reportName = tpl.name;
    restored.category = tpl.category;
    restored.module = tpl.module || restored.module;
    restored.paperSize = tpl.paperSize || "A4";
    restored.orientation = tpl.orientation || "portrait";
    return restored;
  };

  useEffect(() => {
    if (!templateId) return;
    (async () => {
      try {
        const res: any = await goGet(`/api/reports/templates/${templateId}`);
        if (res?.success && res.data) {
          const tpl = res.data;
          setSelectedTplId(String(tpl.id));
          const restored = applyTemplateMeta(deserializeWorkbook(tpl.layoutJson), tpl);
          setWb(restored);
          setActiveSheetIdx(0);
        }
      } catch {
        toast.error("Gagal memuat template laporan");
      }
    })();
  }, [templateId]);

  // Format baru dari halaman "Laporan & Format": ?new=1&module=...&name=...
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const moduleKey = searchParams.get("module") || "umum";
    const name = searchParams.get("name") || "";
    const category = searchParams.get("category") || "Umum";
    setWb(() =>
      createDefaultWorkbook({ reportName: name || "Laporan Baru", category, module: moduleKey }),
    );
    setSelectedTplId("");
    setActiveSheetIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const activeSheet = wb.sheets[activeSheetIdx] || wb.sheets[0];
  const activeSheetId = activeSheet?.id;
  useEffect(() => {
    if (!activeSheetId) return;
    setSelected({ r: 0, c: 0 });
    setSelection({ r0: 0, c0: 0, r1: 0, c1: 0 });
    setFormatPainter(null);
    setSelectedShapeId(null);
  }, [activeSheetId]);
  const currentCell = activeSheet?.cells[cellKey(selected.r, selected.c)];
  const gridGlobals = useMemo(() => ({ ...schoolGlobalVars(school), laporan: { periode: "Contoh Periode" } }), [school]);

  /**
   * Rencana batas halaman dihitung dengan engine yang sama dengan PDF, agar
   * garis di editor benar-benar mencerminkan hasil cetak (termasuk ekspansi
   * baris zona ulang berdasarkan jumlah data simulasi).
   */
  const pageBreakPlan = useMemo(
    () => computePageBreaks(activeSheet, wb, { dataset, global: gridGlobals }),
    [activeSheet, wb, dataset, gridGlobals]
  );

  /** Rasio lebar total kolom terhadap area cetak (1 = pas dengan kertas). */
  const printWidthRatio = useMemo(() => {
    const contentPt = paperContentSizePt(wb).contentWidthPt;
    const totalPt = totalColWidthPx(activeSheet) * PX_TO_PT;
    return contentPt > 0 ? totalPt / contentPt : 1;
  }, [activeSheet, wb]);

  const generalVars: RibbonVariableSample[] = useMemo(
    () => [
      { label: "Nama Sekolah", token: "{{sekolah.schoolName}}", hint: "dari pengaturan sekolah" },
      { label: "Alamat", token: "{{sekolah.address}}", hint: "dari pengaturan sekolah" },
      { label: "Kepala Sekolah", token: "{{principal.nama}}", hint: "dari pengaturan sekolah" },
      { label: "NIP Kepsek", token: "{{principal.nip}}", hint: "dari pengaturan sekolah" },
      { label: "Periode", token: "{{laporan.periode}}", hint: "diisi pemanggil" },
      { label: "Total Nominal", token: "{{laporan.total_nominal}}", hint: "diisi pemanggil" },
    ],
    []
  );

  const setRowHeight = (heightPt: number | undefined) => {
    if (!activeSheet) return;
    const rowHeights = { ...(activeSheet.rowHeights || {}) };
    for (let r = selection.r0; r <= selection.r1; r++) {
      // undefined = kembalikan ke auto; 0 = sembunyikan; >0 = tinggi eksplisit.
      if (heightPt !== undefined) rowHeights[r] = Math.max(0, heightPt);
      else delete rowHeights[r];
    }
    updateSheet({ rowHeights });
  };

  const updateSheet = (patch: Partial<typeof activeSheet>) => {
    const sheets = wb.sheets.map((s, i) => (i === activeSheetIdx ? { ...s, ...patch } : s));
    updateWb({ ...wb, sheets });
  };

  const updateCell = (patch: Partial<SheetCell>) => {
    if (!activeSheet) return;
    updateSheet({ cells: patchCells(activeSheet, { r0: selected.r, c0: selected.c, r1: selected.r, c1: selected.c }, patch).cells });
  };

  const updateSelection = (patch: Partial<SheetCell>) => {
    if (!activeSheet) return;
    updateSheet({ cells: patchCells(activeSheet, selection, patch).cells });
  };

  const selectedShape = activeSheet?.shapes?.find((s) => s.id === selectedShapeId) ?? null;

  const updateShape = (patch: Partial<ReportShape>) => {
    if (!activeSheet || !selectedShapeId) return;
    updateSheet({
      shapes: (activeSheet.shapes || []).map((s) => (s.id === selectedShapeId ? { ...s, ...patch } : s)),
    });
  };

  const selectedImage = activeSheet?.images?.find((im) => im.id === selectedShapeId) ?? null;

  const updateImage = (patch: Partial<ReportImage>) => {
    if (!activeSheet || !selectedShapeId) return;
    updateSheet({
      images: (activeSheet.images || []).map((im) => (im.id === selectedShapeId ? { ...im, ...patch } : im)),
    });
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      // "gallery" adalah folder publik yang sudah diizinkan tulis & disajikan
      // route /uploads/*. Folder "uploads" TIDAK disajikan publik (404).
      form.append("folder", "gallery");
      const res: any = await goPost("/api/upload", form);
      const stored = res?.url || res?.data?.url;
      const url = resolveUploadUrl(stored);
      if (!url) throw new Error("Gagal mengunggah gambar");
      gridRef.current?.addImage(url);
      toast.success("Gambar ditambahkan");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah gambar");
    }
  };

  const toggleRowRepeat = (r: number, value: boolean) => {
    if (!activeSheet) return;
    const cells = { ...activeSheet.cells };
    for (let c = 0; c < activeSheet.cols; c++) {
      const key = cellKey(r, c);
      const cell = cells[key] || {};
      if (value) cells[key] = { ...cell, repeatZone: true };
      else {
        const { repeatZone, ...rest } = cell;
        void repeatZone;
        if (Object.keys(rest).length === 0) delete cells[key];
        else cells[key] = rest;
      }
    }
    updateSheet({ cells });
  };

  const datasetKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of dataset) for (const k of Object.keys(row)) keys.add(k);
    return Array.from(keys);
  }, [dataset]);

  const applyDensityPreset = (density: ReportDensity) => {
    const preset = REPORT_DENSITY_PRESETS[density];
    updateWb({ ...wb, density, margin: { ...preset.margin }, typography: { ...preset.typography } }, { force: true });
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
    if (!found) return;
    try {
      const restored = applyTemplateMeta(deserializeWorkbook(found.layoutJson), found);
      updateWb(restored, { force: true });
      setActiveSheetIdx(0);
      toast.success(`Template "${found.name}" dimuat`);
    } catch {
      toast.error(`Template "${found.name}" rusak dan tidak bisa dimuat`);
    }
  };

  const handleDownloadPdf = async () => {
    setGenerating(true);
    try {
      const { generateReportPdf } = await import("@/lib/report-pdf");
      const blob = await generateReportPdf({
        workbook: wb,
        school,
        dataset,
        fileName: wb.reportName || "Laporan",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${wb.reportName || "Laporan"}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("PDF Laporan berhasil diunduh");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat PDF");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!wb.reportCode || !wb.reportName) {
      toast.error("Kode & Nama Template wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: wb.reportCode,
        name: wb.reportName,
        category: wb.category || "Umum",
        module: wb.module || "umum",
        description: `Template format ${wb.reportName}`,
        paperSize: wb.paperSize,
        orientation: wb.orientation,
        layoutJson: serializeWorkbook(wb),
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
    } catch {
      toast.error("Gagal menyimpan template ke server");
    } finally {
      setSaving(false);
    }
  };

  const handleExportJson = () => {
    const data = serializeWorkbook(wb);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ReportTemplate-${wb.reportCode || "CUSTOM"}.json`;
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
        const restored = deserializeWorkbook(text);
        updateWb(restored, { force: true });
        setActiveSheetIdx(0);
        toast.success("Template berhasil diimpor dari file JSON");
      } catch {
        toast.error("File JSON tidak valid");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const addSheet = () => {
    const sheet = createSheet({ name: `Lembar ${wb.sheets.length + 1}`, cols: activeSheet?.cols || 6 });
    updateWb({ ...wb, sheets: [...wb.sheets, sheet] }, { force: true });
    setActiveSheetIdx(wb.sheets.length);
  };

  const handleRemoveColumn = () => {
    if (!activeSheet || activeSheet.cols <= 1) return;
    const last = activeSheet.cols - 1;
    const cells: (typeof activeSheet)["cells"] = {};
    for (const [key, cell] of Object.entries(activeSheet.cells)) {
      const c = Number(key.split(",")[1]);
      if (c >= last) continue;
      const maxCol = (cell.colSpan ?? 1) - 1 + c;
      if (maxCol >= last) {
        const newSpan = last - c;
        if (newSpan <= 1) {
          const { colSpan, ...rest } = cell;
          void colSpan;
          cells[key] = rest;
        } else {
          cells[key] = { ...cell, colSpan: newSpan };
        }
      } else {
        cells[key] = cell;
      }
    }
    const rowHeights = activeSheet.rowHeights ? { ...activeSheet.rowHeights } : undefined;
    setSelected((s) => ({ r: s.r, c: Math.min(s.c, last - 1) }));
    updateSheet({ cols: last, colWidths: activeSheet.colWidths.slice(0, last), cells, ...(rowHeights ? { rowHeights } : {}) });
  };

  const removeSheet = (idx: number) => {
    if (wb.sheets.length <= 1) {
      toast.error("Minimal satu lembar harus ada");
      return;
    }
    const sheets = wb.sheets.filter((_, i) => i !== idx);
    updateWb({ ...wb, sheets }, { force: true });
    setActiveSheetIdx((cur) => Math.min(cur, sheets.length - 1));
  };

  const renameSheet = (idx: number, name: string) => {
    const sheets = wb.sheets.map((s, i) => (i === idx ? { ...s, name } : s));
    updateWb({ ...wb, sheets });
  };

  const handleAddRow = () => setExtraRows((e) => e + 5);
  const handleRemoveRow = () => gridRef.current?.deleteLastRow();

  const handleResizeColumn = (cols: number[], widthPx: number) => {
    if (!activeSheet) return;
    const colWidths = [...activeSheet.colWidths];
    // 0 = sembunyikan kolom (tanpa lantai), hanya batas atas yang dijaga.
    for (const c of cols) colWidths[c] = Math.max(0, Math.min(MAX_COL_WIDTH_PX, Math.round(widthPx)));
    updateSheet({ colWidths });
  };

  const handleResizeRow = (rows: number[], heightPt: number) => {
    if (!activeSheet) return;
    const rowHeights = { ...(activeSheet.rowHeights || {}) };
    for (const r of rows) rowHeights[r] = Math.max(0, heightPt);
    updateSheet({ rowHeights });
  };

  /**
   * Bagi lebar area konten kertas ke seluruh kolom secara proporsional terhadap
   * lebar saat ini. Hasilnya total kolom pas dengan area cetak (tanpa overflow),
   * membantu template lama yang lebarnya belum disesuaikan.
   */
  const handleFitColumnsToWidth = () => {
    if (!activeSheet) return;
    const contentWidthPx = paperContentSizePt(wb).contentWidthPt / PX_TO_PT;
    const current = activeSheet.colWidths.length
      ? activeSheet.colWidths
      : Array.from({ length: activeSheet.cols }, () => DEFAULT_COL_WIDTH_PX);
    const total = current.reduce((a, b) => a + b, 0) || 1;
    const visible = current.map((w) => Math.max(0, w));
    const visibleTotal = visible.reduce((a, b) => a + b, 0) || 1;
    const raw = visible.map((w) => (w / visibleTotal) * contentWidthPx);
    const colWidths = raw.map((w, i) => {
      if (visible[i] === 0) return 0;
      // Fit to Width harus benar-benar mengisi lebar cetak. Batas editor
      // MAX_COL_WIDTH_PX tidak boleh diterapkan di sini karena pada jumlah
      // kolom banyak, clamp itu membuat total tetap overflow dan PDF wrap.
      return Math.max(1, Math.round(w));
    });
    const roundedTotal = colWidths.reduce((a, b) => a + b, 0);
    const adjustIndex = [...colWidths.keys()].reverse().find((i) => visible[i] > 0);
    if (adjustIndex !== undefined) {
      colWidths[adjustIndex] = Math.max(1, colWidths[adjustIndex] + Math.round(contentWidthPx - roundedTotal));
    }
    updateSheet({ colWidths });
    toast.success("Kolom disesuaikan ke lebar kertas");
  };

  /**
   * Hitung skala cetak otomatis agar seluruh lebar tabel muat 1 halaman.
   * Tidak mengubah lebar kolom model — hanya `printScale` (ala Excel "Fit to 1
   * page wide"). Dibatasi 10%–100% agar teks tak menjadi tak terbaca.
   */
  const handleScaleToFitPage = () => {
    const contentPt = paperContentSizePt(wb).contentWidthPt;
    const totalPt = totalColWidthPx(activeSheet) * PX_TO_PT;
    if (totalPt <= 0 || contentPt <= 0) return;
    const ratio = contentPt / totalPt;
    const scale = Math.max(0.1, Math.min(1, Math.round(ratio * 100) / 100));
    updateWb({ ...wb, printScale: scale });
    toast.success(`Skala cetak disetel ${Math.round(scale * 100)}% agar muat 1 halaman`);
  };

  /** Cari & ganti di seluruh sel sheet aktif. */
  const handleFindReplace = (replace: boolean) => {
    if (!activeSheet) return;
    if (!findText) {
      toast.error("Teks pencarian kosong");
      return;
    }
    let count = 0;
    const cells = { ...activeSheet.cells };
    for (const [key, cell] of Object.entries(cells)) {
      if (typeof cell.value !== "string") continue;
      if (cell.value.includes(findText)) {
        count++;
        if (replace) cells[key] = { ...cell, value: cell.value.split(findText).join(replaceText) };
      }
    }
    if (count === 0) {
      toast.info("Tidak ada kecocokan");
      return;
    }
    if (replace) {
      updateSheet({ cells });
      toast.success(`${count} sel diganti`);
    } else {
      toast.success(`${count} sel cocok ditemukan`);
    }
  };

  /** Terapkan dataset hasil sort/filter ke simulasi. */
  const applySortFilter = () => {
    let rows = [...dataset];
    if (filterKey && filterValue) {
      rows = rows.filter((r) => String(r[filterKey] ?? "").toLowerCase().includes(filterValue.toLowerCase()));
    }
    if (sortKey) {
      rows.sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const an = Number(av);
        const bn = Number(bv);
        let cmp: number;
        if (!isNaN(an) && !isNaN(bn)) cmp = an - bn;
        else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    setDataset(rows);
    setSortFilterOpen(false);
    toast.success(`Dataset disimulasikan: ${rows.length} baris`);
  };

  const addConditionalRule = (rule: ConditionalRule) => {
    if (!activeSheet) return;
    const conditionals = [...(activeSheet.conditionals || []), rule];
    updateSheet({ conditionals });
    toast.success("Aturan conditional ditambahkan");
  };

  const removeConditionalRule = (idx: number) => {
    if (!activeSheet) return;
    const conditionals = (activeSheet.conditionals || []).filter((_, i) => i !== idx);
    updateSheet({ conditionals });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ReportRibbon
        wb={wb}
        currentCell={currentCell}
        datasetKeys={datasetKeys}
        datasetCount={dataset.length}
        pageBreakPlan={pageBreakPlan}
        showPageBreaks={showPageBreaks}
        zoom={zoom}
        effectiveScale={effectiveScale}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        saving={saving}
        generating={generating}
        templateList={templateList}
        selectedTplId={selectedTplId}
        onExit={() => {
          // Kembali ke halaman asal (mis. daftar Format Laporan). Bila Studio
          // dibuka langsung tanpa riwayat, back() tidak berefek → alihkan ke
          // daftar format.
          if (typeof window !== "undefined" && window.history.state?.idx > 0) router.back();
          else router.push("/admin/laporan-format");
        }}
        onBack={() => router.back()}
        onSelectTemplate={handleSelectTemplate}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSaveTemplate}
        onPreview={() => setPreviewOpen(true)}
        onDownloadPdf={handleDownloadPdf}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onOpenDataDialog={() => setMockModalOpen(true)}
        onChangeMeta={(patch) => updateWb({ ...wb, ...patch })}
        onChangeCell={(patch) => {
          if (formatPainter) {
            setFormatPainter((p) => ({ ...p, ...patch }));
            return;
          }
          updateSelection(patch);
        }}
        onInsertCellValue={(value) => updateCell({ value })}
        onClearCell={() => updateSelection({ value: "" })}
        onMerge={() => gridRef.current?.mergeSelection()}
        onSplit={() => gridRef.current?.unmergeSelection()}
        canMerge={mergeState.canMerge}
        isMerged={mergeState.isMerged}
        onAddColumn={() => updateSheet({ cols: activeSheet.cols + 1, colWidths: [...activeSheet.colWidths, DEFAULT_COL_WIDTH_PX] })}
        onFitColumnsToWidth={handleFitColumnsToWidth}
        printWidthRatio={printWidthRatio}
        onScaleToFitPage={handleScaleToFitPage}
        onRemoveColumn={handleRemoveColumn}
        onAddRow={handleAddRow}
        onRemoveRow={handleRemoveRow}
        onInsertRowAbove={() => gridRef.current?.insertRowAbove()}
        onInsertRowBelow={() => gridRef.current?.insertRowBelow()}
        onInsertColLeft={() => gridRef.current?.insertColLeft()}
        onInsertColRight={() => gridRef.current?.insertColRight()}
        onAddShape={(type) => gridRef.current?.addShape(type)}
        onChangeShape={updateShape}
        onDeleteShape={() => gridRef.current?.deleteShape()}
        selectedShape={selectedShape}
        onAddImage={(src) => gridRef.current?.addImage(src)}
        onUploadImage={handleUploadImage}
        selectedImage={selectedImage}
        onChangeImage={updateImage}
        onAddSheet={addSheet}
        onToggleRowRepeat={() => toggleRowRepeat(selected.r, !currentCell?.repeatZone)}
        rowRepeat={currentCell?.repeatZone === true}
        sheets={wb.sheets.map((s) => ({ id: s.id, name: s.name }))}
        activeSheetIdx={activeSheetIdx}
        onSelectSheet={setActiveSheetIdx}
        onRemoveSheet={removeSheet}
        onTogglePageBreaks={() => setShowPageBreaks((v) => !v)}
        onZoom={(z) => setZoom(z)}
        onApplyDensity={applyDensityPreset}
        onSetRowHeight={setRowHeight}
        rowHeight={activeSheet?.rowHeights?.[selected.r]}
        generalVars={generalVars}
        isClipboardFormatting={!!formatPainter}
        onToggleFormatPainter={() => {
          if (formatPainter) {
            setFormatPainter(null);
            return;
          }
          if (!currentCell) {
            toast.error("Pilih sel dengan format untuk disalin");
            return;
          }
          setFormatPainter(extractVisualStyle(currentCell) || {});
          toast.info("Format painter aktif — klik sel tujuan lalu tekan tombol lagi");
        }}
        onFindReplace={() => setFindReplaceOpen(true)}
        freezeCols={freezeCols}
        freezeRows={freezeRows}
        onSetFreeze={(cols, rows) => {
          setFreezeCols(cols);
          setFreezeRows(rows);
        }}
        onOpenSortFilter={() => setSortFilterOpen(true)}
        onOpenConditional={() => setConditionalOpen(true)}
      />

      <div className="min-h-0 flex-1 overflow-hidden bg-slate-100 dark:bg-zinc-900/40">
        <SheetGrid
          ref={gridRef}
          sheet={activeSheet}
          onChange={updateSheet}
          selected={selected}
          onSelect={setSelected}
          onSelectionChange={setSelection}
          onShapeSelectChange={setSelectedShapeId}
          dataset={dataset}
          global={gridGlobals}
          pageBreakPlan={pageBreakPlan}
          showPageBreaks={showPageBreaks}
          onTogglePageBreaks={() => setShowPageBreaks((v) => !v)}
          zoom={zoom}
          onScaleChange={setEffectiveScale}
          onMergeStateChange={setMergeState}
          minRows={12 + extraRows}
          onResizeColumn={handleResizeColumn}
          onResizeRow={handleResizeRow}
          freezeCols={freezeCols}
          freezeRows={freezeRows}
          onPaintFormat={
            formatPainter
              ? (r, c) => {
                  if (!activeSheet) return;
                  const key = cellKey(r, c);
                  const cells = { ...activeSheet.cells, [key]: { ...(activeSheet.cells[key] || {}), ...formatPainter } };
                  updateSheet({ cells });
                  setFormatPainter(null);
                  toast.success("Format ditempelkan");
                }
              : undefined
          }
          sheetTabs={wb.sheets.map((s) => ({ id: s.id, name: s.name }))}
          activeSheetIdx={activeSheetIdx}
          onSelectSheet={setActiveSheetIdx}
          onAddSheet={addSheet}
          onRemoveSheet={removeSheet}
          onRenameSheet={renameSheet}
          hideToolbar
        />
      </div>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex h-[92vh] max-w-5xl flex-col p-4">
          <DialogHeader className="border-b pb-2">
            <DialogTitle className="text-base font-semibold">Pratinjau PDF Laporan</DialogTitle>
          </DialogHeader>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border bg-card">
            {previewOpen && (
              <ReportPdfPreview workbook={wb} school={school} dataset={dataset} global={gridGlobals} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Data test dialog */}
      <Dialog open={mockModalOpen} onOpenChange={setMockModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Simulasi Dataset Laporan (Array JSON)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Masukkan contoh data JSON mentah yang biasanya dikirim oleh modul lain (Tabungan, Inventaris, Presensi) untuk menguji format laporan.
            </p>
            <Textarea className="h-64 font-mono text-xs" value={mockJson} onChange={(e) => setMockJson(e.target.value)} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setMockModalOpen(false)}>Batal</Button>
              <Button size="sm" onClick={handleApplyMockJson}>Terapkan Simulasi</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Find & Replace dialog */}
      <Dialog open={findReplaceOpen} onOpenChange={setFindReplaceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Cari & Ganti</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Cari teks..." value={findText} onChange={(e) => setFindText(e.target.value)} />
            <Input placeholder="Ganti dengan..." value={replaceText} onChange={(e) => setReplaceText(e.target.value)} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => handleFindReplace(false)}>Cari</Button>
              <Button size="sm" onClick={() => handleFindReplace(true)}>Ganti Semua</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sort & Filter dialog */}
      <Dialog open={sortFilterOpen} onOpenChange={setSortFilterOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Urutkan & Filter Dataset Simulasi</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Urutkan berdasarkan</label>
                <select className="mt-1 h-9 w-full rounded border bg-background px-2 text-sm" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                  <option value="">— tidak —</option>
                  {datasetKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Arah</label>
                <select className="mt-1 h-9 w-full rounded border bg-background px-2 text-sm" value={sortDir} onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}>
                  <option value="asc">Naik (A-Z / kecil-besar)</option>
                  <option value="desc">Turun (Z-A / besar-kecil)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Filter kolom</label>
                <select className="mt-1 h-9 w-full rounded border bg-background px-2 text-sm" value={filterKey} onChange={(e) => setFilterKey(e.target.value)}>
                  <option value="">— tidak —</option>
                  {datasetKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Mengandung</label>
                <Input className="mt-1 h-9" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => { setDataset(DEFAULT_MOCK_DATASET); setMockJson(JSON.stringify(DEFAULT_MOCK_DATASET, null, 2)); setSortFilterOpen(false); }}>
                Reset Data
              </Button>
              <Button size="sm" onClick={applySortFilter}>Terapkan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conditional formatting dialog */}
      <Dialog open={conditionalOpen} onOpenChange={setConditionalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Pewarnaan Bersyarat (Conditional Formatting)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Kolom</label>
                <select className="mt-1 h-9 w-full rounded border bg-background px-2 text-sm" value={condCol} onChange={(e) => setCondCol(Number(e.target.value))}>
                  <option value={-1}>Semua kolom</option>
                  {Array.from({ length: activeSheet.cols }).map((_, c) => (
                    <option key={c} value={c}>{colLettersLabel(c)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Kondisi</label>
                <select className="mt-1 h-9 w-full rounded border bg-background px-2 text-sm" value={condOp} onChange={(e) => setCondOp(e.target.value as ConditionalRule["op"])}>
                  <option value="gt">&gt; lebih besar</option>
                  <option value="gte">&ge; lebih besar sama</option>
                  <option value="lt">&lt; lebih kecil</option>
                  <option value="lte">&le; lebih kecil sama</option>
                  <option value="eq">= sama dengan</option>
                  <option value="neq">&ne; tidak sama</option>
                  <option value="contains">mengandung</option>
                  <option value="notEmpty">tidak kosong</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Nilai pembanding</label>
              <Input className="mt-1 h-9" value={condValue} onChange={(e) => setCondValue(e.target.value)} placeholder="mis. 0" />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs">
                Warna latar
                <input type="color" className="h-7 w-10 cursor-pointer rounded border" value={condBg} onChange={(e) => setCondBg(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-xs">
                Warna teks
                <input type="color" className="h-7 w-10 cursor-pointer rounded border" value={condColor} onChange={(e) => setCondColor(e.target.value)} />
              </label>
            </div>
            <Button
              size="sm"
              onClick={() => {
                addConditionalRule({ col: condCol, op: condOp, value: condValue, bg: condBg, color: condColor });
              }}
            >
              Tambah Aturan
            </Button>

            <div className="max-h-40 overflow-auto rounded border">
              {(!activeSheet.conditionals || activeSheet.conditionals.length === 0) ? (
                <p className="p-2 text-xs text-muted-foreground">Belum ada aturan.</p>
              ) : (
                activeSheet.conditionals.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2 border-b px-2 py-1 text-xs last:border-b-0">
                    <span className="h-4 w-4 rounded border" style={{ backgroundColor: rule.bg }} />
                    <span className="flex-1 font-mono">
                      {rule.col === -1 ? "Semua" : colLettersLabel(rule.col)} · {rule.op} {rule.value}
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 text-red-600" onClick={() => removeConditionalRule(i)}>Hapus</Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Huruf kolom (A, B, ...) dari indeks 0-based. */
function colLettersLabel(c: number): string {
  let n = c + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
