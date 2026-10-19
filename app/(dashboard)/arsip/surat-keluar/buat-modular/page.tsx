"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  LayoutList,
  Eye,
  RefreshCw,
  LayoutTemplate,
  Users,
  Settings2,
  Undo2,
  Redo2,
  Download,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { goPost, goGet, goPatch } from "@/lib/api-client";
import { getSchoolLogo } from "@/lib/school-logo";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
import { useLetterNumbering } from "@/lib/hooks/use-letter-numbering";
import {
  LetterDocumentEditor,
  type LetterDocumentEditorHandle,
} from "@/components/letter-builder/letter-document-editor";
import { BlockPalette } from "@/components/letter-builder/block-palette";
import {
  TemplatePickerDialog,
  type ModularTemplate,
} from "@/components/letter-builder/template-picker-dialog";
import { DataPickerDialog } from "@/components/letter-builder/data-picker-dialog";
import { DocumentSettingsDialog } from "@/components/letter-builder/document-settings-dialog";
import {
  createDocumentFromBlocks,
  migrateContentBlocksToDocument,
  serializeDocument,
  type LetterDocumentData,
} from "@/lib/config/letter-document";
import { formatLetterNumber } from "@/lib/config/letter-number-format";
import type { LetterBlockInstance } from "@/lib/config/letter-blocks";
import { findMissingRequiredInDocument } from "@/lib/config/letter-blocks";
import {
  getLetterStandard,
  type LetterCategory,
  type LetterTypeOption,
} from "@/lib/config/letter-standards";
import { useLetterTypes } from "@/lib/hooks/use-letter-types";
import type { LetterPdfInput, LetterSchoolData } from "@/lib/letter-pdf";

// Renderer PDF dimuat dinamis (client-only) agar aman terhadap SSR.
const PDFPreview = dynamic<LetterPdfInput>(
  () => import("@/components/letter-builder/letter-pdf-preview").then((m) => m.LetterPdfPreview),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Memuat pratinjau…</div> }
);

type Step = "jenis" | "rakit";

