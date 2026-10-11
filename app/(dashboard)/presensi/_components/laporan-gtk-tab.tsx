"use client";

/**
 * Tab Laporan Presensi GTK — laporan bulanan (matriks GTK × tanggal) untuk
 * honorer & pembina ekskul, dengan ekspor Excel/PDF.
 *
 * Data dari GET /api/gtk-attendance/monthly (matriks + hari efektif + libur).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, FileText, RefreshCw, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { showError, showSuccess } from "@/lib/toast";
import { useAuthStore } from "@/lib/stores/auth-store";
import { goGet } from "@/lib/api-client";
import {
  gtkAttendanceApi,
  gtkAttendancePct,
  overallAttendancePct,
  statusLetter,
  dateKey,
  daysInMonth,
  monthName,
  MONTH_NAMES_ID,
  gtkCategoryLabel,
  type GtkMonthlyReport,
} from "@/lib/presensi-gtk";
import { exportMonthlyExcel, exportMonthlyPDF } from "@/lib/presensi-gtk/export";

const STATUS_COLORS: Record<string, string> = {
  H: "text-emerald-600 font-bold",
  S: "text-amber-600 font-bold",
  I: "text-blue-600 font-bold",
  A: "text-rose-600 font-bold",
  "-": "text-slate-300",
};

export function LaporanGtkTab() {
  const { user } = useAuthStore();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [scope, setScope] = useState<"gtk" | "ekskul">("gtk");
  const [report, setReport] = useState<GtkMonthlyReport | null>(null);
  const [schoolName, setSchoolName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await gtkAttendanceApi.monthly(year, month, scope);
      setReport((res?.data as GtkMonthlyReport) || null);
    } catch {
      showError("Gagal memuat laporan bulanan GTK");
    } finally {
      setLoading(false);
    }
  }, [year, month, scope]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    goGet<any>("/api/school-settings")
      .then((res: any) => setSchoolName(res?.data?.school_name || ""))
      .catch(() => {});
  }, []);

  const dayNumbers = useMemo(() => {
    if (!report) return [];
    return Array.from({ length: daysInMonth(report.year, report.month) }, (_, i) => i + 1);
  }, [report]);

  // Peta hari libur → reason, untuk disembunyikan/abu-abu.
  const holidayMap = useMemo(() => {
    const m = new Map<string, string>();
    (report?.holidays || []).forEach((h) => m.set(h.date, h.reason));
    return m;
  }, [report]);

  const handleExcel = async () => {
    if (!report) return;
    setExporting(true);
    try {
      await exportMonthlyExcel(report, { schoolName, scope });
      showSuccess("Excel laporan bulanan diunduh");
    } catch (e: any) {
      showError(e?.message || "Gagal mengunduh Excel");
    } finally {
      setExporting(false);
    }
  };

  const handlePdf = async () => {
    if (!report) return;
    setExporting(true);
    try {
      await exportMonthlyPDF(report, { schoolName, scope });
      showSuccess("PDF laporan bulanan diunduh");
    } catch (e: any) {
      showError(e?.message || "Gagal mengunduh PDF");
    } finally {
      setExporting(false);
    }
  };

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const overall = report ? overallAttendancePct(report.rows, report.effectiveDays) : null;

  return (
    <Card>
      <CardHeader className="p-4 md:p-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" /> Laporan Bulanan Presensi GTK
            </CardTitle>
            <CardDescription>
              {report ? `${report.rows.length} GTK · ${report.effectiveDays} hari efektif` : "Pilih periode"}
              {overall !== null ? ` · Kehadiran ${overall}%` : ""}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Navigasi bulan */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="h-7 border-0 w-[110px] shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES_ID.map((name, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-7 border-0 w-[90px] shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[year - 1, year, year + 1].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Select value={scope} onValueChange={(v) => setScope(v as "gtk" | "ekskul")}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gtk">GTK Harian</SelectItem>
                <SelectItem value="ekskul">Sesi Ekskul</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Muat
            </Button>
            <Button size="sm" onClick={handleExcel} disabled={!report || exporting || report.rows.length === 0}>
              <Download className="h-4 w-4 mr-1.5" /> Excel
            </Button>
            <Button size="sm" variant="outline" onClick={handlePdf} disabled={!report || exporting || report.rows.length === 0}>
              <Download className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !report || report.rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Tidak ada data presensi untuk {monthName(month)} {year}
            {scope === "ekskul" ? " (sesi ekskul)" : ""}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-900">
                  <th className="sticky left-0 z-10 bg-slate-50 dark:bg-zinc-900 border border-slate-200 px-2 py-1.5 text-left font-semibold w-8">No</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold min-w-[160px]">Nama</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold min-w-[120px]">Kepegawaian</th>
                  {dayNumbers.map((d) => {
                    const dk = dateKey(report.year, report.month, d);
                    const holiday = holidayMap.has(dk);
                    return (
                      <th
                        key={d}
                        className={`border border-slate-200 px-1 py-1.5 text-center font-semibold w-6 ${
                          holiday ? "bg-rose-50 text-rose-500" : ""
                        }`}
                        title={holiday ? holidayMap.get(dk) : undefined}
                      >
                        {d}
                      </th>
                    );
                  })}
                  <th className="border border-slate-200 px-1.5 py-1.5 text-center font-semibold w-7 text-emerald-600">H</th>
                  <th className="border border-slate-200 px-1.5 py-1.5 text-center font-semibold w-7 text-amber-600">S</th>
                  <th className="border border-slate-200 px-1.5 py-1.5 text-center font-semibold w-7 text-blue-600">I</th>
                  <th className="border border-slate-200 px-1.5 py-1.5 text-center font-semibold w-7 text-rose-600">A</th>
                  <th className="border border-slate-200 px-1.5 py-1.5 text-center font-semibold w-12">%</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, i) => {
                  const pct = gtkAttendancePct(r, report.effectiveDays);
                  return (
                    <tr key={r.employeeId} className="hover:bg-slate-50/50">
                      <td className="sticky left-0 z-10 bg-white dark:bg-zinc-950 border border-slate-200 px-2 py-1 text-center text-muted-foreground">{i + 1}</td>
                      <td className="border border-slate-200 px-2 py-1">
                        <div className="font-semibold text-slate-800 dark:text-zinc-200">{r.name}</div>
                        {r.nip && <div className="text-[10px] text-muted-foreground">NIP {r.nip}</div>}
                        {r.extracurricular && <div className="text-[10px] text-indigo-600">{r.extracurricular}</div>}
                      </td>
                      <td className="border border-slate-200 px-2 py-1">
                        <Badge variant="outline" className="text-[10px]">{r.employmentStatus || "-"}</Badge>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{gtkCategoryLabel(r.category)}</div>
                      </td>
                      {dayNumbers.map((d) => {
                        const dk = dateKey(report.year, report.month, d);
                        const holiday = holidayMap.has(dk);
                        const letter = holiday ? "" : statusLetter(r.dailyStatus[dk] || "");
                        return (
                          <td
                            key={d}
                            className={`border border-slate-200 px-1 py-1 text-center ${
                              holiday ? "bg-rose-50/40" : ""
                            } ${STATUS_COLORS[letter] || ""}`}
                          >
                            {letter}
                          </td>
                        );
                      })}
                      <td className="border border-slate-200 px-1.5 py-1 text-center font-semibold">{r.totalHadir}</td>
                      <td className="border border-slate-200 px-1.5 py-1 text-center">{r.totalSakit}</td>
                      <td className="border border-slate-200 px-1.5 py-1 text-center">{r.totalIzin}</td>
                      <td className="border border-slate-200 px-1.5 py-1 text-center">{r.totalAlpha}</td>
                      <td className="border border-slate-200 px-1.5 py-1 text-center font-semibold">
                        {pct === null ? "-" : pct}
                      </td>
                    </tr>
                  );
                })}
                {/* Rekap harian */}
                <tr className="bg-slate-100 dark:bg-zinc-900 font-semibold">
                  <td className="sticky left-0 z-10 bg-slate-100 dark:bg-zinc-900 border border-slate-200 px-2 py-1 text-center" colSpan={3}>Jumlah hadir/hari</td>
                  {dayNumbers.map((d) => {
                    const dk = dateKey(report.year, report.month, d);
                    const holiday = holidayMap.has(dk);
                    const count = holiday ? "" : report.rows.filter((r) => r.dailyStatus[dk] === "hadir").length;
                    return (
                      <td key={d} className={`border border-slate-200 px-1 py-1 text-center ${holiday ? "bg-rose-50/40" : ""}`}>
                        {count}
                      </td>
                    );
                  })}
                  <td className="border border-slate-200 px-1.5 py-1 text-center">{report.rows.reduce((n, r) => n + r.totalHadir, 0)}</td>
                  <td className="border border-slate-200 px-1.5 py-1 text-center">{report.rows.reduce((n, r) => n + r.totalSakit, 0)}</td>
                  <td className="border border-slate-200 px-1.5 py-1 text-center">{report.rows.reduce((n, r) => n + r.totalIzin, 0)}</td>
                  <td className="border border-slate-200 px-1.5 py-1 text-center">{report.rows.reduce((n, r) => n + r.totalAlpha, 0)}</td>
                  <td className="border border-slate-200 px-1.5 py-1 text-center">{overall === null ? "-" : overall}</td>
                </tr>
              </tbody>
            </table>

            {report.holidays.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-3 text-[11px] text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="font-semibold">Libur:</span>
                {report.holidays.map((h) => (
                  <Badge key={h.date} variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">
                    {h.date} · {h.reason}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
