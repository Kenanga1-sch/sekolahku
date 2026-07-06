"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, ArrowRight, Library, Loader2 } from "lucide-react";

// Subcomponents
import TabKelas from "./tab-kelas";
import TabKenaikan from "./tab-kenaikan";
import TabReferensi from "./tab-ref";

type TabType = "kelas" | "kenaikan" | "referensi";

function AkademikTabsContent() {
  const searchParams = useSearchParams();
  const queryTab = searchParams.get("tab") as TabType | null;

  const [activeTab, setActiveTab] = useState<TabType>("kelas");

  useEffect(() => {
    if (queryTab === "kelas" || queryTab === "kenaikan" || queryTab === "referensi") {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="flex border-b border-muted">
        <button
          onClick={() => setActiveTab("kelas")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-[2px] flex items-center gap-2 ${
            activeTab === "kelas"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Data Kelas
        </button>
        <button
          onClick={() => setActiveTab("kenaikan")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-[2px] flex items-center gap-2 ${
            activeTab === "kenaikan"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ArrowRight className="h-4 w-4" />
          Kenaikan & Kelulusan
        </button>
        <button
          onClick={() => setActiveTab("referensi")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-[2px] flex items-center gap-2 ${
            activeTab === "referensi"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Library className="h-4 w-4" />
          Referensi Akademik
        </button>
      </div>

      {/* Tab Contents */}
      <div className="pt-2">
        {activeTab === "kelas" && <TabKelas />}
        {activeTab === "kenaikan" && <TabKenaikan />}
        {activeTab === "referensi" && <TabReferensi />}
      </div>
    </div>
  );
}

export default function AkademikPage() {
  return (
    <div className="p-6 space-y-6">
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
