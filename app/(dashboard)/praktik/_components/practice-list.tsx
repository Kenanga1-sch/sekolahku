"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, FileStack, Play, CheckCircle2, Timer, Shuffle } from "lucide-react";
import { goGet, goPost } from "@/lib/api-client";
import { showError } from "@/lib/toast";

interface QuestionSet {
  id: string;
  name: string;
  bankId: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  timerMinutes?: number;
  bankTitle?: string;
  itemCount?: number;
}

interface Practice {
  id: string;
  setId: string;
  setName?: string;
  totalScore: number;
  maxScore: number;
  isCompleted: boolean;
  attemptNumber: number;
  createdAt?: number;
}

export function PracticeList() {
  const router = useRouter();
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);

  const fetchSets = useCallback(async () => {
    setIsLoading(true);
    try {
      const result: any = await goGet("/api/student/me/sets?limit=100");
      setSets(result?.data || []);
    } catch {
      showError("Gagal memuat paket soal");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchPractices = async () => {
    try {
      const result: any = await goGet("/api/student/me/practices?limit=100");
      setPractices(result?.data || []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchSets();
    fetchPractices();
  }, [fetchSets]);

  const handleStartPractice = async (setId: string) => {
    setStartingId(setId);
    try {
      const result: any = await goPost("/api/student/me/practices", { setId });
      if (result?.data?.id) {
        router.push(`/praktik?id=${result.data.id}`);
      }
    } catch {
      showError("Gagal memulai praktik");
    } finally {
      setStartingId(null);
    }
  };

  const getPracticeForSet = (setId: string) => practices.filter((p) => p.setId === setId);

  const getBestScore = (setId: string) => {
    const setPractices = getPracticeForSet(setId).filter((p) => p.isCompleted && p.maxScore > 0);
    if (setPractices.length === 0) return null;
    return setPractices.reduce(
      (best, p) => (p.totalScore / p.maxScore > best.totalScore / best.maxScore ? p : best),
      setPractices[0]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Paket Soal Tersedia</h2>
        <p className="text-xs text-muted-foreground">Pilih paket soal untuk mulai berlatih</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : sets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileStack className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Belum ada paket soal</p>
            <p className="text-xs">Guru Anda belum membuat paket soal</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sets.map((set) => {
            const bestScore = getBestScore(set.id);
            const attemptCount = getPracticeForSet(set.id).length;
            const isStarting = startingId === set.id;

            return (
              <Card key={set.id} className="hover:border-emerald-300 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{set.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{set.bankTitle || "Bank Soal"}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">{set.itemCount || 0} soal</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {set.shuffleQuestions && (
                      <Badge className="bg-purple-100 text-purple-700 gap-1">
                        <Shuffle className="h-3 w-3" /> Acak Soal
                      </Badge>
                    )}
                    {set.timerMinutes && (
                      <Badge className="bg-amber-100 text-amber-700 gap-1">
                        <Timer className="h-3 w-3" /> {set.timerMinutes} mnt
                      </Badge>
                    )}
                  </div>

                  {bestScore && bestScore.maxScore > 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-2 text-xs">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          Skor terbaik: {bestScore.totalScore}/{bestScore.maxScore} ({Math.round((bestScore.totalScore / bestScore.maxScore) * 100)}%)
                        </span>
                      </div>
                      <p className="text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">{attemptCount}x mengerjakan</p>
                    </div>
                  )}

                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleStartPractice(set.id)}
                    disabled={isStarting || (set.itemCount || 0) === 0}
                  >
                    {isStarting ? "Memuat..." : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        {bestScore ? "Kerjakan Ulang" : "Mulai Berlatih"}
                      </>
                    )}
                  </Button>
                  {(set.itemCount || 0) === 0 && (
                    <p className="text-[10px] text-amber-600 text-center">Paket ini belum berisi soal</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {practices.length > 0 && (
        <div className="space-y-4 pt-6 border-t">
          <h3 className="text-lg font-bold">Riwayat Praktik</h3>
          <div className="space-y-2">
            {practices.slice(0, 10).map((p) => (
              <Card
                key={p.id}
                className="hover:border-emerald-300 transition-colors cursor-pointer"
                onClick={() => router.push(p.isCompleted ? `/praktik?view=hasil&id=${p.id}` : `/praktik?id=${p.id}`)}
              >
                <CardContent className="flex items-center gap-4 p-3">
                  <div className={`p-2 rounded-lg ${p.isCompleted ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                    {p.isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.setName || "Paket Soal"}</p>
                    <p className="text-xs text-muted-foreground">
                      Percobaan #{p.attemptNumber}
                      {p.isCompleted && p.maxScore > 0 && ` • Skor: ${p.totalScore}/${p.maxScore}`}
                    </p>
                  </div>
                  {p.isCompleted && p.maxScore > 0 && (
                    <Badge className={p.totalScore / p.maxScore >= 0.7 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                      {Math.round((p.totalScore / p.maxScore) * 100)}%
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
