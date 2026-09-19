"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Backpack,
  Box,
  Clock,
  FileText,
  Loader2,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { showError, showSuccess } from "@/lib/toast";
import {
  canSubmit,
  deadlineLabel,
  formatDate,
  getMyTugas,
  submitMyTugas,
  type Tugas,
} from "@/lib/tugas";
import { FileUploader } from "../../tugas/_components/file-uploader";

export default function TugasSayaDetailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id") || "";

  const [tugas, setTugas] = useState<Tugas | null>(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const t = await getMyTugas(id);
      setTugas(t || null);
    } catch {
      showError("Gagal memuat tugas");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Prefill form dari pengumpulan sebelumnya (yang belum dinilai).
  useEffect(() => {
    if (!tugas || tugas.myStatus === "graded") return;
    setAnswer(tugas.myAnswerText || "");
    setAttachmentUrl(tugas.myAttachmentUrl || "");
    setAttachmentName(tugas.myAttachmentName || "");
  }, [tugas]);

  if (loading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!tugas) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="text-5xl">🔍</span>
        <p className="font-semibold text-slate-700 dark:text-slate-200">Tugas tidak ditemukan</p>
        <Button variant="outline" onClick={() => router.push("/tugas-saya")}>
          Kembali ke Tugas Saya
        </Button>
      </div>
    );
  }

  const graded = tugas.myStatus === "graded";
  const submittedNotGraded = tugas.myStatus === "submitted";
  const open = canSubmit(tugas);
  const overdue = !!tugas.dueAt && tugas.dueAt < Date.now();

  const handleSubmit = async () => {
    if (!answer.trim() && !attachmentUrl) {
      showError("Isi jawaban atau lampirkan file");
      return;
    }
    setSubmitting(true);
    try {
      await submitMyTugas(tugas.id, {
        answerText: answer.trim(),
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentName || undefined,
      });
      showSuccess(submittedNotGraded ? "Jawaban diperbarui" : "Jawaban terkumpul");
      fetchData();
      // Reset form setelah refresh (prefill akan mengambil data baru).
      setAnswer("");
      setAttachmentUrl("");
      setAttachmentName("");
    } catch (err: any) {
      showError(err?.message || "Gagal mengumpulkan tugas");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <button
        onClick={() => router.push("/tugas-saya")}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-blue-600 dark:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke Tugas Saya
      </button>

      {/* Detail tugas */}
      <Card>
        <CardContent className="space-y-4 py-5">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{tugas.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Box className="h-3.5 w-3.5" /> {tugas.subjectName || "Tanpa mapel"}
              </span>
              <span className="flex items-center gap-1">
                <Backpack className="h-3.5 w-3.5" /> {tugas.className || "Kelas"}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {deadlineLabel(tugas.dueAt)}
              </span>
            </p>
          </div>

          {tugas.description && (
            <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-slate-200">
              {tugas.description}
            </div>
          )}

          {tugas.attachmentUrl && (
            <a
              href={tugas.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-blue-400 dark:hover:bg-blue-950/20"
            >
              <FileText className="h-4 w-4" />
              {tugas.attachmentName || "Lampiran dari guru"}
            </a>
          )}
        </CardContent>
      </Card>

      {/* Hasil nilai (jika sudah dinilai) */}
      {graded && (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CardContent className="space-y-3 py-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-emerald-800 dark:text-emerald-300">Hasil Penilaian</h2>
              {tugas.myScore != null && (
                <span className="rounded-full bg-emerald-600 px-4 py-1 text-lg font-bold text-white">
                  {tugas.myScore}
                </span>
              )}
            </div>
            {tugas.mySubmittedAt && (
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                Dikumpulkan {formatDate(tugas.mySubmittedAt)}
                {tugas.myIsLate ? " · terlambat" : ""}
              </p>
            )}
            {tugas.myFeedback && (
              <div className="rounded-lg border border-emerald-200 bg-white p-3 text-sm text-slate-700 dark:border-emerald-900 dark:bg-zinc-900 dark:text-slate-200">
                <p className="mb-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Umpan balik guru
                </p>
                {tugas.myFeedback}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form pengumpulan */}
      {open ? (
        <Card>
          <CardContent className="space-y-4 py-5">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">
              {submittedNotGraded ? "Perbarui Jawaban" : "Kumpulkan Jawaban"}
            </h2>

            {overdue && tugas.allowLate && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                Batas waktu sudah terlewati. Anda masih bisa mengumpulkan, namun akan ditandai terlambat.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="answer">Jawaban</Label>
              <Textarea
                id="answer"
                placeholder="Tuliskan jawaban atau pengerjaan Anda di sini..."
                rows={6}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Lampiran (opsional)</Label>
              <FileUploader
                value={attachmentUrl}
                fileName={attachmentName}
                onChange={(url, name) => {
                  setAttachmentUrl(url || "");
                  setAttachmentName(name || "");
                }}
              />
            </div>

            <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
              {submitting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Mengumpulkan…
                </>
              ) : (
                <>
                  <Send className="mr-1 h-4 w-4" /> {submittedNotGraded ? "Perbarui Jawaban" : "Kumpulkan"}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        !graded && (
          <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30">
            <CardContent className="py-6 text-center">
              <Clock className="mx-auto mb-2 h-8 w-8 text-rose-500" />
              <p className="font-semibold text-rose-800 dark:text-rose-300">Pengumpulan ditutup</p>
              <p className="mt-1 text-sm text-rose-700/80 dark:text-rose-400/80">
                Batas waktu sudah terlewati dan tugas ini tidak menerima pengumpulan terlambat.
              </p>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
