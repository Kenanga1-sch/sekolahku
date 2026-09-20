"use client";

import { useEffect, useState } from "react";
import { Sprout, Users, ClipboardCheck, Loader2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { goGet } from "@/lib/api-client";
import { showError } from "@/lib/toast";
import type { ScreeningSession } from "@/lib/ruang-tumbuh/types";
import { DOMAIN_LABELS } from "@/lib/ruang-tumbuh/types";

interface StaffAggregate {
  academicYear?: string;
  totalStudents: number;
  screenedCount: number;
  domainStats: { domain: string; domainLabel: string; attempts: number; avgAccuracy: number }[];
  recentSessions: ScreeningSession[];
}

const GAME_ICON: Record<string, string> = {
  "game-tangkap-target": "🎣",
  "game-jangan-terkecoh": "🛡️",
  "game-ingat-urutannya": "🧠",
  "game-kereta-kata": "📖",
  "game-toko-buah": "🍎",
};

export default function StaffAggregatePage() {
  const [agg, setAgg] = useState<StaffAggregate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await goGet("/api/ruang-tumbuh/aggregate");
        if (cancelled) return;
        // Backend mengirim null (bukan []) saat belum ada sesi sama sekali.
        // Tanpa normalisasi, agg.domainStats.length melempar TypeError dan
        // halaman jatuh ke root error boundary.
        const data = res?.data;
        setAgg(
          data
            ? {
                ...data,
                domainStats: data.domainStats ?? [],
                recentSessions: data.recentSessions ?? [],
              }
            : null,
        );
      } catch {
        showError("Gagal memuat agregat skrining");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!agg) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-slate-500">
            Belum ada data skrining yang terkumpul.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Sprout className="h-6 w-6 text-emerald-500" />
          Agregat Skrining Seluruh Sekolah
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Ringkasan pelaksanaan skrining seluruh kelas
          {agg.academicYear ? ` · Tahun Ajaran ${agg.academicYear}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-slate-500">
              <ClipboardCheck className="h-4 w-4" />
              <span className="text-xs font-medium">Total Sesi</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{agg.totalStudents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Siswa Diskrining</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{agg.screenedCount}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-slate-500">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Domain Diukur</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{agg.domainStats.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Statistik per Domain</CardTitle>
        </CardHeader>
        <CardContent>
          {agg.domainStats.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Belum ada hasil yang terkumpul.</p>
          ) : (
            <div className="space-y-3">
              {agg.domainStats.map((st) => (
                <div key={st.domain}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {st.domainLabel || DOMAIN_LABELS[st.domain] || st.domain}
                    </span>
                    <span className="text-slate-500">
                      {st.attempts} sesi · rata-rata {st.avgAccuracy.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(100, Math.round(st.avgAccuracy))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sesi Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {agg.recentSessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Belum ada sesi.</p>
          ) : (
            <div className="space-y-2">
              {agg.recentSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border bg-white p-3 dark:bg-slate-900"
                >
                  <span className="text-2xl">{GAME_ICON[s.gameId] || "🎮"}</span>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {s.title || s.gameName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {s.gameName} · {s.className} · {s.academicYear}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      s.status === "active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : s.status === "finished"
                          ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {s.status === "active" ? "Berlangsung" : s.status === "finished" ? "Selesai" : "Belum mulai"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
