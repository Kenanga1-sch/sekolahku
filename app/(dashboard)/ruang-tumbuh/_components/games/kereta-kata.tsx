"use client";

import { KERETA_KATA_ITEMS } from "@/lib/ruang-tumbuh/content-kereta-kata";
import { McqGame } from "./mcq-game";
import type { GameProps } from "@/lib/ruang-tumbuh/types";

// GAME 04 — KERETA KATA (domain: literasi)
// Tugas visual auto-grade: huruf → suku kata → kata → kata kompleks →
// kalimat → pemahaman. Pengukuran kelancaran membaca dilakukan guru
// melalui form observasi (§15: manual sebelum speech recognition).
export function KeretaKata({ onComplete }: GameProps) {
  return (
    <McqGame
      items={KERETA_KATA_ITEMS}
      title="Kereta Kata"
      emoji="📖"
      accent="amber"
      instructions={
        <>
          <p>Pilih jawaban yang paling tepat!</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ada 6 level: dari huruf sampai membaca cerita pendek. Kerjakan santai saja, ya!
          </p>
        </>
      }
      onComplete={onComplete}
    />
  );
}
