"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Backpack } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { showError } from "@/lib/toast";
import { listMyTugas, deadlineLabel, MY_STATUS_LABEL, type Tugas } from "@/lib/tugas";

export default function TugasSayaPage() {
  const router = useRouter();
  const [list, setList] = useState<Tugas[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { data } = await listMyTugas();
      setList(data);
    } catch {
      showError("Gagal memuat tugas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-10 w-64" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Backpack className="text-blue-600" /> Tugas Saya
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tugas dari guru kelas Anda. Kumpulkan sebelum batas waktu.
        </p>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-5xl">🎒</span>
            <p className="font-semibold text-slate-700 dark:text-slate-200">Belum ada tugas</p>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Tugas dari guru akan muncul di sini saat diberikan.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((t, i) => {
            const badge = MY_STATUS_LABEL[t.myStatus || ""];
            const overdue = !!t.dueAt && t.dueAt < Date.now();
            return (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => router.push(`/tugas-saya/detail?id=${t.id}`)}
                className="w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{t.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.subjectName ? `${t.subjectName} · ` : ""}
                      {t.teacherName || "Guru"}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className={overdue && t.myStatus !== "graded" ? "font-semibold text-rose-600" : ""}>
                    {deadlineLabel(t.dueAt)}
                  </span>
                  {t.myStatus === "graded" && t.myScore != null && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      Nilai {t.myScore}
                    </span>
                  )}
                  {t.myIsLate && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                      Terlambat
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
