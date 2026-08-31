"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";

import TabMutasiMasuk from "./TabMutasiMasuk";
import TabMutasiKeluar from "./TabMutasiKeluar";
import TabBukuMutasi from "./TabBukuMutasi";

type MutasiTab = "masuk" | "keluar" | "buku";

const TABS: { key: MutasiTab; label: string; content: React.ReactNode }[] = [
  { key: "masuk", label: "Mutasi Masuk", content: <TabMutasiMasuk /> },
  { key: "keluar", label: "Mutasi Keluar", content: <TabMutasiKeluar /> },
  { key: "buku", label: "Buku Mutasi", content: <TabBukuMutasi /> },
];

export default function TabMutasi() {
  const [activeTab, setActiveTab] = useState<MutasiTab>("masuk");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" /> Kelola Mutasi Siswa
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
            Manajemen permohonan mutasi masuk dan mutasi keluar siswa.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto whitespace-nowrap scrollbar-none bg-slate-100/60 dark:bg-zinc-900/40 p-1 rounded-xl gap-1.5 border border-slate-200/40 dark:border-zinc-800/40 max-w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 py-1.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer border ${
              activeTab === tab.key
                ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-sm border-slate-200/80 dark:border-zinc-800"
                : "text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-zinc-900/30 border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {TABS.find((t) => t.key === activeTab)?.content}
    </div>
  );
}

