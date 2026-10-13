"use client";

import { Suspense } from "react";
import {
  ArrowLeft,
  Loader2,
  FileCheck,
  Layers,
  Check,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Import Modular Components
import { TemplateSelector } from "@/components/letters/generator/template-selector";
import { RecipientSelector } from "@/components/letters/generator/recipient-selector";
import { VariableForm } from "@/components/letters/generator/variable-form";
import { PreviewStep } from "@/components/letters/generator/preview-step";
import { DeprecationBanner } from "@/components/letters/deprecation-banner";
import { formatLetterNumber } from "./letter-generator-helpers";
import { useLetterGenerator } from "./use-letter-generator";

function LetterGeneratorContent() {
  const {
    step,
    setStep,
    loading,
    creationMode,
    templates,
    groups,
    selectedTemplate,
    selectedGroup,
    targetType,
    setTargetType,
    recipientMode,
    setRecipientMode,
    selectedRecipients,
    setSelectedRecipients,
    manualInputs,
    setManualInputs,
    generatedPreviewData,
    schoolSettings,
    selectedClassification,
    setSelectedClassification,
    classifications,
    previewSequence,
    loadingSequence,
    mergeBatch,
    setMergeBatch,
    handleSelectTemplate,
    handleSelectGroup,
    manualVars,
    handlePreparePreview,
    handleDownload,
    handleSubmitToVerification,
    submitting,
    router,
  } = useLetterGenerator();

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

      <DeprecationBanner
        title="Wizard surat dari template DOCX akan ditinggalkan"
        description="Jalur ini bergantung pada file DOCX dan tidak menerapkan standar tata naskah dinas. Untuk surat berkop standar, gunakan Editor Surat Modular."
      />

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
          templateUrl={
            creationMode === "GROUP" && selectedGroup
              ? selectedGroup.items?.[0]?.template?.filePath
              : selectedTemplate?.filePath
          }
          paperSize={selectedTemplate?.paperSize || "A4"}
          orientation={selectedTemplate?.orientation || "portrait"}
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
