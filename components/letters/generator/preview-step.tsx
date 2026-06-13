"use client";

import { ArrowLeft, Check, Download, Loader2, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewStepProps {
  selectedRecipients: any[];
  generatedData: any;
  onBack: () => void;
  onDownload: () => void;
  onSubmitToVerification?: () => void;
  loading: boolean;
  submitting?: boolean;
}

export function PreviewStep({
  selectedRecipients,
  generatedData,
  onBack,
  onDownload,
  onSubmitToVerification,
  loading,
  submitting,
}: PreviewStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack} disabled={loading}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Edit Data
          </Button>
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {selectedRecipients.length > 1
                ? `Siap unduh untuk ${selectedRecipients.length} penerima`
                : "Siap diunduh"}
            </span>
            <span className="text-xs text-muted-foreground">Pastikan data sudah benar.</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onDownload} size="lg" variant="outline" disabled={loading}>
            <Download className="mr-2 h-4 w-4" />
            {selectedRecipients.length > 1 ? "Download ZIP (Semua)" : "Download"}
          </Button>
          {onSubmitToVerification && (
            <Button onClick={onSubmitToVerification} size="lg" className="bg-blue-600 hover:bg-blue-700" disabled={loading || submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {submitting ? "Mengirim..." : "Cetak & Kirim ke Verifikasi"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex justify-center bg-zinc-200 dark:bg-zinc-950 p-8 rounded-lg overflow-auto">
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-lg shadow-sm max-w-lg text-center space-y-4">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center">
            {selectedRecipients.length > 1 ? <Users className="h-8 w-8" /> : <Check className="h-8 w-8" />}
          </div>
          <h3 className="text-xl font-semibold">Dokumen Siap</h3>
          {selectedRecipients.length > 1 ? (
            <p className="text-muted-foreground text-sm">
              Anda akan mengunduh <strong>{selectedRecipients.length} dokumen</strong> sekaligus dalam format ZIP.
              <br />
              Nomor surat akan dicatat secara otomatis ke dalam sistem arsip.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Data <strong>{generatedData?.siswa_nama || generatedData?.penerima_nama || "Penerima"}</strong> telah digabungkan.
              <br />
              Silakan unduh file sekarang.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
