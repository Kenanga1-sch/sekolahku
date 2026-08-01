"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { format, subDays, getDaysInMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Download, FileText, Filter, Loader2, Calendar as CalendarIcon, Printer, ChevronLeft, ChevronRight, User, Calendar, BarChart2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { goGet } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { siteConfig } from "@/lib/config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AttendanceRecord {
  id: string;
  date: string;
  className: string;
  studentId: string;
  studentName: string;
  nis: string | null;
  nisn: string | null;
  status: "hadir" | "sakit" | "izin" | "alpha";
  checkInTime: string | null;
  recordMethod: "qr_scan" | "manual";
}

interface ReportData {
  records: AttendanceRecord[];
  summary: {
    hadir: number;
    sakit: number;
    izin: number;
    alpha: number;
    total: number;
  };
}

interface StudentMatrix {
  studentId: string;
  studentName: string;
  nis: string;
  dailyStatus: Record<number, "H" | "S" | "I" | "A" | "-">;
  totalHadir: number;
  totalSakit: number;
  totalIzin: number;
  totalAlpha: number;
}

interface StudentAttendanceSummary {
  academicYear: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
  totalDays: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const STATUS_LABELS: Record<string, string> = {
  hadir: "Hadir",
  sakit: "Sakit",
  izin: "Izin",
  alpha: "Alpha",
};

const STATUS_BADGES: Record<string, string> = {
  hadir: "bg-green-100 text-green-700",
  sakit: "bg-yellow-100 text-yellow-700",
  izin: "bg-blue-100 text-blue-700",
  alpha: "bg-red-100 text-red-700",
};

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function getStatusLabel(status: string): string {
  switch (status) {
    case "hadir": return "H";
    case "sakit": return "S";
    case "izin": return "I";
    case "alpha": return "A";
    default: return "-";
  }
}

function extractStudents(res: any): { id: string; name?: string; fullName?: string; username?: string; nis?: string; nisn?: string; className?: string }[] {
  const nested = res?.data?.data || res?.data?.students || res?.data;
  if (Array.isArray(nested)) return nested;
  if (Array.isArray(res)) return res;
  return [];
}

function calculateAttendancePercentage(hadir: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((hadir / total) * 1000) / 10; // 1 decimal place
}

// Normalize class name for consistent filtering
function normalizeClassName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, '');
}

