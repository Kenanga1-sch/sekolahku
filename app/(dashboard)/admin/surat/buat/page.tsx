"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  Send,
  FileCheck,
  Layers,
  FileText,
  Check,
  BookOpen,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
import { generateDocument, createDocumentBlob, mergeDocxFiles } from "@/lib/docx";
import { goGet, goPost } from "@/lib/api-client";
import { LETTER_TYPES } from "@/lib/constants/letter-types";

// Import Modular Components
import { TemplateSelector } from "@/components/letters/generator/template-selector";
import { RecipientSelector } from "@/components/letters/generator/recipient-selector";
import { VariableForm } from "@/components/letters/generator/variable-form";
import { PreviewStep } from "@/components/letters/generator/preview-step";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function formatLetterNumber(formatPattern: string | undefined, sequence: number, classificationCode: string, date = new Date()) {
  const padded3 = String(sequence).padStart(3, "0");
  const padded2 = String(sequence).padStart(2, "0");
  const padded4 = String(sequence).padStart(4, "0");
  const rawSeq = String(sequence);
  const year = String(date.getFullYear());
  const month = romanMonths[date.getMonth()];
  const monthNumeric = String(date.getMonth() + 1).padStart(2, "0");

  return (formatPattern || "{nomor}/{kode_klasifikasi}/SDN1-KNG/{bulan}/{tahun}")
    .replaceAll("{kode_klasifikasi}", classificationCode)
    .replaceAll("{nomor_urut_raw}", rawSeq)
    .replaceAll("{nomor_raw}", rawSeq)
    .replaceAll("{no_raw}", rawSeq)
    .replaceAll("{nomor_urut_2}", padded2)
    .replaceAll("{nomor_urut_3}", padded3)
    .replaceAll("{nomor_urut_4}", padded4)
    .replaceAll("{nomor_urut}", padded3)
    .replaceAll("{nomor}", padded3)
    .replaceAll("{no}", padded3)
    .replaceAll("{bulan_angka}", monthNumeric)
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
  const initialGroupId = searchParams.get("groupId");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // Data
  const [creationMode, setCreationMode] = useState<"SINGLE" | "GROUP">("SINGLE");
  const [templates, setTemplates] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [templateVars, setTemplateVars] = useState<string[]>([]);

  // Target & Recipients
  const [targetType, setTargetType] = useState<"STUDENT" | "STAFF" | "MANUAL">("STUDENT");
  const [recipientMode, setRecipientMode] = useState<"SINGLE" | "MULTIPLE" | "CLASS">("SINGLE");
  const [selectedRecipients, setSelectedRecipients] = useState<any[]>([]);

  // Inputs
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
  const [generatedPreviewData, setGeneratedPreviewData] = useState<any>(null);
  const [generatedLetterMeta, setGeneratedLetterMeta] = useState<{ letterNumber: string; nextSequence: number; classificationCode: string } | null>(null);
  const [selectedClassification, setSelectedClassification] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [classifications, setClassifications] = useState<any[]>([]);
  const [previewSequence, setPreviewSequence] = useState<number>(1);
  const [loadingSequence, setLoadingSequence] = useState(false);
  const [mergeBatch, setMergeBatch] = useState(true);

  // School Settings
  const { settings: schoolSettings, refresh: refreshSettings } = useSchoolSettings();

  useEffect(() => {
    if (step === 2) {
      const clsCode = selectedClassification || selectedTemplate?.classificationCode || "";
      setLoadingSequence(true);
      goPost("/api/eoffice/letter-numbering", {
        classificationCode: clsCode,
        date: new Date().toISOString()
      })
      .then((numbering: any) => {
        const nextSequence = Number(numbering?.data || numbering?.nextSequence || 1);
        setPreviewSequence(nextSequence);
      })
      .catch(() => {
        setPreviewSequence(1);
      })
      .finally(() => {
        setLoadingSequence(false);
      });
    }
  }, [step, selectedClassification, selectedTemplate]);

  useEffect(() => {
    goGet("/api/eoffice/letter-templates?limit=100")
      .then((data: any) => {
        setTemplates(data.data);
        if (initialTemplateId) {
          const tpl = data.data.find((t: any) => t.id === initialTemplateId);
          if (tpl) handleSelectTemplate(tpl);
        }
      });
      
    goGet("/api/eoffice/template-groups")
      .then((data: any) => {
        setGroups(data.data || []);
        if (initialGroupId) {
          const grp = (data.data || []).find((g: any) => g.id === initialGroupId);
          if (grp) handleSelectGroup(grp);
        }
      })
      .finally(() => setLoading(false));

    goGet("/api/eoffice/klasifikasi")
      .then((data: any) => {
        if (data && Array.isArray(data.data)) {
          setClassifications(data.data);
        } else {
          // Fallback to constants
          setClassifications(LETTER_TYPES.map(lt => ({
            code: lt.kode_klasifikasi,
            name: lt.jenis_surat
          })));
        }
      })
      .catch(() => {
        // Fallback to constants
        setClassifications(LETTER_TYPES.map(lt => ({
          code: lt.kode_klasifikasi,
          name: lt.jenis_surat
        })));
      });
  }, [initialTemplateId, initialGroupId]);

  const handleSelectTemplate = async (tpl: any) => {
    setLoading(true);
    try {
      const fullTpl: any = await goGet(`/api/eoffice/letter-templates/${tpl.id}`);
      const varRes: any = await goGet(`/api/eoffice/letter-templates/${tpl.id}/variables`);
      
      setSelectedTemplate(fullTpl);
      setTemplateVars(varRes.variables || []);
      setSelectedClassification(fullTpl.classificationCode || "");
      
      setTargetType("STUDENT");
      setCreationMode("SINGLE");
      setStep(2);
    } catch (error) {
      toast.error("Gagal memuat detail template");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGroup = async (group: any) => {
    setLoading(true);
    try {
      const fullGroup: any = await goGet(`/api/eoffice/template-groups/${group.id}`);
      setSelectedGroup(fullGroup.data);
      setTargetType("STUDENT");
      setCreationMode("GROUP");
      
      const allVars = new Set<string>();
      for (const item of fullGroup.data.items) {
          const varRes: any = await goGet(`/api/eoffice/letter-templates/${item.templateId}/variables`);
          varRes.variables?.forEach((v: string) => allVars.add(v));
      }
      setTemplateVars(Array.from(allVars));
      setSelectedClassification(""); 
      setStep(2);
    } catch (error) {
      toast.error("Gagal memuat detail grup template");
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
      sekolah_nama: schoolSettings?.school_name || "SD NEGERI 1 KUNINGAN",
      sekolah_npsn: schoolSettings?.school_npsn || "",
      sekolah_alamat: schoolSettings?.school_address || "Jl. Siliwangi No. 12, Kabupaten Kuningan, Jawa Barat",
      sekolah_telepon: schoolSettings?.school_phone || "(0232) 871112",
      sekolah_email: schoolSettings?.school_email || "sdn1kuningan@gmail.com",
      sekolah_website: schoolSettings?.school_website || "www.sdn1kuningan.sch.id",
      kepala_sekolah_nama: schoolSettings?.principal_name || "H. Mamat Slamet, S.Pd., M.Si.",
      kepala_sekolah_nip: schoolSettings?.principal_nip || "19680324 199203 1 005",
      tanggal_hari_ini: format(new Date(), "d MMMM yyyy", { locale: id }),
      tanggal_surat: format(new Date(), "d MMMM yyyy", { locale: id }),
      tahun_ajaran: schoolSettings?.current_academic_year || "2025/2026",
      ...manualInputs,
    };

    try {
      if (shouldUseAutoNumber()) {
        const clsCode = selectedClassification || selectedTemplate?.classificationCode || "";
        const clsPayload: any = clsCode ? { classificationCode: clsCode, date: new Date().toISOString() } : { date: new Date().toISOString() };
        const numbering: any = await goPost("/api/eoffice/letter-numbering", clsPayload);
        const nextSequence = Number(numbering?.data || numbering?.nextSequence || 1);
        const formatPattern = selectedTemplate?.letterNumberFormat || schoolSettings?.letter_number_format;
        const letterNumber = formatLetterNumber(formatPattern, nextSequence, clsCode);
        baseData.nomor_surat_otomatis = letterNumber;
        baseData.nomor_surat = manualInputs.nomor_surat || letterNumber;
        setGeneratedLetterMeta({ letterNumber, nextSequence, classificationCode: clsCode });
      } else {
        setGeneratedLetterMeta(null);
        baseData.nomor_surat = manualInputs.nomor_surat || "024/400.3.5/SDN1-KNG/VI/2026";
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
    const clsCode = generatedLetterMeta.classificationCode;
    const formatPattern = selectedTemplate?.letterNumberFormat || schoolSettings?.letter_number_format;
    const letterNumber = formatLetterNumber(formatPattern, sequenceNumber, clsCode);
    await goPost("/api/eoffice/letter-increment", {
      letterNumber,
      sequenceNumber,
      templateId: selectedTemplate?.id,
      recipient: recipientLabel(recipient),
      classificationCode: clsCode || undefined,
    });
  };

  const handleDownload = async () => {
    if (!generatedPreviewData) return;

    setLoading(true);
    try {
      const zip = new JSZip();
      const buffers: ArrayBuffer[] = [];
      let fileCount = 0;

      const processTemplate = async (tpl: any, baseData: any, idxOffset: number, buffersList?: ArrayBuffer[]) => {
        if (!tpl.filePath) return;
        for (const [recIdx, rec] of selectedRecipients.entries()) {
          const recData = { ...baseData };
          if (generatedLetterMeta) {
            const sequenceNumber = generatedLetterMeta.nextSequence + recIdx + idxOffset;
            const clsCode = generatedLetterMeta.classificationCode || tpl.classificationCode || "";
            const formatPattern = tpl.letterNumberFormat || schoolSettings?.letter_number_format;
            const letterNumber = formatLetterNumber(formatPattern, sequenceNumber, clsCode);
            recData.nomor_surat_otomatis = letterNumber;
            recData.nomor_surat = manualInputs.nomor_surat || letterNumber;
          } else {
            recData.nomor_surat = manualInputs.nomor_surat || baseData.nomor_surat || "024/400.3.5/SDN1-KNG/VI/2026";
          }
          mergeRecipientData(recData, rec);
          const blob = await createDocumentBlob(tpl.filePath, recData);
          if (buffersList) {
            const buf = await blob.arrayBuffer();
            buffersList.push(buf);
          } else {
            zip.file(`${tpl.name}_${recipientLabel(rec).replace(/\s+/g, "_")}.docx`, blob);
          }
          fileCount++;
          await logGeneratedLetter(rec, recIdx + idxOffset);
        }
      };

      const isMerging = mergeBatch && selectedRecipients.length > 1;

      if (creationMode === "GROUP" && selectedGroup) {
        for (let i = 0; i < selectedGroup.items.length; i++) {
          await processTemplate(selectedGroup.items[i].template, generatedPreviewData, i * selectedRecipients.length, isMerging ? buffers : undefined);
        }
      } else if (selectedTemplate) {
        if (!selectedTemplate.filePath) {
          toast.error("Template ini belum memiliki file DOCX.");
          setLoading(false);
          return;
        }
        if (selectedRecipients.length > 1) {
          await processTemplate(selectedTemplate, generatedPreviewData, 0, isMerging ? buffers : undefined);
        } else {
          // Single Download
          const recData = { ...generatedPreviewData };
          mergeRecipientData(recData, selectedRecipients[0]);
          const fileName = `${selectedTemplate.name}_${recData.siswa_nama || recData.penerima_nama || "Output"}.docx`;
          await generateDocument(selectedTemplate.filePath, recData, fileName);
          await logGeneratedLetter(selectedRecipients[0], 0);
          toast.success("Dokumen berhasil diunduh.");
          refreshSettings();
          setLoading(false);
          return;
        }
      }

      if (isMerging && buffers.length > 0) {
        const mergedBlob = mergeDocxFiles(buffers);
        const fileName = `Batch_${creationMode === "GROUP" ? selectedGroup.name : selectedTemplate.name}_${format(new Date(), "yyyyMMdd")}.docx`;
        saveAs(mergedBlob, fileName);
        toast.success(`Berhasil mengunduh berkas gabungan (${fileCount} dokumen).`);
      } else if (fileCount > 0) {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `Batch_${creationMode === "GROUP" ? selectedGroup.name : selectedTemplate.name}_${format(new Date(), "yyyyMMdd")}.zip`);
        toast.success(`Berhasil mengunduh ${fileCount} dokumen.`);
      }

      refreshSettings();
    } catch (error) {
      toast.error("Gagal membuat dokumen.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitToVerification = async () => {
    if (!generatedPreviewData) return;
    if (creationMode === "SINGLE" && !selectedTemplate?.filePath) {
      toast.error("Template ini belum memiliki file DOCX.");
      return;
    }
    if (selectedRecipients.length === 0) {
      toast.error("Silakan pilih penerima terlebih dahulu.");
      return;
    }
    
    setSubmitting(true);
    try {
      if (creationMode === "GROUP") {
        for (const [recIdx, rec] of selectedRecipients.entries()) {
          const recName = recipientLabel(rec);
          let mailNumber = "";
          
          if (generatedLetterMeta) {
            const clsCode = selectedClassification || "";
            const formatPattern = schoolSettings?.letter_number_format;
            const sequenceNumber = generatedLetterMeta.nextSequence + recIdx * selectedGroup.items.length;
            mailNumber = formatLetterNumber(formatPattern, sequenceNumber, clsCode);
          }

          await goPost("/api/eoffice/template-groups/generate", {
            groupId: selectedGroup.id,
            classificationCode: selectedClassification,
            recipient: recName,
            subjectPrefix: manualInputs.perihal_surat || "",
            mailNumber: mailNumber || "",
            dateOfLetter: format(new Date(), "yyyy-MM-dd"),
          });
        }
        toast.success("Grup surat berhasil dikirim ke verifikasi!");
      } else {
        const clsCode = selectedClassification || selectedTemplate?.classificationCode || "";
        
        for (const [recIdx, rec] of selectedRecipients.entries()) {
          const recName = recipientLabel(rec);
          
          // Re-generate preview data for this recipient
          const recData = { ...generatedPreviewData };
          
          let mailNumber = "";
          if (generatedLetterMeta) {
            const sequenceNumber = generatedLetterMeta.nextSequence + recIdx;
            const formatPattern = selectedTemplate?.letterNumberFormat || schoolSettings?.letter_number_format;
            mailNumber = formatLetterNumber(formatPattern, sequenceNumber, clsCode);
            recData.nomor_surat_otomatis = mailNumber;
            recData.nomor_surat = manualInputs.nomor_surat || mailNumber;
          } else {
            recData.nomor_surat = manualInputs.nomor_surat || generatedPreviewData.nomor_surat || "";
          }
          
          mergeRecipientData(recData, rec);
          
          // Generate DOCX blob
          const blob = await createDocumentBlob(selectedTemplate.filePath, recData);
          // Upload the blob as a file
          const docxFile = new File([blob], `${selectedTemplate.name}_${recName}.docx`, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
          const uploadForm = new FormData();
          uploadForm.append("file", docxFile);
          
          const uploadResult: any = await goPost("/api/eoffice/upload-docx", uploadForm);
          const filePath = uploadResult?.filePath || uploadResult?.path || "";
          if (!filePath) throw new Error("Gagal mengupload file");

          await goPost("/api/eoffice/letter-generate-submit", {
            templateId: selectedTemplate.id,
            classificationCode: clsCode,
            recipient: recName,
            subject: recData.perihal_surat || `Surat ${selectedTemplate.name}`,
            mailNumber: mailNumber,
            dateOfLetter: format(new Date(), "yyyy-MM-dd"),
            filePath,
          });

          // Log increment
          if (generatedLetterMeta) {
            await logGeneratedLetter(rec, recIdx);
          }
        }

        toast.success("Surat berhasil dikirim ke verifikasi!");
      }
      
      router.push("/arsip/surat-keluar");
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengirim surat ke verifikasi.");
    } finally {
      setSubmitting(false);
    }
  };

  const manualVars = templateVars.filter((v) => {
    // Exclude student and recipient variables (always auto-filled)
    if (v.startsWith("siswa_") || v.startsWith("penerima_") || v.startsWith("guru_")) return false;

    // List of system variables that we always resolve
    const systemVars = [
      "tanggal_hari_ini",
      "tanggal_surat",
      "tahun_ajaran",
      "sekolah_nama",
      "sekolah_npsn",
      "sekolah_alamat",
      "sekolah_telepon",
      "sekolah_email",
      "sekolah_website",
      "nomor_surat_otomatis"
    ];
    if (systemVars.includes(v)) return false;

    // For principal settings: only hide if they are already configured in settings.
    // If not configured, show them in the manual inputs form so the user can enter them.
    if (v === "kepala_sekolah_nama" && schoolSettings?.principal_name) return false;
    if (v === "kepala_sekolah_nip" && schoolSettings?.principal_nip) return false;

    // For letter number: only hide if auto-numbering is enabled.
    // If auto-numbering is disabled, let the user input it manually.
    if (v === "nomor_surat" && shouldUseAutoNumber()) return false;

    // Show kepala_sekolah_nama, kepala_sekolah_nip, or nomor_surat if they failed the above checks
    if (["kepala_sekolah_nama", "kepala_sekolah_nip", "nomor_surat"].includes(v)) return true;

    // Keep all other custom variables as manual inputs
    return true;
  });

  return (
    <div className={cn("mx-auto space-y-6 pb-20 transition-all duration-300", step === 3 ? "max-w-5xl" : "max-w-4xl")}>
      <div>
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="p-0 text-muted-foreground hover:text-foreground h-auto font-normal mb-2 flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Buat Surat Baru</h1>
            <p className="text-sm text-muted-foreground">Generator surat otomatis dari template dokumen.</p>
          </div>
        </div>
      </div>

      {/* Stepper Card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {/* Step 1 */}
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
              step > 1
                ? "bg-emerald-500 text-white"
                : step === 1
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none"
                  : "bg-slate-100 text-slate-500 dark:bg-zinc-800"
            )}>
              {step > 1 ? <Check className="h-4 w-4" /> : "1"}
            </div>
            <div className="flex flex-col">
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider", step >= 1 ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground")}>Langkah 1</span>
              <span className={cn("text-xs font-semibold", step === 1 ? "text-foreground" : "text-muted-foreground")}>Pilih Template</span>
            </div>
          </div>

          <div className={cn("flex-1 h-0.5 mx-4 border-t-2 border-dashed transition-all duration-300", step > 1 ? "border-emerald-500" : "border-slate-200 dark:border-zinc-800")} />

          {/* Step 2 */}
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
              step > 2
                ? "bg-emerald-500 text-white"
                : step === 2
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none"
                  : "bg-slate-100 text-slate-500 dark:bg-zinc-800"
            )}>
              {step > 2 ? <Check className="h-4 w-4" /> : "2"}
            </div>
            <div className="flex flex-col">
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider", step >= 2 ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground")}>Langkah 2</span>
              <span className={cn("text-xs font-semibold", step === 2 ? "text-foreground" : "text-muted-foreground")}>Isi Data & Variabel</span>
            </div>
          </div>

          <div className={cn("flex-1 h-0.5 mx-4 border-t-2 border-dashed transition-all duration-300", step > 2 ? "border-emerald-500" : "border-slate-200 dark:border-zinc-800")} />

          {/* Step 3 */}
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
              step === 3
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none"
                : "bg-slate-100 text-slate-500 dark:bg-zinc-800"
            )}>
              3
            </div>
            <div className="flex flex-col">
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider", step === 3 ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground")}>Langkah 3</span>
              <span className={cn("text-xs font-semibold", step === 3 ? "text-foreground" : "text-muted-foreground")}>Pratinjau & Cetak</span>
            </div>
          </div>
        </div>
      </div>

      {step === 1 && (
        <Tabs defaultValue="tunggal" className="space-y-6">
          <TabsList className="bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
            <TabsTrigger value="tunggal" className="rounded-lg">Template Tunggal</TabsTrigger>
            <TabsTrigger value="grup" className="rounded-lg">Paket Surat (Grup)</TabsTrigger>
          </TabsList>

          <TabsContent value="tunggal">
            <TemplateSelector templates={templates} loading={loading} onSelect={handleSelectTemplate} />
          </TabsContent>

          <TabsContent value="grup">
            {loading ? (
              <div className="text-center py-12 flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                <span className="text-sm text-muted-foreground">Memuat paket surat...</span>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-2xl bg-zinc-50 dark:bg-zinc-900">
                <span className="block text-sm text-muted-foreground">Belum ada grup template.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map((grp) => (
                  <Card
                    key={grp.id}
                    className="cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-md transition-all duration-200"
                    onClick={() => handleSelectGroup(grp)}
                  >
                    <CardHeader className="p-5">
                      <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center mb-3 text-indigo-600 dark:text-indigo-400">
                        <Layers className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-base text-slate-800 dark:text-slate-100">{grp.name}</CardTitle>
                      <CardDescription className="text-xs">{grp.items?.length || 0} Dokumen Template</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">
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
          <div className="space-y-6 lg:sticky lg:top-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-slate-50 dark:bg-zinc-800/40 p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Detail Metadata Dokumen</h4>
              </div>
              <div className="p-5 space-y-5 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">
                    {creationMode === "GROUP" ? "Nama Grup Paket" : "Nama Template"}
                  </p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    {creationMode === "GROUP" ? selectedGroup?.name : selectedTemplate?.name}
                  </p>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                  <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-2">Klasifikasi Kode Kearsipan</p>
                  <Select value={selectedClassification || selectedTemplate?.classificationCode || ""} onValueChange={setSelectedClassification}>
                    <SelectTrigger className="w-full mt-1 bg-white dark:bg-zinc-950 border-slate-200 dark:border-slate-800 rounded-xl">
                      <SelectValue placeholder="Pilih klasifikasi" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {classifications.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} - {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Format Penomoran Surat</p>
                    <div className="font-mono text-xs bg-slate-50 dark:bg-zinc-950 px-3 py-2 border rounded-xl overflow-x-auto text-slate-600 dark:text-slate-400 mt-1.5">
                      {selectedTemplate?.letterNumberFormat || schoolSettings?.letter_number_format || "{nomor}/{kode_klasifikasi}/SDN1-KNG/{bulan}/{tahun}"}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Draf Nomor Surat (Live Preview)</p>
                    <div className="font-mono text-sm font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 p-3 border border-emerald-200/60 dark:border-emerald-900/50 rounded-xl flex items-center justify-between mt-1.5 transition-all duration-300">
                      {loadingSequence ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                          <span className="text-xs text-emerald-600/70 font-normal">Menghitung...</span>
                        </div>
                      ) : (
                        <span>
                          {formatLetterNumber(
                            selectedTemplate?.letterNumberFormat || schoolSettings?.letter_number_format,
                            previewSequence,
                            selectedClassification || selectedTemplate?.classificationCode || ""
                          )}
                        </span>
                      )}
                      <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-sans uppercase font-bold tracking-wider">Otomatis</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Jumlah Penerima</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedRecipients.length} Orang</p>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {targetType === "STUDENT" ? "Siswa" : targetType === "STAFF" ? "Guru/Staf" : "Manual"}
                  </div>
                </div>
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
          onSubmitToVerification={handleSubmitToVerification}
          loading={loading}
          submitting={submitting}
          mergeBatch={mergeBatch}
          setMergeBatch={setMergeBatch}
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
