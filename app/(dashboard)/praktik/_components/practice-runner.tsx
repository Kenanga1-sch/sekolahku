"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Clock, ChevronLeft, ChevronRight, Send, AlertTriangle } from "lucide-react";
import { goGet, goPost } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";

interface Question {
  id: string;
  type: string;
  content: string;
  mediaUrl?: string;
  options?: string;
  points: number;
  difficulty: string;
}

interface Practice {
  id: string;
  setId: string;
  setName?: string;
  startedAt?: number;
  timerMinutes?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  isCompleted: boolean;
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PracticeRunner({ practiceId }: { practiceId: string }) {
  const router = useRouter();
  const [practice, setPractice] = useState<Practice | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchPractice = useCallback(async () => {
    try {
      const result: any = await goGet(`/api/student/me/practices/${practiceId}`);
      const practiceData = result?.data;

      if (!practiceData) {
        showError("Praktik tidak ditemukan");
        router.push("/praktik");
        return;
      }

      // Sudah selesai → langsung ke hasil.
      if (practiceData.isCompleted) {
        router.replace(`/praktik?view=hasil&id=${practiceId}`);
        return;
      }

      setPractice(practiceData);

      const itemsResult: any = await goGet(`/api/student/me/sets/${practiceData.setId}/items`);
      const items = itemsResult?.data || [];
      let qs = items.map((item: any) => item.question).filter(Boolean);

      // Acak urutan soal sesuai pengaturan paket.
      if (practiceData.shuffleQuestions) qs = shuffleArray(qs);
      setQuestions(qs);

      const initialAnswers: Record<string, string> = {};
      qs.forEach((q: Question) => { initialAnswers[q.id] = ""; });
      setAnswers(initialAnswers);

      if (practiceData.timerMinutes && practiceData.timerMinutes > 0 && practiceData.startedAt) {
        const elapsed = Math.floor((Date.now() - practiceData.startedAt) / 1000);
        const remaining = practiceData.timerMinutes * 60 - elapsed;
        if (remaining > 0) setTimeLeft(remaining);
      }
    } catch {
      showError("Gagal memuat data praktik");
      router.push("/praktik");
    } finally {
      setIsLoading(false);
    }
  }, [practiceId, router]);

  useEffect(() => { fetchPractice(); }, [fetchPractice]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const answerArray = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
      await goPost(`/api/student/me/practices/${practiceId}/submit`, { answers: answerArray });
      showSuccess("Jawaban berhasil dikirim!");
      router.replace(`/praktik?view=hasil&id=${practiceId}`);
    } catch {
      showError("Gagal mengirim jawaban");
      setIsSubmitting(false);
    }
  }, [answers, isSubmitting, practiceId, router]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) { clearInterval(timer); handleSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, handleSubmit]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const handleAnswer = (qid: string, ans: string) => setAnswers((p) => ({ ...p, [qid]: ans }));

  // pg_multi: toggle satu teks dalam array JSON.
  const toggleMultiAnswer = (qid: string, text: string) => {
    setAnswers((prev) => {
      const current: string[] = prev[qid] ? safeJsonParseArray(prev[qid]) : [];
      const next = current.includes(text) ? current.filter((t) => t !== text) : [...current, text];
      return { ...prev, [qid]: JSON.stringify(next) };
    });
  };

  // matching: { leftId: rightId }
  const setMatchAnswer = (qid: string, leftId: string, rightId: string) => {
    setAnswers((prev) => {
      const current = prev[qid] ? safeJsonParseObject(prev[qid] ?? "") : {};
      return { ...prev, [qid]: JSON.stringify({ ...current, [leftId]: rightId }) };
    });
  };

  const answeredCount = Object.values(answers).filter((a) => a !== "" && a !== "[]").length;
  const currentQuestion = questions[currentIdx];

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!practice || questions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Soal tidak ditemukan di paket ini</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/praktik")}>Kembali</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-zinc-950 border rounded-lg p-3 sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push("/praktik")}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm truncate">{practice.setName || "Praktik"}</h1>
            <p className="text-xs text-muted-foreground">Soal {currentIdx + 1} dari {questions.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {timeLeft !== null && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${timeLeft < 60 ? "bg-red-100 text-red-700 animate-pulse" : "bg-amber-100 text-amber-700"}`}>
              <Clock className="h-4 w-4" /><span className="font-mono font-bold text-sm">{formatTime(timeLeft)}</span>
            </div>
          )}
          <div className="text-right"><p className="text-xs text-muted-foreground">Dijawab</p><p className="font-bold text-sm">{answeredCount}/{questions.length}</p></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {questions.map((q, idx) => (
          <button
            key={q.id}
            onClick={() => setCurrentIdx(idx)}
            className={`w-10 h-10 rounded-lg text-xs font-medium transition-all ${idx === currentIdx ? "bg-blue-600 text-white scale-110" : answers[q.id] && answers[q.id] !== "[]" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      {currentQuestion && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Soal {currentIdx + 1}</Badge>
              <Badge className={currentQuestion.difficulty === "easy" ? "bg-green-100 text-green-700" : currentQuestion.difficulty === "hard" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
                {currentQuestion.difficulty === "easy" ? "Mudah" : currentQuestion.difficulty === "hard" ? "Sulit" : "Sedang"}
              </Badge>
              <span className="text-xs text-muted-foreground">{currentQuestion.points} poin</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentQuestion.mediaUrl && <img src={currentQuestion.mediaUrl} alt="Lampiran" className="max-w-full max-h-64 rounded-lg object-contain" />}
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{currentQuestion.content}</div>

            <QuestionInput
              question={currentQuestion}
              answer={answers[currentQuestion.id] || ""}
              onAnswer={(ans) => handleAnswer(currentQuestion.id, ans)}
              onToggleMulti={(text) => toggleMultiAnswer(currentQuestion.id, text)}
              onMatch={(leftId, rightId) => setMatchAnswer(currentQuestion.id, leftId, rightId)}
              shuffleOptions={!!practice.shuffleOptions}
            />

            <div className="flex items-center justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}><ChevronLeft className="h-4 w-4 mr-1" />Sebelumnya</Button>
              {currentIdx < questions.length - 1 ? (
                <Button onClick={() => setCurrentIdx(currentIdx + 1)}>Selanjutnya<ChevronRight className="h-4 w-4 ml-1" /></Button>
              ) : (
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowConfirm(true)}><Send className="h-4 w-4 mr-2" />Selesai</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader><h3 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5 text-amber-500" />Konfirmasi Submit</h3></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">Anda menjawab <strong>{answeredCount}</strong> dari <strong>{questions.length}</strong> soal.</p>
              {answeredCount < questions.length && <p className="text-sm text-amber-600">Masih ada {questions.length - answeredCount} soal belum dijawab!</p>}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>Kembali</Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? "Mengirim..." : "Ya, Submit"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function safeJsonParseArray(str?: string): string[] {
  if (!str) return [];
  try { const a = JSON.parse(str); return Array.isArray(a) ? a : []; } catch { return []; }
}
function safeJsonParseObject(str?: string): Record<string, string> {
  if (!str) return {};
  try { const o = JSON.parse(str); return o && typeof o === "object" ? o : {}; } catch { return {}; }
}

interface QuestionInputProps {
  question: Question;
  answer: string;
  onAnswer: (ans: string) => void;
  onToggleMulti: (text: string) => void;
  onMatch: (leftId: string, rightId: string) => void;
  shuffleOptions: boolean;
}

function QuestionInput({ question, answer, onAnswer, onToggleMulti, onMatch, shuffleOptions }: QuestionInputProps) {
  // pg_single: radio teks
  if ((question.type === "pg_single") && question.options) {
    let opts = safeJsonParseArray(question.options);
    if (shuffleOptions) opts = shuffleArray(opts);
    return (
      <RadioGroup value={answer} onValueChange={(v) => onAnswer(v)} className="space-y-2">
        {opts.map((opt: any, idx: number) => (
          <Label key={opt.id ?? idx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${answer === opt.text ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-slate-200 hover:border-slate-300"}`}>
            <RadioGroupItem value={opt.text} />
            <span className="font-bold text-xs text-muted-foreground">{LETTERS[idx]}</span>
            <span className="text-sm">{opt.text}</span>
          </Label>
        ))}
      </RadioGroup>
    );
  }

  // pg_multi: checkbox teks
  if (question.type === "pg_multi" && question.options) {
    let opts = safeJsonParseArray(question.options);
    if (shuffleOptions) opts = shuffleArray(opts);
    const selected: string[] = answer ? safeJsonParseArray(answer) : [];
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground">Pilih semua jawaban yang benar</p>
        {opts.map((opt: any, idx: number) => {
          const isChecked = selected.includes(opt.text);
          return (
            <Label
              key={opt.id ?? idx}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isChecked ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-slate-200 hover:border-slate-300"}`}
            >
              <Checkbox checked={isChecked} onCheckedChange={() => onToggleMulti(opt.text)} />
              <span className="font-bold text-xs text-muted-foreground">{LETTERS[idx]}</span>
              <span className="text-sm">{opt.text}</span>
            </Label>
          );
        })}
      </div>
    );
  }

  if (question.type === "true_false") {
    return (
      <RadioGroup value={answer} onValueChange={(v) => onAnswer(v)} className="space-y-2">
        {["Benar", "Salah"].map((opt) => (
          <Label key={opt} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${answer === opt ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-slate-200 hover:border-slate-300"}`}>
            <RadioGroupItem value={opt} /><span className="text-sm">{opt}</span>
          </Label>
        ))}
      </RadioGroup>
    );
  }

  // matching / pair_match: kiri (nomor) ↔ kanan (huruf, diacak)
  if (question.type === "matching" || question.type === "pair_match") {
    const pairs = safeJsonParseArray(question.options).map((p: any) => ({
      id: String(p.id ?? ""),
      left: String(p.left ?? ""),
      right: String(p.right ?? ""),
      rightId: p.rightId ? String(p.rightId) : `r${p.id}`,
    }));
    if (!pairs.length) return null;

    let rights = pairs.map((p: any) => ({ rightId: p.rightId, right: p.right }));
    if (shuffleOptions) rights = shuffleArray(rights);

    const currentMap: Record<string, string> = answer ? safeJsonParseObject(answer) : {};

    return (
      <div className="space-y-3">
        <p className="text-[11px] text-muted-foreground">Cocokkan item kiri (nomor) dengan item kanan (huruf)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Kolom kiri */}
          <div className="space-y-2">
            {pairs.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-slate-50 dark:bg-zinc-900">
                <span className="font-bold text-xs text-muted-foreground shrink-0">{i + 1}.</span>
                <span className="text-sm flex-1">{p.left}</span>
              </div>
            ))}
          </div>
          {/* Kolom kanan: pilih huruf untuk tiap nomor */}
          <div className="space-y-2">
            {pairs.map((p: any, i: number) => {
              const selectedRight = currentMap[p.id];
              return (
                <div key={`sel-${p.id}`} className="p-2.5 rounded-lg border bg-white dark:bg-zinc-950">
                  <p className="text-[10px] text-muted-foreground mb-1.5">Jawaban untuk nomor {i + 1}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rights.map((r: any, ri: number) => {
                      const isActive = selectedRight === r.rightId;
                      return (
                        <button
                          key={r.rightId}
                          type="button"
                          onClick={() => onMatch(p.id, r.rightId)}
                          className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${isActive ? "bg-blue-600 text-white scale-110" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300"}`}
                          title={r.right}
                        >
                          {LETTERS[ri]}
                        </button>
                      );
                    })}
                  </div>
                  {selectedRight && (
                    <p className="text-[10px] text-blue-600 mt-1">
                      {LETTERS[rights.findIndex((r: any) => r.rightId === selectedRight)]}: {rights.find((r: any) => r.rightId === selectedRight)?.right}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // fill_blank / essay
  return (
    <textarea
      className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      value={answer}
      onChange={(e) => onAnswer(e.target.value)}
      placeholder={question.type === "fill_blank" ? "Tulis jawaban..." : "Tulis jawaban esai..."}
    />
  );
}
