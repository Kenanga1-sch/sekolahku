"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionList } from "./_components/session-list";
import { GameRunner } from "./_components/game-runner";
import { GameResult } from "./_components/game-result";

function RuangTumbuhContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const attemptId = searchParams.get("attempt");
  const view = searchParams.get("view");

  // Mode hasil: ?view=hasil&attempt=xxx
  if (view === "hasil" && attemptId) {
    return <GameResult attemptId={attemptId} />;
  }

  // Mode bermain: ?session=xxx
  if (sessionId) {
    return <GameRunner sessionId={sessionId} />;
  }

  // Mode default: daftar tantangan aktif
  return <SessionList />;
}

export default function RuangTumbuhPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary">
          🌱 Ruang Tumbuh
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Kenali kemampuanmu, tumbuh bersama.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full rounded-3xl" />
          </div>
        }
      >
        <RuangTumbuhContent />
      </Suspense>
    </div>
  );
}