export default function LaporanPresensiPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const pathname = usePathname();

  const [tab, setTab] = useState<"harian" | "bulanan">("harian");

  // --- Harian state ---
  const [loadingHarian, setLoadingHarian] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [className, setClassName] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // --- Harian computed ---
  const paginatedRecords = useMemo(() => {
    if (!data) return [];
    const start = (currentPage - 1) * pageSize;
    return data.records.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => { setCurrentPage(1); }, [startDate, endDate, className]);

  // --- Bulanan state ---
  const [loadingBulanan, setLoadingBulanan] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const printRef = useRef<HTMLDivElement>(null);

  const [classes, setClasses] = useState<{ name: string; teacherName?: string | null }[]>([]);
  const [studentsList, setStudentsList] = useState<{ id: string; name?: string; fullName?: string; username?: string; nis?: string; nisn?: string; className?: string }[]>([]);
  const [principalName, setPrincipalName] = useState("");
  const [principalNIP, setPrincipalNIP] = useState("");

  // Student detail modal state
  const [detailStudent, setDetailStudent] = useState<{ id: string; name: string; nis: string; className: string } | null>(null);
  const [studentDetailLoading, setStudentDetailLoading] = useState(false);
  const [studentDetailData, setStudentDetailData] = useState<StudentAttendanceSummary[]>([]);



  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let y = current - 3; y <= current + 1; y++) years.push(y);
    return years;
  }, []);

  useEffect(() => {
    goGet("/api/classes")
      .then((response: any) => setClasses(response?.data || response || []))
      .catch(() => {});
  }, []);

  // Fetch school settings for principal name & NIP
  useEffect(() => {
    goGet("/api/school-settings")
      .then((response: any) => {
        const s = response?.data || response || {};
        setPrincipalName(s.principal_name || s.principalName || "");
        setPrincipalNIP(s.principal_nip || s.principalNIP || "");
      })
      .catch(() => {});
  }, []);

  // Reset state on client-side navigation (defensive, complementing layout key)
  useEffect(() => {
    setTab("harian");
    setLoadingHarian(false);
    setLoadingBulanan(false);
    setData(null);
    setRecords([]);
  }, [pathname]);

  // --- Harian fetcher ---
  const fetchReport = useCallback(async () => {
    if (!startDate || !endDate) { toast.error("Tanggal mulai dan selesai harus diisi"); return; }
    setLoadingHarian(true);
    try {
      const normalizedClass = className === "all" ? "all" : normalizeClassName(className);
      const params = new URLSearchParams({ startDate, endDate, class: normalizedClass });
      const response: any = await goGet(`/api/attendance/report?${params.toString()}`);
      setData(response?.data || response);
    } catch (error: any) {
      toast.error(error.message || "Gagal memuat laporan");
    } finally { setLoadingHarian(false); }
  }, [startDate, endDate, className]);

  const handleExport = () => {
    const normalizedClass = className === "all" ? "all" : normalizeClassName(className);
    const params = new URLSearchParams({ startDate, endDate, class: normalizedClass });
    window.location.href = `${API_BASE}/api/attendance/export?${params.toString()}`;
  };

  const handleExportPdf = () => {
    // Open print dialog for the current view (monthly tab uses print CSS)
    // For daily tab, we'd need a separate PDF generation
    if (tab === "bulanan") {
      window.print();
    } else {
      // For daily report, create a printable view
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      
      const headers = ['Tanggal', 'Kelas', 'Siswa', 'NIS/NISN', 'Status', 'Waktu', 'Metode'];
      const rows = data?.records.map(r => [
        r.date,
        `Kelas ${r.className}`,
        r.studentName,
        r.nis || r.nisn || '-',
        STATUS_LABELS[r.status],
        r.checkInTime || '-',
        r.recordMethod === 'qr_scan' ? 'QR' : 'Manual'
      ]) || [];
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Laporan Presensi Harian</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; }
            h2 { text-align: center; margin: 0 0 5px; }
            .meta { text-align: center; font-size: 10px; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 4px; text-align: center; }
            th { background: #f0f0f0; }
            .text-left { text-align: left; }
          </style>
        </head>
        <body>
          <h2>LAPORAN PRESENSI HARIAN</h2>
          <div class="meta">
            ${siteConfig.school.name}<br>
            Periode: ${format(new Date(startDate), "d MMM yyyy", { locale: localeId })} - ${format(new Date(endDate), "d MMM yyyy", { locale: localeId })}<br>
            Kelas: ${className === "all" ? "Semua Kelas" : `Kelas ${className}`}
          </div>
          <table>
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td class="${i === 2 ? 'text-left' : ''}">${cell}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
          <script>window.onload = () => window.print();</script>
        </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // --- Bulanan fetcher ---
  const daysInMonth = useMemo(() => getDaysInMonth(new Date(selectedYear, selectedMonth - 1)), [selectedYear, selectedMonth]);

  const fetchBulanan = useCallback(async () => {
    setLoadingBulanan(true);
    try {
      const s = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
      const e = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
      const normalizedClass = selectedClass === "all" ? "all" : normalizeClassName(selectedClass);
      const params = new URLSearchParams({ startDate: s, endDate: e, class: normalizedClass });
      const res: any = await goGet(`/api/attendance/report?${ params.toString()}`);
      const d = res?.data || res;
      setRecords(d?.records || []);

      // Fetch students list for the selected class (to include students without attendance data)
      if (selectedClass && selectedClass !== "all") {
        try {
          const studentsRes: any = await goGet(`/api/students?className=${encodeURIComponent(normalizedClass)}&limit=500&status=active`);
          const studentsData = extractStudents(studentsRes);
          setStudentsList(studentsData);
        } catch {
          setStudentsList([]);
        }
      } else if (selectedClass === "all") {
        // Fetch all students for "Semua Kelas" view
        try {
          const studentsRes: any = await goGet(`/api/students?limit=1000&status=active`);
          const studentsData = extractStudents(studentsRes);
          setStudentsList(studentsData);
        } catch {
          setStudentsList([]);
        }
      } else {
        setStudentsList([]);
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat data");
    } finally { setLoadingBulanan(false); }
  }, [selectedYear, selectedMonth, selectedClass, daysInMonth]);

  // Fetch student attendance detail
  const fetchStudentDetail = useCallback(async (studentId: string, studentName: string, nis: string, className: string) => {
    setStudentDetailLoading(true);
    setDetailStudent({ id: studentId, name: studentName, nis, className });
    try {
      const response: any = await goGet(`/api/attendance/student-summary/${studentId}`);
      const summary = response?.data || response || [];
      setStudentDetailData(summary);
    } catch (error: any) {
      toast.error(error.message || "Gagal memuat riwayat siswa");
      setStudentDetailData([]);
    } finally {
      setStudentDetailLoading(false);
    }
  }, []);

  const handleStudentClick = useCallback((student: { id: string; name: string; nis: string; className: string }) => {
    fetchStudentDetail(student.id, student.name, student.nis, student.className);
  }, [fetchStudentDetail]);

  useEffect(() => { if (tab === "bulanan") fetchBulanan(); }, [tab, fetchBulanan]);

  const matrix = useMemo(() => {
    const map = new Map<string, StudentMatrix>();
    
    // Add students from attendance records
    for (const r of records) {
      if (!map.has(r.studentId)) {
        map.set(r.studentId, {
          studentId: r.studentId,
          studentName: r.studentName,
          nis: r.nis || r.nisn || "-",
          dailyStatus: {},
          totalHadir: 0, totalSakit: 0, totalIzin: 0, totalAlpha: 0,
        });
      }
      const m = map.get(r.studentId)!;
      const day = parseInt(r.date.split("-")[2], 10);
      m.dailyStatus[day] = getStatusLabel(r.status) as "H" | "S" | "I" | "A" | "-";
      if (r.status === "hadir") m.totalHadir++;
      else if (r.status === "sakit") m.totalSakit++;
      else if (r.status === "izin") m.totalIzin++;
      else if (r.status === "alpha") m.totalAlpha++;
    }
    
    // Add students from studentsList that don't have attendance records
    for (const s of studentsList) {
      if (!map.has(s.id)) {
        map.set(s.id, {
          studentId: s.id,
          studentName: s.name || s.fullName || s.username || "-",
          nis: s.nis || s.nisn || "-",
          dailyStatus: {},
          totalHadir: 0, totalSakit: 0, totalIzin: 0, totalAlpha: 0,
        });
      }
    }
    
    return Array.from(map.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [records, studentsList]);

  const handlePrint = () => window.print();

  const monthName = MONTHS[selectedMonth - 1];
  const classNameBulanan = selectedClass === "all" ? "Semua Kelas" : `Kelas ${selectedClass}`;

  const getWaliKelas = (clsName: string): string => {
    const normalized = clsName.replace(/^Kelas\s*/i, "").trim();
    const match = classes.find(
      (c) => c.name === clsName || c.name === normalized || c.name === `Kelas ${normalized}`
    );
    return match?.teacherName || "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="no-print flex items-center gap-4">
        <Link href="/presensi">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Laporan Presensi
          </h1>
          <p className="text-muted-foreground">Rekapitulasi kehadiran siswa</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="no-print flex gap-1 bg-muted rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("harian")}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            tab === "harian" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Rekap Harian
        </button>
        <button
          onClick={() => setTab("bulanan")}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            tab === "bulanan" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Daftar Hadir Bulanan
        </button>
      </div>

      {/* ========== TAB HARIAN ========== */}
      {tab === "harian" && (
        <>
          {/* Filter Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter Laporan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Preset Filter Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(start.getDate() - 6); // 7 hari termasuk hari ini
                  setStartDate(format(start, "yyyy-MM-dd"));
                  setEndDate(format(end, "yyyy-MM-dd"));
                }}>
                  Minggu Ini
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  const end = new Date();
                  const start = new Date(end.getFullYear(), end.getMonth(), 1);
                  setStartDate(format(start, "yyyy-MM-dd"));
                  setEndDate(format(end, "yyyy-MM-dd"));
                }}>
                  Bulan Ini
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  // Semester 1: Juli - Desember
                  const now = new Date();
                  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
                  const start = new Date(year, 6, 1); // 1 Juli
                  const end = new Date(year, 11, 31); // 31 Desember
                  if (now >= start && now <= end) {
                    setStartDate(format(start, "yyyy-MM-dd"));
                    setEndDate(format(now, "yyyy-MM-dd"));
                  } else {
                    toast.info("Belum memasuki semester 1 tahun ini");
                  }
                }}>
                  Semester 1
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  // Semester 2: Januari - Juni
                  const now = new Date();
                  const year = now.getMonth() < 6 ? now.getFullYear() : now.getFullYear() + 1;
                  const start = new Date(year, 0, 1); // 1 Januari
                  const end = new Date(year, 5, 30); // 30 Juni
                  if (now >= start && now <= end) {
                    setStartDate(format(start, "yyyy-MM-dd"));
                    setEndDate(format(now, "yyyy-MM-dd"));
                  } else {
                    toast.info("Belum memasuki semester 2 tahun ini");
                  }
                }}>
                  Semester 2
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  // Tahun Ajaran: Juli - Juni berikutnya
                  const now = new Date();
                  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
                  const start = new Date(startYear, 6, 1); // 1 Juli
                  const end = new Date(startYear + 1, 5, 30); // 30 Juni thn berikutnya
                  if (now >= start && now <= end) {
                    setStartDate(format(start, "yyyy-MM-dd"));
                    setEndDate(format(now, "yyyy-MM-dd"));
                  } else {
                    toast.info("Tahun ajaran belum dimulai");
                  }
                }}>
                  Tahun Ajaran
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Tanggal Mulai</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Selesai</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Kelas</Label>
                  <Select value={className} onValueChange={setClassName}>
                    <SelectTrigger><SelectValue placeholder="Semua Kelas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kelas</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.name} value={cls.name}>Kelas {cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={fetchReport} variant="outline" className="w-full" disabled={loadingHarian}>
                  {loadingHarian ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Filter className="h-4 w-4 mr-2" />}
                  Tampilkan
                </Button>
                <Button onClick={handleExport} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {data && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Card><CardContent className="py-4"><p className="text-2xl font-bold">{data.summary.total}</p><p className="text-xs text-muted-foreground">Total Catatan</p></CardContent></Card>
              <Card className="border-green-200"><CardContent className="py-4"><p className="text-2xl font-bold text-green-700">{data.summary.hadir}</p><p className="text-xs text-green-600">Hadir</p></CardContent></Card>
              <Card className="border-yellow-200"><CardContent className="py-4"><p className="text-2xl font-bold text-yellow-700">{data.summary.sakit}</p><p className="text-xs text-yellow-600">Sakit</p></CardContent></Card>
              <Card className="border-blue-200"><CardContent className="py-4"><p className="text-2xl font-bold text-blue-700">{data.summary.izin}</p><p className="text-xs text-blue-600">Izin</p></CardContent></Card>
              <Card className="border-red-200"><CardContent className="py-4"><p className="text-2xl font-bold text-red-700">{data.summary.alpha}</p><p className="text-xs text-red-600">Alpha</p></CardContent></Card>
              <Card className="border-purple-200"><CardContent className="py-4"><p className="text-2xl font-bold text-purple-700">{calculateAttendancePercentage(data.summary.hadir, data.summary.total)}%</p><p className="text-xs text-purple-600">% Kehadiran</p></CardContent></Card>
            </div>
          )}

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-4 flex items-start gap-3 text-sm text-blue-700">
              <CalendarIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Tentang Laporan</p>
                <p className="mt-1 opacity-90">
                  Laporan yang diunduh mencakup detail kehadiran siswa, waktu check-in, metode presensi (QR/Manual), dan status kehadiran. Gunakan filter tanggal dan kelas untuk membatasi data yang ingin dianalisis.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview Laporan</CardTitle>
              <CardDescription>
                {data ? `${data.records.length} catatan pada rentang ${format(new Date(startDate), "d MMM yyyy", { locale: localeId })} - ${format(new Date(endDate), "d MMM yyyy", { locale: localeId })}` : "Pilih filter lalu tampilkan laporan"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHarian ? (
                <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin" />Memuat laporan...</div>
              ) : !data || data.records.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border rounded-lg bg-muted/20 border-dashed">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p>Belum ada data presensi pada filter ini</p>
                  <p className="text-xs">Sesi yang sudah ditutup akan otomatis menyertakan siswa alpha</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  {/* Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border-b bg-muted/30">
                    <span className="text-sm text-muted-foreground">
                      Menampilkan {Math.min((currentPage - 1) * pageSize + 1, data.records.length)} - {Math.min(currentPage * pageSize, data.records.length)} dari {data.records.length} catatan
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                        className="border border-slate-200 rounded px-2 py-1 text-sm"
                      >
                        <option value={25}>25 per halaman</option>
                        <option value={50}>50 per halaman</option>
                        <option value={100}>100 per halaman</option>
                        <option value={200}>200 per halaman</option>
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportPdf}
                      >
                        <FileText className="h-4 w-4 mr-1" />PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium w-20 text-center">
                        Halaman {currentPage} / {Math.ceil(data.records.length / pageSize)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(data.records.length / pageSize), p + 1))}
                        disabled={currentPage >= Math.ceil(data.records.length / pageSize)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead><TableHead>Kelas</TableHead><TableHead>Siswa</TableHead>
                        <TableHead>Status</TableHead><TableHead>Waktu</TableHead><TableHead>Metode</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.date}</TableCell>
                          <TableCell>Kelas {record.className}</TableCell>
                          <TableCell>
                            <div><p className="font-medium">{record.studentName}</p><p className="text-xs text-muted-foreground">{record.nis || record.nisn || "-"}</p></div>
                          </TableCell>
                          <TableCell><Badge className={STATUS_BADGES[record.status]}>{STATUS_LABELS[record.status]}</Badge></TableCell>
                          <TableCell>{record.checkInTime || "-"}</TableCell>
                          <TableCell>{record.recordMethod === "qr_scan" ? "QR" : "Manual"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ========== TAB BULANAN ========== */}
      {tab === "bulanan" && (
        <div className="space-y-4" ref={printRef}>
          {/* Filter & Actions */}
          <Card className="no-print">
            <CardContent className="flex items-center gap-3 flex-wrap py-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Bulan</Label>
                <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (<SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Tahun</Label>
                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="w-[85px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Kelas</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kelas</SelectItem>
                      {classes.map((c) => (<SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={fetchBulanan} variant="outline" size="sm" disabled={loadingBulanan}>
                {loadingBulanan && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Tampilkan
              </Button>
              <Button onClick={handlePrint} size="sm" className="ml-auto">
                <Printer className="h-4 w-4 mr-1" />Cetak
              </Button>
              <Button onClick={handleExportPdf} size="sm" className="ml-2">
                <FileText className="h-4 w-4 mr-1" />Export PDF
              </Button>
            </CardContent>
          </Card>

          {/* Summary Cards for Monthly Report */}
          {!loadingBulanan && matrix.length > 0 && (
            <div className="no-print grid grid-cols-2 md:grid-cols-6 gap-3">
              <Card><CardContent className="py-3"><p className="text-xl font-bold">{matrix.length}</p><p className="text-xs text-muted-foreground">Total Siswa</p></CardContent></Card>
              <Card className="border-green-200"><CardContent className="py-3"><p className="text-xl font-bold text-green-700">{matrix.reduce((sum, s) => sum + s.totalHadir, 0)}</p><p className="text-xs text-green-600">Total Hadir</p></CardContent></Card>
              <Card className="border-yellow-200"><CardContent className="py-3"><p className="text-xl font-bold text-yellow-700">{matrix.reduce((sum, s) => sum + s.totalSakit, 0)}</p><p className="text-xs text-yellow-600">Total Sakit</p></CardContent></Card>
              <Card className="border-blue-200"><CardContent className="py-3"><p className="text-xl font-bold text-blue-700">{matrix.reduce((sum, s) => sum + s.totalIzin, 0)}</p><p className="text-xs text-blue-600">Total Izin</p></CardContent></Card>
              <Card className="border-red-200"><CardContent className="py-3"><p className="text-xl font-bold text-red-700">{matrix.reduce((sum, s) => sum + s.totalAlpha, 0)}</p><p className="text-xs text-red-600">Total Alpha</p></CardContent></Card>
              <Card className="border-purple-200"><CardContent className="py-3"><p className="text-xl font-bold text-purple-700">{(() => { const totalHadir = matrix.reduce((sum, s) => sum + s.totalHadir, 0); const totalHari = matrix.reduce((sum, s) => sum + s.totalHadir + s.totalSakit + s.totalIzin + s.totalAlpha, 0); return totalHari > 0 ? Math.round((totalHadir / totalHari) * 1000) / 10 : 0; })()}%</p><p className="text-xs text-purple-600">% Kehadiran Kelas</p></CardContent></Card>
            </div>
          )}

          {loadingBulanan ? (
            <div className="space-y-4">
              {/* Skeleton untuk filter card */}
              <Card className="no-print">
                <CardContent className="flex items-center gap-3 flex-wrap py-3">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-24" />
                </CardContent>
              </Card>
              {/* Skeleton untuk print page */}
              <div className="print-page bg-white p-4">
                <Skeleton className="h-6 w-48 mx-auto mb-2" />
                <Skeleton className="h-4 w-64 mx-auto mb-4" />
                <Skeleton className="h-4 w-32 mx-auto mb-4" />
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border p-2 w-12"><Skeleton className="h-4 w-8" /></th>
                        <th className="border p-2 w-32"><Skeleton className="h-4 w-24" /></th>
                        <th className="border p-2 w-48"><Skeleton className="h-4 w-36" /></th>
                        {Array.from({ length: 31 }, (_, i) => (
                          <th key={i} className="border p-2 w-8"><Skeleton className="h-3 w-6" /></th>
                        ))}
                        <th className="border p-2 w-16"><Skeleton className="h-3 w-10" /></th>
                        <th className="border p-2 w-16"><Skeleton className="h-3 w-10" /></th>
                        <th className="border p-2 w-16"><Skeleton className="h-3 w-10" /></th>
                        <th className="border p-2 w-20"><Skeleton className="h-3 w-12" /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 10 }, (_, row) => (
                        <tr key={row}>
                          <td className="border p-2 text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                          <td className="border p-2"><Skeleton className="h-4 w-20" /></td>
                          <td className="border p-2"><Skeleton className="h-4 w-32" /></td>
                          {Array.from({ length: 31 }, (_, i) => (
                            <td key={i} className="border p-2 text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                          ))}
                          <td className="border p-2 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                          <td className="border p-2 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                          <td className="border p-2 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                          <td className="border p-2 text-center"><Skeleton className="h-4 w-10 mx-auto" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between mt-6">
                  <div className="text-center"><Skeleton className="h-4 w-32 mx-auto" /><Skeleton className="h-4 w-24 mx-auto mt-2" /><Skeleton className="h-2 w-32 mx-auto mt-10" /><Skeleton className="h-3 w-16 mx-auto mt-2" /></div>
                  <div className="text-center"><Skeleton className="h-4 w-32 mx-auto" /><Skeleton className="h-4 w-24 mx-auto mt-2" /><Skeleton className="h-2 w-32 mx-auto mt-10" /><Skeleton className="h-3 w-16 mx-auto mt-2" /></div>
                </div>
              </div>
            </div>
          ) : matrix.length === 0 ? (
            <>
              <Card className="no-print bg-yellow-50 border-yellow-200">
                <CardContent className="py-3 text-center text-yellow-700 text-sm">
                  Belum ada data presensi untuk periode ini. Menampilkan format tabel kosong untuk verifikasi.
                </CardContent>
              </Card>
              <PrintPage matrix={[]} daysInMonth={daysInMonth}
                monthName={monthName} year={selectedYear} className={classNameBulanan}
                onStudentClick={handleStudentClick}
                principalName={principalName} principalNIP={principalNIP}
              />
            </>
          ) : isAdmin && selectedClass === "all" ? (
            Array.from(new Set([
              ...(records || []).map(r => r?.className).filter(Boolean),
              ...studentsList.map(s => s?.className).filter(Boolean),
            ])).sort().map(cls => {
              const classMatrix = matrix.filter(m =>
                (records || []).some(r => r?.studentId === m.studentId && r?.className === cls) ||
                studentsList.some(s => s?.id === m.studentId && s?.className === cls)
              );
              if (classMatrix.length === 0) return null;
              return (
                <PrintPage key={cls} matrix={classMatrix} daysInMonth={daysInMonth}
                  monthName={monthName} year={selectedYear} className={`Kelas ${cls}`}
                  onStudentClick={handleStudentClick}
                  principalName={principalName} principalNIP={principalNIP}
                  waliKelas={getWaliKelas(String(cls))}
                />
              );
            })
          ) : (
            <PrintPage matrix={matrix} daysInMonth={daysInMonth}
              monthName={monthName} year={selectedYear} className={classNameBulanan}
              onStudentClick={handleStudentClick}
              principalName={principalName} principalNIP={principalNIP}
              waliKelas={getWaliKelas(classNameBulanan)}
            />
          )}
        </div>
      )}

      {/* Student Detail Modal */}
      <StudentDetailModal
        student={detailStudent}
        data={studentDetailData}
        loading={studentDetailLoading}
        onClose={() => setDetailStudent(null)}
      />
    </div>
  );
}

// Student Detail Modal Component
function StudentDetailModal({
  student,
  data,
  loading,
  onClose,
}: {
  student: { id: string; name: string; nis: string; className: string } | null;
  data: StudentAttendanceSummary[];
  loading: boolean;
  onClose: () => void;
}) {
  if (!student) return null;

  return (
    <Dialog open={!!student} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Riwayat Kehadiran: {student.name}
          </DialogTitle>
          <DialogDescription>
            NIS: {student.nis} • Kelas: {student.className}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Belum ada data kehadiran untuk siswa ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Tahun Ajaran</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Sakit</TableHead>
                    <TableHead className="text-center">Izin</TableHead>
                    <TableHead className="text-center">Alpha</TableHead>
                    <TableHead className="text-center">Total Hari</TableHead>
                    <TableHead className="text-center">% Kehadiran</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d) => {
                    const pct = d.totalDays > 0 ? Math.round((d.hadir / d.totalDays) * 1000) / 10 : 0;
                    return (
                      <TableRow key={d.academicYear}>
                        <TableCell className="font-medium text-center">{d.academicYear}</TableCell>
                        <TableCell className="text-center text-green-700 font-medium">{d.hadir}</TableCell>
                        <TableCell className="text-center text-yellow-700">{d.sakit}</TableCell>
                        <TableCell className="text-center text-blue-700">{d.izin}</TableCell>
                        <TableCell className="text-center text-red-700">{d.alpha}</TableCell>
                        <TableCell className="text-center">{d.totalDays}</TableCell>
                        <TableCell className="text-center font-semibold text-purple-700">{pct}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PrintPage({
  matrix, daysInMonth, monthName, year, className,
  onStudentClick, principalName, principalNIP, waliKelas, waliNIP,
}: {
  matrix: StudentMatrix[]; daysInMonth: number; monthName: string; year: number; className: string;
  onStudentClick?: (student: { id: string; name: string; nis: string; className: string }) => void;
  principalName?: string; principalNIP?: string; waliKelas?: string; waliNIP?: string;
}) {
  // Calculate class attendance percentage
  const totalSiswa = matrix?.length || 0;
  const totalHadirKelas = matrix?.reduce((sum, s) => sum + (s.totalHadir || 0), 0) || 0;
  const activeDays = matrix?.flatMap(s => Object.keys(s.dailyStatus || {})) || [];
  const totalHariEfektif = activeDays.length > 0 ? Math.max(...activeDays.map(d => Number(d) || 0), 1) : daysInMonth;
  const denominator = totalSiswa * totalHariEfektif;
  const persentaseKelas = totalSiswa > 0 && denominator > 0 
    ? Math.round((totalHadirKelas / denominator) * 1000) / 10 
    : 0;

  // Dynamic font size so 1 class always fits on 1 F4 page (landscape)
  // rows = siswa + 2 header rows; F4 landscape usable height ~200mm ≈ 756px.
  const rowCount = Math.max(totalSiswa, 1) + 2;
  const baseFont = Math.min(8, Math.max(4.5, 660 / rowCount));

  return (
    <div className="print-page" style={{ ["--pf" as any]: `${baseFont}px`, background: "white" }}>
      <style>{`
        @media print {
          @page { size: 8.27in 13in landscape; margin: 5mm; }
          body { font-size: ${baseFont}px; }
        }
        .print-page {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .print-page + .print-page {
          break-before: page;
          page-break-before: always;
        }
        .print-table {
          width: 100%; border-collapse: collapse; font-size: var(--pf);
        }
        .print-table th, .print-table td {
          border: 0.5px solid #000; padding: 0.5px 1px; text-align: center; white-space: nowrap;
        }
        .print-table th { background: #f0f0f0; font-weight: 600; }
        .print-table .col-no { width: 4.5%; }
        .print-table .col-nis { width: 11%; }
        .print-table .col-name { text-align: left; }
        .print-table .col-day { font-size: calc(var(--pf) * 0.85); min-width: 10px; width: 1.8%; max-width: 1.8%; }
        .print-table .col-sum { }
        .print-table .col-pct { font-weight: 600; }
        .print-table .col-hadir { color: #15803d; font-weight: 600; }
        .print-table .status-h { color: #15803d; }
        .print-table .status-s { color: #b45309; }
        .print-table .status-i { color: #1d4ed8; }
        .print-table .status-a { color: #dc2626; }
        .print-table td.col-name { text-decoration: none !important; }
        .signature-block { break-inside: avoid; page-break-inside: avoid; }
      `}</style>

      <div style={{ textAlign: "center", marginBottom: "0.3rem" }}>
        <h2 style={{ margin: 0, fontSize: "calc(var(--pf) * 1.8)", fontWeight: 700 }}>DAFTAR HADIR SISWA</h2>
        <p style={{ margin: "1px 0", fontSize: "calc(var(--pf) * 1.4)", fontWeight: 600 }}>{siteConfig.school.name}</p>
        <p style={{ margin: 0, fontSize: "calc(var(--pf) * 1.2)" }}>Tahun Pelajaran {year}/{year + 1}</p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem", fontSize: "calc(var(--pf) * 1.2)" }}>
        <span><strong>Kelas:</strong> {className}</span>
        <span><strong>Bulan:</strong> {monthName} {year}</span>
        <span><strong>Kehadiran Kelas:</strong> {persentaseKelas}%</span>
      </div>

      <table className="print-table">
        <thead>
          <tr>
            <th className="col-no" rowSpan={2}>No</th>
            <th className="col-nis" rowSpan={2}>NIS</th>
            <th className="col-name" rowSpan={2}>Nama Siswa</th>
            <th colSpan={daysInMonth} className="col-day">Tanggal</th>
            <th className="col-sum col-hadir" rowSpan={2}>H</th>
            <th className="col-sum" rowSpan={2}>S</th>
            <th className="col-sum" rowSpan={2}>I</th>
            <th className="col-sum" rowSpan={2}>A</th>
            <th className="col-pct" rowSpan={2}>%</th>
          </tr>
          <tr>
            {Array.from({ length: daysInMonth }, (_, i) => (
              <th className="col-day" key={i}>{i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.length === 0 ? (
            <tr>
              <td colSpan={daysInMonth + 7} style={{ textAlign: "center", padding: "8px" }}>
                Belum ada data presensi untuk periode ini
              </td>
            </tr>
          ) : matrix.map((s, i) => {
            const totalHari = s.totalHadir + s.totalSakit + s.totalIzin + s.totalAlpha;
            const pct = totalHari > 0 ? Math.round((s.totalHadir / totalHari) * 1000) / 10 : 0;
            return (
              <tr key={s.studentId}>
                <td className="col-no">{i + 1}</td>
                <td className="col-nis">{s.nis}</td>
                <td className="col-name" style={{ cursor: onStudentClick ? "pointer" : "default" }} onClick={() => onStudentClick?.({ id: s.studentId, name: s.studentName, nis: s.nis, className })}>
                  {s.studentName}
                </td>
                {Array.from({ length: daysInMonth }, (_, d) => {
                  const status = s.dailyStatus[d + 1] || "-";
                  const cls = status === "H" ? "status-h" : status === "S" ? "status-s" : status === "I" ? "status-i" : status === "A" ? "status-a" : "";
                  return <td key={d} className={`col-day ${cls}`}>{status === "-" ? "" : status}</td>;
                })}
                <td className="col-sum col-hadir" style={{ fontWeight: 600, color: "#15803d" }}>{s.totalHadir}</td>
                <td className="col-sum">{s.totalSakit}</td>
                <td className="col-sum">{s.totalIzin}</td>
                <td className="col-sum">{s.totalAlpha}</td>
                <td className="col-pct">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="signature-block" style={{ display: "flex", justifyContent: "space-between", marginTop: "0.8rem", fontSize: "calc(var(--pf) * 1.2)" }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <p style={{ margin: 0 }}>Mengetahui,</p>
          <p style={{ margin: "1px 0" }}>Kepala Sekolah</p>
          <p style={{ marginTop: "1.6rem" }}>{principalName ? principalName : "________________________"}</p>
          <p style={{ margin: "1px 0" }}>{principalNIP ? `NIP. ${principalNIP}` : "NIP."}</p>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <p style={{ margin: 0 }}>{monthName} {year}</p>
          <p style={{ margin: "1px 0" }}>Wali Kelas</p>
          <p style={{ marginTop: "1.6rem" }}>{waliKelas ? waliKelas : "________________________"}</p>
          <p style={{ margin: "1px 0" }}>{waliNIP ? `NIP. ${waliNIP}` : "NIP."}</p>
        </div>
      </div>
    </div>
  );
}