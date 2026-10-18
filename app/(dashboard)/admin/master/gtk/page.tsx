"use client";

import { Suspense, lazy } from "react";
import { IdCard, Printer, Loader2 } from "lucide-react";
import { useTabParam } from "@/lib/hooks/use-tab-param";

const TabDirektori = lazy(() => import("./tab-direkturi"));
const TabCetakKartu = lazy(() => import("./tab-cetak-kartu"));

type TabType = "direktori" | "cetak-kartu";

interface TabDef {
  id: TabType;
  label: string;
  icon: typeof IdCard;
}

const TABS: TabDef[] = [
  { id: "direktori", label: "Direktori GTK", icon: IdCard },
  { id: "cetak-kartu", label: "Cetak Kartu", icon: Printer },
];

const ALL_TAB_IDS: TabType[] = ["direktori", "cetak-kartu"];

function TabFallback() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function MasterGTKPage() {
  return (
    <Suspense fallback={<TabFallback />}>
      <GTKTabsContent />
    </Suspense>
  );
}

function GTKTabsContent() {
  // Tab aktif tersimpan di URL (?tab=...) agar tetap terbuka setelah refresh.
  const [activeTab, setActiveTab] = useTabParam<TabType>("direktori", {
    validTabs: ALL_TAB_IDS,
  });

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="relative">
        <div className="flex overflow-x-auto whitespace-nowrap scrollbar-none bg-slate-100/60 dark:bg-zinc-900/40 p-1 rounded-xl gap-1.5 border border-slate-200/40 dark:border-zinc-800/40">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <Suspense fallback={<TabFallback />}>
        {activeTab === "direktori" && <TabDirektori />}
        {activeTab === "cetak-kartu" && <TabCetakKartu />}
      </Suspense>
    </div>
  );
}
