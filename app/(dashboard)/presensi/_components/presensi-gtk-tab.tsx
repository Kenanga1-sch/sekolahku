"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { goGet } from "@/lib/api-client";
import { showError } from "@/lib/toast";
import { formatNamaGtk } from "@/lib/gtk-name";

type GtkRow = {
  employeeId: string;
  name: string;
  category: string;
  nip: string;
  date: string;
  status: string;
  checkIn: string;
};

const statusLabel = (s: string) => {
  switch (s) {
    case "hadir": return { text: "Hadir", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "sakit": return { text: "Sakit", cls: "bg-sky-50 text-sky-700 border-sky-200" };
    case "izin": return { text: "Izin", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    case "alpha": return { text: "Alpha", cls: "bg-rose-50 text-rose-700 border-rose-200" };
    default: return { text: "Belum absen", cls: "bg-slate-50 text-slate-500 border-slate-200" };
  }
};

const categoryLabel = (c: string) => {
  switch (c) {
    case "kepsek": return "Kepala Sekolah";
    case "guru": return "Guru";
    case "staff": return "Staff TU";
    case "support": return "Tenaga Support";
    default: return "GTK";
  }
};

export function PresensiGtkTab() {
  const [rows, setRows] = useState<GtkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await goGet(`/api/gtk-attendance/daily?date=${today}`);
      setRows(res?.data || []);
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
              {hadir} dari {rows.length} GTK hadir. Scan kartu GTK di menu Scan Harian untuk mencatat kehadiran.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Memuat...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Belum ada data GTK.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {rows.map((r) => {
              const st = statusLabel(r.status);
              return (
                <div key={r.employeeId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{formatNamaGtk(r.name, null)}</p>
                    <p className="text-xs text-muted-foreground">{categoryLabel(r.category)}{r.nip ? ` · NIP ${r.nip}` : ""}</p>
                  </div>
                  <Badge variant="outline" className={`text-[11px] ${st.cls}`}>{st.text}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
