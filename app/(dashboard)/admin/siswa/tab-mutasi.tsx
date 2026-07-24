"use client";

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
  ArrowRightCircle
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
  const { data: dataStats } = useSWR("/api/classes/stats", fetcher);

  const requestsIn = dataRequestsIn?.data || [];
  const classStats = dataStats?.data || [];

  // Derived: selected class for per-kelas report
  const selectedClass = useMemo(
    () => (reportClassId && reportClassId !== "all" ? classStats.find((c: any) => c.id === reportClassId) : null),
    [reportClassId, classStats]
  );
  const isPerClass = !!selectedClass;

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
      const payload: any = { statusApproval: newStatus };
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

  const generatePDF = async (req: any) => {
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
    const assignedClass = classStats.find((c: any) => c.id === req.targetClassId)?.name || "-";
    doc.text(`: ${assignedClass}`, 60, startY + 30);
    
    doc.text("Telah kami SETUJUI untuk diterima sebagai siswa pindahan di sekolah kami.", 20, startY + 50, { maxWidth: 170 });
    
    // Footer
    doc.text(`Kendal, ${format(new Date(), "d MMMM yyyy", { locale: idLocale })}`, 140, startY + 70);
    doc.text("Kepala Sekolah", 140, startY + 80);
    
    doc.text("( ...................... )", 140, startY + 100);
    
    doc.save(`Surat_Penerimaan_${req.studentName}.pdf`);
  };

  const currentClassStats = targetClass 
    ? classStats.find((c: any) => c.id === targetClass) 
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
  const mutasiLogs = dataLogs?.data || [];

  // Rekap per-grade from backend
  const { data: dataRekap } = useSWR(
    `/api/admin/mutasi/rekap?month=${reportMonth}`,
    fetcher
  );
  const rekapData = dataRekap?.data || [];

  const requestsOut = dataRequestsOut?.data || [];

  const [selectedRequestOut, setSelectedRequestOut] = useState<any>(null);
  const [openRequestIdOut, setOpenRequestIdOut] = useState<string | null>(null);
  const [liabilityData, setLiabilityData] = useState<any>(null);
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
      mutasiLogs.filter((log: any) => {
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
    () => monthlyLogs.filter((log: any) => log.mutasiType === "masuk"),
    [monthlyLogs]
  );
  const monthlyKeluarLogs = useMemo(
    () => monthlyLogs.filter((log: any) => log.mutasiType === "keluar"),
    [monthlyLogs]
  );
  const reportMonthLabel = useMemo(
    () => format(selectedReportDate, "MMMM yyyy", { locale: idLocale }).toUpperCase(),
    [selectedReportDate]
  );
  const masukRows = useMemo(
    () =>
      padReportRows(
        monthlyMasukLogs.map((log: any, index: number) => ({
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
        monthlyKeluarLogs.map((log: any, index: number) => ({
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
      const item = rekapData.find((r: any) => r.grade === grade);

      const logMasukL = monthlyMasukLogs.filter((log: any) => log.gender === "L").length;
      const logMasukP = monthlyMasukLogs.filter((log: any) => log.gender === "P").length;
      const logKeluarL = monthlyKeluarLogs.filter((log: any) => log.gender === "L").length;
      const logKeluarP = monthlyKeluarLogs.filter((log: any) => log.gender === "P").length;

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
          awalJM: awalL + awalP,
          masukL,
          masukP,
          masukJM: masukL + masukP,
          keluarL,
          keluarP,
          keluarJM: keluarL + keluarP,
          akhirL,
          akhirP,
          akhirJM: akhirL + akhirP,
          keterangan: monthlyLogs.length === 0 ? "Nihil" : "",
        },
      ];
    }

    // Semua kelas: use backend rekap data + fallback to logs calculation
    const rows = BOOK_RECAP_GRADES.map((grade) => {
      const item = rekapData.find((r: any) => r.grade === grade);
      const logMasukL = monthlyMasukLogs.filter((log: any) => (log.classGrade === grade || !log.classGrade) && log.gender === "L").length;
      const logMasukP = monthlyMasukLogs.filter((log: any) => (log.classGrade === grade || !log.classGrade) && log.gender === "P").length;
      const logKeluarL = monthlyKeluarLogs.filter((log: any) => (log.classGrade === grade || !log.classGrade) && log.gender === "L").length;
      const logKeluarP = monthlyKeluarLogs.filter((log: any) => (log.classGrade === grade || !log.classGrade) && log.gender === "P").length;

      const masukL = (item && typeof item.masukL === "number" && item.masukL > 0) ? item.masukL : logMasukL;
      const masukP = (item && typeof item.masukP === "number" && item.masukP > 0) ? item.masukP : logMasukP;
      const keluarL = (item && typeof item.keluarL === "number" && item.keluarL > 0) ? item.keluarL : logKeluarL;
      const keluarP = (item && typeof item.keluarP === "number" && item.keluarP > 0) ? item.keluarP : logKeluarP;

      const awalL = item ? item.awalL : 0;
      const awalP = item ? item.awalP : 0;
      const akhirL = item ? item.akhirL : 0;
      const akhirP = item ? item.akhirP : 0;

      return {
        grade,
        awalL,
        awalP,
        awalJM: awalL + awalP,
        masukL,
        masukP,
        masukJM: masukL + masukP,
        keluarL,
        keluarP,
        keluarJM: keluarL + keluarP,
        akhirL,
        akhirP,
        akhirJM: akhirL + akhirP,
        keterangan: "",
      };
    });

    // Calculate totals
    const totals = {
      awalL: rows.reduce((s, r) => s + r.awalL, 0),
      awalP: rows.reduce((s, r) => s + r.awalP, 0),
      masukL: rows.reduce((s, r) => s + r.masukL, 0),
      masukP: rows.reduce((s, r) => s + r.masukP, 0),
      keluarL: rows.reduce((s, r) => s + r.keluarL, 0),
      keluarP: rows.reduce((s, r) => s + r.keluarP, 0),
      akhirL: rows.reduce((s, r) => s + r.akhirL, 0),
      akhirP: rows.reduce((s, r) => s + r.akhirP, 0),
    };

    rows.push({
      grade: "Jumlah" as any,
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
      keterangan: monthlyLogs.length === 0 ? "Laporan nihil" : "",
    });

    return rows;
  }, [rekapData, monthlyLogs.length, isPerClass, selectedClass, monthlyMasukLogs, monthlyKeluarLogs]);

  const handleOpenDetailOut = async (req: any) => {
    setSelectedRequestOut(req);
    setCheckingLiability(true);
    setLiabilityData(null);
    
    try {
        const result: any = await goGet(`/api/admin/mutasi-keluar/${req.id}/check`);
        if(result.success) {
            setLiabilityData(result.data);
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
          <div className="p-4 flex justify-end border-b">
             <DialogMutasiMasukLangsung classStats={classStats} />
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
                    Gagal memuat permohonan mutasi masuk.
                  </TableCell>
                </TableRow>
              ) : requestsIn.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Tidak ada data permohonan.
                  </TableCell>
                </TableRow>
              ) : (
                requestsIn.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell className="hidden sm:table-cell">
                      {format(new Date(req.createdAt), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{req.registrationNumber}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-800 dark:text-zinc-200">{req.studentName}</div>
                      <div className="text-xs text-muted-foreground">{req.originSchool}</div>
                    </TableCell>
                    <TableCell>Kelas {req.targetGrade}</TableCell>
                    <TableCell>
                      <Badge variant={
                        req.statusApproval === "principal_approved" ? "default" : 
                        req.statusApproval === "rejected" ? "destructive" : 
                        req.statusApproval === "verified" ? "secondary" : "outline"
                      }>
                        {req.statusApproval === "principal_approved" ? "Disetujui" :
                         req.statusApproval === "rejected" ? "Ditolak" :
                         req.statusApproval === "verified" ? "Terverifikasi" : "Menunggu"}
                      </Badge>
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
                            <DialogTitle>Detail Permohonan</DialogTitle>
                            <DialogDescription>
                              {req.registrationNumber} - {req.studentName}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="grid grid-cols-2 gap-6 py-4">
                            <div className="space-y-4">
                              <h3 className="font-semibold border-b">Data Siswa</h3>
                              <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                                <span className="text-muted-foreground">NISN:</span>
                                <span>{req.nisn}</span>
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
                              <h3 className="font-semibold border-b">Data Orang Tua</h3>
                              <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                                <span className="text-muted-foreground">Nama:</span>
                                <span>{req.parentName}</span>
                                <span className="text-muted-foreground">WhatsApp:</span>
                                <a 
                                  href={`https://wa.me/${req.whatsappNumber}`} 
                                  target="_blank"
                                  className="text-green-600 hover:underline flex items-center"
                                >
                                  {req.whatsappNumber} <MessageCircle className="h-3 w-3 ml-1" />
                                </a>
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
                                        .filter((c: any) => c.grade === req.targetGrade)
                                        .map((c: any) => (
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
                                 <Check className="h-5 w-5" /> Permohonan telah disetujui. Silakan unduh surat dan kirim ke orang tua.
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
          <div className="p-4 flex justify-end border-b">
             <DialogMutasiKeluarLangsung />
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
                    Gagal memuat permohonan mutasi keluar.
                  </TableCell>
                </TableRow>
              ) : requestsOut.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Tidak ada permohonan.
                  </TableCell>
                </TableRow>
              ) : (
                requestsOut.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell className="hidden sm:table-cell">
                      {format(new Date(req.createdAt), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{req.nisn}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-800 dark:text-zinc-200">{req.studentName}</div>
                      <div className="text-xs text-muted-foreground">{req.className}</div>
                    </TableCell>
                    <TableCell>{req.destinationSchool}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {req.reason === "domisili" ? "Pindah Domisili" : 
                       req.reason === "tugas_orangtua" ? "Tugas Ortu" : "Lainnya"}
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
                            <DialogTitle>Detail Permohonan</DialogTitle>
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
                                                      {liabilityData.library.activeLoans}
                                                  </div>
                                                  <div className="text-xs text-muted-foreground">Buku belum kembali</div>
                                                  <Badge className="mt-2" variant={liabilityData.library.status === "Clear" ? "default" : "destructive"}>
                                                      {liabilityData.library.status}
                                                  </Badge>
                                              </Card>
                                              <Card className="p-4 border-l-4 border-l-green-500">
                                                  <div className="flex items-center gap-2 mb-2">
                                                      <Building className="h-4 w-4 text-green-500" />
                                                      <span className="font-medium">Tabungan</span>
                                                  </div>
                                                  <div className="text-2xl font-bold">
                                                      Rp {liabilityData.financial.balance.toLocaleString("id-ID")}
                                                  </div>
                                                  <div className="text-xs text-muted-foreground">Saldo tersisa</div>
                                                  <Badge className="mt-2" variant={liabilityData.financial.status === "Clear" ? "default" : "secondary"}>
                                                      {liabilityData.financial.status}
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
                  {classStats.map((c: any) => (
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
function padReportRows<T extends Record<string, any>>(
  rows: T[],
  targetCount: number
): T[] {
  const filled = [...rows];
  if (filled.length >= targetCount) return filled;
  
  // Create an empty filler object based on the first row's keys, or a default fallback
  const empty = {} as Record<string, any>;
  let keys = rows.length > 0 ? Object.keys(rows[0]) : [];
  if (keys.length === 0) {
    keys = ["no", "tanggal", "nama", "lp", "noInduk", "kelas", "sekolah", "asalNoInduk", "asalKelas", "persetujuanTanggal", "persetujuanNomor", "nomorSurat", "tujuan"];
  }
  keys.forEach((k) => (empty[k] = ""));
  
  while (filled.length < targetCount) {
    const filler = { ...empty };
    keys.forEach((k) => (filler[k] = "..."));
    filled.push(filler as T);
  }
  return filled;
}

function DialogMutasiMasukLangsung({ classStats }: { classStats: any[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    nisn: "",
    nis: "",
    gender: "L",
    metaData: "",
    originNis: "",
    originClass: "",
    classId: "",
    approvalNo: "",
    approvalDate: "",
    reason: ""
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.nisn || !form.classId) {
      toast.error("Nama, NISN, dan Kelas tujuan wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        student: {
          fullName: form.fullName,
          nisn: form.nisn,
          nis: form.nis || undefined,
          gender: form.gender,
          metaData: form.metaData,
          classId: form.classId
        },
        reason: form.reason,
        originNis: form.originNis,
        originClass: form.originClass,
        approvalNo: form.approvalNo,
        approvalDate: form.approvalDate
      };

      await goPost("/api/admin/mutasi/masuk/langsung", payload);
      toast.success("Mutasi masuk berhasil diproses");
      setOpen(false);
      mutate("/api/admin/mutasi/logs");
      mutate("/api/classes/stats");
      setForm({ fullName: "", nisn: "", nis: "", gender: "L", metaData: "", originNis: "", originClass: "", classId: "", approvalNo: "", approvalDate: "", reason: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memproses mutasi masuk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Proses Mutasi Masuk
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mutasi Masuk Langsung</DialogTitle>
          <DialogDescription>
            Isikan data mutasi masuk sesuai dokumen untuk pencatatan otomatis di Buku Mutasi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-2 max-h-[80vh] overflow-y-auto px-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nama Siswa *</Label>
              <Input 
                value={form.fullName} 
                onChange={(e) => setForm({...form, fullName: e.target.value})} 
                placeholder="Nama Lengkap" 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <Label>NISN *</Label>
              <Input 
                value={form.nisn} 
                onChange={(e) => setForm({...form, nisn: e.target.value})} 
                placeholder="10 digit NISN" 
                required 
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>NIS Sekolah Ini</Label>
              <Input 
                value={form.nis} 
                onChange={(e) => setForm({...form, nis: e.target.value})} 
                placeholder="No. Induk Baru" 
              />
            </div>
            <div className="space-y-1.5">
              <Label>Jenis Kelamin</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({...form, gender: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Laki-laki</SelectItem>
                  <SelectItem value="P">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kelas Penempatan *</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({...form, classId: v})} required>
                <SelectTrigger><SelectValue placeholder="Pilih Kelas"/></SelectTrigger>
                <SelectContent>
                  {classStats.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Sekolah Asal</Label>
              <Input 
                value={form.metaData} 
                onChange={(e) => setForm({...form, metaData: e.target.value})} 
                placeholder="SDN Asal..." 
              />
            </div>
            <div className="space-y-1.5">
              <Label>No. Induk Asal</Label>
              <Input 
                value={form.originNis} 
                onChange={(e) => setForm({...form, originNis: e.target.value})} 
                placeholder="NIS Sekolah Asal" 
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kelas Asal</Label>
              <Input 
                value={form.originClass} 
                onChange={(e) => setForm({...form, originClass: e.target.value})} 
                placeholder="misal: Kelas 3" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nomor Surat Persetujuan</Label>
              <Input 
                value={form.approvalNo} 
                onChange={(e) => setForm({...form, approvalNo: e.target.value})} 
                placeholder="No. Surat Rekomendasi/Dinas" 
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Surat Persetujuan</Label>
              <Input 
                type="date"
                value={form.approvalDate} 
                onChange={(e) => setForm({...form, approvalDate: e.target.value})} 
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label>Keterangan / Alasan Mutasi</Label>
            <Input 
              value={form.reason} 
              onChange={(e) => setForm({...form, reason: e.target.value})} 
              placeholder="Ikut Domisili Orang Tua..." 
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Proses Mutasi
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogMutasiKeluarLangsung() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    studentId: "",
    destinationSchool: "",
    destinationClass: "",
    letterNo: "",
    reason: ""
  });

  const { data: dataStudents } = useSWR(
    open ? "/api/students?limit=500&status=active" : null, 
    fetcher
  );
  const students = dataStudents?.data?.data || [];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId || !form.destinationSchool) {
      toast.error("Siswa dan Sekolah Tujuan wajib diisi");
      return;
    }

    setLoading(true);
    try {
      await goPost("/api/admin/mutasi-keluar/langsung", form);
      toast.success("Mutasi keluar berhasil diproses");
      setOpen(false);
      mutate("/api/admin/mutasi/logs");
      setForm({ studentId: "", destinationSchool: "", destinationClass: "", letterNo: "", reason: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memproses mutasi keluar. Pastikan tidak ada sangkutan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
          <ArrowRightCircle className="mr-2 h-4 w-4" /> Proses Mutasi Keluar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mutasi Keluar Langsung</DialogTitle>
          <DialogDescription>
            Isikan data mutasi keluar siswa untuk pencatatan otomatis di Buku Mutasi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-2">
          
          <div className="space-y-1.5">
            <Label>Pilih Siswa (Aktif) *</Label>
            <Select value={form.studentId} onValueChange={(v) => setForm({...form, studentId: v})} required>
              <SelectTrigger><SelectValue placeholder="Pilih Siswa"/></SelectTrigger>
              <SelectContent>
                {students.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.fullName} ({s.className})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sekolah Tujuan *</Label>
              <Input 
                value={form.destinationSchool} 
                onChange={(e) => setForm({...form, destinationSchool: e.target.value})} 
                placeholder="SDN Tujuan..." 
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ke Kelas (Tujuan)</Label>
              <Input 
                value={form.destinationClass} 
                onChange={(e) => setForm({...form, destinationClass: e.target.value})} 
                placeholder="misal: Kelas 4" 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nomor Surat Pindah / Permohonan</Label>
            <Input 
              value={form.letterNo} 
              onChange={(e) => setForm({...form, letterNo: e.target.value})} 
              placeholder="No. Surat Permohonan/Pindah" 
            />
          </div>
          
          <div className="space-y-1.5">
            <Label>Alasan Pindah</Label>
            <Input 
              value={form.reason} 
              onChange={(e) => setForm({...form, reason: e.target.value})} 
              placeholder="Ikut Orang Tua / Pindah Domisili..." 
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={loading} variant="destructive">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Keluarkan Siswa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface BukuMutasiPrintLayoutProps {
  reportMonthLabel: string;
  masukRows: any[];
  monthlyMasukLogs: any[];
  keluarRows: any[];
  monthlyKeluarLogs: any[];
  schoolSettings: any;
  rekapRows: any[];
  isPerClass: boolean;
  selectedClassName: string;
}

function BukuMutasiPrintLayout({
  reportMonthLabel,
  masukRows,
  monthlyMasukLogs,
  keluarRows,
  monthlyKeluarLogs,
  schoolSettings,
  rekapRows,
  isPerClass,
  selectedClassName,
}: BukuMutasiPrintLayoutProps) {
  const signatureLabel = isPerClass ? "Kepala Sekolah," : "Pengawas Sekolah,";
  const signatureName = isPerClass
    ? schoolSettings?.principal_name || "................................................"
    : schoolSettings?.supervisor_name || "................................................";
  const signatureNIP = isPerClass
    ? schoolSettings?.principal_nip || "...................................."
    : schoolSettings?.supervisor_nip || "....................................";

  return (
    <div className="mutasi-print-root bg-white p-2 text-black font-sans text-[9px] leading-tight">
      <div className="mx-auto w-full space-y-2">
        {/* Main Title */}
        <div className="flex justify-between items-baseline mb-2 border-b-2 border-black pb-1">
          <div className="text-[16px] font-bold tracking-wide uppercase">
            BUKU MUTASI MURID
          </div>
          {isPerClass && selectedClassName && (
            <div className="text-[12px] font-bold uppercase">
              {selectedClassName}
            </div>
          )}
        </div>

        {/* 2-Column Side-by-Side Main Grid */}
        <div className="grid grid-cols-2 gap-4 items-start">
          
          {/* LEFT SIDE: MASUK & SIGNATURE */}
          <div className="space-y-3">
            {/* Header Line */}
            <div className="flex justify-between items-center text-[10px] font-bold pb-0.5 border-b border-black">
              <span>BULAN : {reportMonthLabel}</span>
              <span className="uppercase tracking-wider">MASUK</span>
            </div>

            {/* MASUK Table (11 Columns) */}
            <div className="relative">
              <table className="w-full border-collapse border border-black table-fixed text-[8px]">
                <thead>
                  <tr className="bg-slate-50">
                    <th rowSpan={2} className="border border-black px-0.5 py-0.5 text-center w-[4%] leading-tight">No.<br />Urut</th>
                    <th rowSpan={2} className="border border-black px-0.5 py-0.5 text-center w-[9%] leading-tight">Tanggal</th>
                    <th rowSpan={2} className="border border-black px-0.5 py-0.5 text-left w-[20%] leading-tight">Nama Siswa</th>
                    <th rowSpan={2} className="border border-black px-0.5 py-0.5 text-center w-[4%] leading-tight">L/P</th>
                    <th rowSpan={2} className="border border-black px-0.5 py-0.5 text-center w-[9%] leading-tight">No.<br />Induk</th>
                    <th rowSpan={2} className="border border-black px-0.5 py-0.5 text-center w-[5%] leading-tight">Kelas</th>
                    <th colSpan={3} className="border border-black px-0.5 py-0.5 text-center leading-tight">Berasal dari</th>
                    <th colSpan={2} className="border border-black px-0.5 py-0.5 text-center leading-tight">Persetujuan<br />Kanwil/Kanko</th>
                  </tr>
                  <tr className="bg-slate-50">
                    <th className="border border-black px-0.5 py-0.5 text-left w-[18%] leading-tight">Sekolah</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[8%] leading-tight">No. Induk</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%] leading-tight">Kelas</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[9%] leading-tight">Tanggal</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[9%] leading-tight">Nomor</th>
                  </tr>
                </thead>
                <tbody>
                  {masukRows.map((row, index) => (
                    <tr key={`masuk-${index}`} className="h-6">
                      <td className="border border-black px-1 py-1 text-center font-medium">{row.no}</td>
                      <td className="border border-black px-1 py-1 text-center whitespace-nowrap">{row.tanggal}</td>
                      <td className="border border-black px-1 py-1 font-medium break-words whitespace-normal leading-tight">{row.nama}</td>
                      <td className="border border-black px-1 py-1 text-center">{row.lp}</td>
                      <td className="border border-black px-1 py-1 text-center font-mono">{row.noInduk}</td>
                      <td className="border border-black px-1 py-1 text-center">{row.kelas}</td>
                      <td className="border border-black px-1 py-1 break-words whitespace-normal leading-tight">{row.sekolah}</td>
                      <td className="border border-black px-1 py-1 text-center font-mono">{row.asalNoInduk}</td>
                      <td className="border border-black px-1 py-1 text-center">{row.asalKelas}</td>
                      <td className="border border-black px-1 py-1 text-center">{row.persetujuanTanggal}</td>
                      <td className="border border-black px-1 py-1 text-center">{row.persetujuanNomor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {monthlyMasukLogs.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-red-500 border-2 border-red-500 rounded px-6 py-1 text-2xl font-bold tracking-widest uppercase rotate-[-12deg] opacity-30">
                    NIHIL
                  </div>
                </div>
              )}
            </div>

            {/* Signature Block */}
            <div className="pt-8 pl-4 space-y-1 text-[10px]">
              <div className="font-bold">{signatureLabel}</div>
              <div className="h-14" />
              <div className="font-bold border-b border-black inline-block">
                {signatureName}
              </div>
              <div className="text-[9px]">
                NIP. {signatureNIP}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: KELUAR & REKAPITULASI */}
          <div className="space-y-3">
            {/* Header Line */}
            <div className="flex justify-between items-center text-[10px] font-bold pb-0.5 border-b border-black">
              <span>BULAN : {reportMonthLabel}</span>
              <span className="uppercase tracking-wider">KELUAR</span>
            </div>

            {/* KELUAR Table (8 Columns) */}
            <div className="relative">
              <table className="w-full border-collapse border border-black table-fixed text-[8.5px]">
                <thead>
                  <tr className="bg-slate-50 font-bold">
                    <th rowSpan={2} className="border border-black px-1 py-1 text-center w-[4%] leading-tight">No.<br />Urut</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 text-center w-[10%] leading-tight">Tanggal</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 text-left w-[23%] leading-tight">Nama Siswa</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 text-center w-[10%] leading-tight">No.<br />Induk</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 text-center w-[4%] leading-tight">L/P</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 text-center w-[7%] leading-tight">Kelas</th>
                    <th className="border border-black px-1 py-1 text-center w-[20%] leading-tight">Nomor Surat Pindah</th>
                    <th className="border border-black px-1 py-1 text-left w-[22%] leading-tight">Keterangan/<br />Pindah ke..</th>
                  </tr>
                </thead>
                <tbody>
                  {keluarRows.map((row, index) => (
                    <tr key={`keluar-${index}`} className="h-6">
                      <td className="border border-black px-1 py-1 text-center font-medium">{row.no}</td>
                      <td className="border border-black px-1 py-1 text-center whitespace-nowrap">{row.tanggal}</td>
                      <td className="border border-black px-1 py-1 font-medium break-words whitespace-normal leading-tight">{row.nama}</td>
                      <td className="border border-black px-1 py-1 text-center font-mono">{row.noInduk}</td>
                      <td className="border border-black px-1 py-1 text-center">{row.lp}</td>
                      <td className="border border-black px-1 py-1 text-center">{row.kelas}</td>
                      <td className="border border-black px-1 py-1 text-center break-words whitespace-normal leading-tight">{row.nomorSurat}</td>
                      <td className="border border-black px-1 py-1 break-words whitespace-normal leading-tight">{row.tujuan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {monthlyKeluarLogs.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-red-500 border-2 border-red-500 rounded px-6 py-1 text-2xl font-bold tracking-widest uppercase rotate-[-12deg] opacity-30">
                    NIHIL
                  </div>
                </div>
              )}
            </div>

            {/* REKAPITULASI Section */}
            <div className="pt-2">
              <div className="text-[10px] font-bold uppercase mb-1">REKAPITULASI</div>
              <table className="w-full border-collapse border border-black table-fixed text-[8.5px]">
                <thead>
                  <tr className="bg-slate-50 font-bold">
                    <th rowSpan={2} className="border border-black px-1 py-1 text-center w-[10%] font-bold">Kelas</th>
                    <th colSpan={3} className="border border-black px-0.5 py-0.5 text-center">Awal Bulan</th>
                    <th colSpan={3} className="border border-black px-0.5 py-0.5 text-center">MASUK</th>
                    <th colSpan={3} className="border border-black px-0.5 py-0.5 text-center">KELUAR</th>
                    <th colSpan={3} className="border border-black px-0.5 py-0.5 text-center">Akhir Bulan</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 text-center w-[18%]">Keterangan</th>
                  </tr>
                  <tr className="bg-slate-50 text-[8px] font-semibold">
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">L</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">P</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[6%] font-bold">JM</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">L</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">P</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[6%] font-bold">JM</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">L</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">P</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[6%] font-bold">JM</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">L</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">P</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[6%] font-bold">JM</th>
                  </tr>
                </thead>
                <tbody>
                  {rekapRows.map((row) => (
                    <tr key={`rekap-${row.grade}`} className={row.grade === "Jumlah" ? "font-bold bg-slate-100 border-t-2 border-black" : "h-5"}>
                      <td className="border border-black px-1 py-0.5 text-center font-bold">
                        {typeof row.grade === "number" ? toRoman(row.grade) : row.grade}
                      </td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.awalL !== "" ? row.awalL : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.awalP !== "" ? row.awalP : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center font-bold bg-slate-50">{row.awalJM !== "" ? row.awalJM : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.masukL !== "" ? row.masukL : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.masukP !== "" ? row.masukP : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center font-bold bg-slate-50">{row.masukJM !== "" ? row.masukJM : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.keluarL !== "" ? row.keluarL : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.keluarP !== "" ? row.keluarP : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center font-bold bg-slate-50">{row.keluarJM !== "" ? row.keluarJM : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.akhirL !== "" ? row.akhirL : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.akhirP !== "" ? row.akhirP : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center font-bold bg-slate-50">{row.akhirJM !== "" ? row.akhirJM : 0}</td>
                      <td className="border border-black px-1 py-0.5 text-center font-medium">{row.keterangan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Note — only on screen preview */}
        <div className="no-print rounded border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-[8px] text-slate-500 mt-2">
          Format cetak mengikuti standar resmi Buku Mutasi Murid (A4 Landscape). Kolom yang belum terisi otomatis sengaja dibiarkan kosong untuk kelengkapan arsip manual.
        </div>
      </div>
    </div>
  );
}
