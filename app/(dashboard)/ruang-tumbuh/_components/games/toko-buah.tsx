"use client";

import { TOKO_BUAH_ITEMS } from "@/lib/ruang-tumbuh/content-toko-buah";
import { McqGame } from "./mcq-game";
import type { GameProps } from "@/lib/ruang-tumbuh/types";

// GAME 05 — TOKO BUAH (domain: numerasi)
// Soal cerita buah-buahan bertingkat: number sense → operasi dasar →
// soal cerita multi-langkah. Sistem menghitung level kesulitan tempat
// kesalahan mulai meningkat (§16).
export function TokoBuah({ onComplete }: GameProps) {
  return (
    <McqGame
      items={TOKO_BUAH_ITEMS}
      title="Toko Buah"
      emoji="🍎"
      accent="rose"
      instructions={
        <>
          <p>Selesaikan soal-soal di toko buah!</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ada 6 level: dari menghitung buah sampai soal cerita. Hitung pelan-pelan, ya!
          </p>
        </>
      }
      onComplete={onComplete}
    />
  );
}
