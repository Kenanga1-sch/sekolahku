"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { Sprout } from "lucide-react";
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
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        icon={Sprout}
        title="Ruang Tumbuh"
        description="Kenali kemampuanmu dan tumbuh bersama."
      />
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
