"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Monitor,
  CalendarPlus,
  ClipboardCheck,
  Gauge,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StationsTab } from "./_components/stations-tab";
import { BookingsTab } from "./_components/bookings-tab";
import { ReportsTab } from "./_components/reports-tab";
import { QuotasTab } from "./_components/quotas-tab";
import { HistoryTab } from "./_components/history-tab";

export default function KomputerPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <Link href="/perpustakaan" className="shrink-0">
          <Button variant="ghost" size="icon" aria-label="Kembali ke perpustakaan">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">Komputer Belajar</h1>
          <p className="text-muted-foreground text-sm">
            Kelola jadwal, kuota, dan verifikasi laporan baca siswa.
          </p>
        </div>
      </div>

      <Tabs defaultValue="stations" className="space-y-4">
        <TabsList className="w-full h-auto justify-start gap-1 overflow-x-auto scrollbar-none whitespace-nowrap sm:grid sm:grid-cols-5">
          <TabsTrigger value="stations" className="gap-1.5 shrink-0">
            <Monitor className="h-4 w-4" /> Komputer
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-1.5 shrink-0">
            <CalendarPlus className="h-4 w-4" /> Jadwal
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5 shrink-0">
            <ClipboardCheck className="h-4 w-4" /> Laporan
          </TabsTrigger>
          <TabsTrigger value="quotas" className="gap-1.5 shrink-0">
            <Gauge className="h-4 w-4" /> Kuota
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 shrink-0">
            <History className="h-4 w-4" /> Riwayat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stations">
          <StationsTab />
        </TabsContent>
        <TabsContent value="bookings">
          <BookingsTab />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="quotas">
          <QuotasTab />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
