"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, IdCard, MapPin, QrCode, Award } from "lucide-react";
import { showError } from "@/lib/toast";
import { formatNamaGtk } from "@/lib/gtk-name";
import {
  gtkAttendanceApi,
  gtkStatusLabel,
  gtkCategoryLabel,
  formatDistance,
  type GtkAttendanceRow,
} from "@/lib/presensi-gtk";
import { useTabParam } from "@/lib/hooks/use-tab-param";

type GtkSubTab = "gtk" | "ekskul";

const GTK_SUB_TABS: GtkSubTab[] = ["gtk", "ekskul"];

function AttendanceList({ rows, empty }: { rows: GtkAttendanceRow[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="divide-y divide-slate-100 dark:divide-zinc-800">
      {rows.map((r, i) => {
        const st = gtkStatusLabel(r.status);
        return (
          <div key={`${r.employeeId}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 dark:text-zinc-200 truncate">
                {formatNamaGtk(r.name, null)}
              </p>
              <p className="text-xs text-muted-foreground">
                {gtkCategoryLabel(r.category)}
                {r.nip ? ` · NIP ${r.nip}` : ""}
                {r.employmentStatus ? ` · ${r.employmentStatus}` : ""}
                {r.extracurricularName ? ` · ${r.extracurricularName}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {r.distanceM != null && (
                <Badge
                  variant="outline"
                  className={`text-[11px] gap-1 ${
                    r.withinRadius === false
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  <MapPin className="h-3 w-3" /> {formatDistance(r.distanceM)}
                </Badge>
              )}
              <Badge variant="outline" className={`text-[11px] ${st.className}`}>
                {st.text}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PresensiGtkTab() {
  // Sub-tab tersimpan di URL (?gtab=...) agar tetap terbuka setelah refresh.
  const [activeTab, setActiveTab] = useTabParam<GtkSubTab>("gtk", {
    param: "gtab",
    validTabs: GTK_SUB_TABS,
  });
  const [rows, setRows] = useState<GtkAttendanceRow[]>([]);
  const [ekskulRows, setEkskulRows] = useState<GtkAttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [daily, eks] = await Promise.all([
        gtkAttendanceApi.daily(today),
        gtkAttendanceApi.ekskulDaily(today),
      ]);
      setRows((daily as any)?.data || []);
      setEkskulRows((eks as any)?.data || []);
    } catch {
      showError("Gagal memuat presensi GTK");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const hadir = rows.filter((r) => r.status === "hadir").length;

  return (
    <Card>
      <CardHeader className="p-4 md:p-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Presensi GTK — {today}</CardTitle>
            <CardDescription>
              {hadir} dari {rows.length} GTK wajib presensi hadir. Hanya honorer (GTT/GTY/Honorer/PTT) &
              Pembina Ekskul; PNS/PPPK dikecualikan.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" className="font-semibold">
              <Link href="/presensi/scan-gtk">
                <QrCode className="h-4 w-4 mr-2" /> Scan GTK
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Memuat...</p>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as GtkSubTab)} className="w-full">
            <div className="px-4 pt-4">
              <TabsList>
                <TabsTrigger value="gtk" className="gap-1.5">
                  <IdCard className="h-3.5 w-3.5" /> GTK Harian
                </TabsTrigger>
                <TabsTrigger value="ekskul" className="gap-1.5">
                  <Award className="h-3.5 w-3.5" /> Sesi Ekskul
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="gtk" className="mt-2">
              <AttendanceList rows={rows} empty="Belum ada GTK wajib presensi hari ini." />
            </TabsContent>
            <TabsContent value="ekskul" className="mt-2">
              <AttendanceList rows={ekskulRows} empty="Belum ada presensi sesi ekskul hari ini." />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
