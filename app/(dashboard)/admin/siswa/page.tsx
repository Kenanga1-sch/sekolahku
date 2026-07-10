"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Users, Printer, ArrowRightLeft, GraduationCap, UserCheck, Loader2 } from "lucide-react";

// Subcomponents
import TabDirektori from "./tab-direktori";
import TabKartu from "./tab-kartu";
import TabMutasi from "./tab-mutasi";
import TabAlumni from "./tab-alumni";
import TabSPMB from "./tab-spmb";

type TabType = "direktori" | "kartu" | "mutasi" | "alumni" | "spmb";

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
      queryTab === "spmb"
    ) {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-100 dark:border-zinc-800 overflow-x-auto whitespace-nowrap scrollbar-none bg-slate-50/50 dark:bg-zinc-950/20 p-1 rounded-xl gap-0.5">
        <button
          onClick={() => setActiveTab("direktori")}
          className={`py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "direktori"
              ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-100/50 dark:hover:bg-zinc-900/30"
          }`}
        >
          <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Direktori Siswa
        </button>
        <button
          onClick={() => setActiveTab("kartu")}
          className={`py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "kartu"
              ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-100/50 dark:hover:bg-zinc-900/30"
          }`}
        >
          <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Cetak Kartu
        </button>
        <button
          onClick={() => setActiveTab("mutasi")}
          className={`py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "mutasi"
              ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-100/50 dark:hover:bg-zinc-900/30"
          }`}
        >
          <ArrowRightLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Mutasi Siswa
        </button>
        <button
          onClick={() => setActiveTab("alumni")}
          className={`py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "alumni"
              ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-100/50 dark:hover:bg-zinc-900/30"
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Buku Induk
        </button>
        <button
          onClick={() => setActiveTab("spmb")}
          className={`py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "spmb"
              ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-100/50 dark:hover:bg-zinc-900/30"
          }`}
        >
          <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Penerimaan (SPMB)
        </button>
      </div>
      
      {/* Tab Contents */}
      <div className="pt-2">
        {activeTab === "direktori" && <TabDirektori />}
        {activeTab === "kartu" && <TabKartu />}
        {activeTab === "mutasi" && <TabMutasi />}
        {activeTab === "alumni" && <TabAlumni />}
        {activeTab === "spmb" && <TabSPMB />}
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
        <p className="text-muted-foreground text-xs sm:text-sm mt-1 max-w-2xl">
          Kelola data siswa aktif, cetak kartu pelajar, mutasi kesiswaan, buku induk & kelulusan, serta penerimaan siswa baru (SPMB).
        </p>
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
