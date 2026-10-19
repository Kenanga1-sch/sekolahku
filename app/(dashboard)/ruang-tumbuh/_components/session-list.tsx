"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import { goGet } from "@/lib/api-client";
import { showError } from "@/lib/toast";
import type { MySessionView } from "@/lib/ruang-tumbuh/types";

const GAME_ICON: Record<string, string> = {
  "game-tangkap-target": "🎣",
  "game-jangan-terkecoh": "🛡️",
  "game-ingat-urutannya": "🧠",
  "game-kereta-kata": "📖",
  "game-toko-buah": "🍎",
};

export function SessionList() {
  const router = useRouter();
  const [sessions, setSessions] = useState<MySessionView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await goGet(`/api/student/me/ruang-tumbuh/sessions`);
        if (cancelled) return;
        setSessions(res?.data || []);
      } catch {
        showError("Gagal memuat tantangan");
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
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <motion.div
          animate={{ y: [0, -10, 0], rotate: [0, 6, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="text-6xl"
        >
          🌱
        </motion.div>
        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">Belum ada tantangan</h2>
        <p className="max-w-sm text-slate-500 dark:text-slate-400">
          Tantangan akan muncul di sini setelah guru kamu memulai sesi di kelas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
        <span className="text-2xl">🌟</span>
        <h2 className="text-lg font-bold">Tantangan untuk kamu</h2>
      </div>
      {sessions.map((s, i) => {
        const done = s.myAttemptStatus === "completed";
        return (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => router.push(`/ruang-tumbuh?session=${s.id}`)}
            className="flex w-full items-center gap-4 rounded-3xl bg-gradient-to-r from-sky-50 to-emerald-50 p-5 text-left transition hover:scale-[1.02] hover:shadow-lg active:scale-[0.99] dark:from-sky-950/60 dark:to-emerald-950/60"
          >
            <span className="text-5xl">{GAME_ICON[s.gameId] || "🎮"}</span>
            <div className="flex-1">
              <p className="font-bold text-slate-800 dark:text-slate-100">
                {s.title || s.gameName || "Tantangan"}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {s.className} · {s.gameName}
              </p>
            </div>
            {done ? (
              <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                Selesai ✓
              </span>
            ) : (
              <span className="rounded-full bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow">
                Mulai →
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
