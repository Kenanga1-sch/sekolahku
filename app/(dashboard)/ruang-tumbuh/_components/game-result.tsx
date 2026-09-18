"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { goGet } from "@/lib/api-client";
import { showError } from "@/lib/toast";
import type { ScreeningResult } from "@/lib/ruang-tumbuh/types";

// Layar hasil untuk siswa: ramah anak, tanpa perbandingan dengan teman,
// dan tanpa label diagnosis (§44, §45). Hanya menunjukkan usahanya sendiri.
export function GameResult({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await goGet(`/api/student/me/ruang-tumbuh/attempts/${attemptId}/result`);
        if (cancelled) return;
        setResult(res?.data || null);
      } catch {
        showError("Hasil belum tersedia");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  if (loading) {
    return <Skeleton className="h-72 w-full rounded-3xl" />;
  }

  if (!result) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <span className="text-5xl">🤔</span>
        <p className="text-slate-600 dark:text-slate-300">Hasil belum ditemukan.</p>
        <Button onClick={() => router.push("/ruang-tumbuh")}>Kembali</Button>
      </div>
    );
  }

  const { correct, totalTrials, missed } = result.metrics;
  const stars = Math.max(1, Math.round((correct / Math.max(1, totalTrials)) * 3));

  return (
    <div className="mx-auto max-w-lg">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        className="flex flex-col items-center gap-5 rounded-3xl bg-gradient-to-b from-emerald-50 to-sky-50 p-8 text-center dark:from-emerald-950/60 dark:to-sky-950/60"
      >
        <span className="text-7xl">🌈</span>
        <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">Hebat sekali!</h2>
        <div className="flex gap-2 text-4xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: i < stars ? 1 : 0.5, rotate: 0 }}
              transition={{ delay: 0.2 + 0.15 * i, type: "spring", stiffness: 200 }}
              className={i < stars ? "" : "opacity-30 grayscale"}
            >
              ⭐
            </motion.span>
          ))}
        </div>
        <p className="text-slate-700 dark:text-slate-200">
          Kamu berhasil menangkap <b>{correct}</b> target dengan benar dari {totalTrials} kesempatan!
        </p>
        {missed > 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ada {missed} target yang terlewat — tidak apa-apa, kamu pasti bisa lebih baik lain kali!
          </p>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Kamu tidak sedang diuji — ini hanya untuk membantu guru memahami cara belajarmu.
        </p>
        <Button
          size="lg"
          className="rounded-full px-10"
          onClick={() => router.push("/ruang-tumbuh")}
        >
          Selesai
        </Button>
      </motion.div>
    </div>
  );
}
