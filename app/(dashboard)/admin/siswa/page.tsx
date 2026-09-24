"use client";

import { useState, useEffect, Suspense, lazy } from "react";
import { useSearchParams } from "next/navigation";
import { Users, Printer, ArrowRightLeft, GraduationCap, UserCheck, Loader2, BookOpen, Sprout, BarChart3, Backpack } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";

const TabDirektori = lazy(() => import("./tab-direktori"));
const TabKartu = lazy(() => import("./tab-kartu"));
const TabMutasi = lazy(() => import("./tab-mutasi"));
const TabAlumni = lazy(() => import("./tab-alumni"));
const TabSPMB = lazy(() => import("./tab-spmb"));
const TabSkrining = lazy(() =>
  import("./_components/skrining-tab").then((m) => ({ default: m.SkriningTab }))
);
const TabAgregat = lazy(() =>
  import("./_components/agregat-skrining-tab").then((m) => ({ default: m.AgregatSkriningTab }))
);
const TabTugas = lazy(() =>
  import("./_components/tugas-tab").then((m) => ({ default: m.TugasTab }))
);
const AkademikTabsContent = lazy(() =>
  import("../akademik/_components/tabs-content").then((mod) => ({ default: mod.AkademikTabsContent }))
);

type TabType = "direktori" | "kartu" | "mutasi" | "alumni" | "spmb" | "akademik" | "skrining" | "agregat" | "tugas";

interface TabDef {
  id: TabType;
  label: string;
  icon: any;
  /** Bila diset, hanya role ini (dan admin/superadmin) yang melihat tab. */
  guruAccess?: boolean;
}

// Tab khusus guru (guru melihat tab ini saja, di samping tab admin bila admin).
const GURU_TABS: TabDef[] = [
  { id: "skrining", label: "Skrining", icon: Sprout, guruAccess: true },
  { id: "agregat", label: "Agregat", icon: BarChart3, guruAccess: true },
  { id: "tugas", label: "Tugas", icon: Backpack, guruAccess: true },
];

const ADMIN_TABS: TabDef[] = [
  { id: "direktori", label: "Direktori Siswa", icon: Users },
  { id: "kartu", label: "Cetak Kartu", icon: Printer },
  { id: "mutasi", label: "Mutasi Siswa", icon: ArrowRightLeft },
  { id: "alumni", label: "Buku Induk", icon: GraduationCap },
  { id: "spmb", label: "SPMB", icon: UserCheck },
  { id: "akademik", label: "Akademik", icon: BookOpen },
  { id: "skrining", label: "Skrining", icon: Sprout, guruAccess: true },
  { id: "agregat", label: "Agregat", icon: BarChart3, guruAccess: true },
  { id: "tugas", label: "Tugas", icon: Backpack, guruAccess: true },
];

const ALL_TAB_IDS: TabType[] = [
  "direktori", "kartu", "mutasi", "alumni", "spmb", "akademik", "skrining", "agregat", "tugas",
];

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
  const { user, isLoading: authLoading } = useAuthStore();

  const role = (user?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "superadmin";
  // Guru hanya boleh tab Skrining/Agregat/Tugas. Role lain (mis. staff)
  // memakai tampilan admin penuh seperti sebelumnya.
  const isGuruOnly = role === "guru";

  const tabs = isGuruOnly ? GURU_TABS : ADMIN_TABS;
  const defaultTab: TabType = isGuruOnly ? "skrining" : "direktori";

  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  // Sinkronkan tab default setelah role diketahui.
  useEffect(() => {
    if (!authLoading) setActiveTab(defaultTab);
  }, [authLoading, defaultTab]);

  useEffect(() => {
    if (queryTab && ALL_TAB_IDS.includes(queryTab)) {
      // Guru tidak boleh membuka tab selain miliknya meski lewat URL.
      if (isGuruOnly && !GURU_TABS.some((t) => t.id === queryTab)) return;
      setActiveTab(queryTab);
    }
  }, [queryTab, isGuruOnly]);

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="relative">
        <div className="flex overflow-x-auto whitespace-nowrap scrollbar-none bg-slate-100/60 dark:bg-zinc-900/40 p-1 rounded-xl gap-1.5 border border-slate-200/40 dark:border-zinc-800/40">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`shrink-0 py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer border ${
                  active
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
        {activeTab === "skrining" && (
          <Suspense fallback={<TabFallback />}>
            <TabSkrining hideHeader />
          </Suspense>
        )}
        {activeTab === "agregat" && (
          <Suspense fallback={<TabFallback />}>
            <TabAgregat hideHeader />
          </Suspense>
        )}
        {activeTab === "tugas" && (
          <Suspense fallback={<TabFallback />}>
            <TabTugas hideHeader />
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