const CATEGORY_COLORS: Record<string, string> = {
  Kepegawaian: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Umum: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Kesiswaan: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Kurikulum: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Akademik: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

export default function BuatSuratModularPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditMode = !!editId;
  const { settings } = useSchoolSettings();
  const { options: letterTypeOptions } = useLetterTypes();

  const [step, setStep] = useState<Step>("jenis");
  const [selectedType, setSelectedType] = useState<LetterTypeOption | null>(null);
  const [doc, setDoc] = useState<LetterDocumentData | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingDocx, setGeneratingDocx] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [existingStatus, setExistingStatus] = useState<string>("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [dataPickerOpen, setDataPickerOpen] = useState(false);
  const [docSettingsOpen, setDocSettingsOpen] = useState(false);

  /** Stack undo / redo dokumen. */
  const [undoStack, setUndoStack] = useState<LetterDocumentData[]>([]);
  const [redoStack, setRedoStack] = useState<LetterDocumentData[]>([]);

  /** Wrapper setDoc dengan pendaftaran ke stack undo. */
  const updateDocWithUndo = useCallback(
    (next: LetterDocumentData) => {
      if (doc) {
        setUndoStack((prev) => [...prev.slice(-20), doc]);
        setRedoStack([]);
      }
      setDoc(next);
    },
    [doc]
  );

  const handleUndo = () => {
    if (undoStack.length === 0 || !doc) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, doc]);
    setDoc(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !doc) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, doc]);
    setDoc(next);
  };

  const [meta, setMeta] = useState({
    dateOfLetter: new Date().toISOString().split("T")[0],
    mailNumber: "",
  });

  /** Nomor surat manual (override otomatis). */
  const [manualNumber, setManualNumber] = useState("");
  const [useManualNumber, setUseManualNumber] = useState(false);

  /** Tab aktif pada tampilan mobile (Isi / Tambah / Pratinjau). */
  const [mobileTab, setMobileTab] = useState("isi");
  /** Halaman aktif yang diperlihatkan di ribbon desktop (di-track agar palet
      dapat menonaktifkan blok tunggal yang sudah terpasang). */
  const [activeBlocks, setActiveBlocks] = useState<LetterBlockInstance[]>([]);
  /** Indeks halaman aktif yang dibagikan antar tampilan (desktop & mobile). */
  const [activePageIdx, setActivePageIdx] = useState(0);
  /** Variabel tambahan yang disuntikkan dari dialog pemilih data (siswa/guru). */
  const [injectedVars, setInjectedVars] = useState<Record<string, string>>({});

  /** Auto-save draft ke localStorage (hanya mode buat baru). */
  useEffect(() => {
    if (isEditMode || !doc || step !== "rakit") return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          "sekolahku_letter_draft",
          JSON.stringify({
            doc,
            meta,
            selectedTypeId: selectedType?.id,
            injectedVars,
            savedAt: Date.now(),
          })
        );
      } catch {
        /* ignore */
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [doc, meta, selectedType, injectedVars, isEditMode, step]);

  /** Ekspor dokumen sebagai file JSON. */
  const handleExportJson = () => {
    if (!doc) return;
    const data = serializeDocument(doc);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Document-Modular-${perihal || "Surat"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.success("File JSON dokumen berhasil diunduh");
  };

  /** Impor dokumen dari file JSON. */
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const restored = migrateContentBlocksToDocument(text);
        updateDocWithUndo(restored);
        const ltId = restored.letterTypeId ?? null;
        const opt = ltId != null ? letterTypeOptions.find((o) => o.id === ltId) : undefined;
        if (opt) setSelectedType(opt);
        setStep("rakit");
        toast.success("Dokumen berhasil diimpor dari file JSON");
      } catch {
        toast.error("File JSON tidak valid");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Satu sumber kebenaran: bila jumlah halaman menyusut (mis. hapus halaman),
  // klem indeks agar kedua instance editor (desktop & mobile) tetap sinkron.
  useEffect(() => {
    const total = doc?.pages.length ?? 0;
    if (total > 0 && activePageIdx > total - 1) {
      setActivePageIdx(total - 1);
    }
  }, [doc?.pages.length, activePageIdx]);

  const pdfRef = useRef<LetterPdfInput | null>(null);
  const docEditorRef = useRef<LetterDocumentEditorHandle>(null);
  const mobileDocEditorRef = useRef<LetterDocumentEditorHandle>(null);

  /** Tambah blok ke halaman aktif melalui handle editor dokumen. */
  const handlePaletteAdd = (blockId: string) => {
    docEditorRef.current?.addBlockToActivePage(blockId);
  };

  // Mode edit: muat surat tersimpan & migrasikan contentBlocks ke dokumen.
  useEffect(() => {
    if (!editId) return;
    let active = true;
    setLoadingExisting(true);
    (async () => {
      try {
        const res: any = await goGet(`/api/arsip/surat-keluar/detail?id=${encodeURIComponent(editId)}`);
        const s = res?.data;
        if (!s) throw new Error("Surat tidak ditemukan");
        if (!active) return;

        const migrated = migrateContentBlocksToDocument(s.contentBlocks ?? s.content_blocks);
        // Tandai jenis surat dari metadata dokumen bila ada.
        const ltId = migrated.letterTypeId ?? null;
        const opt = ltId != null ? letterTypeOptions.find((o) => o.id === ltId) : undefined;
        if (opt) setSelectedType(opt);

        setDoc(migrated);
        setExistingStatus(s.status || "");
        setMeta({
          dateOfLetter: (s.dateOfLetter || new Date().toISOString().split("T")[0]).slice(0, 10),
          mailNumber: s.mailNumber || "",
        });
        if (s.mailNumber) {
          setManualNumber(s.mailNumber);
          setUseManualNumber(true);
        }
        setStep("rakit");
      } catch (e) {
        if (active) toast.error(e instanceof Error ? e.message : "Gagal memuat surat");
      } finally {
        if (active) setLoadingExisting(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // Nomor urut otomatis dari backend (berdasar kode klasifikasi + bulan).
  const numbering = useLetterNumbering({
    classificationCode: selectedType?.kodeKlasifikasi || "",
    date: meta.dateOfLetter ? new Date(meta.dateOfLetter).toISOString() : new Date().toISOString(),
    immediate: !!selectedType && !useManualNumber && !isEditMode,
  });

  // Nomor surat final: otomatis (dari format) atau manual.
  const autoNumber = useMemo(() => {
    if (!selectedType || numbering.sequence <= 0) return "";
    const pattern = selectedType.formatNomor || settings.letter_number_format || "";
    const d = meta.dateOfLetter ? new Date(meta.dateOfLetter) : new Date();
    return formatLetterNumber(pattern, numbering.sequence, selectedType.kodeKlasifikasi, d);
  }, [selectedType, numbering.sequence, settings.letter_number_format, meta.dateOfLetter]);

  const effectiveNumber = useManualNumber ? manualNumber : autoNumber;

  // Data sekolah dari pengaturan (data-driven, menggantikan hardcode).
  const school: LetterSchoolData = useMemo(
    () => ({
      schoolName: settings.school_name || "Sekolah",
      npsn: settings.school_npsn || "",
      address: settings.school_address || "",
      phone: settings.school_phone || "",
      email: settings.school_email || "",
      website: settings.school_website || "",
      logoUrl: getSchoolLogo(settings.school_logo),
      governanceLine: settings.governance_name || "PEMERINTAH DAERAH",
      departmentLine: settings.department_name || "DINAS PENDIDIKAN DAN KEBUDAYAAN",
      principalName: settings.principal_name || "",
      principalNip: settings.principal_nip || "",
      stampUrl: settings.school_stamp || "",
    }),
    [settings]
  );

  // Memilih jenis surat → terapkan standar + dokumen default.
  const chooseType = (opt: LetterTypeOption) => {
    const standard = getLetterStandard(opt.standardCategory as LetterCategory);
    setSelectedType(opt);
    setDoc(
      createDocumentFromBlocks(standard.defaultBlocks, {
        letterTypeId: opt.id,
        jenisSurat: opt.jenisSurat,
        standardCategory: opt.standardCategory,
      })
    );
    setStep("rakit");
  };

  const standard = useMemo(
    () => (selectedType ? getLetterStandard(selectedType.standardCategory) : null),
    [selectedType]
  );

  /** Muat dokumen dari template modular tersimpan. */
  const handleLoadTemplate = (tpl: ModularTemplate) => {
    try {
      const restored = migrateContentBlocksToDocument(tpl.documentJson);
      const ltId = restored.letterTypeId ?? null;
      const opt = ltId != null ? letterTypeOptions.find((o) => o.id === ltId) : undefined;
      if (opt) setSelectedType(opt);
      updateDocWithUndo(restored);
      setStep("rakit");
      toast.success(`Template "${tpl.name}" dimuat`);
    } catch {
      toast.error("Template tidak dapat dibaca");
    }
  };

  /** Suntikkan variabel siswa/guru + perbarui penerima pada blok tujuan bila ada. */
  const applyInjectedVars = (newVars: Record<string, string>, recipientName: string) => {
    setInjectedVars((prev) => ({ ...prev, ...newVars }));
    if (!doc) return;
    const nextPages = doc.pages.map((p) => ({
      ...p,
      blocks: p.blocks.map((b) => {
        if (b.blockId === "tujuan" && recipientName && (!b.data.kepada || b.data.kepada === "Orang Tua/Wali Murid")) {
          return { ...b, data: { ...b.data, kepada: recipientName } };
        }
        if (b.blockId === "qr_verifikasi" && (!b.data.url || b.data.url === "")) {
          const qrText = effectiveNumber || recipientName || "SURAT-VERIFIED";
          return {
            ...b,
            data: {
              ...b.data,
              url: `/api/qr?text=${encodeURIComponent(qrText)}`,
              caption: "Pindai untuk verifikasi surat",
            },
          };
        }
        return b;
      }),
    }));
    updateDocWithUndo({ ...doc, pages: nextPages });
  };

  // Variabel terisi otomatis dari pengaturan + meta.
  const vars = useMemo<Record<string, string>>(() => {
    const d = meta.dateOfLetter ? new Date(meta.dateOfLetter) : new Date();
    const bulan = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];
    return {
      sekolah_nama: school.schoolName,
      sekolah_npsn: school.npsn,
      sekolah_alamat: school.address,
      sekolah_telepon: school.phone || "",
      sekolah_email: school.email || "",
      sekolah_website: school.website || "",
      kepala_sekolah_nama: school.principalName || "",
      kepala_sekolah_nip: school.principalNip || "",
      tanggal_hari_ini: `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`,
      tanggal_surat: `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`,
      nomor_surat: effectiveNumber || "",
      nomor_surat_otomatis: effectiveNumber || "",
      tahun_ajaran: settings.current_academic_year || "",
      ...injectedVars,
    };
  }, [school, meta, settings, effectiveNumber, injectedVars]);

  // Label perihal untuk subject (dari semua halaman).
  const perihal = useMemo(() => {
    const blk = findBlock(doc, "nomor_perihal_lampiran");
    return (blk?.data?.perihal as string) || "Surat";
  }, [doc]);

  const tanggalAtas = useMemo(() => {
    const blk = findBlock(doc, "tanggal");
    return (blk?.data?.tanggal as string) || meta.dateOfLetter;
  }, [doc, meta.dateOfLetter]);

  // Sinkronkan input ke ref agar generator PDF bisa mengakses nilai terbaru.
  // Dilakukan di useEffect (bukan saat render) agar tidak melanggar aturan React.
  useEffect(() => {
    pdfRef.current =
      standard && doc
        ? {
            standard,
            document: doc,
            school,
            vars,
            fileName: `Surat-${perihal}`.replace(/\s+/g, "-"),
          }
        : null;
  }, [standard, doc, school, vars, perihal]);

  const handleDownloadPdf = async () => {
    if (!pdfRef.current) return;
    setGenerating(true);
    try {
      const { generateLetterPdf } = await import("@/lib/letter-pdf");
      const blob = await generateLetterPdf(pdfRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pdfRef.current.fileName || "Surat"}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("PDF berhasil diunduh");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat PDF");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!pdfRef.current) return;
    setGeneratingDocx(true);
    try {
      const { generateLetterDocx } = await import("@/lib/letter-docx");
      const blob = await generateLetterDocx({
        standard: pdfRef.current.standard,
        document: pdfRef.current.document,
        school: pdfRef.current.school,
        vars: pdfRef.current.vars,
        fileName: pdfRef.current.fileName,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pdfRef.current.fileName || "Surat"}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Word (.docx) berhasil diunduh");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat Word");
    } finally {
      setGeneratingDocx(false);
    }
  };

  const handlePrint = async () => {
    if (!pdfRef.current) return;
    try {
      const { generateLetterHtml } = await import("@/lib/letter-html");
      const html = generateLetterHtml({
        standard: pdfRef.current.standard,
        document: pdfRef.current.document,
        school: pdfRef.current.school,
        vars: pdfRef.current.vars,
      });
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
      toast.error(e instanceof Error ? e.message : "Gagal menyiapkan cetak");
    }
  };

  const handleSubmit = async () => {
    if (!selectedType || !standard || !doc) return;
    if (!meta.dateOfLetter) {
      toast.error("Tanggal surat wajib diisi");
      return;
    }
    if (!perihal || perihal === "Surat") {
      toast.error("Perihal surat wajib diisi (blok Nomor / Perihal / Lampiran)");
      return;
    }

    // Blokir simpan bila masih ada field wajib yang kosong.
    const missing = findMissingRequiredInDocument(doc.pages);
    if (missing.length > 0) {
      const names = Array.from(new Set(missing.map((m) => m.blockLabel))).join(", ");
      toast.error(`Lengkapi dulu blok wajib: ${names}`);
      return;
    }

    setSaving(true);
    try {
      // 1. Render PDF di klien.
      const { generateLetterPdf } = await import("@/lib/letter-pdf");
      const blob = await generateLetterPdf(pdfRef.current!);

      // 2. Upload PDF ke arsip.
      const fd = new FormData();
      const file = new File([blob], `${perihal}.pdf`, { type: "application/pdf" });
      fd.append("file", file);
      fd.append("category", "surat-keluar");

      const uploadRes: any = await fetch("/api/eoffice/upload-arsip-pdf", {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: csrfHeader(),
      });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || !uploadJson?.success) {
        throw new Error(uploadJson?.error || "Gagal mengunggah PDF");
      }
      const filePath: string = uploadJson.data?.filePath || uploadJson.filePath;

      // 3. Simpan record surat keluar + susunan blok (agar bisa diedit ulang).
      const payload = {
        mailNumber: effectiveNumber || "",
        recipient: extractRecipient(doc) || "-",
        subject: perihal,
        dateOfLetter: tanggalAtas || meta.dateOfLetter,
        classificationCode: selectedType.kodeKlasifikasi,
        filePath,
        layoutType: "MODULAR",
        contentBlocks: serializeDocument({
          ...doc,
          letterTypeId: selectedType.id,
          jenisSurat: selectedType.jenisSurat,
          standardCategory: selectedType.standardCategory,
        }),
      };

      if (isEditMode && editId) {
        // Mode edit: perbarui surat yang ada (PATCH).
        const res: any = await goPatch(
          `/api/arsip/surat-keluar/detail?id=${encodeURIComponent(editId)}`,
          payload
        );
        if (res?.success) {
          toast.success("Surat modular berhasil diperbarui!");
          router.push("/arsip/surat-keluar");
        } else {
          toast.error(res?.error || "Gagal memperbarui surat");
        }
        return;
      }

      const res: any = await goPost("/api/arsip/surat-keluar", payload);
      if (res?.success) {
        // 4. Catat nomor urut ke backend agar tidak dipakai ulang (kecuali override).
        if (!useManualNumber && effectiveNumber && numbering.sequence > 0) {
          try {
            await goPost("/api/eoffice/letter-increment", {
              letterNumber: effectiveNumber,
              sequenceNumber: numbering.sequence,
              classificationCode: selectedType.kodeKlasifikasi,
              recipient: extractRecipient(doc) || "-",
            });
          } catch (incErr) {
            // Surat sudah tersimpan, tetapi pencatatan nomor gagal → beri tahu
            // agar pengguna dapat mencoba lagi / memakai nomor manual.
            toast.warning(
              `Surat tersimpan, tetapi nomor urut gagal dicatat: ${
                incErr instanceof Error ? incErr.message : "tidak diketahui"
              }. Periksa agar nomor tidak terpakai ganda.`
            );
            router.push("/arsip/surat-keluar");
            return;
          }
        }
        toast.success("Surat modular berhasil dibuat!");
        router.push("/arsip/surat-keluar");
      } else {
        toast.error(res?.error || "Gagal menyimpan surat");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan surat");
    } finally {
      setSaving(false);
    }
  };

  // Panel meta (tanggal + nomor surat) — dipakai di sidebar desktop & tab mobile.
  const metaPanel = (
    <div className="space-y-2 border-b p-3">
      <div className="space-y-1">
        <Label className="text-xs">Tanggal Surat</Label>
        <DateInput
          type="date"
          className="h-8 text-sm"
          value={meta.dateOfLetter}
          onChange={(e) => setMeta({ ...meta, dateOfLetter: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Nomor Surat</Label>
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
            <Checkbox
              checked={useManualNumber}
              onCheckedChange={(v) => setUseManualNumber(v === true)}
              className="h-3.5 w-3.5"
            />
            Isi manual
          </label>
        </div>
        {useManualNumber ? (
          <Input
            className="h-8 text-sm"
            placeholder="Nomor surat manual"
            value={manualNumber}
            onChange={(e) => setManualNumber(e.target.value)}
          />
        ) : (
          <div className="flex items-center gap-1">
            <div className="flex h-8 flex-1 items-center rounded-md border bg-muted/40 px-2 text-sm">
              {numbering.loading ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Menghitung…
                </span>
              ) : (
                <span className="truncate font-mono text-xs" title={autoNumber}>
                  {autoNumber || "— (pilih jenis surat)"}
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => numbering.refresh()}
              disabled={numbering.loading || !selectedType}
              aria-label="Hitung ulang nomor surat"
              title="Hitung ulang nomor"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${numbering.loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        )}
        {!useManualNumber && selectedType && (
          <p className="text-[10px] text-muted-foreground">
            Urut ke-{numbering.sequence} • Format:{" "}
            <span className="font-mono">
              {selectedType.formatNomor || settings.letter_number_format || "—"}
            </span>
          </p>
        )}
      </div>
    </div>
  );

  // Panel pratinjau PDF — dipakai di kolom kanan desktop & tab mobile.
  const previewPanel = standard && doc && (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-zinc-100 dark:bg-zinc-950">
      <div className="min-h-0 flex-1">
        <PDFPreview standard={standard} document={doc} school={school} vars={vars} />
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(var(--app-vh,100dvh)-2rem)] min-h-0 flex-col gap-2 pb-20 md:gap-3 md:pb-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">
              {isEditMode ? "Edit Surat Modular" : "Buat Surat Modular"}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {step === "jenis"
                ? "Pilih jenis surat, sistem menerapkan standar baku otomatis."
                : `Standar: ${standard?.categoryLabel} • ${standard?.typography.fontFamily} ${standard?.typography.fontSize}pt`}
              {isEditMode && existingStatus ? ` • Status: ${existingStatus}` : ""}
            </p>
          </div>
        </div>
      </div>

      {loadingExisting && (
        <div className="flex items-center justify-center gap-2 rounded-lg border bg-card p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat surat tersimpan…
        </div>
      )}

      {/* STEP 1: pilih jenis surat */}
      {step === "jenis" && !loadingExisting && (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {letterTypeOptions.map((opt) => (
              <Card
                key={opt.id}
                className="cursor-pointer p-4 transition-all hover:border-blue-400 hover:shadow-md"
                onClick={() => chooseType(opt)}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{opt.jenisSurat}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${CATEGORY_COLORS[opt.kategori] || ""}`}
                      >
                        {opt.kategori}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {opt.kodeKlasifikasi}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Standar tipografi & tata letak mengikuti Permendagri 83/2022 dan dapat disesuaikan.
          </p>
        </div>
      )}

      {/* STEP 2: rakit blok + preview */}
      {step === "rakit" && standard && doc && (
        <>
          {/* ───────── DESKTOP (lg+): Layout Mentok — Pratinjau Kiri & Menu Kanan ───────── */}
          <div className="hidden min-h-0 flex-1 gap-3 lg:grid lg:grid-cols-[1fr_420px]">
            {/* Kolom Kiri: Pratinjau PDF Mentok Atas - Bawah */}
            <div className="min-h-0 flex-1">{previewPanel}</div>

            {/* Kolom Kanan: Seluruh Menu & Editor (Scrollable) */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {/* Card 1: Bilah Aksi & Metadata */}
              <div className="rounded-lg border bg-card p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b pb-2">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                      aria-label="Batal perubahan"
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
                      aria-label="Ulang perubahan"
                      title="Redo (Ulang)"
                    >
                      <Redo2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDataPickerOpen(true)}
                      title="Pilih data siswa/guru"
                    >
                      <Users className="h-3.5 w-3.5 mr-1" />
                      Data
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDocSettingsOpen(true)}
                      title="Ukuran kertas & tata letak"
                    >
                      <Settings2 className="h-3.5 w-3.5 mr-1" />
                      Kertas
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTemplateOpen(true)}
                      title="Simpan/muat template"
                    >
                      <LayoutTemplate className="h-3.5 w-3.5 mr-1" />
                      Template
                    </Button>
                  </div>
                </div>

                {/* Form Metadata Tanggal & Nomor */}
                {metaPanel}

                {/* Tombol Ekspor/Cetak/Simpan Utama */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-t pt-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleExportJson}
                      aria-label="Ekspor file JSON"
                      title="Ekspor JSON"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleImportJson}
                      />
                      <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-background hover:bg-accent hover:text-accent-foreground" title="Impor JSON">
                        <Upload className="h-3.5 w-3.5" />
                      </div>
                    </label>
                    <Button variant="outline" size="sm" onClick={handlePrint} title="Cetak">
                      <Printer className="h-3.5 w-3.5 mr-1" />
                      Cetak
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={generating} title="PDF">
                      {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
                      PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadDocx} disabled={generatingDocx} title="Word">
                      {generatingDocx ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileDown className="h-3.5 w-3.5 mr-1" />}
                      Word
                    </Button>
                    <Button size="sm" onClick={handleSubmit} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white" title="Simpan">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      {isEditMode ? "Perbarui" : "Simpan"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Card 2: Ribbon Palet Tambah Blok */}
              <div className="rounded-lg border bg-card p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-blue-600" /> Tambah Blok Modular
                </p>
                <BlockPalette blocks={activeBlocks} onAdd={handlePaletteAdd} layout="grid" />
              </div>

              {/* Card 3: Form Editor Blok & Susunan Halaman */}
              <div className="flex min-h-[450px] flex-col rounded-lg border bg-card overflow-hidden">
                <LetterDocumentEditor
                  ref={docEditorRef}
                  document={doc}
                  onChange={setDoc}
                  variant="compact"
                  onActiveBlocksChange={setActiveBlocks}
                  activePageIdx={activePageIdx}
                  onActivePageIdxChange={setActivePageIdx}
                />
              </div>
            </div>
          </div>

          {/* ───────── MOBILE/TABLET (<lg): Tab penuh layar ───────── */}
          <div className="flex min-h-0 flex-1 flex-col lg:hidden">
            <Tabs value={mobileTab} onValueChange={setMobileTab} className="flex min-h-0 flex-1 flex-col">
              <TabsList className="w-full shrink-0">
                <TabsTrigger value="isi" className="flex-1 gap-1.5">
                  <LayoutList className="h-4 w-4" /> Isi
                </TabsTrigger>
                <TabsTrigger value="tambah" className="flex-1 gap-1.5">
                  <Plus className="h-4 w-4" /> Tambah
                </TabsTrigger>
                <TabsTrigger value="pratinjau" className="flex-1 gap-1.5">
                  <Eye className="h-4 w-4" /> Pratinjau
                </TabsTrigger>
              </TabsList>

              {/* Tab Isi: meta + daftar halaman + susunan + isi blok */}
              <TabsContent value="isi" className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
                  {metaPanel}
                  <div className="min-h-0 flex-1">
                    <LetterDocumentEditor
                      ref={mobileDocEditorRef}
                      document={doc}
                    onChange={updateDocWithUndo}
                      onActiveBlocksChange={setActiveBlocks}
                      activePageIdx={activePageIdx}
                      onActivePageIdxChange={setActivePageIdx}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Tab Tambah: palet blok full-width */}
              <TabsContent value="tambah" className="mt-2 min-h-0 flex-1 overflow-y-auto">
                <div className="rounded-lg border bg-card p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Tambah Blok
                  </p>
                  <BlockPalette
                    blocks={activeBlocks}
                    onAdd={(id) => mobileDocEditorRef.current?.addBlockToActivePage(id)}
                    layout="grid"
                  />
                </div>
              </TabsContent>

              {/* Tab Pratinjau: PDF full width */}
              <TabsContent value="pratinjau" className="mt-2 min-h-0 flex-1">
                {previewPanel}
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}

      {doc && (
        <>
          <TemplatePickerDialog
            open={templateOpen}
            onOpenChange={setTemplateOpen}
            currentDocumentJson={serializeDocument({
              ...doc,
              letterTypeId: selectedType?.id ?? doc.letterTypeId,
              jenisSurat: selectedType?.jenisSurat ?? doc.jenisSurat,
              standardCategory: selectedType?.standardCategory ?? doc.standardCategory,
            })}
            defaultName={selectedType ? `Standar ${selectedType.jenisSurat}` : "Template Modular"}
            category={selectedType?.kategori || "Umum"}
            onLoad={handleLoadTemplate}
          />
          <DataPickerDialog
            open={dataPickerOpen}
            onOpenChange={setDataPickerOpen}
            onSelectStudent={applyInjectedVars}
            onSelectTeacher={applyInjectedVars}
          />
          <DocumentSettingsDialog
            open={docSettingsOpen}
            onOpenChange={setDocSettingsOpen}
            document={doc}
            onChange={updateDocWithUndo}
          />
        </>
      )}
    </div>
  );
}

/** Mencari blok pertama dengan blockId tertentu di seluruh halaman. */
function findBlock(
  doc: LetterDocumentData | null,
  blockId: string
): LetterBlockInstance | undefined {
  if (!doc) return undefined;
  for (const p of doc.pages) {
    const found = p.blocks.find((b) => b.blockId === blockId);
    if (found) return found;
  }
  return undefined;
}

/** Mengambil penerima dari blok tujuan (semua halaman). */
function extractRecipient(doc: LetterDocumentData): string {
  const blk = findBlock(doc, "tujuan");
  return (blk?.data?.kepada as string) || "";
}

/** CSRF header bila tersedia (pola yang dipakai modul lain). */
function csrfHeader(): HeadersInit {
  if (typeof document === "undefined") return {};
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return m ? { "X-CSRF-Token": decodeURIComponent(m[1]) } : {};
}
