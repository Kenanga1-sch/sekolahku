"use client";

import useSWR, { mutate } from "swr";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Download, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { goGet } from "@/lib/api-client";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
import type { ClassStatsItem, MutasiLog, RekapRow } from "./types-mutasi";
import { BukuMutasiPrintLayout } from "./BukuMutasiPrintLayout";

const fetcher = (url: string) => goGet(url);
const BOOK_ROW_COUNT = 10;
const BOOK_RECAP_GRADES = [1, 2, 3, 4, 5, 6];

export default function TabBukuMutasi() {
  const [reportMonth, setReportMonth] = useState(format(new Date(), "yyyy-MM"));
  const [reportClassId, setReportClassId] = useState<string>("all"); // "all" = semua kelas
  const { settings: schoolSettings } = useSchoolSettings();

  const { data: dataStats } = useSWR("/api/classes/stats", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const classStats: ClassStatsItem[] = dataStats?.data || [];

  // Logs & rekap bulanan dari backend
  const { data: dataLogs, error: errorLogs, isLoading: loadingLogs } = useSWR(
    `/api/admin/mutasi/logs?perPage=100&month=${reportMonth}`,
    fetcher
  );
  const mutasiLogs: MutasiLog[] = dataLogs?.data || [];

  const { data: dataRekap } = useSWR(
    `/api/admin/mutasi/rekap?month=${reportMonth}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );
  const rekapData: RekapRow[] = dataRekap?.data || [];

  // Derived: selected class for per-kelas report
  const selectedClass = useMemo(
    () => (reportClassId && reportClassId !== "all" ? classStats.find((c) => c.id === reportClassId) : null),
    [reportClassId, classStats]
  );
  const isPerClass = !!selectedClass;

  const selectedReportDate = useMemo(() => {
    const [year, month] = reportMonth.split("-");
    const parsedYear = Number(year);
    const parsedMonth = Number(month);
    return new Date(parsedYear, Math.max(parsedMonth - 1, 0), 1);
  }, [reportMonth]);
  const monthlyLogs = useMemo(
    () =>
      mutasiLogs.filter((log) => {
        if (!log?.mutationDate) return false;
        const logDate = new Date(log.mutationDate);
        const matchesMonth =
          logDate.getFullYear() === selectedReportDate.getFullYear() &&
          logDate.getMonth() === selectedReportDate.getMonth();
        if (!matchesMonth) return false;
        // Jika per-kelas, filter by classGrade
        if (isPerClass && selectedClass) {
          return log.classGrade === selectedClass.grade;
        }
        return true;
      }),
    [mutasiLogs, selectedReportDate, isPerClass, selectedClass]
  );
  const monthlyMasukLogs = useMemo(
    () => monthlyLogs.filter((log) => log.mutasiType === "masuk"),
    [monthlyLogs]
  );
  const monthlyKeluarLogs = useMemo(
    () => monthlyLogs.filter((log) => log.mutasiType === "keluar"),
    [monthlyLogs]
  );
  const reportMonthLabel = useMemo(
    () => format(selectedReportDate, "MMMM yyyy", { locale: idLocale }).toUpperCase(),
    [selectedReportDate]
  );
  const masukRows = useMemo(
    () =>
      padReportRows(
        monthlyMasukLogs.map((log, index: number) => ({
          no: index + 1,
          tanggal: log.mutationDate ? format(new Date(log.mutationDate), "dd/MM/yyyy") : "",
          nama: log.studentName || "",
          lp: log.gender || "",
          noInduk: log.nis || log.nisn || "",
          kelas: log.className || "",
          sekolah: log.originOrDestination || "",
          asalNoInduk: log.originNis || "",
          asalKelas: log.originClass || "",
          persetujuanTanggal: log.approvalDate ? (log.approvalDate.includes("-") ? format(new Date(log.approvalDate), "dd/MM/yyyy") : log.approvalDate) : "",
          persetujuanNomor: log.approvalNo || "",
        })),
        BOOK_ROW_COUNT
      ),
    [monthlyMasukLogs]
  );
  const keluarRows = useMemo(
    () =>
      padReportRows(
        monthlyKeluarLogs.map((log, index: number) => ({
          no: index + 1,
          tanggal: log.mutationDate ? format(new Date(log.mutationDate), "dd/MM/yyyy") : "",
          nama: log.studentName || "",
          noInduk: log.nis || log.nisn || "",
          lp: log.gender || "",
          kelas: log.className || "",
          nomorSurat: log.letterNo || log.approvalNo || "",
          tujuan: log.originOrDestination ? (log.destinationClass ? `${log.originOrDestination} (${log.destinationClass})` : log.originOrDestination) : "",
        })),
        BOOK_ROW_COUNT
      ),
    [monthlyKeluarLogs]
  );
  const rekapRows = useMemo(() => {
    if (isPerClass && selectedClass) {
      // Per-kelas: only show the selected grade with exact L & P breakdown
      const grade = selectedClass.grade;
      const item = rekapData.find((r) => r.grade === grade);

      const logMasukL = monthlyMasukLogs.filter((log) => log.gender === "L").length;
      const logMasukP = monthlyMasukLogs.filter((log) => log.gender === "P").length;
      const logKeluarL = monthlyKeluarLogs.filter((log) => log.gender === "L").length;
      const logKeluarP = monthlyKeluarLogs.filter((log) => log.gender === "P").length;

      const masukL = (item && typeof item.masukL === "number" && item.masukL > 0) ? item.masukL : logMasukL;
      const masukP = (item && typeof item.masukP === "number" && item.masukP > 0) ? item.masukP : logMasukP;
      const keluarL = (item && typeof item.keluarL === "number" && item.keluarL > 0) ? item.keluarL : logKeluarL;
      const keluarP = (item && typeof item.keluarP === "number" && item.keluarP > 0) ? item.keluarP : logKeluarP;

      const awalL = item ? item.awalL : 0;
      const awalP = item ? item.awalP : 0;
      const akhirL = item ? item.akhirL : 0;
      const akhirP = item ? item.akhirP : 0;

      return [
        {
          grade,
          awalL,
          awalP,
          awalJM: Number(awalL) + Number(awalP),
          masukL,
          masukP,
          masukJM: Number(masukL) + Number(masukP),
          keluarL,
          keluarP,
          keluarJM: Number(keluarL) + Number(keluarP),
          akhirL,
          akhirP,
          akhirJM: Number(akhirL) + Number(akhirP),
          keterangan: monthlyLogs.length === 0 ? "Nihil" : "",
        },
      ];
    }

    // Semua kelas: use backend rekap data
    const rows: RekapRow[] = BOOK_RECAP_GRADES.map((grade) => {
      const item = rekapData.find((r) => r.grade === grade);

      const masukL = (item && typeof item.masukL === "number" && item.masukL > 0) ? item.masukL : 0;
      const masukP = (item && typeof item.masukP === "number" && item.masukP > 0) ? item.masukP : 0;
      const keluarL = (item && typeof item.keluarL === "number" && item.keluarL > 0) ? item.keluarL : 0;
      const keluarP = (item && typeof item.keluarP === "number" && item.keluarP > 0) ? item.keluarP : 0;

      const awalL = item ? item.awalL : 0;
      const awalP = item ? item.awalP : 0;
      const akhirL = item ? item.akhirL : 0;
      const akhirP = item ? item.akhirP : 0;

      return {
        grade,
        awalL, awalP, awalJM: Number(awalL) + Number(awalP),
        masukL, masukP, masukJM: Number(masukL) + Number(masukP),
        keluarL, keluarP, keluarJM: Number(keluarL) + Number(keluarP),
        akhirL, akhirP, akhirJM: Number(akhirL) + Number(akhirP),
        keterangan: "",
      };
    });

    const totals = rows.reduce(
      (acc, r) => ({
        awalL: acc.awalL + Number(r.awalL),
        awalP: acc.awalP + Number(r.awalP),
        masukL: acc.masukL + Number(r.masukL),
        masukP: acc.masukP + Number(r.masukP),
        keluarL: acc.keluarL + Number(r.keluarL),
        keluarP: acc.keluarP + Number(r.keluarP),
        akhirL: acc.akhirL + Number(r.akhirL),
        akhirP: acc.akhirP + Number(r.akhirP),
      }),
      { awalL: 0, awalP: 0, masukL: 0, masukP: 0, keluarL: 0, keluarP: 0, akhirL: 0, akhirP: 0 }
    );

    rows.push({
      grade: "Jumlah",
      awalL: totals.awalL,
      awalP: totals.awalP,
      awalJM: totals.awalL + totals.awalP,
      masukL: totals.masukL,
      masukP: totals.masukP,
      masukJM: totals.masukL + totals.masukP,
      keluarL: totals.keluarL,
      keluarP: totals.keluarP,
      keluarJM: totals.keluarL + totals.keluarP,
      akhirL: totals.akhirL,
      akhirP: totals.akhirP,
      akhirJM: totals.akhirL + totals.akhirP,
      keterangan: monthlyLogs.length === 0 ? "Laporan nihil" : "" as string,
    });

    return rows;
  }, [rekapData, monthlyLogs.length, isPerClass, selectedClass, monthlyMasukLogs, monthlyKeluarLogs]);

  return (
    <Card>
      <style jsx global>{`
        @page {
          size: 215mm 330mm; /* Kertas F4 / Folio Portrait */
          margin: 6mm 8mm;
        }

        @media print {
          body > *:not(.buku-mutasi-print-portal) {
            display: none !important;
          }

          .buku-mutasi-print-portal {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body, html {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .mutasi-print-root {
            padding: 0 !important;
            margin: 0 !important;
          }

          .mutasi-print-root table {
            font-size: 10px !important;
          }

          .mutasi-print-root th,
          .mutasi-print-root td {
            padding: 1px 2px !important;
          }

          .mutasi-print-root .bg-gray-100 {
            background-color: #f3f4f6 !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <div className="no-print p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b">
        <div className="space-y-1">
          <h3 className="font-semibold text-slate-800 dark:text-zinc-200">Buku Mutasi Bulanan</h3>
          <p className="text-xs text-muted-foreground">
            Laporan tetap tersedia untuk setiap bulan, termasuk saat mutasi nihil.
          </p>
        </div>
        <div className="flex w-full lg:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select value={reportClassId} onValueChange={setReportClassId}>
            <SelectTrigger className="w-full sm:w-[260px] h-9 text-xs">
              <SelectValue placeholder="Pilih Jenis Buku Mutasi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Buku Mutasi Sekolah (ttd Pengawas)</SelectItem>
              {classStats.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  Buku Mutasi {c.name} (ttd Kepsek)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="month"
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
            className="w-full sm:w-[160px] h-9 text-xs"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title="Refresh data"
            onClick={() => {
              mutate(`/api/admin/mutasi/logs?perPage=100&month=${reportMonth}`);
              mutate(`/api/admin/mutasi/rekap?month=${reportMonth}`);
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => window.print()} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" /> Cetak Buku Mutasi
          </Button>
        </div>
      </div>
      <div className="no-print border-b px-4 py-3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <div>
          {loadingLogs
            ? "Memuat data buku mutasi..."
            : errorLogs
              ? "Gagal memuat buku mutasi."
              : `Periode: ${reportMonthLabel}${isPerClass ? ` • ${selectedClass?.name}` : " • Semua Kelas"}${monthlyLogs.length === 0 ? " • Status: NIHIL" : ` • ${monthlyLogs.length} mutasi`}`}
        </div>
        <Badge variant="outline" className="text-[11px] bg-slate-50 dark:bg-zinc-900 border-slate-300 dark:border-zinc-700">
          {isPerClass
            ? "📋 Mode: Wali Kelas (Tanda Tangan: Kepala Sekolah)"
            : "🏫 Mode: Sekolah (Tanda Tangan: Pengawas Sekolah)"}
        </Badge>
      </div>

      {/* Screen Preview */}
      <div className="no-print p-4 bg-slate-100 dark:bg-zinc-950 overflow-auto flex justify-center">
        <div className="bg-white text-black p-6 rounded-lg shadow-md w-full max-w-[1340px] border">
          <BukuMutasiPrintLayout
            reportMonthLabel={reportMonthLabel}
            masukRows={masukRows}
            monthlyMasukLogs={monthlyMasukLogs}
            keluarRows={keluarRows}
            monthlyKeluarLogs={monthlyKeluarLogs}
            schoolSettings={schoolSettings}
            rekapRows={rekapRows}
            isPerClass={isPerClass}
            selectedClassName={selectedClass?.name || ""}
          />
        </div>
      </div>

      {/* Print Version via Portal — hanya di client (document tersedia) */}
      {typeof document !== "undefined" && createPortal(
        <div className="buku-mutasi-print-portal hidden print:block">
          <BukuMutasiPrintLayout
            reportMonthLabel={reportMonthLabel}
            masukRows={masukRows}
            monthlyMasukLogs={monthlyMasukLogs}
            keluarRows={keluarRows}
            monthlyKeluarLogs={monthlyKeluarLogs}
            schoolSettings={schoolSettings}
            rekapRows={rekapRows}
            isPerClass={isPerClass}
            selectedClassName={selectedClass?.name || ""}
          />
        </div>,
        document.body
      )}
    </Card>
  );
}

/** Pad rows to fixed count, filling empty rows with "..." */
function padReportRows<T extends Record<string, string | number | undefined>>(
  rows: T[],
  targetCount: number
): T[] {
  const filled = [...rows];
  if (filled.length >= targetCount) return filled;

  let keys = rows.length > 0 ? Object.keys(rows[0]) : [];
  if (keys.length === 0) {
    keys = ["no", "tanggal", "nama", "lp", "noInduk", "kelas", "sekolah", "asalNoInduk", "asalKelas", "persetujuanTanggal", "persetujuanNomor", "nomorSurat", "tujuan"];
  }

  while (filled.length < targetCount) {
    const filler: Record<string, string> = {};
    keys.forEach((k) => (filler[k] = "..."));
    filled.push(filler as unknown as T);
  }
  return filled;
}
