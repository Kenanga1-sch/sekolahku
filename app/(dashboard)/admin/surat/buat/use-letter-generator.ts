"use client";

// Sub-hook generator surat (diekstrak dari surat/buat/page.tsx).
// Mengelola state wizard, load template/grup/klasifikasi, penomoran, unduh,
// dan kirim ke verifikasi. Refactor — zero behavior change.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
import { generateDocument, createDocumentBlob, mergeDocxFiles } from "@/lib/docx";
import { getCurrentAcademicYear } from "@/lib/config";
import { goGet, goPost } from "@/lib/api-client";
import { LETTER_TYPES } from "@/lib/constants/letter-types";
import {
  formatLetterNumber,
  recipientLabel,
  mergeRecipientData,
} from "./letter-generator-helpers";

export function useLetterGenerator() {
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
      tahun_ajaran: schoolSettings?.current_academic_year || getCurrentAcademicYear(),
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
        mergeRecipientData(baseData, selectedRecipients[0], targetType);
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
          mergeRecipientData(recData, rec, targetType);
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
          mergeRecipientData(recData, selectedRecipients[0], targetType);
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
        const mergedBlob = await mergeDocxFiles(buffers);
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
          
          mergeRecipientData(recData, rec, targetType);
          
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
  return {
    // navigation
    router,
    // step & data
    step,
    setStep,
    loading,
    creationMode,
    templates,
    groups,
    selectedTemplate,
    selectedGroup,
    templateVars,
    targetType,
    setTargetType,
    recipientMode,
    setRecipientMode,
    selectedRecipients,
    setSelectedRecipients,
    manualInputs,
    setManualInputs,
    generatedPreviewData,
    // metadata panel
    schoolSettings,
    selectedClassification,
    setSelectedClassification,
    classifications,
    previewSequence,
    loadingSequence,
    mergeBatch,
    setMergeBatch,
    // handlers
    handleSelectTemplate,
    handleSelectGroup,
    manualVars,
    handlePreparePreview,
    handleDownload,
    handleSubmitToVerification,
    submitting,
  };
}
