"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { goGet, goPost } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import {
  type MySessionView,
  type ScreeningAttempt,
  type TrialRecord,
  collectDeviceInfo,
} from "@/lib/ruang-tumbuh/types";
import { TangkapTarget } from "./games/tangkap-target";
import { JanganTerkecoh } from "./games/jangan-terkecoh";
import { IngatUrutannya } from "./games/ingat-urutannya";
import { KeretaKata } from "./games/kereta-kata";
import { TokoBuah } from "./games/toko-buah";

const GAME_BY_ID: Record<string, React.ComponentType<{ attemptId: string; onComplete: (trials: TrialRecord[]) => void }>> = {
  "game-tangkap-target": TangkapTarget,
  "game-jangan-terkecoh": JanganTerkecoh,
  "game-ingat-urutannya": IngatUrutannya,
  "game-kereta-kata": KeretaKata,
  "game-toko-buah": TokoBuah,
};

export function GameRunner({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<MySessionView | null>(null);
  const [attempt, setAttempt] = useState<ScreeningAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 1. Ambil info sesi, lalu mulai/melanjutkan attempt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await goGet(`/api/student/me/ruang-tumbuh/sessions`);
        const sessions: MySessionView[] = res?.data || [];
        const found = sessions.find((s) => s.id === sessionId);
        if (!found) {
          showError("Tantangan tidak ditemukan atau sudah selesai");
          router.replace("/ruang-tumbuh");
          return;
        }
        if (found.myAttemptStatus === "completed") {
          router.replace(`/ruang-tumbuh?view=hasil&attempt=${found.myAttemptId}`);
          return;
        }
        if (cancelled) return;
        setSession(found);

        const startRes: any = await goPost(`/api/student/me/ruang-tumbuh/sessions/${sessionId}/start`);
        if (cancelled) return;
        setAttempt(startRes?.data || null);
      } catch {
        showError("Gagal memuat tantangan");
        router.replace("/ruang-tumbuh");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  // 2. Kirim trial mentah ke server saat game selesai.
  const handleComplete = useCallback(
    async (trials: TrialRecord[]) => {
      if (submitting || !attempt) return;
      setSubmitting(true);
      try {
        const device = collectDeviceInfo();
        const res: any = await goPost(`/api/student/me/ruang-tumbuh/attempts/${attempt.id}/submit`, {
          trials,
          ...device,
        });
        const attemptId = res?.data?.attemptId || attempt.id;
        showSuccess("Hasil tersimpan!");
        router.replace(`/ruang-tumbuh?view=hasil&attempt=${attemptId}`);
      } catch {
        showError("Gagal menyimpan hasil. Coba lagi, ya!");
        setSubmitting(false);
      }
    },
    [attempt, submitting, router],
  );

  if (loading || !session) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[58vh] w-full rounded-3xl" />
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="rounded-2xl bg-amber-50 p-6 text-center dark:bg-amber-950/50">
        <p className="text-amber-700 dark:text-amber-300">Tantangan belum bisa dimulai. Hubungi guru kamu, ya.</p>
      </div>
    );
  }

  const GameComponent = GAME_BY_ID[session.gameId];

  if (!GameComponent) {
    return (
      <div className="rounded-2xl bg-amber-50 p-6 text-center dark:bg-amber-950/50">
        <p className="text-amber-700 dark:text-amber-300">Permainan ini belum tersedia. Tunggu update selanjutnya, ya!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {submitting && (
        <div className="rounded-xl bg-sky-50 p-3 text-center text-sm text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
          Menyimpan hasil permainan…
        </div>
      )}
      <GameComponent attemptId={attempt.id} onComplete={handleComplete} />
    </div>
  );
}
