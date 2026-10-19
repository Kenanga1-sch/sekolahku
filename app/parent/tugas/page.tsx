"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Backpack } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { goGet } from "@/lib/api-client";
import { showError } from "@/lib/toast";
import { deadlineLabel, listChildrenTugas, MY_STATUS_LABEL, type Tugas } from "@/lib/tugas";

interface Child {
  studentId: string;
  fullName: string;
  className?: string;
}

export default function ParentTugasPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [studentId, setStudentId] = useState("");
  const [list, setList] = useState<Tugas[]>([]);
  const [loading, setLoading] = useState(true);
  const [childLoading, setChildLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await goGet("/api/parent/children");
        const c: Child[] = res?.data || [];
        if (cancelled) return;
        setChildren(c);
        if (c.length && !studentId) setStudentId(c[0].studentId);
      } catch {
        showError("Gagal memuat daftar anak");
      } finally {
        if (!cancelled) setChildLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTugas = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      setList(await listChildrenTugas(studentId));
    } catch {
      showError("Gagal memuat tugas anak");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchTugas();
  }, [fetchTugas]);

  if (childLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-10 w-64" />
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl p-4 md:p-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-5xl">🎒</span>
            <p className="font-semibold text-slate-700 dark:text-slate-200">Belum ada anak terhubung</p>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Hubungkan akun anak Anda dengan sekolah untuk memantau tugas.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Backpack className="text-blue-600" /> Tugas Anak
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Pantau tugas dan batas waktu yang diberikan guru kelas anak Anda.
        </p>
      </div>

      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => (
            <button
              key={c.studentId}
              type="button"
              onClick={() => setStudentId(c.studentId)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                studentId === c.studentId
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-slate-300"
              }`}
            >
              {c.fullName}
              {c.className ? ` · ${c.className}` : ""}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-5xl">📚</span>
            <p className="font-semibold text-slate-700 dark:text-slate-200">Belum ada tugas</p>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Tugas yang diberikan guru akan muncul di sini.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((t, i) => {
            const badge = MY_STATUS_LABEL[t.myStatus || ""];
            const overdue = !!t.dueAt && t.dueAt < Date.now();
            return (
              <motion.div
                key={`${t.studentId}-${t.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900"
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
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
