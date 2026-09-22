"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, TrendingUp, TrendingDown, Users, Target, Clock } from "lucide-react";
import { goGet } from "@/lib/api-client";
import { showError } from "@/lib/toast";

interface QuestionSet {
  id: string;
  name: string;
  mode: string;
  itemCount?: number;
}

interface ScoreBucket {
  label: string;
  count: number;
}

interface ItemAnalysis {
  questionId: string;
  content: string;
  type: string;
  difficulty: string;
  bloomLevel?: string;
  totalAnswered: number;
  correctCount: number;
  correctRate: number;
  flag: string;
}

interface SetAnalytics {
  setId: string;
  setName: string;
  attemptCount: number;
  studentCount: number;
  averageScore: number;
  averageMax: number;
  averagePercent: number;
  highestPercent: number;
  lowestPercent: number;
  passRate: number;
  pendingEssays: number;
  scoreBuckets: ScoreBucket[];
  items: ItemAnalysis[];
}

const TYPE_LABELS: Record<string, string> = {
  pg_single: "PG Tunggal",
  pg_multi: "PG Multi",
  true_false: "B/S",
  fill_blank: "Isian",
  matching: "Menyambung",
  pair_match: "Menjodohkan",
  essay: "Esai",
};

const FLAG_META: Record<string, { label: string; className: string }> = {
  too_easy: { label: "Terlalu mudah", className: "bg-blue-100 text-blue-700" },
  too_hard: { label: "Terlalu sulit", className: "bg-red-100 text-red-700" },
  ok: { label: "Ideal", className: "bg-emerald-100 text-emerald-700" },
  insufficient_data: { label: "Data kurang", className: "bg-slate-100 text-slate-600" },
};

function StatCard({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={`h-3.5 w-3.5 ${tone || ""}`} />
          {label}
        </div>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function TabAnalitik() {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [selectedSet, setSelectedSet] = useState("");
  const [analytics, setAnalytics] = useState<SetAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSetsLoading, setIsSetsLoading] = useState(true);

  const fetchSets = useCallback(async () => {
    setIsSetsLoading(true);
    try {
      const res: any = await goGet("/api/bank-soal/sets?limit=100");
      setSets(res?.data || []);
    } catch {
      showError("Gagal memuat daftar paket");
    } finally {
      setIsSetsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  const fetchAnalytics = useCallback(async (setId: string) => {
    setIsLoading(true);
    try {
      const res: any = await goGet(`/api/bank-soal/sets/${setId}/analytics`);
      setAnalytics(res?.data || null);
    } catch {
      showError("Gagal memuat analitik");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSet) fetchAnalytics(selectedSet);
  }, [selectedSet, fetchAnalytics]);

  const maxBucket = analytics ? Math.max(1, ...analytics.scoreBuckets.map((b) => b.count)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold">Analitik & Analisis Soal</h2>
          <p className="text-xs text-muted-foreground">
            Lihat performa kelas dan kualitas tiap soal dari paket ujian/latihan
          </p>
        </div>
        <Select value={selectedSet} onValueChange={setSelectedSet}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder={isSetsLoading ? "Memuat..." : "Pilih Paket Soal"} />
          </SelectTrigger>
          <SelectContent>
            {sets.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} {s.mode === "ujian" ? "(Ujian)" : "(Latihan)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedSet ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BarChart3 className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Pilih paket soal untuk melihat analitik</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : !analytics || analytics.attemptCount === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Clock className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Belum ada data pengerjaan</p>
            <p className="text-xs">Analitik muncul setelah siswa mengerjakan paket ini</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            <StatCard
              icon={Target}
              label="Rata-rata Nilai"
              value={`${analytics.averagePercent.toFixed(0)}%`}
              sub={`${analytics.averageScore.toFixed(0)} / ${analytics.averageMax.toFixed(0)}`}
              tone="text-blue-600"
            />
            <StatCard
              icon={Users}
              label="Peserta"
              value={`${analytics.studentCount}`}
              sub={`${analytics.attemptCount} percobaan selesai`}
              tone="text-emerald-600"
            />
            <StatCard
              icon={TrendingUp}
              label="Ketuntasan (≥70%)"
              value={`${analytics.passRate.toFixed(0)}%`}
              sub={`${analytics.attemptCount} sesi`}
              tone="text-emerald-600"
            />
            <StatCard
              icon={TrendingUp}
              label="Tertinggi"
              value={`${analytics.highestPercent.toFixed(0)}%`}
              tone="text-emerald-600"
            />
            <StatCard
              icon={TrendingDown}
              label="Terendah"
              value={`${analytics.lowestPercent.toFixed(0)}%`}
              tone="text-red-600"
            />
            <StatCard
              icon={Clock}
              label="Esai Menunggu"
              value={`${analytics.pendingEssays}`}
              sub="jawaban belum dikoreksi"
              tone="text-amber-600"
            />
          </div>

          {/* Histogram */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribusi Nilai</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.scoreBuckets.map((b) => (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">{b.label}</span>
                    <div className="flex-1 h-5 bg-slate-100 dark:bg-zinc-800 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded transition-all"
                        style={{ width: `${(b.count / maxBucket) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-8 text-right shrink-0">{b.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Item analysis */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Analisis Butir Soal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {analytics.items.map((it) => {
                const flag = FLAG_META[it.flag] || FLAG_META.ok;
                return (
                  <div
                    key={it.questionId}
                    className="p-3 rounded-lg border bg-white dark:bg-zinc-950 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm line-clamp-2 flex-1">{it.content}</p>
                      <Badge className={`${flag.className} shrink-0`}>{flag.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <Badge variant="outline">{TYPE_LABELS[it.type] || it.type}</Badge>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700">
                        {it.difficulty === "easy" ? "Mudah" : it.difficulty === "hard" ? "Sulit" : "Sedang"}
                      </Badge>
                      {it.bloomLevel && (
                        <Badge variant="outline" className="bg-cyan-50 text-cyan-700">
                          {it.bloomLevel}
                        </Badge>
                      )}
                      <span className="text-muted-foreground">
                        {it.correctCount}/{it.totalAnswered} benar
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-zinc-800 rounded overflow-hidden">
                        <div
                          className={`h-full rounded ${
                            it.flag === "too_hard" ? "bg-red-500" : it.flag === "too_easy" ? "bg-blue-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${it.correctRate}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right shrink-0">
                        {it.correctRate.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
