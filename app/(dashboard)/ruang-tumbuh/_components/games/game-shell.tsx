"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { TrialRecord } from "@/lib/ruang-tumbuh/types";

type Phase = "instruksi" | "hitung" | "main" | "selesai";

// GameShell menyediakan alur standar tiap game skrining: layar instruksi
// (§45: ramah anak) → hitungan mundur → area bermain → layar perayaan
// (§44: tanpa perbandingan dengan teman).
export function GameShell({
  title,
  emoji,
  instructions,
  children,
  onFinish,
  accent,
}: {
  title: string;
  emoji: string;
  instructions: React.ReactNode;
  children: (submit: (trials: TrialRecord[]) => void) => React.ReactNode;
  onFinish: (trials: TrialRecord[]) => void;
  accent?: "sky" | "amber" | "violet" | "rose";
}) {
  const [phase, setPhase] = useState<Phase>("instruksi");
  const [countdown, setCountdown] = useState(3);
  const [trials, setTrials] = useState<TrialRecord[] | null>(null);

  const gradients: Record<string, string> = {
    sky: "from-sky-50 to-emerald-50 dark:from-sky-950 dark:to-emerald-950",
    amber: "from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950",
    violet: "from-violet-50 to-fuchsia-50 dark:from-violet-950 dark:to-fuchsia-950",
    rose: "from-rose-50 to-pink-50 dark:from-rose-950 dark:to-pink-950",
  };
  const grad = gradients[accent || "sky"];

  useEffect(() => {
    if (phase !== "hitung") return;
    if (countdown <= 0) {
      setPhase("main");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  const submit = useCallback((t: TrialRecord[]) => {
    setTrials(t);
    setPhase("selesai");
  }, []);

  useEffect(() => {
    if (phase !== "selesai" || !trials) return;
    const t = setTimeout(() => onFinish(trials), 1700);
    return () => clearTimeout(t);
  }, [phase, trials, onFinish]);

  if (phase === "instruksi") {
    return (
      <div className={`flex min-h-[60vh] flex-col items-center justify-center gap-6 rounded-3xl bg-gradient-to-b ${grad} p-8 text-center`}>
        <motion.div
          animate={{ y: [0, -12, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="text-7xl"
        >
          {emoji}
        </motion.div>
        <div>
          <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-100">{title}</h2>
          <div className="mt-3 space-y-2 text-base text-slate-600 dark:text-slate-300">{instructions}</div>
        </div>
        <button
          onClick={() => {
            setCountdown(3);
            setPhase("hitung");
          }}
          className="rounded-full bg-emerald-500 px-12 py-4 text-xl font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-105 hover:bg-emerald-600 active:scale-95"
        >
          Mulai 🚀
        </button>
      </div>
    );
  }

  if (phase === "hitung") {
    return (
      <div className={`flex min-h-[60vh] items-center justify-center rounded-3xl bg-gradient-to-b ${grad}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={countdown}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="text-8xl font-bold text-emerald-600 dark:text-emerald-300"
          >
            {countdown > 0 ? countdown : "Mulai!"}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  if (phase === "selesai") {
    const correct = (trials || []).filter((t) => t.isCorrect).length;
    const total = Math.max(1, (trials || []).length);
    const stars = Math.max(1, Math.round((correct / total) * 3));
    return (
      <div className={`flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-3xl bg-gradient-to-b ${grad} p-8 text-center`}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="text-7xl"
        >
          🌟
        </motion.div>
        <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">Kerja Bagus!</h2>
        <div className="flex gap-2 text-4xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: i < stars ? 1 : 0.4, rotate: 0 }}
              transition={{ delay: 0.15 * i, type: "spring", stiffness: 200 }}
              className={i < stars ? "" : "opacity-30 grayscale"}
            >
              ⭐
            </motion.span>
          ))}
        </div>
        <p className="text-slate-600 dark:text-slate-300">Hasil sedang disimpan…</p>
      </div>
    );
  }

  return <div className="space-y-4">{children(submit)}</div>;
}
