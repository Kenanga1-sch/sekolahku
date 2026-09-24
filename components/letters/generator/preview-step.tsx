"use client";

import { ArrowLeft, Download, Loader2, Printer, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DocxPreview } from "./docx-preview";

interface PreviewStepProps {
  selectedRecipients: any[];
  generatedData: any;
  onBack: () => void;
  onDownload: () => void;
  onSubmitToVerification?: () => void;
  loading: boolean;
  submitting?: boolean;
  mergeBatch?: boolean;
  setMergeBatch?: (val: boolean) => void;
  /** URL template .docx untuk pratinjau nyata. */
  templateUrl?: string | null;
  paperSize?: string;
  orientation?: string;
}


export function PreviewStep({
  selectedRecipients,
  generatedData,
  onBack,
  onDownload,
  onSubmitToVerification,
  loading,
  submitting,
  mergeBatch = true,
  setMergeBatch,
  templateUrl,
  paperSize = "A4",
  orientation = "portrait",
}: PreviewStepProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Kolom Kiri: Pratinjau Dokumen Nyata */}
      <div className="lg:col-span-2 space-y-3">
        <DocxPreview
          templateUrl={templateUrl}
          data={generatedData}
          paperSize={paperSize}
          orientation={orientation}
        />
      </div>

      {/* Kolom Kanan: Actions & Summary Panel */}
      <div className="space-y-6">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
          Aksi & Status Dokumen
        </span>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-5">
          {/* Status Badge */}
          <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-3.5 rounded-xl text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="text-xs">
              <p className="font-bold">Draft Dokumen Siap</p>
              <p className="text-muted-foreground mt-0.5">Semua data berhasil digabungkan ke template.</p>
            </div>
          </div>

          {/* Penerima List */}
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Penerima Surat ({selectedRecipients.length})
            </p>
            <div className="max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-800/80 rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-950/20 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {selectedRecipients.length > 0 ? (
                selectedRecipients.map((r, index) => (
                  <div key={r.id || index} className="py-2.5 flex justify-between items-center first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-slate-200 dark:bg-zinc-800 text-[10px] rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-slate-250 truncate max-w-[140px]">
                        {r.name || r.fullName || "Penerima Manual"}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-[10px] bg-white dark:bg-zinc-900 border dark:border-zinc-850 px-2 py-0.5 rounded-full font-mono">
                      {r.nis || r.nip || "-"}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-3 text-center text-muted-foreground italic">
                  Penerima Manual
                </div>
              )}
            </div>
          </div>

          {/* Switch Gabungkan Dokumen (hanya tampil jika penerima > 1) */}
          {selectedRecipients.length > 1 && setMergeBatch && (
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-950/20 border border-slate-150/80 dark:border-slate-850 rounded-xl text-xs mt-3">
              <div className="space-y-0.5">
                <p className="font-semibold text-slate-850 dark:text-slate-250">Gabungkan Berkas</p>
                <p className="text-muted-foreground text-[10px]">Jadikan 1 file Word (.docx) untuk semua penerima</p>
              </div>
              <Switch checked={mergeBatch} onCheckedChange={setMergeBatch} />
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {onSubmitToVerification && (
              <Button
                onClick={onSubmitToVerification}
                className="w-full bg-indigo-600 hover:bg-indigo-750 text-white font-bold py-5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-100 dark:shadow-none"
                disabled={loading || submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                {submitting ? "Memproses Verifikasi..." : "Cetak & Kirim ke Verifikasi"}
              </Button>
            )}

            <Button
              onClick={onDownload}
              variant="outline"
              className="w-full border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-zinc-950 font-semibold py-5 rounded-xl flex items-center justify-center gap-2"
              disabled={loading || submitting}
            >
              <Download className="h-4 w-4 text-slate-500" />
              {selectedRecipients.length > 1
                ? mergeBatch
                  ? "Unduh Berkas Gabungan (.docx)"
                  : "Download ZIP (Semua Dokumen)"
                : "Unduh Word (.docx)"}
            </Button>

            <Button
              variant="ghost"
              onClick={onBack}
              disabled={loading || submitting}
              className="w-full text-slate-500 hover:text-slate-800 rounded-xl"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Kembali Edit Data
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
