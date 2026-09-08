"use client";

import { useState, useEffect, Suspense, lazy } from "react";
import { useSearchParams } from "next/navigation";
import { Users, Printer, ArrowRightLeft, GraduationCap, UserCheck, Loader2, BookOpen } from "lucide-react";

const TabDirektori = lazy(() => import("./tab-direktori"));
const TabKartu = lazy(() => import("./tab-kartu"));
const TabMutasi = lazy(() => import("./tab-mutasi"));
const TabAlumni = lazy(() => import("./tab-alumni"));
const TabSPMB = lazy(() => import("./tab-spmb"));
const AkademikTabsContent = lazy(() =>
  import("../akademik/page").then((mod) => ({ default: mod.AkademikTabsContent }))
);

type TabType = "direktori" | "kartu" | "mutasi" | "alumni" | "spmb" | "akademik";

function TabFallback() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function SiswaTabsContent() {
  const searchParams = useSearchParams();
  const queryTab = searchParams.get("tab") as TabType | null;

  const [activeTab, setActiveTab] = useState<TabType>("direktori");

  useEffect(() => {
    if (
      queryTab === "direktori" ||
      queryTab === "kartu" ||
      queryTab === "mutasi" ||
      queryTab === "alumni" ||
      queryTab === "spmb" ||
      queryTab === "akademik"
    ) {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="relative">
        <div className="flex overflow-x-auto whitespace-nowrap scrollbar-none bg-slate-100/60 dark:bg-zinc-900/40 p-1 rounded-xl gap-1.5 border border-slate-200/40 dark:border-zinc-800/40">
          <button
            onClick={() => setActiveTab("direktori")}
          className={`shrink-0 py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer border ${
            activeTab === "direktori"
              ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-sm border-slate-200/80 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-zinc-900/30 border-transparent"
          }`}
        >
          <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Direktori Siswa
        </button>
        <button
          onClick={() => setActiveTab("kartu")}
          className={`shrink-0 py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer border ${
            activeTab === "kartu"
              ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-sm border-slate-200/80 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-zinc-900/30 border-transparent"
          }`}
        >
          <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Cetak Kartu
        </button>
        <button
          onClick={() => setActiveTab("mutasi")}
          className={`shrink-0 py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer border ${
            activeTab === "mutasi"
              ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-sm border-slate-200/80 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-zinc-900/30 border-transparent"
          }`}
        >
          <ArrowRightLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Mutasi Siswa
        </button>
        <button
          onClick={() => setActiveTab("alumni")}
          className={`shrink-0 py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer border ${
            activeTab === "alumni"
              ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-sm border-slate-200/80 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-zinc-900/30 border-transparent"
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Buku Induk
        </button>
        <button
          onClick={() => setActiveTab("spmb")}
          className={`shrink-0 py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer border ${
            activeTab === "spmb"
              ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-sm border-slate-200/80 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-zinc-900/30 border-transparent"
          }`}
        >
          <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          SPMB
        </button>
        <button
          onClick={() => setActiveTab("akademik")}
          className={`shrink-0 py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer border ${
            activeTab === "akademik"
              ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-sm border-slate-200/80 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-zinc-900/30 border-transparent"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Akademik
        </button>
        </div>
        {/* Scroll fade indicator (mobile) */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-slate-100 dark:from-zinc-900 to-transparent sm:hidden" aria-hidden="true" />
      </div>
      
      {/* Tab Contents — lazy loaded */}
      <div className="pt-2">
        {activeTab === "direktori" && (
          <Suspense fallback={<TabFallback />}>
            <TabDirektori />
          </Suspense>
        )}
        {activeTab === "kartu" && (
          <Suspense fallback={<TabFallback />}>
            <TabKartu />
          </Suspense>
        )}
        {activeTab === "mutasi" && (
          <Suspense fallback={<TabFallback />}>
            <TabMutasi />
          </Suspense>
        )}
        {activeTab === "alumni" && (
          <Suspense fallback={<TabFallback />}>
            <TabAlumni />
          </Suspense>
        )}
        {activeTab === "spmb" && (
          <Suspense fallback={<TabFallback />}>
            <TabSPMB />
          </Suspense>
        )}
        {activeTab === "akademik" && (
          <Suspense fallback={<TabFallback />}>
            <div className="bg-white dark:bg-zinc-950 rounded-xl p-4 sm:p-6 border border-slate-200/60 dark:border-zinc-800">
              <AkademikTabsContent />
            </div>
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default function ManajemenSiswaPage() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2.5">
          <div className="p-1.5 sm:p-2 bg-blue-50 dark:bg-zinc-900 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-100/30 dark:border-zinc-800 shrink-0">
            <Users className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          Manajemen Siswa
        </h1>
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <SiswaTabsContent />
      </Suspense>
    </div>
  );
}
