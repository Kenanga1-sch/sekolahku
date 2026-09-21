"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, ArrowRight, Library } from "lucide-react";

import TabKelas from "../tab-kelas";
import TabKenaikan from "../tab-kenaikan";
import TabReferensi from "../tab-ref";

type TabType = "kelas" | "kenaikan" | "referensi";

export function AkademikTabsContent() {
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
      <div className="flex border-b border-muted overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("kelas")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-[2px] flex items-center gap-2 shrink-0 ${
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
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-[2px] flex items-center gap-2 shrink-0 ${
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
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-[2px] flex items-center gap-2 shrink-0 ${
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
