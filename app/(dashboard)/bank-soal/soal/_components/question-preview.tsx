"use client";

import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye } from "lucide-react";
import type { Choice } from "./choice-list-editor";
import type { MatchPair } from "./pair-match-editor";
import type { FillBlankAnswer } from "./fill-blank-editor";

interface QuestionPreviewProps {
  type: string;
  content: string;
  mediaUrl?: string;
  options?: Choice[];
  pairs?: MatchPair[];
  fillAnswer?: FillBlankAnswer;
  points: number;
  difficulty: string;
  showAnswers?: boolean;
}

const difficultyLabels: Record<string, string> = {
  easy: "Mudah",
  medium: "Sedang",
  hard: "Sulit",
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuestionPreview({
  type,
  content,
  mediaUrl,
  options = [],
  pairs = [],
  fillAnswer,
  points,
  difficulty,
  showAnswers = false,
}: QuestionPreviewProps) {
  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-950 p-5 space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground border-b pb-2">
        <Eye className="h-3.5 w-3.5" />
        PREVIEW SOAL (tampilan siswa)
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[10px]">{type.replace("_", " ").toUpperCase()}</Badge>
        <Badge variant="outline" className="text-[10px]">{difficultyLabels[difficulty] || difficulty}</Badge>
        <Badge variant="outline" className="text-[10px]">{points} poin</Badge>
      </div>

      <p className="text-sm leading-relaxed whitespace-pre-wrap min-h-[2.5rem]">
        {content || <span className="text-muted-foreground italic">Ketik konten soal di sebelah kiri...</span>}
      </p>

      {mediaUrl && (
        <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
          <img
            src={mediaUrl}
            alt="Lampiran soal"
            className="w-full max-h-56 object-contain"
            loading="lazy"
          />
        </div>
      )}

      {(type === "pg_single" || type === "pg_multi") && options.length > 0 && (
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div
              key={opt.id}
              className={`flex items-center gap-3 p-2.5 rounded-lg border text-sm ${
                showAnswers && opt.isCorrect
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
                  : "border-slate-200 dark:border-zinc-800"
              }`}
            >
              {type === "pg_single" ? (
                <RadioGroup value={showAnswers && opt.isCorrect ? opt.text : ""} className="flex">
                  <RadioGroupItem value={opt.text} id={`pv-${opt.id}`} className="h-4 w-4" />
                </RadioGroup>
              ) : (
                <Checkbox checked={showAnswers && opt.isCorrect} className="h-4 w-4" />
              )}
              <span className="font-bold text-xs text-muted-foreground">{LETTERS[idx]}.</span>
              <span>{opt.text || <span className="text-muted-foreground italic">(kosong)</span>}</span>
            </div>
          ))}
        </div>
      )}

      {type === "true_false" && (
        <div className="flex gap-3">
          {["Benar", "Salah"].map((opt) => {
            const isCorrect = showAnswers && options.find((c) => c.isCorrect)?.text === opt;
            return (
              <div
                key={opt}
                className={`flex-1 flex items-center gap-2 p-2.5 rounded-lg border text-sm ${
                  isCorrect
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
                    : "border-slate-200 dark:border-zinc-800"
                }`}
              >
                <RadioGroup value={isCorrect ? opt : ""} className="flex">
                  <RadioGroupItem value={opt} id={`pv-tf-${opt}`} className="h-4 w-4" />
                </RadioGroup>
                {opt}
              </div>
            );
          })}
        </div>
      )}

      {type === "fill_blank" && (
        <div className="space-y-1.5">
          <div className="flex min-h-[38px] items-center rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3 text-sm text-muted-foreground">
            {fillAnswer?.keyword ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {fillAnswer.keyword}
              </span>
            ) : (
              <span className="italic">Jawaban siswa muncul di sini...</span>
            )}
          </div>
          {showAnswers && fillAnswer && fillAnswer.alternatives.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Alternatif yang diterima: {fillAnswer.alternatives.filter(Boolean).join(", ") || "-"}
            </p>
          )}
        </div>
      )}

      {(type === "matching" || type === "pair_match") && pairs.length > 0 && (
        <div className="space-y-2">
          {pairs.map((p, idx) => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate p-2 rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
                {p.left || <span className="text-muted-foreground italic">(kiri)</span>}
              </span>
              <span className="text-muted-foreground text-xs">↔</span>
              <span className="flex-1 truncate p-2 rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
                {p.right || <span className="text-muted-foreground italic">(kanan)</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {type === "essay" && (
        <div className="min-h-[80px] rounded-md border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 p-3">
          <p className="text-[11px] text-muted-foreground italic">
            Area jawaban esai siswa (dinilai manual)
          </p>
        </div>
      )}
    </div>
  );
}
