"use client";

import { Suspense } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { AkademikTabsContent } from "./_components/tabs-content";

export default function AkademikPage() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-zinc-900 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-100/30 dark:border-zinc-800">
            <BookOpen className="h-6 w-6" />
          </div>
          Kelas & Akademik
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pusat kendali administrasi kelas, proses kenaikan dan kelulusan siswa, serta pengelolaan data referensi akademik.
        </p>
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <AkademikTabsContent />
      </Suspense>
    </div>
  );
}
