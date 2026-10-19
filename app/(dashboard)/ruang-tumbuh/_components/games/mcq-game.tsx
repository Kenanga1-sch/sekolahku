"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { TrialRecord } from "@/lib/ruang-tumbuh/types";
import { GameShell } from "./game-shell";

// McqGame: runner pertanyaan pilihan ganda bertingkat untuk game literasi
// & numerasi. Setiap jawaban dicatat sebagai trial mentah (§22) lengkap
// dengan level & reaction time; server menghitung metrik + errorBreakpoint.
export function McqGame({
  items,
  title,
  emoji,
  instructions,
  accent,
  onComplete,
}: {
  items: { id: string; level: number; levelName?: string; passage?: string; prompt: string; options: string[]; answer: string }[];
  title: string;
  emoji: string;
  instructions: React.ReactNode;
  accent?: "sky" | "amber" | "violet" | "rose";
  onComplete: (trials: TrialRecord[]) => void;
}) {
  return (
    <GameShell title={title} emoji={emoji} instructions={instructions} accent={accent} onFinish={onComplete}>
      {(submit) => <McqPlay items={items} onFinish={submit} />}
    </GameShell>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function McqPlay({
  items,
  onFinish,
}: {
  items: { id: string; level: number; levelName?: string; passage?: string; prompt: string; options: string[]; answer: string }[];
  onFinish: (trials: TrialRecord[]) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const trialsRef = useRef<TrialRecord[]>([]);
  const itemStartRef = useRef(0);

  const item = items[idx];
  const total = items.length;
  const progress = Math.round((idx / total) * 100);

  // Acak urutan opsi tiap item & mulai timer reaction time.
  useEffect(() => {
    setOptions(shuffle(item.options));
    setPicked(null);
    itemStartRef.current = performance.now();
  }, [idx, item.options]);

  const handlePick = (opt: string) => {
    if (picked) return;
    const rt = Math.round(performance.now() - itemStartRef.current);
    const correct = opt === item.answer;
    trialsRef.current.push({
      trialNumber: idx + 1,
      level: item.level,
      stimulus: JSON.stringify({ itemId: item.id, prompt: item.prompt }),
      response: opt,
      isCorrect: correct,
      reactionTimeMs: rt,
    });
    setPicked(opt);
    const isLast = idx + 1 >= total;
    setTimeout(() => {
      if (isLast) {
        onFinish(trialsRef.current);
      } else {
        setIdx((i) => i + 1);
      }
    }, 750);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
          {item.levelName || `Level ${item.level}`}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {idx + 1} / {total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <motion.div
          className="h-full rounded-full bg-emerald-500"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <motion.div
        key={idx}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900"
      >
        {item.passage && (
          <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm italic text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            “{item.passage}”
          </p>
        )}
        <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{item.prompt}</p>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt) => {
          const isAnswer = opt === item.answer;
          const isPicked = opt === picked;
          let cls =
            "border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800";
          if (picked) {
            if (isAnswer) cls = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40";
            else if (isPicked) cls = "border-rose-400 bg-rose-50 dark:bg-rose-950/40";
            else cls = "border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900";
          }
          return (
            <button
              key={opt}
              type="button"
              disabled={!!picked}
              onClick={() => handlePick(opt)}
              className={`rounded-2xl border-2 p-4 text-center text-lg font-medium text-slate-800 transition active:scale-95 dark:text-slate-100 ${cls}`}
            >
              {opt}
              {picked && isAnswer && <span className="ml-2">✓</span>}
              {isPicked && !isAnswer && <span className="ml-2">✗</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
