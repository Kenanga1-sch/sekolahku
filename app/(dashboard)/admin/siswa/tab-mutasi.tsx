﻿﻿﻿"use client";

import useSWR, { mutate } from "swr";
import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { 
  Loader2, 
  Check, 
  X, 
  RefreshCw, 
  MessageCircle, 
  Download,
  Building,
  CheckCircle,
  ArrowRightLeft,
  PlusCircle,
  ArrowRightCircle,
  Search
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { goGet, goPatch, goPost } from "@/lib/api-client";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
import type { ClassStatsItem, MutasiRequest, MutasiLog, ReportRow, RekapRow, LiabilityData } from "./types-mutasi";
import { DialogMutasiMasuk } from "./DialogMutasiMasuk";
import { DialogMutasiKeluar } from "./DialogMutasiKeluar";
import { BukuMutasiPrintLayout } from "./BukuMutasiPrintLayout";

const fetcher = (url: string) => goGet(url);
const BOOK_ROW_COUNT = 10;
const BOOK_RECAP_GRADES = [1, 2, 3, 4, 5, 6];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];
function toRoman(n: number): string {
  return ROMAN[n] ?? String(n);
}

export default function TabMutasi() {
  // Tab State: "masuk" (Incoming), "keluar" (Outgoing), or "buku" (Buku Mutasi)
  const [activeTab, setActiveTab] = useState<"masuk" | "keluar" | "buku">("masuk");
  const [reportMonth, setReportMonth] = useState(format(new Date(), "yyyy-MM"));
  const [reportClassId, setReportClassId] = useState<string>("all"); // "all" = semua kelas
  const { settings: schoolSettings } = useSchoolSettings();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- MUTASI MASUK (INCOMING) STATE & HOOKS ---
  const { data: dataRequestsIn, error: errorRequestsIn, isLoading: loadingRequestsIn } = useSWR(
    "/api/admin/mutasi",
    fetcher
  );
  const { data: dataStats } = useSWR("/api/classes/stats", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000, // cache 1 menit â€” jarang berubah
  });

  const requestsIn: MutasiRequest[] = dataRequestsIn?.data || [];
  const classStats: ClassStatsItem[] = dataStats?.data || [];

  // Filter States - Mutasi Masuk
  const [searchIn, setSearchIn] = useState("");
  const [monthIn, setMonthIn] = useState("all");
  const [gradeIn, setGradeIn] = useState("all");
  const [statusIn, setStatusIn] = useState("all");

  // Filter States - Mutasi Keluar
  const [searchOut, setSearchOut] = useState("");
  const [monthOut, setMonthOut] = useState("all");
  const [gradeOut, setGradeOut] = useState("all");
  const [statusOut, setStatusOut] = useState("all");

  // Derived: selected class for per-kelas report
  const selectedClass = useMemo(
    () => (reportClassId && reportClassId !== "all" ? classStats.find((c) => c.id === reportClassId) : null),
    [reportClassId, classStats]
  );
  const isPerClass = !!selectedClass;

  // Filtered Mutasi Masuk Data
  const filteredRequestsIn = useMemo(() => {
    return requestsIn.filter((req) => {
      if (searchIn.trim() !== "") {
        const q = searchIn.toLowerCase();
        const matchesName = (req.studentName || "").toLowerCase().includes(q);
        const matchesNisn = (req.nisn || "").toLowerCase().includes(q);
        const matchesReg = (req.registrationNumber || "").toLowerCase().includes(q);
        const matchesSchool = (req.originSchool || "").toLowerCase().includes(q);
        if (!matchesName && !matchesNisn && !matchesReg && !matchesSchool) return false;
      }
      if (monthIn !== "all" && req.createdAt) {
        const d = format(new Date(req.createdAt), "yyyy-MM");
        if (d !== monthIn) return false;
      }
      if (gradeIn !== "all") {
        if (String(req.targetGrade) !== gradeIn) return false;
      }
      if (statusIn !== "all") {
        if (req.statusApproval !== statusIn) return false;
      }
      return true;
    });
  }, [requestsIn, searchIn, monthIn, gradeIn, statusIn]);

  const [openRequestIdIn, setOpenRequestIdIn] = useState<string | null>(null);
  const [isUpdatingIn, setIsUpdatingIn] = useState(false);
  const [targetClass, setTargetClass] = useState<string>("");

  const handleUpdateStatusIn = async (
    id: string,
    newStatus: string,
    targetClassId?: string
  ) => {
    setIsUpdatingIn(true);
    try {
      const payload: Record<string, string> = { statusApproval: newStatus };
      if (targetClassId) payload.targetClassId = targetClassId;

      await goPatch(`/api/admin/mutasi/${id}`, payload);

      toast.success("Status berhasil diperbarui");
      mutate("/api/admin/mutasi");
      setOpenRequestIdIn(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui status");
    } finally {
      setIsUpdatingIn(false);
    }
  };

  const generatePDF = async (req: MutasiRequest) => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text("SURAT KETERANGAN PENERIMAAN", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text("MUTASI MASUK PESERTA DIDIK", 105, 28, { align: "center" });
    
    // Body
    doc.setFontSize(11);
    doc.text(`Nomor Registrasi: ${req.registrationNumber}`, 20, 50);
    
    doc.text("Yang bertanda tangan di bawah ini Kepala Sekolah SD Negeri ... menerangkan bahwa:", 20, 70, { maxWidth: 170 });
    
    const startY = 80;
    doc.text(`Nama Siswa`, 20, startY);
    doc.text(`: ${req.studentName}`, 60, startY);
    
    doc.text(`NISN`, 20, startY + 10);
    doc.text(`: ${req.nisn}`, 60, startY + 10);
    
    doc.text(`Asal Sekolah`, 20, startY + 20);
    doc.text(`: ${req.originSchool}`, 60, startY + 20);
    
    doc.text(`Diterima di Kelas`, 20, startY + 30);
    const assignedClass = classStats.find((c) => c.id === req.targetClassId)?.name || "-";
    doc.text(`: ${assignedClass}`, 60, startY + 30);
    
    doc.text("Telah kami SETUJUI untuk diterima sebagai siswa pindahan di sekolah kami.", 20, startY + 50, { maxWidth: 170 });
    
    // Footer
    doc.text(`Kendal, ${format(new Date(), "d MMMM yyyy", { locale: idLocale })}`, 140, startY + 70);
    doc.text("Kepala Sekolah", 140, startY + 80);
    
    doc.text("( ...................... )", 140, startY + 100);
    
    doc.save(`Surat_Penerimaan_${req.studentName}.pdf`);
  };

  const currentClassStats = targetClass 
    ? classStats.find((c) => c.id === targetClass) 
    : null;

  // --- MUTASI KELUAR (OUTGOING) STATE & HOOKS ---
  const { data: dataRequestsOut, error: errorRequestsOut, isLoading: loadingRequestsOut } = useSWR(
    "/api/admin/mutasi-keluar",
    fetcher
  );

  // --- BUKU MUTASI (LOGS) STATE & HOOKS ---
  const { data: dataLogs, error: errorLogs, isLoading: loadingLogs } = useSWR(
    "/api/admin/mutasi/logs?perPage=500",
    fetcher
  );
  const mutasiLogs: MutasiLog[] = dataLogs?.data || [];

  // Rekap per-grade from backend
  const { data: dataRekap } = useSWR(
    `/api/admin/mutasi/rekap?month=${reportMonth}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );
  const rekapData: RekapRow[] = dataRekap?.data || [];

  const requestsOut: MutasiRequest[] = dataRequestsOut?.data || [];

  // Filtered Mutasi Keluar Data
  const filteredRequestsOut = useMemo(() => {
    return requestsOut.filter((req) => {
      if (searchOut.trim() !== "") {
        const q = searchOut.toLowerCase();
        const matchesName = (req.studentName || "").toLowerCase().includes(q);
        const matchesNisn = (req.nisn || "").toLowerCase().includes(q);
        const matchesLetter = (req.letterNo || "").toLowerCase().includes(q);
        const matchesSchool = (req.destinationSchool || "").toLowerCase().includes(q);
        if (!matchesName && !matchesNisn && !matchesLetter && !matchesSchool) return false;
      }
      if (monthOut !== "all" && req.createdAt) {
        const d = format(new Date(req.createdAt), "yyyy-MM");
        if (d !== monthOut) return false;
      }
      if (gradeOut !== "all") {
        const className = (req.className || "").toLowerCase();
        if (!className.includes(`kelas ${gradeOut}`) && !className.includes(`${gradeOut}`)) return false;
      }
      if (statusOut !== "all") {
        if (req.status !== statusOut) return false;
      }
      return true;
    });
  }, [requestsOut, searchOut, monthOut, gradeOut, statusOut]);

  const [selectedRequestOut, setSelectedRequestOut] = useState<MutasiRequest | null>(null);
  const [openRequestIdOut, setOpenRequestIdOut] = useState<string | null>(null);
  const [liabilityData, setLiabilityData] = useState<LiabilityData | null>(null);
  const [checkingLiability, setCheckingLiability] = useState(false);
  const [updatingOut, setUpdatingOut] = useState(false);
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

    // Semua kelas: use backend rekap data + fallback to logs calculation
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

    // Calculate totals in a single pass
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

  const handleOpenDetailOut = async (req: MutasiRequest) => {
    setSelectedRequestOut(req);
    setCheckingLiability(true);
    setLiabilityData(null);

    try {
        const result = await goGet<{ success: boolean; data?: LiabilityData }>(`/api/admin/mutasi-keluar/${req.id}/check`);
        if(result.success) {
            setLiabilityData(result.data ?? null);
        }
    } catch (e) {
        console.error(e);
        toast.error("Gagal mengecek tanggungan siswa");
    } finally {
        setCheckingLiability(false);
    }
  };

  const updateStatusOut = async (id: string, newStatus: string) => {
    setUpdatingOut(true);
    try {
        await goPatch(`/api/admin/mutasi-keluar/${id}`, { status: newStatus });
        
        toast.success("Status berhasil diperbarui");
        mutate("/api/admin/mutasi-keluar");
        setOpenRequestIdOut(null);
        setSelectedRequestOut(null);
    } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal memperbarui status");
    } finally {
        setUpdatingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" /> Kelola Mutasi Siswa
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
            Manajemen permohonan mutasi masuk dan mutasi keluar siswa.
          </p>
        </div>
        <Button 
          onClick={() => {
            mutate(activeTab === "masuk" ? "/api/admin/mutasi" : "/api/admin/mutasi-keluar");
            if (activeTab === "masuk") mutate("/api/classes/stats");
          }} 
          variant="outline" 
          size="sm"
          className="w-full sm:w-auto"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto whitespace-nowrap scrollbar-none bg-slate-100/60 dark:bg-zinc-900/40 p-1 rounded-xl gap-1.5 border border-slate-200/40 dark:border-zinc-800/40 max-w-fit">
        <button
          onClick={() => setActiveTab("masuk")}
          className={`shrink-0 py-1.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer border ${
            activeTab === "masuk"
              ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-sm border-slate-200/80 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-zinc-900/30 border-transparent"
          }`}
        >
          Mutasi Masuk
        </button>
        <button
          onClick={() => setActiveTab("keluar")}
          className={`shrink-0 py-1.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer border ${
            activeTab === "keluar"
              ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-sm border-slate-200/80 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-zinc-900/30 border-transparent"
          }`}
        >
          Mutasi Keluar
        </button>
        <button
          onClick={() => setActiveTab("buku")}
          className={`shrink-0 py-1.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer border ${
            activeTab === "buku"
              ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 shadow-sm border-slate-200/80 dark:border-zinc-800"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-zinc-900/30 border-transparent"
          }`}
        >
          Buku Mutasi
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "masuk" ? (
        <Card>
          {/* Filter Bar - Mutasi Masuk */}
          <div className="p-4 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto flex-1">
              <div className="relative w-full sm:w-[220px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama, NISN, no reg..."
                  value={searchIn}
                  onChange={(e) => setSearchIn(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>

              <Input
                type="month"
                value={monthIn === "all" ? "" : monthIn}
                onChange={(e) => setMonthIn(e.target.value || "all")}
                className="w-full sm:w-[150px] h-9 text-xs"
                title="Filter Bulan & Tahun"
              />

              <Select value={gradeIn} onValueChange={setGradeIn}>
                <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  <SelectItem value="1">Kelas 1</SelectItem>
                  <SelectItem value="2">Kelas 2</SelectItem>
                  <SelectItem value="3">Kelas 3</SelectItem>
                  <SelectItem value="4">Kelas 4</SelectItem>
                  <SelectItem value="5">Kelas 5</SelectItem>
                  <SelectItem value="6">Kelas 6</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusIn} onValueChange={setStatusIn}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="principal_approved">Disetujui / Selesai</SelectItem>
                  <SelectItem value="verified">Terverifikasi</SelectItem>
                  <SelectItem value="pending">Menunggu (Pending)</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>

              {(searchIn || monthIn !== "all" || gradeIn !== "all" || statusIn !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchIn("");
                    setMonthIn("all");
                    setGradeIn("all");
                    setStatusIn("all");
                  }}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset Filter
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0">
              <span className="text-xs text-muted-foreground">
                Total: <strong>{filteredRequestsIn.length}</strong> mutasi
              </span>
              <DialogMutasiMasuk classStats={classStats} />
            </div>
          </div>

          <Table>
            <TableHeader>
             <TableRow>
                <TableHead className="hidden sm:table-cell">Tgl Masuk</TableHead>
                <TableHead className="hidden sm:table-cell">No. Registrasi</TableHead>
                <TableHead>Nama Siswa</TableHead>
                <TableHead>Kelas Tujuan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRequestsIn ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : errorRequestsIn ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-destructive">
                    Gagal memuat riwayat mutasi masuk.
                  </TableCell>
                </TableRow>
              ) : filteredRequestsIn.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Tidak ada data mutasi masuk yang sesuai filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequestsIn.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="hidden sm:table-cell">
                      {req.createdAt ? format(new Date(req.createdAt), "dd/MM/yyyy") : "-"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="font-mono text-xs">{req.registrationNumber}</span>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-800 dark:text-zinc-200">{req.studentName}</div>
                      <div className="text-xs text-muted-foreground">Asal: {req.originSchool}</div>
                    </TableCell>
                    <TableCell>Kelas {req.targetGrade}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={
                          req.statusApproval === "principal_approved" ? "default" : 
                          req.statusApproval === "rejected" ? "destructive" : 
                          req.statusApproval === "verified" ? "secondary" : "outline"
                        }>
                          {req.statusApproval === "principal_approved" ? "Disetujui" :
                           req.statusApproval === "rejected" ? "Ditolak" :
                           req.statusApproval === "verified" ? "Terverifikasi" : "Menunggu"}
                        </Badge>
                        {req.statusDelivery === "direct" && (
                          <span className="text-[10px] text-muted-foreground font-mono">Input Langsung</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog open={openRequestIdIn === req.id} onOpenChange={(open) => {
                        if(open) {
                          setOpenRequestIdIn(req.id);
                          setTargetClass(req.targetClassId || "");
                        } else {
                          setOpenRequestIdIn(null);
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">Detail</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Detail Mutasi Masuk</DialogTitle>
                            <DialogDescription>
                              {req.registrationNumber} - {req.studentName}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="grid grid-cols-2 gap-6 py-4">
                            <div className="space-y-4">
                              <h3 className="font-semibold border-b">Data Siswa</h3>
                              <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                                <span className="text-muted-foreground">NISN:</span>
                                <span>{req.nisn || "-"}</span>
                                <span className="text-muted-foreground">JK:</span>
                                <span>{req.gender === "L" ? "Laki-laki" : "Perempuan"}</span>
                                <span className="text-muted-foreground">Sekolah Asal:</span>
                                <div>
                                  <div>{req.originSchool}</div>
                                  {req.originSchoolAddress && (
                                    <div className="text-xs text-muted-foreground">{req.originSchoolAddress}</div>
                                  )}
                                </div>
                                <span className="text-muted-foreground">Kelas Tujuan:</span>
                                <span>Kelas {req.targetGrade}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <h3 className="font-semibold border-b">Data Orang Tua / Kontak</h3>
                              <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                                <span className="text-muted-foreground">Nama:</span>
                                <span>{req.parentName || "-"}</span>
                                <span className="text-muted-foreground">WhatsApp:</span>
                                {req.whatsappNumber && req.whatsappNumber !== "-" ? (
                                  <a
                                    href={`https://wa.me/${req.whatsappNumber}`}
                                    target="_blank"
                                    className="text-green-600 hover:underline flex items-center"
                                  >
                                    {req.whatsappNumber} <MessageCircle className="h-3 w-3 ml-1" />
                                  </a>
                                ) : (
                                  <span>-</span>
                                )}
                              </div>

                              {req.statusApproval === "principal_approved" && (
                                <div className="mt-4 p-4 bg-muted rounded-md">
                                  <h4 className="font-semibold mb-2">Dokumen</h4>
                                  <Button size="sm" onClick={() => generatePDF(req)}>
                                    <Download className="mr-2 h-4 w-4" /> Download Surat
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Admin Action Area */}
                          <div className="border-t pt-4 space-y-4">
                            <h3 className="font-semibold">Tindak Lanjut</h3>
                            
                            {req.statusApproval === "pending" && (
                              <div className="flex gap-2">
                                <Button 
                                  onClick={() => handleUpdateStatusIn(req.id, "verified")}
                                  disabled={isUpdatingIn}
                                >
                                  <Check className="mr-2 h-4 w-4" /> Verifikasi Dokumen
                                </Button>
                                <Button 
                                  variant="destructive"
                                  onClick={() => handleUpdateStatusIn(req.id, "rejected")}
                                  disabled={isUpdatingIn}
                                >
                                  <X className="mr-2 h-4 w-4" /> Tolak
                                </Button>
                              </div>
                            )}

                            {req.statusApproval === "verified" && (
                              <div className="flex flex-col gap-4">
                                <div className="space-y-2">
                                  <Label>Pilih Kelas Penempatan</Label>
                                  <Select value={targetClass} onValueChange={setTargetClass}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Pilih Kelas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {classStats
                                        .filter((c) => c.grade === req.targetGrade)
                                        .map((c) => (
                                          <SelectItem key={c.id} value={c.id}>
                                            {c.name} ({c.studentCount}/{c.capacity})
                                          </SelectItem>
                                        ))
                                      }
                                    </SelectContent>
                                  </Select>
                                  {currentClassStats && (
                                    <p className={`text-xs ${currentClassStats.studentCount >= currentClassStats.capacity ? "text-red-500" : "text-green-600"}`}>
                                      Sisa Kuota: {currentClassStats.capacity - currentClassStats.studentCount}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    onClick={() => handleUpdateStatusIn(req.id, "principal_approved", targetClass)}
                                    disabled={isUpdatingIn || !targetClass}
                                  >
                                    <Check className="mr-2 h-4 w-4" /> Setujui (Kepsek)
                                  </Button>
                                  <Button 
                                    variant="destructive"
                                    onClick={() => handleUpdateStatusIn(req.id, "rejected")}
                                    disabled={isUpdatingIn}
                                  >
                                    <X className="mr-2 h-4 w-4" /> Tolak
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {req.statusApproval === "principal_approved" && (
                               <div className="flex items-center gap-2 text-green-600">
                                 <Check className="h-5 w-5" /> Mutasi telah disetujui/dicatat. Silakan unduh surat keterangan jika diperlukan.
                               </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : activeTab === "keluar" ? (
        <Card>
          {/* Filter Bar - Mutasi Keluar */}
          <div className="p-4 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto flex-1">
              <div className="relative w-full sm:w-[220px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama, NISN, no surat..."
                  value={searchOut}
                  onChange={(e) => setSearchOut(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>

              <Input
                type="month"
                value={monthOut === "all" ? "" : monthOut}
                onChange={(e) => setMonthOut(e.target.value || "all")}
                className="w-full sm:w-[150px] h-9 text-xs"
                title="Filter Bulan & Tahun"
              />

              <Select value={gradeOut} onValueChange={setGradeOut}>
                <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  <SelectItem value="1">Kelas 1</SelectItem>
                  <SelectItem value="2">Kelas 2</SelectItem>
                  <SelectItem value="3">Kelas 3</SelectItem>
                  <SelectItem value="4">Kelas 4</SelectItem>
                  <SelectItem value="5">Kelas 5</SelectItem>
                  <SelectItem value="6">Kelas 6</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusOut} onValueChange={setStatusOut}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="completed">Selesai</SelectItem>
                  <SelectItem value="processed">Diproses</SelectItem>
                  <SelectItem value="draft">Draft / Baru</SelectItem>
                </SelectContent>
              </Select>

              {(searchOut || monthOut !== "all" || gradeOut !== "all" || statusOut !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchOut("");
                    setMonthOut("all");
                    setGradeOut("all");
                    setStatusOut("all");
                  }}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset Filter
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0">
              <span className="text-xs text-muted-foreground">
                Total: <strong>{filteredRequestsOut.length}</strong> mutasi
              </span>
              <DialogMutasiKeluar />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Tanggal</TableHead>
                <TableHead className="hidden sm:table-cell">NISN</TableHead>
                <TableHead>Nama Siswa</TableHead>
                <TableHead>Sekolah Tujuan</TableHead>
                <TableHead className="hidden md:table-cell">Alasan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRequestsOut ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : errorRequestsOut ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-destructive">
                    Gagal memuat mutasi keluar.
                  </TableCell>
                </TableRow>
              ) : filteredRequestsOut.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Tidak ada data mutasi keluar yang sesuai filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequestsOut.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="hidden sm:table-cell">
                      {req.createdAt ? format(new Date(req.createdAt), "dd/MM/yyyy") : "-"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{req.nisn || "-"}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-800 dark:text-zinc-200">{req.studentName}</div>
                      <div className="text-xs text-muted-foreground">{req.className}</div>
                    </TableCell>
                    <TableCell>{req.destinationSchool}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {req.reason === "domisili" ? "Pindah Domisili" : 
                       req.reason === "tugas_orangtua" ? "Tugas Ortu" : (req.reason || "Lainnya")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        req.status === "completed" ? "default" : 
                        req.status === "processed" ? "secondary" : "outline"
                      }>
                        {req.status === "draft" ? "Draft/Baru" :
                         req.status === "processed" ? "Diproses" : "Selesai"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog open={openRequestIdOut === req.id} onOpenChange={(open) => {
                          if(open) {
                              setOpenRequestIdOut(req.id);
                              handleOpenDetailOut(req);
                          } else {
                              setOpenRequestIdOut(null);
                              setSelectedRequestOut(null);
                          }
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">Tindak Lanjut</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Detail Mutasi Keluar</DialogTitle>
                            <DialogDescription>
                              Tinjau status tanggungan siswa sebelum memproses mutasi.
                            </DialogDescription>
                          </DialogHeader>
                          
                          {selectedRequestOut && (
                             <div className="space-y-6 py-4">
                                  <div className="grid grid-cols-2 gap-4 text-sm bg-muted p-4 rounded-lg">
                                      <div>
                                          <span className="text-muted-foreground block">Nama Siswa:</span>
                                          <span className="font-semibold">{selectedRequestOut.studentName}</span>
                                      </div>
                                      <div>
                                          <span className="text-muted-foreground block">NISN:</span>
                                          <span className="font-semibold">{selectedRequestOut.nisn}</span>
                                      </div>
                                      <div>
                                          <span className="text-muted-foreground block">Sekolah Tujuan:</span>
                                          <span className="font-semibold">{selectedRequestOut.destinationSchool}</span>
                                      </div>
                                      <div>
                                          <span className="text-muted-foreground block">Alasan:</span>
                                          <span className="font-semibold">{selectedRequestOut.reasonDetail || selectedRequestOut.reason}</span>
                                      </div>
                                  </div>

                                  <div className="space-y-3">
                                      <h3 className="font-semibold border-b pb-2">Cek Tanggungan</h3>
                                      {checkingLiability ? (
                                          <div className="flex items-center gap-2 text-muted-foreground">
                                              <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa data...
                                          </div>
                                      ) : liabilityData ? (
                                          <div className="grid grid-cols-2 gap-4">
                                              <Card className="p-4 border-l-4 border-l-blue-500">
                                                  <div className="flex items-center gap-2 mb-2">
                                                      <Building className="h-4 w-4 text-blue-500" />
                                                      <span className="font-medium">Perpustakaan</span>
                                                  </div>
                                                  <div className="text-2xl font-bold">
                                                      {liabilityData.library?.activeLoans ?? 0}
                                                  </div>
                                                  <div className="text-xs text-muted-foreground">Buku belum kembali</div>
                                                  <Badge className="mt-2" variant={liabilityData.library?.status === "Clear" ? "default" : "destructive"}>
                                                      {liabilityData.library?.status}
                                                  </Badge>
                                              </Card>
                                              <Card className="p-4 border-l-4 border-l-green-500">
                                                  <div className="flex items-center gap-2 mb-2">
                                                      <Building className="h-4 w-4 text-green-500" />
                                                      <span className="font-medium">Tabungan</span>
                                                  </div>
                                                  <div className="text-2xl font-bold">
                                                      Rp {(liabilityData.financial?.balance ?? 0).toLocaleString("id-ID")}
                                                  </div>
                                                  <div className="text-xs text-muted-foreground">Saldo tersisa</div>
                                                  <Badge className="mt-2" variant={liabilityData.financial?.status === "Clear" ? "default" : "secondary"}>
                                                      {liabilityData.financial?.status}
                                                  </Badge>
                                              </Card>
                                          </div>
                                      ) : (
                                          <p className="text-red-500">Gagal mengambil data.</p>
                                      )}
                                  </div>

                                  <div className="flex justify-end gap-3 pt-4 border-t">
                                      <Button variant="outline" onClick={() => {
                                          setOpenRequestIdOut(null);
                                          setSelectedRequestOut(null);
                                      }}>Tutup</Button>
                                      
                                      {selectedRequestOut.status !== "completed" && (
                                          <>
                                              {selectedRequestOut.status === "draft" && (
                                                  <Button 
                                                      onClick={() => updateStatusOut(selectedRequestOut.id, "processed")}
                                                      disabled={updatingOut}
                                                  >
                                                      Tandai Diproses
                                                  </Button>
                                              )}
                                              {selectedRequestOut.status === "processed" && (
                                                   <Button 
                                                      className="bg-green-600 hover:bg-green-700"
                                                      onClick={() => updateStatusOut(selectedRequestOut.id, "completed")}
                                                      disabled={updatingOut}
                                                   >
                                                      <CheckCircle className="mr-2 h-4 w-4" /> Selesai (Mutasi Keluar)
                                                   </Button>
                                              )}
                                          </>
                                      )}
                                  </div>
                             </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : activeTab === "buku" ? (
        <Card>
          <style jsx global>{`
            @page {
              size: 330mm 215mm; /* Kertas F4 / Folio Landscape */
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
                  : `Periode: ${reportMonthLabel}${isPerClass ? ` â€¢ ${selectedClass?.name}` : " â€¢ Semua Kelas"}${monthlyLogs.length === 0 ? " â€¢ Status: NIHIL" : ` â€¢ ${monthlyLogs.length} mutasi`}`}
            </div>
            <Badge variant="outline" className="text-[11px] bg-slate-50 dark:bg-zinc-900 border-slate-300 dark:border-zinc-700">
              {isPerClass 
                ? "ðŸ“‹ Mode: Wali Kelas (Tanda Tangan: Kepala Sekolah)" 
                : "ðŸ« Mode: Sekolah (Tanda Tangan: Pengawas Sekolah)"}
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

          {/* Print Version via Portal */}
          {isMounted && createPortal(
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
      ) : null}
    </div>
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

