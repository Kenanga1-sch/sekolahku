"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TrialRecord } from "@/lib/ruang-tumbuh/types";

// ══════════════════════════════════════════════════════════
// GAME 01 — TANGKAP TARGET (domain: perhatian)
// Anak harus mengklik target yang ditentukan di antara benda
// bergerak. Merekam: benar/salah/terlewat + reaction time.
// ══════════════════════════════════════════════════════════

const TARGET_EMOJI = "🐟";
const DISTRACTOR_POOL = ["🔴", "🟡", "🟢", "🔵", "🟣", "🐠", "🐙", "🦈", "🐢", "🐬", "🦭", "🐡"];

const TRIALS_PER_WAVE = 5;
const TOTAL_WAVES = 3;
const TOTAL_TRIALS = TRIALS_PER_WAVE * TOTAL_WAVES;
const TRIAL_TIMEOUT_MS = 2800;
const FEEDBACK_MS = 380;

type Phase = "instruksi" | "hitung" | "main" | "selesai";
type Feedback = { type: "benar" | "salah" | "lewat"; emoji: string } | null;

interface Item {
  key: string;
  emoji: string;
  isTarget: boolean;
  x: number; // %
  y: number; // %
  vx: number;
  vy: number;
}

function pickDistractors(count: number): string[] {
  const pool = [...DISTRACTOR_POOL];
  const out: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function spawnItems(level: number): Item[] {
  const count = 5 + level; // wave 1: 6, wave 2: 7, wave 3: 8
  const distractors = pickDistractors(count - 1);
  const emojis = [TARGET_EMOJI, ...distractors];
  // Acak posisi awal; pastikan tidak menumpuk terlalu dekat (upaya sederhana).
  const items: Item[] = emojis.map((emoji, i) => {
    const speed = 0.22 + level * 0.09; // makin cepat tiap wave
    const angle = Math.random() * Math.PI * 2;
    return {
      key: `${i}-${emoji}`,
      emoji,
      isTarget: emoji === TARGET_EMOJI,
      x: 4 + Math.random() * 84,
      y: 6 + Math.random() * 64,
      vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
      vy: Math.sin(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
    };
  });
  return items;
}

export function TangkapTarget({ onComplete }: { attemptId: string; onComplete: (trials: TrialRecord[]) => void }) {
  const [phase, setPhase] = useState<Phase>("instruksi");
  const [countdown, setCountdown] = useState(3);
  const [trialNo, setTrialNo] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [stars, setStars] = useState(0);
  const trialsRef = useRef<TrialRecord[]>([]);
  const trialStartRef = useRef<number>(0);
  const animRef = useRef<number | null>(null);
  const trialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const level = Math.min(TOTAL_WAVES, Math.ceil(trialNo / TRIALS_PER_WAVE));

  const endGame = useCallback(() => {
    onComplete(trialsRef.current);
  }, [onComplete]);

  // Satu percobaan: munculkan item, mulai timer, jalankan animasi.
  const runTrial = useCallback(
    (no: number) => {
      const lv = Math.min(TOTAL_WAVES, Math.ceil(no / TRIALS_PER_WAVE));
      const spawned = spawnItems(lv);
      setItems(spawned);
      setFeedback(null);
      trialStartRef.current = performance.now();

      // Animasi gerak benda.
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(2.5, (now - last) / 16.67); // normalisasi ke 60fps
        last = now;
        setItems((prev) =>
          prev.map((it) => {
            let nx = it.x + it.vx * dt;
            let ny = it.y + it.vy * dt;
            let { vx, vy } = it;
            if (nx <= 0 || nx >= 90) {
              vx = -vx;
              nx = Math.max(0, Math.min(90, nx));
            }
            if (ny <= 0 || ny >= 78) {
              vy = -vy;
              ny = Math.max(0, Math.min(78, ny));
            }
            return { ...it, x: nx, y: ny, vx, vy };
          }),
        );
        animRef.current = requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);

      // Timeout: target terlewat.
      trialTimerRef.current = setTimeout(() => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        trialsRef.current.push({
          trialNumber: no,
          level: lv,
          stimulus: JSON.stringify({ target: TARGET_EMOJI, itemCount: spawned.length }),
          response: "",
          isCorrect: false,
          reactionTimeMs: 0,
        });
        setFeedback({ type: "lewat", emoji: "🐟" });
        setTimeout(() => advance(no), FEEDBACK_MS);
      }, TRIAL_TIMEOUT_MS);
    },
    [],
  );

  const advance = useCallback(
    (currentNo: number) => {
      const next = currentNo + 1;
      setFeedback(null);
      if (next > TOTAL_TRIALS) {
        setPhase("selesai");
        return;
      }
      setTrialNo(next);
      runTrial(next);
    },
    [runTrial],
  );

  // Mulai hitungan mundur sebelum trial pertama.
  useEffect(() => {
    if (phase !== "hitung") return;
    if (countdown <= 0) {
      setPhase("main");
      runTrial(1);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [phase, countdown, runTrial]);

  // Saat selesai: kumpulkan bintang & panggil onComplete.
  useEffect(() => {
    if (phase !== "selesai") return;
    const correct = trialsRef.current.filter((t) => t.isCorrect).length;
    setStars(Math.max(1, Math.round((correct / TOTAL_TRIALS) * 3)));
    const t = setTimeout(() => endGame(), 1600);
    return () => clearTimeout(t);
  }, [phase, endGame]);

  // Cleanup saat unmount.
  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (trialTimerRef.current) clearTimeout(trialTimerRef.current);
    };
  }, []);

  const handleItemClick = (item: Item) => {
    if (phase !== "main" || feedback) return;
    if (trialTimerRef.current) clearTimeout(trialTimerRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const rt = Math.round(performance.now() - trialStartRef.current);
    const lv = Math.min(TOTAL_WAVES, Math.ceil(trialNo / TRIALS_PER_WAVE));
    trialsRef.current.push({
      trialNumber: trialNo,
      level: lv,
      stimulus: JSON.stringify({ target: TARGET_EMOJI }),
      response: item.emoji,
      isCorrect: item.isTarget,
      reactionTimeMs: rt,
    });
    setFeedback({ type: item.isTarget ? "benar" : "salah", emoji: item.emoji });
    setTimeout(() => advance(trialNo), FEEDBACK_MS);
  };

  // ── Layar instruksi (§45: ramah anak, sedikit teks, tombol besar) ──
  if (phase === "instruksi") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 rounded-3xl bg-gradient-to-b from-sky-50 to-emerald-50 p-8 text-center dark:from-sky-950 dark:to-emerald-950">
        <motion.div
          animate={{ y: [0, -12, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="text-7xl"
        >
          🎣
        </motion.div>
        <div>
          <h2 className="text-2xl font-bold text-sky-700 dark:text-sky-300">Tangkap Target</h2>
          <p className="mt-3 text-lg text-slate-700 dark:text-slate-200">
            Klik hanya <span className="text-3xl">{TARGET_EMOJI}</span> yang berenang!
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Jangan klik benda lain, ya. Ada {TOTAL_TRIALS} kali kesempatan.
          </p>
        </div>
        <button
          onClick={() => {
            setCountdown(3);
            setPhase("hitung");
          }}
          className="rounded-full bg-sky-500 px-12 py-4 text-xl font-bold text-white shadow-lg shadow-sky-500/40 transition hover:scale-105 hover:bg-sky-600 active:scale-95"
        >
          Mulai 🚀
        </button>
      </div>
    );
  }

  // ── Hitungan mundur ──
  if (phase === "hitung") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-3xl bg-gradient-to-b from-sky-50 to-emerald-50 dark:from-sky-950 dark:to-emerald-950">
        <AnimatePresence mode="wait">
          <motion.div
            key={countdown}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="text-8xl font-bold text-sky-600 dark:text-sky-300"
          >
            {countdown > 0 ? countdown : "Mulai!"}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ── Layar selesai (tanpa skor perbandingan, §44) ──
  if (phase === "selesai") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-3xl bg-gradient-to-b from-emerald-50 to-sky-50 p-8 text-center dark:from-emerald-950 dark:to-sky-950">
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

  // ── Area bermain ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span className="rounded-full bg-sky-100 px-3 py-1 dark:bg-sky-900/50">Wave {level}/{TOTAL_WAVES}</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 dark:bg-emerald-900/50">
            Percobaan {trialNo}/{TOTAL_TRIALS}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Klik <span className="text-xl">{TARGET_EMOJI}</span> saja!
        </p>
      </div>

      <div className="relative h-[58vh] min-h-[340px] w-full touch-none overflow-hidden rounded-3xl bg-gradient-to-b from-cyan-100 via-sky-100 to-blue-100 dark:from-cyan-950 dark:via-sky-950 dark:to-blue-950">
        {/* gelembung dekoratif */}
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className="pointer-events-none absolute rounded-full bg-white/20"
            style={{
              width: `${10 + i * 7}px`,
              height: `${10 + i * 7}px`,
              left: `${8 + i * 15}%`,
              top: `${70 + ((i * 5) % 24)}%`,
            }}
          />
        ))}

        {items.map((item) => (
          <motion.button
            key={item.key}
            type="button"
            onPointerDown={() => handleItemClick(item)}
            className="absolute flex h-14 w-14 select-none items-center justify-center text-3xl transition-transform hover:scale-110 active:scale-95 sm:h-16 sm:w-16 sm:text-4xl"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            aria-label={item.isTarget ? "target" : "distraktor"}
            disabled={!!feedback}
          >
            {item.emoji}
          </motion.button>
        ))}

        <AnimatePresence>
          {feedback && (
            <motion.div
              key={`${trialNo}-${feedback.type}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`pointer-events-none absolute inset-0 flex items-center justify-center ${
                feedback.type === "benar"
                  ? "bg-emerald-400/25"
                  : feedback.type === "salah"
                    ? "bg-rose-400/25"
                    : "bg-amber-400/25"
              }`}
            >
              <motion.div
                initial={{ scale: 0.3 }}
                animate={{ scale: 1 }}
                className="text-6xl"
              >
                {feedback.type === "benar" ? "✅" : feedback.type === "salah" ? "🙅" : "⏰"}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
