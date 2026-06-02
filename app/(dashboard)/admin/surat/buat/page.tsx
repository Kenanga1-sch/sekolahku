"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
import { generateDocument, createDocumentBlob } from "@/lib/docx";
import { goGet, goPost } from "@/lib/api-client";

// Import Modular Components
import { TemplateSelector } from "@/components/letters/generator/template-selector";
import { RecipientSelector } from "@/components/letters/generator/recipient-selector";
import { VariableForm } from "@/components/letters/generator/variable-form";
import { PreviewStep } from "@/components/letters/generator/preview-step";

const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function formatLetterNumber(formatPattern: string | undefined, sequence: number, date = new Date()) {
  const padded = String(sequence).padStart(3, "0");
  const year = String(date.getFullYear());
  const month = romanMonths[date.getMonth()];

  return (formatPattern || "421/{nomor}/SDN1-KNG/{bulan}/{tahun}")
    .replaceAll("{nomor}", padded)
    .replaceAll("{no}", padded)
    .replaceAll("{bulan}", month)
    .replaceAll("{bulan_romawi}", month)
    .replaceAll("{tahun}", year);
}

function recipientLabel(recipient: any) {
  return recipient?.name || recipient?.fullName || recipient?.email || "Manual";
}

function LetterGeneratorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTemplateId = searchParams.get("templateId");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // Data
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateVars, setTemplateVars] = useState<string[]>([]);

  // Target & Recipients
  const [targetType, setTargetType] = useState<"STUDENT" | "STAFF" | "MANUAL">("STUDENT");
  const [recipientMode, setRecipientMode] = useState<"SINGLE" | "MULTIPLE" | "CLASS">("SINGLE");
  const [selectedRecipients, setSelectedRecipients] = useState<any[]>([]);

  // Inputs
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
  const [generatedPreviewData, setGeneratedPreviewData] = useState<any>(null);
  const [generatedLetterMeta, setGeneratedLetterMeta] = useState<{ letterNumber: string; nextSequence: number } | null>(null);

  // School Settings
  const { settings: schoolSettings, refresh: refreshSettings } = useSchoolSettings();

  // Load Templates
  useEffect(() => {
    goGet("/api/eoffice/letter-templates?limit=100")
      .then((data: any) => {
        setTemplates(data.data);
        if (initialTemplateId) {
          const tpl = data.data.find((t: any) => t.id === initialTemplateId);
          if (tpl) handleSelectTemplate(tpl);
        }
      })
      .finally(() => setLoading(false));
  }, [initialTemplateId]);

  const handleSelectTemplate = async (tpl: any) => {
    setLoading(true);
    try {
      const fullTpl: any = await goGet(`/api/eoffice/letter-templates/${tpl.id}`);
      const varRes: any = await goGet(`/api/eoffice/letter-templates/${tpl.id}/variables`);
      
      setSelectedTemplate(fullTpl);
      setTemplateVars(varRes.variables || []);
      
      if (fullTpl.category === "STAFF") setTargetType("STAFF");
      else if (fullTpl.category === "STUDENT") setTargetType("STUDENT");
      
      setStep(2);
    } catch (error) {
      toast.error("Gagal memuat detail template");
    } finally {
      setLoading(false);
    }
  };

  const mergeRecipientData = (data: any, recipient: any) => {
    if (targetType === "STUDENT") {
      data.siswa_nama = recipient.name || recipient.fullName || "";
      data.siswa_nis = recipient.nis || "-";
      data.siswa_nisn = recipient.nisn || "-";
      data.siswa_kelas = recipient.className || "";
      data.siswa_jenis_kelamin = recipient.gender === "L" ? "Laki-laki" : "Perempuan";
      data.siswa_tempat_lahir = recipient.birthPlace || "";
      
      if (recipient.birthDate) {
        const bDate = new Date(recipient.birthDate);
        data.siswa_tanggal_lahir = format(bDate, "d MMMM yyyy", { locale: id });
        data.siswa_tanggal_lahir_indo = data.siswa_tanggal_lahir;
      }
      data.siswa_alamat = recipient.address || "";
      data.siswa_nama_wali = recipient.parentName || recipient.guardianName || "";
      data.siswa_no_hp_wali = recipient.parentPhone || "";
    } else {
      data.penerima_nama = recipient.name || recipient.fullName || "";
      data.penerima_nip = recipient.nip || "-";
      data.penerima_jabatan = recipient.position || recipient.jobType || recipient.role || "";
      data.guru_nama = data.penerima_nama;
      data.guru_nip = data.penerima_nip;
      data.guru_jabatan = data.penerima_jabatan;
    }
  };

  const shouldUseAutoNumber = () =>
    templateVars.includes("nomor_surat_otomatis") ||
    templateVars.includes("nomor_surat") ||
    Boolean(manualInputs.nomor_surat_otomatis || manualInputs.nomor_surat);

  const handlePreparePreview = async () => {
    if (targetType !== "MANUAL" && selectedRecipients.length === 0) {
      toast.error("Mohon pilih minimal satu penerima.");
      return;
    }

    setLoading(true);
    const baseData: any = {
      sekolah_nama: schoolSettings?.school_name || "",
      sekolah_npsn: schoolSettings?.school_npsn || "",
      sekolah_alamat: schoolSettings?.school_address || "",
      sekolah_telepon: schoolSettings?.school_phone || "",
      sekolah_email: schoolSettings?.school_email || "",
      sekolah_website: schoolSettings?.school_website || "",
      kepala_sekolah_nama: schoolSettings?.principal_name || "",
      kepala_sekolah_nip: schoolSettings?.principal_nip || "",
      tanggal_hari_ini: format(new Date(), "d MMMM yyyy", { locale: id }),
      tanggal_surat: format(new Date(), "d MMMM yyyy", { locale: id }),
      tahun_ajaran: schoolSettings?.current_academic_year || "",
      ...manualInputs,
    };

    try {
      if (shouldUseAutoNumber()) {
        const numbering: any = await goPost("/api/eoffice/letter-numbering", {
          date: new Date().toISOString(),
        });
        const nextSequence = Number(numbering?.data || numbering?.nextSequence || 1);
        const letterNumber = formatLetterNumber(schoolSettings?.letter_number_format, nextSequence);
        baseData.nomor_surat_otomatis = letterNumber;
        baseData.nomor_surat = manualInputs.nomor_surat || letterNumber;
        setGeneratedLetterMeta({ letterNumber, nextSequence });
      } else {
        setGeneratedLetterMeta(null);
      }

      if (selectedRecipients.length > 0) {
        mergeRecipientData(baseData, selectedRecipients[0]);
      }

      setGeneratedPreviewData(baseData);
      setStep(3);
    } catch (error) {
      toast.error("Gagal menyiapkan nomor surat otomatis.");
    } finally {
      setLoading(false);
    }
  };

  const logGeneratedLetter = async (recipient: any, index: number) => {
    if (!generatedLetterMeta) return;
    const sequenceNumber = generatedLetterMeta.nextSequence + index;
    await goPost("/api/eoffice/letter-increment", {
      letterNumber: formatLetterNumber(schoolSettings?.letter_number_format, sequenceNumber),
      sequenceNumber,
      templateId: selectedTemplate?.id,
      recipient: recipientLabel(recipient),
    });
  };

  const handleDownload = async () => {
    if (!generatedPreviewData) return;
    if (!selectedTemplate?.filePath) {
      toast.error("Template ini belum memiliki file DOCX. Gunakan fitur import template Word terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      if (selectedRecipients.length > 1) {
        // ZIP Generation
        const zip = new JSZip();
        for (const [index, rec] of selectedRecipients.entries()) {
          const recData = { ...generatedPreviewData };
          if (generatedLetterMeta) {
            const sequenceNumber = generatedLetterMeta.nextSequence + index;
            const letterNumber = formatLetterNumber(schoolSettings?.letter_number_format, sequenceNumber);
            recData.nomor_surat_otomatis = letterNumber;
            recData.nomor_surat = manualInputs.nomor_surat || letterNumber;
          }
          mergeRecipientData(recData, rec);
          const blob = await createDocumentBlob(selectedTemplate.filePath, recData);
          zip.file(`${recipientLabel(rec).replace(/\s+/g, "_")}.docx`, blob);
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `Batch_${selectedTemplate.name}_${format(new Date(), "yyyyMMdd")}.zip`);
        await Promise.all(selectedRecipients.map((rec, index) => logGeneratedLetter(rec, index)));
        toast.success(`Berhasil mengunduh ${selectedRecipients.length} dokumen.`);
      } else {
        // Single Download
        const fileName = `${selectedTemplate.name}_${generatedPreviewData.siswa_nama || "Output"}.docx`;
        await generateDocument(selectedTemplate.filePath, generatedPreviewData, fileName);
        await logGeneratedLetter(selectedRecipients[0], 0);
        toast.success("Dokumen berhasil diunduh.");
      }

      refreshSettings();

    } catch (error) {
      toast.error("Gagal membuat dokumen.");
    } finally {
      setLoading(false);
    }
  };

  const manualVars = templateVars.filter(
    (v) =>
      !v.startsWith("siswa_") &&
      !v.startsWith("penerima_") &&
      !["tanggal_hari_ini", "tanggal_surat", "tahun_ajaran", "kepala_sekolah_nama", "kepala_sekolah_nip", "sekolah_nama", "sekolah_npsn", "sekolah_alamat", "sekolah_telepon", "sekolah_email", "sekolah_website", "nomor_surat_otomatis", "nomor_surat"].includes(v)
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Buat Surat Baru</h1>
          <p className="text-muted-foreground">Generator surat otomatis dari template.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground border-b pb-4 overflow-x-auto whitespace-nowrap">
        <div className={cn("flex items-center gap-2", step >= 1 && "text-blue-600")}>
          <div className="w-6 h-6 rounded-full border flex items-center justify-center text-xs">1</div>
          Pilih Template
        </div>
        <ChevronRight className="h-4 w-4 shrink-0" />
        <div className={cn("flex items-center gap-2", step >= 2 && "text-blue-600")}>
          <div className="w-6 h-6 rounded-full border flex items-center justify-center text-xs">2</div>
          Isi Data
        </div>
        <ChevronRight className="h-4 w-4 shrink-0" />
        <div className={cn("flex items-center gap-2", step >= 3 && "text-blue-600")}>
          <div className="w-6 h-6 rounded-full border flex items-center justify-center text-xs">3</div>
          Preview & Cetak
        </div>
      </div>

      {step === 1 && (
        <TemplateSelector templates={templates} loading={loading} onSelect={handleSelectTemplate} />
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <RecipientSelector
              targetType={targetType}
              setTargetType={setTargetType}
              recipientMode={recipientMode}
              setRecipientMode={setRecipientMode}
              selectedRecipients={selectedRecipients}
              setSelectedRecipients={setSelectedRecipients}
            />
            <VariableForm
              manualVars={manualVars}
              manualInputs={manualInputs}
              setManualInputs={setManualInputs}
              onBack={() => setStep(1)}
              onNext={handlePreparePreview}
            />
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-lg border bg-zinc-50 dark:bg-zinc-900 space-y-2 text-sm">
              <h4 className="font-semibold">Info Template</h4>
              <p className="text-muted-foreground">{selectedTemplate?.name}</p>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">Penerima terpilih:</p>
                <p className="font-medium">{selectedRecipients.length} Orang</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <PreviewStep
          selectedRecipients={selectedRecipients}
          generatedData={generatedPreviewData}
          onBack={() => setStep(2)}
          onDownload={handleDownload}
          loading={loading}
        />
      )}
    </div>
  );
}

export default function LetterGeneratorPage() {
  return (
    <Suspense fallback={<div>Memuat...</div>}>
      <LetterGeneratorContent />
    </Suspense>
  );
}
