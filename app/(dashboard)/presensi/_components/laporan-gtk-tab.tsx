"use client";

/**
 * Tab Laporan Presensi GTK — honorer & pembina ekskul.
 *
 * Dua mode:
 *  - Bulanan: matriks GTK × tanggal (GET /api/gtk-attendance/monthly).
 *  - Tahunan/Semester: rekap agregat rentang bulan (GET /api/gtk-attendance/range).
 * Ekspor Excel/PDF (PDF menyertakan blok tanda tangan kepala sekolah).
 * Baris dengan kehadiran < 75% ditandai peringatan.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Download,
  FileText,
  RefreshCw,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Table2,
  CalendarRange,
} from "lucide-react";
import { showError, showSuccess } from "@/lib/toast";
import { goGet } from "@/lib/api-client";
import { useTabParam } from "@/lib/hooks/use-tab-param";
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
  annualAttendancePct,
  overallAnnualPct,
  isBelowThreshold,
  monthRangeLabel,
  SEMESTERS,
  ATTENDANCE_WARNING_THRESHOLD,
  type GtkMonthlyReport,
  type GtkAnnualReport,
} from "@/lib/presensi-gtk";
import {
  exportMonthlyExcel,
  exportMonthlyPDF,
  exportRangeExcel,
  exportRangePDF,
} from "@/lib/presensi-gtk/export";

const STATUS_COLORS: Record<string, string> = {
  H: "text-emerald-600 font-bold",
  S: "text-amber-600 font-bold",
  I: "text-blue-600 font-bold",
  A: "text-rose-600 font-bold",
  "-": "text-slate-300",
};

interface SchoolInfo {
  schoolName: string;
  principalName: string;
  principalNip: string;
  city: string;
}

export function LaporanGtkTab() {
  const now = new Date();
  // Tab tersimpan di URL (?mgtk=...) agar tetap terbuka setelah refresh.
  const [mode, setMode] = useTabParam<"bulanan" | "rentang">("bulanan", {
    param: "mgtk",
    validTabs: ["bulanan", "rentang"],
  });
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [semester, setSemester] = useState<keyof typeof SEMESTERS>("ganjil");
  const [scope, setScope] = useState<"gtk" | "ekskul">("gtk");
  const [report, setReport] = useState<GtkMonthlyReport | null>(null);
  const [annual, setAnnual] = useState<GtkAnnualReport | null>(null);
  const [school, setSchool] = useState<SchoolInfo>({ schoolName: "", principalName: "", principalNip: "", city: "" });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const sem = SEMESTERS[semester];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === "bulanan") {
        const res: any = await gtkAttendanceApi.monthly(year, month, scope);
        setReport((res?.data as GtkMonthlyReport) || null);
      } else {
        const res: any = await gtkAttendanceApi.range(year, sem.startMonth, sem.endMonth, scope);
        setAnnual((res?.data as GtkAnnualReport) || null);
      }
    } catch {
      showError("Gagal memuat laporan GTK");
    } finally {
      setLoading(false);
    }
  }, [mode, year, month, sem.startMonth, sem.endMonth, scope]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    goGet<any>("/api/school-settings")
      .then((res: any) => {
        const d = res?.data || {};
        setSchool({
          schoolName: d.school_name || "",
          principalName: d.principal_name || "",
          principalNip: d.principal_nip || "",
          city: (d.school_address || "").split(",")[0] || "",
        });
      })
      .catch(() => {});
  }, []);

  const dayNumbers = useMemo(() => {
    if (!report) return [];
    return Array.from({ length: daysInMonth(report.year, report.month) }, (_, i) => i + 1);
  }, [report]);

  const holidayMap = useMemo(() => {
    const m = new Map<string, string>();
    (report?.holidays || []).forEach((h) => m.set(h.date, h.reason));
    return m;
  }, [report]);

  const pdfMeta = useMemo(
    () => ({
      schoolName: school.schoolName,
      scope,
      principalName: school.principalName,
      principalNip: school.principalNip,
      city: school.city,
    }),
    [school, scope]
  );

  const run = async (fn: () => Promise<void>, label: string) => {
    setExporting(true);
    try {
      await fn();
      showSuccess(`${label} diunduh`);
    } catch (e: any) {
      showError(e?.message || `Gagal mengunduh ${label}`);
    } finally {
      setExporting(false);
    }
  };

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; } else if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const monthlyOverall = report ? overallAttendancePct(report.rows, report.effectiveDays) : null;
  const annualOverall = annual ? overallAnnualPct(annual.rows, annual.effectiveDays) : null;
  const belowThresholdCount = useMemo(() => {
    if (mode === "bulanan" && report) {
      return report.rows.filter((r) => isBelowThreshold(gtkAttendancePct(r, report.effectiveDays))).length;
    }
    if (mode === "rentang" && annual) {
      return annual.rows.filter((r) => isBelowThreshold(annualAttendancePct(r))).length;
    }
    return 0;
  }, [mode, report, annual]);

  const canExport = mode === "bulanan" ? !!report && report.rows.length > 0 : !!annual && annual.rows.length > 0;

  return (
    <Card>
      <CardHeader className="p-4 md:p-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" /> Laporan Presensi GTK
            </CardTitle>
            <CardDescription>
              {mode === "bulanan"
                ? report
                  ? `${report.rows.length} GTK · ${report.effectiveDays} hari efektif`
                  : "Pilih periode"
                : annual
                ? `${annual.rows.length} GTK · ${annual.effectiveDays} hari efektif`
                : "Pilih periode"}
              {mode === "bulanan" && monthlyOverall !== null ? ` · Kehadiran ${monthlyOverall}%` : ""}
              {mode === "rentang" && annualOverall !== null ? ` · Kehadiran ${annualOverall}%` : ""}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Mode */}
            <Tabs value={mode} onValueChange={(v) => setMode(v as "bulanan" | "rentang")}>
              <TabsList className="h-8">
                <TabsTrigger value="bulanan" className="text-xs gap-1"><Table2 className="h-3.5 w-3.5" /> Bulanan</TabsTrigger>
                <TabsTrigger value="rentang" className="text-xs gap-1"><CalendarRange className="h-3.5 w-3.5" /> Tahun/Semester</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Pemilih periode */}
            {mode === "bulanan" ? (
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="h-7 border-0 w-[110px] shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES_ID.map((name, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="h-7 border-0 w-[90px] shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[year - 1, year, year + 1].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Select value={semester} onValueChange={(v) => setSemester(v as keyof typeof SEMESTERS)}>
                  <SelectTrigger className="w-[190px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ganjil">{SEMESTERS.ganjil.label}</SelectItem>
                    <SelectItem value="genap">{SEMESTERS.genap.label}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="w-[90px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[year - 1, year, year + 1].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Select value={scope} onValueChange={(v) => setScope(v as "gtk" | "ekskul")}>
              <SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gtk">GTK Harian</SelectItem>
                <SelectItem value="ekskul">Sesi Ekskul</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Muat
            </Button>
            <Button
              size="sm"
              disabled={!canExport || exporting}
              onClick={() =>
                mode === "bulanan"
                  ? run(() => exportMonthlyExcel(report!, pdfMeta), "Excel")
                  : run(() => exportRangeExcel(annual!, pdfMeta), "Excel")
              }
            >
              <Download className="h-4 w-4 mr-1.5" /> Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canExport || exporting}
              onClick={() =>
                mode === "bulanan"
                  ? run(() => exportMonthlyPDF(report!, pdfMeta), "PDF")
                  : run(() => exportRangePDF(annual!, pdfMeta), "PDF")
              }
            >
              <Download className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        </div>

        {belowThresholdCount > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <b>{belowThresholdCount} GTK</b> memiliki kehadiran di bawah {ATTENDANCE_WARNING_THRESHOLD}% pada periode ini.
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : mode === "bulanan" ? (
          !report || report.rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Tidak ada data presensi untuk {monthName(month)} {year}{scope === "ekskul" ? " (sesi ekskul)" : ""}.
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
                        <th key={d} className={`border border-slate-200 px-1 py-1.5 text-center font-semibold w-6 ${holiday ? "bg-rose-50 text-rose-500" : ""}`} title={holiday ? holidayMap.get(dk) : undefined}>
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
                    const warn = isBelowThreshold(pct);
                    return (
                      <tr key={r.employeeId} className={warn ? "bg-rose-50/40" : "hover:bg-slate-50/50"}>
                        <td className="sticky left-0 z-10 bg-white dark:bg-zinc-950 border border-slate-200 px-2 py-1 text-center text-muted-foreground">{i + 1}</td>
                        <td className="border border-slate-200 px-2 py-1">
                          <div className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1">
                            {r.name}
                            {warn && <AlertTriangle className="h-3 w-3 text-rose-500" />}
                          </div>
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
                            <td key={d} className={`border border-slate-200 px-1 py-1 text-center ${holiday ? "bg-rose-50/40" : ""} ${STATUS_COLORS[letter] || ""}`}>
                              {letter}
                            </td>
                          );
                        })}
                        <td className="border border-slate-200 px-1.5 py-1 text-center font-semibold">{r.totalHadir}</td>
                        <td className="border border-slate-200 px-1.5 py-1 text-center">{r.totalSakit}</td>
                        <td className="border border-slate-200 px-1.5 py-1 text-center">{r.totalIzin}</td>
                        <td className="border border-slate-200 px-1.5 py-1 text-center">{r.totalAlpha}</td>
                        <td className={`border border-slate-200 px-1.5 py-1 text-center font-semibold ${warn ? "text-rose-600" : ""}`}>
                          {pct === null ? "-" : pct}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-100 dark:bg-zinc-900 font-semibold">
                    <td className="sticky left-0 z-10 bg-slate-100 dark:bg-zinc-900 border border-slate-200 px-2 py-1 text-center" colSpan={3}>Jumlah hadir/hari</td>
                    {dayNumbers.map((d) => {
                      const dk = dateKey(report.year, report.month, d);
                      const holiday = holidayMap.has(dk);
                      const count = holiday ? "" : report.rows.filter((r) => r.dailyStatus[dk] === "hadir").length;
                      return <td key={d} className={`border border-slate-200 px-1 py-1 text-center ${holiday ? "bg-rose-50/40" : ""}`}>{count}</td>;
                    })}
                    <td className="border border-slate-200 px-1.5 py-1 text-center">{report.rows.reduce((n, r) => n + r.totalHadir, 0)}</td>
                    <td className="border border-slate-200 px-1.5 py-1 text-center">{report.rows.reduce((n, r) => n + r.totalSakit, 0)}</td>
                    <td className="border border-slate-200 px-1.5 py-1 text-center">{report.rows.reduce((n, r) => n + r.totalIzin, 0)}</td>
                    <td className="border border-slate-200 px-1.5 py-1 text-center">{report.rows.reduce((n, r) => n + r.totalAlpha, 0)}</td>
                    <td className="border border-slate-200 px-1.5 py-1 text-center">{monthlyOverall === null ? "-" : monthlyOverall}</td>
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
          )
        ) : !annual || annual.rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Tidak ada data presensi untuk {monthRangeLabel(sem.startMonth, sem.endMonth, year)}{scope === "ekskul" ? " (sesi ekskul)" : ""}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-900">
                  <th className="border border-slate-200 px-2 py-2 text-left font-semibold w-10">No</th>
                  <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Nama</th>
                  <th className="border border-slate-200 px-2 py-2 text-left font-semibold">Kepegawaian</th>
                  <th className="border border-slate-200 px-2 py-2 text-center font-semibold w-12 text-emerald-600">H</th>
                  <th className="border border-slate-200 px-2 py-2 text-center font-semibold w-12 text-amber-600">S</th>
                  <th className="border border-slate-200 px-2 py-2 text-center font-semibold w-12 text-blue-600">I</th>
                  <th className="border border-slate-200 px-2 py-2 text-center font-semibold w-12 text-rose-600">A</th>
                  <th className="border border-slate-200 px-2 py-2 text-center font-semibold w-16">Efektif</th>
                  <th className="border border-slate-200 px-2 py-2 text-center font-semibold w-16">%</th>
                </tr>
              </thead>
              <tbody>
                {annual.rows.map((r, i) => {
                  const pct = annualAttendancePct(r);
                  const warn = isBelowThreshold(pct);
                  return (
                    <tr key={r.employeeId} className={warn ? "bg-rose-50/40" : "hover:bg-slate-50/50"}>
                      <td className="border border-slate-200 px-2 py-1.5 text-center text-muted-foreground">{i + 1}</td>
                      <td className="border border-slate-200 px-3 py-1.5">
                        <div className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1">
                          {r.name}
                          {warn && <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />}
                        </div>
                        {r.nip && <div className="text-[10px] text-muted-foreground">NIP {r.nip}</div>}
                        {r.extracurricular && <div className="text-[10px] text-indigo-600">{r.extracurricular}</div>}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5">
                        <Badge variant="outline" className="text-[10px]">{r.employmentStatus || "-"}</Badge>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{gtkCategoryLabel(r.category)}</div>
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center font-semibold">{r.totalHadir}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center">{r.totalSakit}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center">{r.totalIzin}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center">{r.totalAlpha}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center text-muted-foreground">{annual.effectiveDays}</td>
                      <td className={`border border-slate-200 px-2 py-1.5 text-center font-semibold ${warn ? "text-rose-600" : ""}`}>
                        {pct === null ? "-" : pct}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-100 dark:bg-zinc-900 font-semibold">
                  <td className="border border-slate-200 px-2 py-1.5 text-center" colSpan={3}>{annual.rows.length} GTK</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center">{annual.rows.reduce((n, r) => n + r.totalHadir, 0)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center">{annual.rows.reduce((n, r) => n + r.totalSakit, 0)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center">{annual.rows.reduce((n, r) => n + r.totalIzin, 0)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center">{annual.rows.reduce((n, r) => n + r.totalAlpha, 0)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center">{annual.effectiveDays}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-center">{annualOverall === null ? "-" : annualOverall}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
