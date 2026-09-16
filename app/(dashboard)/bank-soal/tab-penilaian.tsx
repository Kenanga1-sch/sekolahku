"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClipboardCheck, ChevronRight, Clock, CheckCircle2, XCircle } from "lucide-react";
import { goGet, goPut } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";

interface Practice {
  id: string;
  studentName?: string;
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

export default function TabPenilaian() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gradingPractice, setGradingPractice] = useState<Practice | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [grading, setGrading] = useState<Record<string, { isCorrect: boolean; points: string }>>({});
  const [search, setSearch] = useState("");

  const fetchPractices = useCallback(async () => {
    setIsLoading(true);
    try {
      const res: any = await goGet("/api/bank-soal/practices?limit=100");
      setPractices(res?.data || []);
    } catch {
      showError("Gagal memuat data praktik");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPractices();
  }, [fetchPractices]);

  const openGrading = async (p: Practice) => {
    setGradingPractice(p);
    setAnswersLoading(true);
    setGrading({});
    try {
      const res: any = await goGet(`/api/bank-soal/practices/${p.id}/result`);
      const data = res?.data;
      const list: Answer[] = data?.answers || [];
      setAnswers(list);
      // Inisialisasi form koreksi untuk essay yang belum dinilai.
      const init: Record<string, { isCorrect: boolean; points: string }> = {};
      list.forEach((a) => {
        if (a.isCorrect === null && a.questionType === "essay") {
          init[a.questionId] = { isCorrect: false, points: String(a.questionPoints || 0) };
        }
      });
      setGrading(init);
    } catch {
      showError("Gagal memuat jawaban siswa");
    } finally {
      setAnswersLoading(false);
    }
  };

  const handleGrade = async (questionId: string) => {
    if (!gradingPractice) return;
    const g = grading[questionId];
    if (!g) return;
    const points = parseFloat(g.points) || 0;
    const maxPoints = answers.find((a) => a.questionId === questionId)?.questionPoints || 0;
    if (points > maxPoints) {
      showError(`Poin tidak boleh melebihi ${maxPoints}`);
      return;
    }
    try {
      await goPut(`/api/bank-soal/practices/${gradingPractice.id}/answers/${questionId}/grade`, {
        isCorrect: g.isCorrect,
        points,
      });
      showSuccess("Nilai berhasil disimpan");
      // Refresh jawaban & daftar.
      await openGrading(gradingPractice);
      fetchPractices();
    } catch {
      showError("Gagal menyimpan nilai");
    }
  };

  const pendingEssays = (p: Practice) => p.maxScore > 0 && p.totalScore === 0;
  const filtered = search
    ? practices.filter((p) =>
        (p.studentName || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.setName || "").toLowerCase().includes(search.toLowerCase())
      )
    : practices;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold">Penilaian Praktik</h2>
          <p className="text-xs text-muted-foreground">
            Koreksi jawaban esai siswa dan pantau hasil praktik
          </p>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari siswa / paket..."
          className="w-full sm:w-64"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ClipboardCheck className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Belum ada praktik yang dikumpulkan</p>
            <p className="text-xs">Praktik siswa akan muncul di sini setelah di-submit</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Card key={p.id} className="hover:border-blue-300 transition-colors cursor-pointer" onClick={() => openGrading(p)}>
              <CardContent className="flex items-center gap-4 p-3.5">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                  <ClipboardCheck className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {p.studentName || "Siswa"} — {p.setName || "Paket Soal"}
                  </p>
                  <p className="text-xs text-muted-foreground">Percobaan #{p.attemptNumber}</p>
                </div>
                {p.maxScore > 0 && (
                  <Badge className={p.totalScore / p.maxScore >= 0.7 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                    {Math.round((p.totalScore / p.maxScore) * 100)}% ({p.totalScore.toFixed(0)}/{p.maxScore.toFixed(0)})
                  </Badge>
                )}
                {pendingEssays(p) && (
                  <Badge className="bg-amber-100 text-amber-700 gap-1">
                    <Clock className="h-3 w-3" /> Ada esai belum dikoreksi
                  </Badge>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Koreksi */}
      <Dialog open={!!gradingPractice} onOpenChange={(open) => { if (!open) setGradingPractice(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Koreksi: {gradingPractice?.studentName || "Siswa"}</DialogTitle>
            <DialogDescription>{gradingPractice?.setName || "Paket Soal"} —_percobaan #{gradingPractice?.attemptNumber}</DialogDescription>
          </DialogHeader>

          {answersLoading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {answers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Tidak ada jawaban tersimpan</p>
              ) : (
                answers.map((a, idx) => {
                  const isEssay = a.questionType === "essay";
                  const isPending = a.isCorrect === null;
                  const g = grading[a.questionId];
                  return (
                    <Card key={a.id} className={isPending ? "border-amber-200 dark:border-amber-900" : ""}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{idx + 1}.</span>
                            <Badge variant="outline">{TYPE_LABELS[a.questionType || ""] || a.questionType}</Badge>
                            <span className="text-xs text-muted-foreground">{a.questionPoints || 0} poin</span>
                          </div>
                          {isPending ? (
                            <Badge className="bg-amber-100 text-amber-700 gap-1"><Clock className="h-3 w-3" /> Menunggu koreksi</Badge>
                          ) : a.isCorrect ? (
                            <Badge className="bg-emerald-100 text-emerald-700 gap-1"><CheckCircle2 className="h-3 w-3" /> Benar ({a.pointsEarned})</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 gap-1"><XCircle className="h-3 w-3" /> Salah (0)</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm font-medium whitespace-pre-wrap">{a.questionContent}</p>
                        <div className="text-xs space-y-1">
                          <p><span className="font-semibold text-muted-foreground">Jawaban siswa: </span><span className="whitespace-pre-wrap">{a.answer || "(kosong)"}</span></p>
                          {a.explanation && (
                            <p><span className="font-semibold text-muted-foreground">Panduan: </span><span className="text-muted-foreground">{a.explanation}</span></p>
                          )}
                        </div>

                        {/* Form koreksi essay */}
                        {isEssay && isPending && g && (
                          <div className="flex items-center gap-2 pt-2 border-t">
                            <Button
                              size="sm"
                              variant={g.isCorrect ? "default" : "outline"}
                              className={g.isCorrect ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                              onClick={() => setGrading((prev) => ({ ...prev, [a.questionId]: { ...prev[a.questionId], isCorrect: true } }))}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Benar
                            </Button>
                            <Button
                              size="sm"
                              variant={!g.isCorrect ? "destructive" : "outline"}
                              onClick={() => setGrading((prev) => ({ ...prev, [a.questionId]: { ...prev[a.questionId], isCorrect: false } }))}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Salah
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              max={a.questionPoints || 0}
                              value={g.points}
                              onChange={(e) => setGrading((prev) => ({ ...prev, [a.questionId]: { ...prev[a.questionId], points: e.target.value } }))}
                              className="w-24 h-8"
                            />
                            <span className="text-[10px] text-muted-foreground">dari {a.questionPoints || 0} poin</span>
                            <Button size="sm" className="ml-auto" onClick={() => handleGrade(a.questionId)}>
                              Simpan
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
