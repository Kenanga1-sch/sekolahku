"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      const migrated = migrateContentBlocksToDocument(tpl.documentJson);
      const ltId = migrated.letterTypeId ?? null;
      const opt = ltId != null ? letterTypeOptions.find((o) => o.id === ltId) : undefined;
      if (opt) setSelectedType(opt);
      setDoc(migrated);
      setStep("rakit");
      toast.success(`Template "${tpl.name}" dimuat`);
    } catch {
      toast.error("Template tidak dapat dibaca");
    }
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
    };
  }, [school, meta, settings, effectiveNumber]);

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
        <Input
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
        {step === "rakit" && (
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTemplateOpen(true)}
              title="Simpan/muat template modular"
            >
              <LayoutTemplate className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Template</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} title="Cetak">
              <Printer className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Cetak</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={generating} title="Unduh PDF">
              {generating ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <FileText className="h-4 w-4 sm:mr-2" />}
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadDocx} disabled={generatingDocx} title="Unduh Word">
              {generatingDocx ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <FileDown className="h-4 w-4 sm:mr-2" />}
              <span className="hidden sm:inline">Word</span>
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving} title="Simpan">
              {saving ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <Save className="h-4 w-4 sm:mr-2" />}
              <span className="hidden sm:inline">{isEditMode ? "Perbarui Surat" : "Simpan ke Arsip"}</span>
            </Button>
          </div>
        )}
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
          {/* ───────── DESKTOP (lg+): Ribbon atas + Sidebar kolom + Pratinjau ───────── */}
          <div className="hidden min-h-0 flex-1 flex-col gap-3 lg:flex">
            {/* Ribbon: palet blok di atas (layaknya ribbon Word) */}
            <div className="flex min-h-0 shrink-0 items-start gap-3 rounded-lg border bg-card p-2">
              <div className="flex shrink-0 flex-col items-center justify-center gap-1 self-stretch border-r pr-3">
                <Plus className="h-4 w-4 text-blue-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tambah Blok
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <BlockPalette blocks={activeBlocks} onAdd={handlePaletteAdd} layout="ribbon" />
              </div>
            </div>

            {/* Bodi: sidebar kiri + pratinjau kanan */}
            <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr] gap-3 overflow-hidden">
              <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
                {metaPanel}
                <div className="min-h-0 flex-1">
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
              <div className="min-h-0">{previewPanel}</div>
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
                      onChange={setDoc}
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
