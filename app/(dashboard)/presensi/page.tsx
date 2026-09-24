"use client";

/**
 * Halaman Presensi — pembungkus tab.
 *
 * Tab: Ringkasan (dashboard harian), Pengajuan Izin, Laporan, Hari Libur.
 * Deep-link via ?tab=. Halaman mandiri lama (/presensi/pengajuan, /laporan,
 * /holidays) tetap ada dan merender komponen tab yang sama.
 */

import { useState, useEffect, Suspense, lazy } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, CalendarDays, FileText, Loader2, LayoutDashboard } from "lucide-react";

const PresensiDashboardTab = lazy(() =>
  import("./_components/presensi-dashboard-tab").then((m) => ({ default: m.PresensiDashboardTab }))
);
const PengajuanIzinTab = lazy(() =>
  import("./_components/pengajuan-izin-tab").then((m) => ({ default: m.PengajuanIzinTab }))
);
const LaporanPresensiTab = lazy(() =>
  import("./_components/laporan-presensi-tab").then((m) => ({ default: m.LaporanPresensiTab }))
);
const HariLiburTab = lazy(() =>
  import("./_components/hari-libur-tab").then((m) => ({ default: m.HariLiburTab }))
);

type TabType = "ringkasan" | "pengajuan" | "laporan" | "libur";

const TABS: { id: TabType; label: string; icon: any }[] = [
  { id: "ringkasan", label: "Ringkasan", icon: LayoutDashboard },
  { id: "pengajuan", label: "Pengajuan Izin", icon: CalendarDays },
  { id: "laporan", label: "Laporan", icon: FileText },
  { id: "libur", label: "Hari Libur", icon: CalendarDays },
];

function TabFallback() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function PresensiTabsContent() {
  const searchParams = useSearchParams();
  const queryTab = searchParams.get("tab") as TabType | null;

  const [activeTab, setActiveTab] = useState<TabType>("ringkasan");

  useEffect(() => {
    if (queryTab === "ringkasan" || queryTab === "pengajuan" || queryTab === "laporan" || queryTab === "libur") {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="relative">
        <div className="flex overflow-x-auto whitespace-nowrap scrollbar-none bg-slate-100/60 dark:bg-zinc-900/40 p-1 rounded-xl gap-1.5 border border-slate-200/40 dark:border-zinc-800/40">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`shrink-0 py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer border ${
                  activeTab === t.id
                    ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-sm border-slate-200/80 dark:border-zinc-800"
                    : "text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-zinc-900/30 border-transparent"
                }`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-slate-100 dark:from-zinc-900 to-transparent sm:hidden" aria-hidden="true" />
      </div>

      <div className="pt-2">
        {activeTab === "ringkasan" && (
          <Suspense fallback={<TabFallback />}>
            <PresensiDashboardTab />
          </Suspense>
        )}
        {activeTab === "pengajuan" && (
          <Suspense fallback={<TabFallback />}>
            <PengajuanIzinTab hideHeader />
          </Suspense>
        )}
        {activeTab === "laporan" && (
          <Suspense fallback={<TabFallback />}>
            <LaporanPresensiTab hideHeader />
          </Suspense>
        )}
        {activeTab === "libur" && (
          <Suspense fallback={<TabFallback />}>
            <HariLiburTab hideHeader />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default function PresensiPage() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2.5">
          <div className="p-1.5 sm:p-2 bg-blue-50 dark:bg-zinc-900 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-100/30 dark:border-zinc-800 shrink-0">
            <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          Presensi
        </h1>
      </div>

      <Suspense fallback={<TabFallback />}>
        <PresensiTabsContent />
      </Suspense>
    </div>
  );
}
