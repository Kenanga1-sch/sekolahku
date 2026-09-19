"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { showError, showSuccess } from "@/lib/toast";
import { gradeTugasSubmission, formatDate, type TugasSubmission } from "@/lib/tugas";

interface GradingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: TugasSubmission | null;
  tugasId: string;
  onSaved?: (sub: TugasSubmission) => void;
}

export function GradingDialog({ open, onOpenChange, submission, tugasId, onSaved }: GradingDialogProps) {
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !submission) return;
    setScore(submission.score != null ? String(submission.score) : "");
    setFeedback(submission.feedback || "");
  }, [open, submission]);

  if (!submission) return null;

  const handleSave = async () => {
    const trimmed = score.trim();
    const num = trimmed === "" ? null : Number(trimmed);
    if (num != null && (Number.isNaN(num) || num < 0 || num > 100)) {
      showError("Nilai harus di antara 0 dan 100");
      return;
    }
    setSaving(true);
    try {
      const saved = await gradeTugasSubmission(tugasId, submission.id, {
        score: num,
        feedback: feedback.trim(),
      });
      showSuccess("Nilai tersimpan");
      onOpenChange(false);
      if (saved && onSaved) onSaved(saved);
    } catch (err: any) {
      showError(err?.message || "Gagal menyimpan nilai");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nilai Pengumpulan</DialogTitle>
          <DialogDescription>
            {submission.studentName} · dikumpulkan {formatDate(submission.submittedAt)}
            {submission.isLate ? " (terlambat)" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {submission.answerText && (
            <div className="space-y-1">
              <Label>Jawaban Siswa</Label>
              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                {submission.answerText}
              </div>
            </div>
          )}
          {submission.attachmentUrl && (
            <div className="space-y-1">
              <Label>Lampiran Siswa</Label>
              <a
                href={submission.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {submission.attachmentName || "Lihat lampiran"}
              </a>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="grade-score">Nilai (0–100)</Label>
            <Input
              id="grade-score"
              type="number"
              min={0}
              max={100}
              placeholder="mis. 85"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kosongkan jika hanya ingin memberi umpan balik tanpa nilai.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grade-feedback">Umpan Balik</Label>
            <Textarea
              id="grade-feedback"
              placeholder="Tuliskan umpan balik untuk siswa (opsional)..."
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Menyimpan…
              </>
            ) : (
              "Simpan Nilai"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GradingDialog;
