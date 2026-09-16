"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Clock, ArrowLeft, AlertCircle } from "lucide-react";
import { goGet } from "@/lib/api-client";
import { showError } from "@/lib/toast";

interface Practice {
  id: string;
  setName?: string;
  totalScore: number;
  maxScore: number;
  isCompleted: boolean;
  attemptNumber: number;
}

interface Answer {
  id: string;
  questionId: string;
  answer?: string;
  isCorrect?: boolean | null;
  pointsEarned: number;
  questionType?: string;
  questionContent?: string;
  questionOptions?: string;
  questionPoints?: number;
  explanation?: string;
  correctAnswer?: string;
}

const TYPE_LABELS: Record<string, string> = {
  pg_single: "PG Tunggal",
  pg_multi: "PG Multi",
  true_false: "Benar/Salah",
  fill_blank: "Isian",
  matching: "Menjodohkan",
  pair_match: "Mencocokkan",
  essay: "Esai",
};

function formatCorrectAnswer(a: Answer): string {
  const raw = a.correctAnswer || "";
  const t = a.questionType;
  if (t === "pg_single" || t === "true_false") return raw || "-";
  if (t === "pg_multi") {
    try {
      const arr: string[] = JSON.parse(raw);
      return Array.isArray(arr) && arr.length ? arr.join(", ") : "-";
    } catch { return raw || "-"; }
  }
  if (t === "fill_blank") {
    try {
      const arr: string[] = JSON.parse(raw);
      return Array.isArray(arr) && arr.length ? arr.join(" / ") : raw || "-";
    } catch { return raw || "-"; }
  }
  if (t === "matching" || t === "pair_match") {
    try {
      const map: Record<string, string> = JSON.parse(raw);
      const opts = a.questionOptions ? JSON.parse(a.questionOptions) : [];
      const rows = Object.entries(map).map(([leftId, rightId]) => {
        const pair = opts.find((o: any) => String(o.id) === String(leftId));
        const right = opts.find((o: any) => String(o.rightId ?? `r${o.id}`) === String(rightId));
        return `${pair?.left ?? leftId} → ${right?.right ?? rightId}`;
      });
      return rows.length ? rows.join("; ") : "-";
    } catch { return raw || "-"; }
  }
  return raw || "-";
}

function formatStudentAnswer(a: Answer): string {
  const raw = a.answer || "";
  const t = a.questionType;
  if (t === "pg_multi") {
    try {
      const arr: string[] = JSON.parse(raw);
      return Array.isArray(arr) && arr.length ? arr.join(", ") : "(kosong)";
    } catch { return raw || "(kosong)"; }
  }
  if (t === "matching" || t === "pair_match") {
    try {
      const map: Record<string, string> = JSON.parse(raw);
      const opts = a.questionOptions ? JSON.parse(a.questionOptions) : [];
      const rows = Object.entries(map).map(([leftId, rightId]) => {
        const pair = opts.find((o: any) => String(o.id) === String(leftId));
        const right = opts.find((o: any) => String(o.rightId ?? `r${o.id}`) === String(rightId));
        return `${pair?.left ?? leftId} → ${right?.right ?? rightId}`;
      });
      return rows.length ? rows.join("; ") : "(kosong)";
    } catch { return raw || "(kosong)"; }
  }
  return raw || "(kosong)";
}

export function PracticeResult({ practiceId }: { practiceId: string }) {
  const router = useRouter();
  const [practice, setPractice] = useState<Practice | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res: any = await goGet(`/api/student/me/practices/${practiceId}/result`);
        const data = res?.data;
        if (!data) {
          showError("Hasil tidak ditemukan");
          router.push("/praktik");
          return;
        }
        setPractice(data.practice || null);
        setAnswers(data.answers || []);
      } catch {
        showError("Gagal memuat hasil praktik");
        router.push("/praktik");
      } finally {
        setIsLoading(false);
      }
    };
    fetchResult();
  }, [practiceId, router]);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!practice) return null;

  const pendingEssays = answers.filter((a) => a.isCorrect === null);
  const percentage = practice.maxScore > 0 ? Math.round((practice.totalScore / practice.maxScore) * 100) : 0;
  const correctCount = answers.filter((a) => a.isCorrect === true).length;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/praktik")} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Kembali ke Daftar Paket
      </Button>

      {/* Score Card */}
      <Card className="border-2 border-emerald-200 dark:border-emerald-900">
        <CardContent className="p-6 text-center space-y-3">
          <h2 className="font-bold text-lg">{practice.setName || "Praktik"}</h2>
          {practice.maxScore > 0 ? (
            <>
              <div className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {practice.totalScore.toFixed(0)} / {practice.maxScore.toFixed(0)}
              </div>
              <div className="text-2xl font-bold">{percentage}%</div>
              <p className="text-sm text-muted-foreground">
                {correctCount} dari {answers.length} soal benar • Percobaan #{practice.attemptNumber}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada soal bernilai pada praktik ini</p>
          )}
          {pendingEssays.length > 0 && (
            <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-lg px-4 py-2 text-xs">
              <Clock className="h-4 w-4" />
              {pendingEssays.length} soal esai menunggu koreksi guru
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review per soal */}
      <div className="space-y-4">
        {answers.map((a, idx) => {
          const isPending = a.isCorrect === null;
          const isCorrect = a.isCorrect === true;
          return (
            <Card key={a.id} className={isPending ? "border-amber-200 dark:border-amber-900" : isCorrect ? "border-emerald-200 dark:border-emerald-900" : "border-red-200 dark:border-red-900"}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{idx + 1}.</span>
                    <Badge variant="outline">{TYPE_LABELS[a.questionType || ""] || a.questionType}</Badge>
                    <span className="text-xs text-muted-foreground">{a.questionPoints || 0} poin</span>
                  </div>
                  {isPending ? (
                    <Badge className="bg-amber-100 text-amber-700 gap-1"><Clock className="h-3 w-3" /> Menunggu koreksi</Badge>
                  ) : isCorrect ? (
                    <Badge className="bg-emerald-100 text-emerald-700 gap-1"><CheckCircle2 className="h-3 w-3" /> Benar</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 gap-1"><XCircle className="h-3 w-3" /> Salah</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium whitespace-pre-wrap">{a.questionContent}</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex gap-2">
                    <span className="font-semibold text-muted-foreground shrink-0 w-24">Jawaban Anda:</span>
                    <span className={isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                      {formatStudentAnswer(a)}
                    </span>
                  </div>
                  {!isPending && !isCorrect && (
                    <div className="flex gap-2">
                      <span className="font-semibold text-muted-foreground shrink-0 w-24">Kunci:</span>
                      <span className="text-emerald-700 dark:text-emerald-400">{formatCorrectAnswer(a)}</span>
                    </div>
                  )}
                  {a.explanation && (
                    <div className="flex gap-2">
                      <span className="font-semibold text-muted-foreground shrink-0 w-24">Pembahasan:</span>
                      <span className="text-muted-foreground">{a.explanation}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => router.push("/praktik")}>
          Kembali ke Daftar Paket
        </Button>
      </div>
    </div>
  );
}
