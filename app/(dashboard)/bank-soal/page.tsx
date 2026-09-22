"use client";

import React, { Suspense, useState, useEffect } from "react";
import { BookOpen, Layers, HelpCircle, FileStack, Printer, FolderOpen, ClipboardCheck, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const TabBab = React.lazy(() => import("./tab-bab"));
const TabBank = React.lazy(() => import("./tab-bank"));
const TabSoal = React.lazy(() => import("./tab-soal"));
const TabPaket = React.lazy(() => import("./tab-paket"));
const TabCetak = React.lazy(() => import("./tab-cetak"));
const TabPenilaian = React.lazy(() => import("./tab-penilaian"));
const TabAnalitik = React.lazy(() => import("./tab-analitik"));

const tabs = [
  { id: "bab", label: "Bab / Chapter", icon: Layers },
  { id: "bank", label: "Bank Soal", icon: FolderOpen },
  { id: "soal", label: "Kelola Soal", icon: HelpCircle },
  { id: "paket", label: "Paket Soal", icon: FileStack },
  { id: "cetak", label: "Cetak Soal", icon: Printer },
  { id: "penilaian", label: "Penilaian", icon: ClipboardCheck },
  { id: "analitik", label: "Analitik", icon: BarChart3 },
];

function TabSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function BankSoalPage() {
  const [activeTab, setActiveTab] = useState("bab");

  // Buka tab spesifik via hash (mis. /bank-soal#bank) untuk deep-link
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && tabs.some((t) => t.id === hash)) {
      setActiveTab(hash);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 dark:border-zinc-800/60 pb-4">
        <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
            Bank Soal
          </h1>
          <p className="text-xs text-muted-foreground">
            Kelola soal, bab, dan paket soal untuk latihan dan ujian
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-zinc-800 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[2px] whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Suspense fallback={<TabSkeleton />}>
        {activeTab === "bab" && <TabBab />}
        {activeTab === "bank" && <TabBank />}
        {activeTab === "soal" && <TabSoal />}
        {activeTab === "paket" && <TabPaket />}
        {activeTab === "cetak" && <TabCetak />}
        {activeTab === "penilaian" && <TabPenilaian />}
        {activeTab === "analitik" && <TabAnalitik />}
      </Suspense>
    </div>
  );
}
