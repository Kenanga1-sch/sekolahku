"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GameProps, TrialRecord } from "@/lib/ruang-tumbuh/types";
import { GameShell } from "./game-shell";

// ══════════════════════════════════════════════════════════
// GAME 02 — JANGAN TERKECOH (domain: inhibitory control)
// Aturan: klik HANYA gambar target. Tahan respons pada gambar lain.
// Merekam: correct response, false response, omission, RT (§12).
// ══════════════════════════════════════════════════════════

const POOL = ["🍎", "🐟", "⭐", "🌸", "🪁", "🧁", "🐞", "🌊"];
const TRIALS_PER_WAVE = 7;
const TOTAL_WAVES = 3;
const TOTAL_TRIALS = TRIALS_PER_WAVE * TOTAL_WAVES;
const WAVE_DURATIONS = [1200, 1000, 850]; // ms per stimulus, makin cepat
const FEEDBACK_MS = 400;
const TARGET_RATE = 0.6; // 60% stimulus adalah target

const WAVES = [
  { target: "🍎", label: "apel" },
  { target: "🐟", label: "ikan" },
  { target: "⭐", label: "bintang" },
];

type Feedback = { type: "benar" | "salah" | "lewat"; emoji: string } | null;

export function JanganTerkecoh({ onComplete }: GameProps) {
  return (
    <GameShell
      title="Jangan Terkecoh"
      emoji="🛡️"
      accent="violet"
      instructions={
        <>
          <p>Klik hanya gambar yang sesuai aturan!</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Aturan bisa berubah-ubah tiap putaran. Gambar muncul cepat — tahan diri pada gambar yang salah! Ada {TOTAL_TRIALS} putaran.
          </p>
        </>
      }
      onFinish={onComplete}
    >
      {(submit) => <Play submit={submit} />}
    </GameShell>
  );
}

function Play({ submit }: { submit: (trials: TrialRecord[]) => void }) {
  const [trialNo, setTrialNo] = useState(1);
  const [stimulus, setStimulus] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const trialsRef = useRef<TrialRecord[]>([]);
  const stimulusStartRef = useRef(0);
  const trialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wave = Math.min(TOTAL_WAVES, Math.ceil(trialNo / TRIALS_PER_WAVE));
  const { target, label } = WAVES[wave - 1];
  const duration = WAVE_DURATIONS[wave - 1];

  const judge = useCallback(
    (emoji: string, isTarget: boolean, clicked: boolean) => {
      if (trialTimerRef.current) clearTimeout(trialTimerRef.current);
      const rt = clicked ? Math.round(performance.now() - stimulusStartRef.current) : 0;
      trialsRef.current.push({
        trialNumber: trialNo,
        level: wave,
        stimulus: JSON.stringify({ target, shown: emoji }),
        response: clicked ? emoji : "",
        isCorrect: clicked ? isTarget : !isTarget, // klik target = benar; tahan pada non-target = benar
        reactionTimeMs: rt,
      });
      setFeedback(clicked ? { type: isTarget ? "benar" : "salah", emoji } : { type: isTarget ? "lewat" : "benar", emoji });
      const finished = trialsRef.current.length >= TOTAL_TRIALS;
      setTimeout(() => {
        if (finished) {
          submit(trialsRef.current);
        } else {
          setFeedback(null);
          setTrialNo((n) => n + 1);
        }
      }, FEEDBACK_MS);
    },
    [trialNo, wave, target, submit],
  );

  // Tampilkan satu stimulus per trial.
  const runTrial = useCallback(
    (no: number) => {
      const w = Math.min(TOTAL_WAVES, Math.ceil(no / TRIALS_PER_WAVE));
      const isTarget = Math.random() < TARGET_RATE;
      const emoji = isTarget
        ? WAVES[w - 1].target
        : POOL.filter((e) => e !== WAVES[w - 1].target)[Math.floor(Math.random() * (POOL.length - 1))];
      setStimulus(emoji);
      setFeedback(null);
      stimulusStartRef.current = performance.now();
      trialTimerRef.current = setTimeout(() => {
        // Tidak diklik tepat waktu: omission bila target, benar bila distraktor.
        judge(emoji, isTarget, false);
      }, WAVE_DURATIONS[w - 1]);
    },
    [judge],
  );

  useEffect(() => {
    runTrial(trialNo);
    return () => {
      if (trialTimerRef.current) clearTimeout(trialTimerRef.current);
    };
  }, [trialNo, runTrial]);

  const handleClick = () => {
    if (!stimulus || feedback) return;
    const isTarget = stimulus === target;
    judge(stimulus, isTarget, true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
          Putaran {trialNo}/{TOTAL_TRIALS}
        </span>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
          Cepat {wave}/{TOTAL_WAVES}
        </span>
      </div>

      {/* Aturan wave berjalan (§12: target vs non-target) */}
      <div className="flex items-center justify-center gap-2 rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Klik hanya:</span>
        <span className="text-3xl">{target}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">({label})</span>
      </div>

      <div
        data-testid="jt-area"
        className="relative flex h-[52vh] min-h-[300px] w-full touch-none items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-violet-100 via-fuchsia-50 to-pink-100 dark:from-violet-950 dark:via-fuchsia-950 dark:to-pink-950"
        onPointerDown={handleClick}
      >
        <AnimatePresence mode="wait">
          {stimulus && !feedback && (
            <motion.div
              key={`${trialNo}-${stimulus}`}
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="text-7xl"
            >
              {stimulus}
            </motion.div>
          )}
        </AnimatePresence>

        {feedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`pointer-events-none absolute inset-0 flex items-center justify-center ${
              feedback.type === "benar"
                ? "bg-emerald-400/20"
                : feedback.type === "salah"
                  ? "bg-rose-400/20"
                  : "bg-amber-400/20"
            }`}
          >
            <span className="text-6xl">
              {feedback.type === "benar" ? "✅" : feedback.type === "salah" ? "🙅" : "⏰"}
            </span>
          </motion.div>
        )}
      </div>
      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        Ketuk di mana saja pada kotak hanya jika {label} {target} yang muncul.
      </p>
    </div>
  );
}
