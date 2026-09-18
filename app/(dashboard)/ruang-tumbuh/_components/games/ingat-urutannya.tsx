"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GameProps, TrialRecord } from "@/lib/ruang-tumbuh/types";
import { GameShell } from "./game-shell";

// ══════════════════════════════════════════════════════════
// GAME 03 — INGAT URUTANNYA (domain: working memory)
// Sistem menampilkan urutan benda, lalu menghilangkannya. Anak
// harus memilih urutan yang benar. Level 1 = 2 benda … Level 5 = 6
// benda. 2 percobaan per level; berhenti setelah gagal 2x (§13).
// ══════════════════════════════════════════════════════════

const POOL = ["🍎", "🍌", "🍇", "🍊", "🍓", "🥝", "🍉", "🥭"];
const MAX_LEVEL = 5;
const SHOW_MS = 650;
const GAP_MS = 300;
const FEEDBACK_MS = 1200;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function genSequence(len: number): string[] {
  return shuffle(POOL).slice(0, len);
}

type PlayPhase = "tunjuk" | "isi" | "feedback";

export function IngatUrutannya({ onComplete }: GameProps) {
  return (
    <GameShell
      title="Ingat Urutannya"
      emoji="🧠"
      accent="sky"
      instructions={
        <>
          <p>Perhatikan urutan benda yang muncul!</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Setelah benda menghilang, klik benda sesuai urutannya. Urutan makin panjang tiap level!
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
  const [level, setLevel] = useState(1);
  const [attempt, setAttempt] = useState(1);
  const [sequence, setSequence] = useState<string[]>([]);
  const [showIdx, setShowIdx] = useState(-1);
  const [phase, setPhase] = useState<PlayPhase>("tunjuk");
  const [clicks, setClicks] = useState<string[]>([]);
  const [gridItems, setGridItems] = useState<string[]>([]);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const isiStartRef = useRef(0);
  const trialsRef = useRef<TrialRecord[]>([]);
  const trialNoRef = useRef(0);

  // Mulai (atau ulangi) sebuah level: generate urutan baru & tampilkan.
  const startLevel = useCallback((lv: number) => {
    const seq = genSequence(lv + 1);
    setSequence(seq);
    setClicks([]);
    setGridItems(shuffle(seq));
    setShowIdx(-1);
    setLastCorrect(null);
    setPhase("tunjuk");
  }, []);

  useEffect(() => {
    startLevel(level);
  }, [level, startLevel]);

  // Animasi "tunjuk": tampilkan tiap benda satu per satu.
  useEffect(() => {
    if (phase !== "tunjuk") return;
    const len = sequence.length;
    const isShowing = showIdx >= 0 && showIdx < len;
    const delay = isShowing ? SHOW_MS : GAP_MS;
    const t = setTimeout(() => {
      if (showIdx + 1 >= len) {
        isiStartRef.current = performance.now();
        setPhase("isi");
      } else {
        setShowIdx(showIdx + 1);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [phase, showIdx, sequence]);

  const finishTrial = useCallback(
    (correct: boolean, responseClicks: string[]) => {
      trialNoRef.current += 1;
      const rt = Math.round(performance.now() - isiStartRef.current);
      trialsRef.current.push({
        trialNumber: trialNoRef.current,
        level,
        stimulus: JSON.stringify({ sequence }),
        response: responseClicks.join("→") || "-",
        isCorrect: correct,
        reactionTimeMs: rt,
      });
      setLastCorrect(correct);
      setPhase("feedback");
      setTimeout(() => {
        if (correct) {
          if (level >= MAX_LEVEL) {
            submit(trialsRef.current);
          } else {
            setAttempt(1);
            setLevel((l) => l + 1);
          }
        } else if (attempt >= 2) {
          submit(trialsRef.current);
        } else {
          setAttempt(2);
        }
      }, FEEDBACK_MS);
    },
    [level, attempt, sequence, submit],
  );

  const handlePick = (opt: string) => {
    if (phase !== "isi") return;
    const expected = sequence[clicks.length];
    if (opt === expected) {
      const newClicks = [...clicks, opt];
      setClicks(newClicks);
      if (newClicks.length === sequence.length) {
        finishTrial(true, newClicks);
      }
    } else {
      finishTrial(false, clicks);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
          Level {level}/{MAX_LEVEL} — {level + 1} benda
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">Percobaan {attempt}/2</span>
      </div>

      <div
        data-testid="iu-area"
        className="relative flex min-h-[44vh] w-full items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-sky-100 to-emerald-100 dark:from-sky-950 dark:to-emerald-950"
      >
        {phase === "tunjuk" && (
          <AnimatePresence mode="wait">
            {showIdx >= 0 && showIdx < sequence.length ? (
              <motion.div
                key={`${level}-${showIdx}`}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.4, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-7xl"
              >
                {sequence[showIdx]}
              </motion.div>
            ) : (
              <motion.div key="gap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl text-slate-400">
                🫧
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {phase === "isi" && (
          <div data-testid="iu-grid" className="flex flex-wrap items-center justify-center gap-3 p-4">
            {gridItems.map((opt, i) => {
              const clickedIdx = clicks.indexOf(opt);
              const done = clickedIdx >= 0;
              return (
                <motion.button
                  key={`${i}-${opt}`}
                  type="button"
                  onPointerDown={() => handlePick(opt)}
                  whileTap={{ scale: 0.9 }}
                  className={`flex h-16 w-16 select-none items-center justify-center rounded-2xl text-4xl shadow-md transition ${
                    done ? "bg-emerald-500 text-white" : "bg-white hover:scale-105 dark:bg-slate-800"
                  }`}
                >
                  {done ? clickedIdx + 1 : opt}
                </motion.button>
              );
            })}
          </div>
        )}

        {phase === "feedback" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 p-4"
          >
            <span className="text-6xl">{lastCorrect ? "✅" : "🙅"}</span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Urutannya:</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {sequence.map((s, i) => (
                <span
                  key={i}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl shadow dark:bg-slate-800"
                >
                  {s}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </div>
      <p data-testid="iu-hint" className="text-center text-sm text-slate-500 dark:text-slate-400">
        {phase === "tunjuk"
          ? "Perhatikan urutannya…"
          : phase === "isi"
            ? "Sekarang klik sesuai urutannya!"
            : lastCorrect
              ? "Hebat! Lanjut ke level berikutnya."
              : "Belum tepat. Coba perhatikan lagi ya!"}
      </p>
    </div>
  );
}
