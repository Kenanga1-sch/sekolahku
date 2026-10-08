"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { format, getDaysInMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Download, FileText, Loader2, Printer, ChevronLeft, ChevronRight, User, Calendar, Search, AlertTriangle } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { goGet } from "@/lib/api-client";
import { formatClassName } from "@/lib/class-utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import { siteConfig } from "@/lib/config";
import {
  buildDayColumns,
  resolveEffectiveDays,
  studentPct,
  classPct,
  isBelowThreshold,
  filterMatrix,
  sortMatrix,
  buildMonthlyCsv,
  csvFilename,
  dowLetter,
  academicYearFor,
  STATUS_LABELS_ID,
  type DayColumn,
  type HolidayInfo,
  type SortKey,
} from "@/lib/presensi-report";
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

interface StudentMatrix {
  studentId: string;
  studentName: string;
  nis: string;
  nisn?: string;
  className?: string;
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

// 0=Minggu … 6=Sabtu (sesuai Date.getDay / dow di DayColumn)
const DOW_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

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

// Normalize class name for consistent filtering
function normalizeClassName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, '');
}

export function LaporanPresensiTab({ hideHeader = false }: { hideHeader?: boolean }) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const pathname = usePathname();

  // --- Bulanan state ---
  const [loadingBulanan, setLoadingBulanan] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchBulanan, setSearchBulanan] = useState("");
  const [sortOpt, setSortOpt] = useState("name-asc");
  const [effDaysApi, setEffDaysApi] = useState(0);
  const [holidays, setHolidays] = useState<HolidayInfo[]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const bulananSeq = useRef(0);

  const [classes, setClasses] = useState<{ name: string; teacherName?: string | null }[]>([]);
  // nama kelas → { nama wali (teacherName||waliUserName), nip wali } dari /api/academic/classes
  const [waliMap, setWaliMap] = useState<Record<string, { name: string; nip: string }>>({});
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

  // Satu Select "Oktober 2026" menggantikan Select bulan + tahun terpisah.
  const monthYearOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (const y of yearOptions) {
      for (let m = 1; m <= 12; m++) {
        opts.push({ value: `${y}-${m}`, label: `${MONTHS[m - 1]} ${y}` });
      }
    }
    return opts;
  }, [yearOptions]);

  useEffect(() => {
    goGet("/api/classes")
      .then((response: any) => setClasses(response?.data || response || []))
      .catch(() => {});
    // Info wali kelas (nama + NIP) — endpoint akademik khusus; /api/classes
    // tidak pernah mengirim teacherName sehingga {{wali_kelas_nama}} selalu kosong.
    goGet("/api/academic/classes")
      .then((response: any) => {
        const list: any[] = Array.isArray(response) ? response : response?.data || [];
        const map: Record<string, { name: string; nip: string }> = {};
        for (const c of list) {
          if (!c?.name) continue;
          map[c.name] = {
            name: c.teacherName || c.waliUserName || "",
            nip: c.waliNip || "",
          };
        }
        setWaliMap(map);
      })
      .catch(() => {});
  }, []);

  // Fetch school settings for principal name & NIP.
  // Pakai rute PUBLIC: /api/school-settings hanya superadmin/admin — guru kena
  // 403 yang ditelan catch sehingga kepala sekolah selalu kosong di hasil export.
  useEffect(() => {
    goGet("/api/public/school-settings")
      .then((response: any) => {
        const s = response?.data || response || {};
        setPrincipalName(s.principal_name || s.principalName || "");
        setPrincipalNIP(s.principal_nip || s.principalNIP || "");
      })
      .catch(() => {});
  }, []);

  // Reset state on client-side navigation (defensive, complementing layout key)
  useEffect(() => {
    setLoadingBulanan(false);
    setRecords([]);
  }, [pathname]);

  // --- Bulanan fetcher ---
  const daysInMonth = useMemo(() => getDaysInMonth(new Date(selectedYear, selectedMonth - 1)), [selectedYear, selectedMonth]);

  const fetchBulanan = useCallback(async () => {
    const seq = ++bulananSeq.current;
    setLoadingBulanan(true);
    try {
      const s = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
      const e = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
      const normalizedClass = selectedClass === "all" ? "all" : normalizeClassName(selectedClass);
      const params = new URLSearchParams({ startDate: s, endDate: e, class: normalizedClass });

      // Laporan & daftar siswa diambil paralel (siswa hanya untuk admin;
      // endpoint /api/students hanya untuk admin, guru tidak perlu memanggil).
      const studentsPromise: Promise<any> = isAdmin
        ? goGet(`/api/students?${selectedClass === "all" ? "limit=1000" : `className=${encodeURIComponent(normalizedClass)}&limit=500`}&status=active`).catch(() => null)
        : Promise.resolve(null);

      const [res, studentsRes] = await Promise.all([
        goGet(`/api/attendance/report?${params.toString()}`),
        studentsPromise,
      ]);

      // Abaikan respons basi bila filter sudah berubah lagi
      if (seq !== bulananSeq.current) return;

      const d = res?.data || res;
      setRecords(d?.records || []);
      setEffDaysApi(d?.effectiveDays || 0);
      setHolidays(Array.isArray(d?.holidays) ? d.holidays : []);
      setStudentsList(studentsRes ? extractStudents(studentsRes) : []);
    } catch (err: any) {
      if (seq === bulananSeq.current) toast.error(err.message || "Gagal memuat data");
    } finally {
      if (seq === bulananSeq.current) setLoadingBulanan(false);
    }
  }, [selectedYear, selectedMonth, selectedClass, daysInMonth, isAdmin]);

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

  useEffect(() => { fetchBulanan(); }, [fetchBulanan]);

  const matrix = useMemo(() => {
    const map = new Map<string, StudentMatrix>();

    // Add students from attendance records
    for (const r of records) {
      if (!map.has(r.studentId)) {
        map.set(r.studentId, {
          studentId: r.studentId,
          studentName: r.studentName,
          nis: r.nis || r.nisn || "-",
          nisn: r.nisn || undefined,
          className: r.className || undefined,
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
          nisn: s.nisn || undefined,
          className: s.className || undefined,
          dailyStatus: {},
          totalHadir: 0, totalSakit: 0, totalIzin: 0, totalAlpha: 0,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [records, studentsList]);

  // --- Derived state untuk tampilan bulanan ---
  const dayColumns = useMemo(
    () => buildDayColumns(selectedYear, selectedMonth, holidays),
    [selectedYear, selectedMonth, holidays]
  );
  const effectiveDays = useMemo(
    () => resolveEffectiveDays(effDaysApi, dayColumns),
    [effDaysApi, dayColumns]
  );
  // Kolom tanggal selalu sepanjang bulan (1–31); filter mode kolom/rentang
  // dihapus dari toolbar agar tampilan lebih sederhana.
  const visibleColumns = dayColumns;
  const visibleMatrix = useMemo(() => {
    const [key, dir] = sortOpt.split("-") as [SortKey, "asc" | "desc"];
    return sortMatrix(filterMatrix(matrix, searchBulanan), key, dir, effectiveDays);
  }, [matrix, searchBulanan, sortOpt, effectiveDays]);
  // Kelas yang benar-benar tampil (guru dipaksa backend ke satu kelas)
  const effectiveClassName = useMemo(() => {
    if (selectedClass !== "all") return selectedClass;
    if (isAdmin) return ""; // admin memilih "Semua Kelas" → ditampilkan per kelas
    return records[0]?.className || ""; // guru: backend memaksa satu kelas
  }, [selectedClass, isAdmin, records]);
  const holidayReasons = useMemo(
    () => Array.from(new Map(holidays.filter((h) => !h.reason.includes("Minggu")).map((h) => [h.date, h.reason])).entries()),
    [holidays]
  );
  const belowThresholdCount = useMemo(
    () => matrix.filter((s) => isBelowThreshold(s, effectiveDays)).length,
    [matrix, effectiveDays]
  );

  const handlePrint = () => window.print();

  const [exportingExcel, setExportingExcel] = useState(false);

  /**
   * Unduh Excel berbasis template. Sumber template berlapis:
   *   1. default modul presensi (admin/laporan-format → tombol Default),
   *   2. bawaan public/templates/daftar-hadir-bulanan-v1.xlsx,
   *   3. CSV bila keduanya tak bisa diunduh.
   * Template berisi variabel {{...}}: skalar diganti info sekolah/kelas/
   * periode, baris contoh {{no}}/{{nama}}/{{tgl_N}} direplikasi per siswa
   * (rumus ikut menyesuaikan), lalu baris Jumlah mengikuti di bawahnya.
   */
  const handleExportMonthlyExcel = async () => {
    if (exportingExcel || visibleMatrix.length === 0) return;
    setExportingExcel(true);
    const toastId = toast.loading("Menyiapkan file Excel…");
    try {
      const [{ default: ExcelJS }, excelLib] =
        await Promise.all([
          import("exceljs"),
          import("@/lib/presensi-excel"),
        ]);
      const { fillPresensiWorksheet, excelFilename, resolvePresensiTemplateUrl } = excelLib;
      const { url: templateUrl, paperSize, orientation } = await resolvePresensiTemplateUrl(
        fetch,
        process.env.NEXT_PUBLIC_API_URL || ""
      );
      // Template unggahan admin = folder privat → butuh cookie sesi.
      const res = await fetch(templateUrl, { credentials: "include" });
      if (!res.ok) throw new Error("template-tidak-ditemukan");
      const buf = await res.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.getWorksheet("Daftar Hadir") || wb.worksheets[0];
      if (!ws) throw new Error("template-tidak-valid");

      const signPlace = (
        siteConfig.school.address.match(/Kab\.\s*([^,]+)/)?.[1] ||
        siteConfig.school.address.match(/Kota\s+([^,]+)/)?.[1] ||
        ""
      ).trim();
      const waliKelas = selectedClass !== "all" ? getWaliKelas(selectedClass) : getWaliKelas(effectiveClassName);
      const waliNip = selectedClass !== "all" ? getWaliNip(selectedClass) : getWaliNip(effectiveClassName);
      const { rowCount, unknown } = await fillPresensiWorksheet(ws, {
        rows: visibleMatrix,
        columns: visibleColumns,
        effectiveDays,
        scalars: {
          sekolahNama: siteConfig.school.name,
          sekolahAlamat: siteConfig.school.address,
          sekolahTelepon: siteConfig.school.phone || "",
          kepalaSekolahNama: principalName,
          kepalaSekolahNip: principalNIP,
          waliKelasNama: waliKelas,
          waliKelasNip: waliNip,
          kelas: classNameBulanan,
          bulan: monthName,
          tahun: selectedYear,
          tahunAjaran: academicYearLabel,
          hariEfektif: effectiveDays,
          tanggalCetak: format(new Date(), "d MMMM yyyy", { locale: localeId }),
          tempatTtd: signPlace,
        },
        paperSize,
        orientation,
      });
      if (rowCount === 0) throw new Error("template-tanpa-baris-contoh");

      const out = await wb.xlsx.writeBuffer();
      const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = excelFilename(classNameBulanan, selectedMonth, selectedYear);
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Excel terunduh (${rowCount} siswa)`, {
        id: toastId,
        description: unknown.length > 0 ? `Variabel tak dikenal dibiarkan: ${unknown.join(", ")}` : undefined,
      });
    } catch {
      toast.error("Template Excel belum tersedia — mengunduh CSV sebagai gantinya", { id: toastId });
      handleExportMonthlyCsv();
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportMonthlyCsv = () => {
    try {
      const csv = buildMonthlyCsv({
        rows: visibleMatrix,
        columns: visibleColumns,
        className: classNameBulanan,
        monthName,
        year: selectedYear,
        effectiveDays,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = csvFilename(classNameBulanan, selectedMonth, selectedYear);
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal membuat file CSV");
    }
  };

  const [exportingPdf, setExportingPdf] = useState(false);

  /**
   * Cetak/PDF berbasis template Excel terdaftar: isi template (sama persis
   * dengan ekspor Excel — merge, warna status, blok merah libur, kop,
   * tanda tangan) → render ke HTML → jendela cetak browser → "Save as PDF".
   * Admin "Semua Kelas" → satu blok/halaman per kelas. Fallback: cetak
   * lama (PrintPage) bila template tak termuat.
   */
  const handleCetakPdf = async () => {
    if (exportingPdf || visibleMatrix.length === 0) return;
    setExportingPdf(true);
    const toastId = toast.loading("Menyiapkan cetak dari template…");
    try {
      const [{ default: ExcelJS }, excelLib, printLib] = await Promise.all([
        import("exceljs"),
        import("@/lib/presensi-excel"),
        import("@/lib/worksheet-print"),
      ]);
      const { fillPresensiWorksheet, resolvePresensiTemplateUrl } = excelLib;
      const { url: templateUrl, paperSize, orientation } = await resolvePresensiTemplateUrl(
        fetch,
        process.env.NEXT_PUBLIC_API_URL || ""
      );
      const res = await fetch(templateUrl, { credentials: "include" });
      if (!res.ok) throw new Error("template-tidak-ditemukan");
      const buf = await res.arrayBuffer();
      const opts = {
        paperSize: (paperSize || "A4").trim().toUpperCase(),
        orientation: orientation || "landscape",
      };

      const signPlace = (
        siteConfig.school.address.match(/Kab\.\s*([^,]+)/)?.[1] ||
        siteConfig.school.address.match(/Kota\s+([^,]+)/)?.[1] ||
        ""
      ).trim();
      const tanggalCetak = format(new Date(), "d MMMM yyyy", { locale: localeId });

      const sections: string[] = [];
      for (const g of renderGroups) {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
        const ws = wb.getWorksheet("Daftar Hadir") || wb.worksheets[0];
        if (!ws) throw new Error("template-tidak-valid");
        const clsLabel = g.cls ? formatClassName(g.cls) : classNameBulanan;
        const waliCls = g.cls || (selectedClass !== "all" ? selectedClass : effectiveClassName);
        const { rowCount } = await fillPresensiWorksheet(ws as never, {
          rows: g.rows,
          columns: dayColumns,
          effectiveDays,
          scalars: {
            sekolahNama: siteConfig.school.name,
            sekolahAlamat: siteConfig.school.address,
            sekolahTelepon: siteConfig.school.phone || "",
            kepalaSekolahNama: principalName,
            kepalaSekolahNip: principalNIP,
            waliKelasNama: getWaliKelas(waliCls),
            waliKelasNip: getWaliNip(waliCls),
            kelas: clsLabel,
            bulan: monthName,
            tahun: selectedYear,
            tahunAjaran: academicYearLabel,
            hariEfektif: effectiveDays,
            tanggalCetak,
            tempatTtd: signPlace,
          },
          paperSize: opts.paperSize,
          orientation: opts.orientation,
        });
        if (rowCount === 0) throw new Error("template-tanpa-baris-contoh");
        // Logo/gambar kop template → data URI untuk render cetak.
        const images = printLib.extractPrintImages(ws, (id: number) =>
          (wb as unknown as { getImage?: (i: number) => never }).getImage?.(id)
        );
        // Replikasi fitToPage Excel: area printable dari paperSize/margin.
        const fitPagePx = printLib.printAreaPx({
          paperSize: opts.paperSize,
          orientation: opts.orientation,
        });
        sections.push(printLib.worksheetToHtml(ws as never, images, { fitPagePx }));
      }

      printLib.openPrintWindow(
        printLib.joinPageSections(sections),
        `Daftar Hadir ${classNameBulanan} ${monthName} ${selectedYear}`,
        opts
      );
      toast.success("Jendela cetak terbuka — pilih “Simpan sebagai PDF”", { id: toastId });
    } catch (err) {
      console.error("Cetak PDF error:", err);
      toast.error("Template belum tersedia — memakai format cetak biasa", { id: toastId });
      handlePrint();
    } finally {
      setExportingPdf(false);
    }
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(selectedYear, selectedMonth - 1 + delta, 1);
    setSelectedYear(d.getFullYear());
    setSelectedMonth(d.getMonth() + 1);
  };

  const monthName = MONTHS[selectedMonth - 1];
  const classNameBulanan = selectedClass !== "all"
    ? formatClassName(selectedClass)
    : effectiveClassName
      ? formatClassName(effectiveClassName)
      : "Semua Kelas";
  const academicYearLabel = academicYearFor(selectedMonth, selectedYear, siteConfig.academicYear.current);

  /** Cari entri wali kelas (nama + NIP) untuk nama kelas apa pun formatnya. */
  const findWali = (clsName: string): { name: string; nip: string } => {
    if (!clsName) return { name: "", nip: "" };
    const normalized = clsName.replace(/^Kelas\s*/i, "").trim();
    const formatted = formatClassName(normalized);
    const key = Object.keys(waliMap).find(
      (k) => k === clsName || k === normalized || formatClassName(k) === formatted
    );
    if (key && (waliMap[key].name || waliMap[key].nip)) return waliMap[key];
    // Fallback: field teacherName lama (bila ada).
    const match = classes.find(
      (c) => c.name === clsName || c.name === normalized || formatClassName(c.name) === formatted
    );
    return { name: match?.teacherName || "", nip: "" };
  };

  const getWaliKelas = (clsName: string): string => findWali(clsName).name;
  const getWaliNip = (clsName: string): string => findWali(clsName).nip;

  // Pengelompokan cetak: admin "Semua Kelas" → satu halaman per kelas, selain itu satu halaman
  const renderGroups: { cls: string; rows: StudentMatrix[] }[] =
    isAdmin && selectedClass === "all"
      ? Array.from(new Set(visibleMatrix.map((m) => m.className || "")))
          .sort()
          .map((cls) => ({ cls, rows: visibleMatrix.filter((m) => (m.className || "") === cls) }))
      : [{ cls: effectiveClassName, rows: visibleMatrix }];

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
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
      )}

      {/* ========== DAFTAR HADIR BULANAN ========== */}
      <div className="space-y-4" ref={printRef}>
          {/* Filter & Actions — 2 baris ringkas:
              1) ‹ bulan-tahun › · kelas · Cetak▾   2) cari · urut */}
          <Card className="no-print">
            <CardContent className="py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => shiftMonth(-1)} aria-label="Bulan sebelumnya">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Select
                    value={`${selectedYear}-${selectedMonth}`}
                    onValueChange={(v) => {
                      const [y, m] = v.split("-").map(Number);
                      setSelectedYear(y);
                      setSelectedMonth(m);
                    }}
                  >
                    <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {monthYearOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => shiftMonth(1)} aria-label="Bulan berikutnya">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                {isAdmin && (
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="h-9 flex-1 min-w-[120px] md:flex-none md:w-[140px]"><SelectValue placeholder="Semua Kelas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kelas</SelectItem>
                      {classes.map((c) => (<SelectItem key={c.name} value={c.name}>{formatClassName(c.name)}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
                {/* Satu tombol Cetak → pilihan Excel / PDF / CSV */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="h-9 ml-auto md:ml-auto" disabled={visibleMatrix.length === 0}>
                      <Printer className="h-4 w-4 mr-1.5" />Cetak
                      <ChevronRight className="h-3.5 w-3.5 ml-1 rotate-90" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleCetakPdf} disabled={exportingPdf}>
                      {exportingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                      PDF (dialog cetak)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportMonthlyExcel} disabled={exportingExcel}>
                      {exportingExcel ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                      Excel (.xlsx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportMonthlyCsv}>
                      <Download className="h-4 w-4 mr-2" />CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={searchBulanan}
                    onChange={(e) => setSearchBulanan(e.target.value)}
                    placeholder="Cari nama / NIS…"
                    className="h-9 pl-8"
                    aria-label="Cari siswa"
                  />
                </div>
                <Select value={sortOpt} onValueChange={setSortOpt}>
                  <SelectTrigger className="h-9 w-full flex-1 min-w-[150px] md:w-[180px] md:flex-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Urut: Nama A–Z</SelectItem>
                    <SelectItem value="name-desc">Urut: Nama Z–A</SelectItem>
                    <SelectItem value="hadir-desc">Urut: Hadir terbanyak</SelectItem>
                    <SelectItem value="pct-desc">Urut: % tertinggi</SelectItem>
                    <SelectItem value="alpha-desc">Urut: Alpha terbanyak</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Info ringkas periode */}
              <p className="text-xs text-muted-foreground">
                {visibleMatrix.length} dari {matrix.length} siswa • Hari efektif: <strong className="text-foreground">{effectiveDays}</strong> dari {daysInMonth} tanggal
                {" • Tahun pelajaran "}<strong className="text-foreground">{academicYearLabel}</strong>
                {holidayReasons.length > 0 && (
                  <>{" • Libur: "}{holidayReasons.map(([d, r]) => `${parseInt(d.split("-")[2], 10)} ${MONTHS[parseInt(d.split("-")[1], 10) - 1]} (${r})`).join(", ")}</>
                )}
              </p>
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
              <Card className="border-purple-200"><CardContent className="py-3"><p className="text-xl font-bold text-purple-700">{(classPct(matrix, effectiveDays) ?? 0)}%</p><p className="text-xs text-purple-600">% Kehadiran (hari efektif)</p></CardContent></Card>
            </div>
          )}

          {/* Legend kode presensi (standar laporan daftar hadir) */}
          {!loadingBulanan && matrix.length > 0 && (
            <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Keterangan:</span>
              <span className="inline-flex items-center gap-1"><span className="font-bold text-green-700">H</span> Hadir</span>
              <span className="inline-flex items-center gap-1"><span className="font-bold text-amber-700">S</span> Sakit</span>
              <span className="inline-flex items-center gap-1"><span className="font-bold text-blue-700">I</span> Izin</span>
              <span className="inline-flex items-center gap-1"><span className="font-bold text-red-700">A</span> Alpha</span>
              <span className="inline-flex items-center gap-1"><span className="font-bold">–</span> Belum tercatat</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm border bg-slate-100 border-slate-300" /> Hari libur / akhir pekan</span>
              {belowThresholdCount > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {belowThresholdCount} siswa di bawah 75% kehadiran
                </span>
              )}
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
              {/* Skeleton untuk tampilan tabel layar */}
              <div className="no-print bg-white p-4 rounded-lg border">
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
              <ScreenMatrix matrix={[]} columns={dayColumns} effectiveDays={effectiveDays}
                className={classNameBulanan} monthName={monthName} year={selectedYear}
                onStudentClick={handleStudentClick}
              />
              <PrintPage matrix={[]} columns={dayColumns} effectiveDays={effectiveDays}
                monthName={monthName} year={selectedYear} academicYear={academicYearLabel}
                className={classNameBulanan}
                onStudentClick={handleStudentClick}
                principalName={principalName} principalNIP={principalNIP}
                waliKelas={getWaliKelas(classNameBulanan)}
                holidayReasons={holidayReasons}
              />
            </>
          ) : visibleMatrix.length === 0 ? (
            <Card className="no-print border-dashed">
              <CardContent className="py-10 text-center text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>Tidak ada siswa yang cocok dengan pencarian "{searchBulanan}"</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setSearchBulanan("")}>
                  Bersihkan pencarian
                </Button>
              </CardContent>
            </Card>
          ) : (
            renderGroups.map((g) => (
              <Fragment key={g.cls || "kelas"}>
                {/* Mobile (<md): kartu per siswa — terbaca di portrait kecil */}
                <StudentCards
                  matrix={g.rows} columns={visibleColumns} effectiveDays={effectiveDays}
                  className={g.cls ? formatClassName(g.cls) : classNameBulanan}
                  monthName={monthName} year={selectedYear}
                  onStudentClick={handleStudentClick}
                />
                {/* Desktop (≥md): tabel matriks */}
                <div className="hidden md:block">
                  <ScreenMatrix
                    matrix={g.rows} columns={visibleColumns} effectiveDays={effectiveDays}
                    className={g.cls ? formatClassName(g.cls) : classNameBulanan}
                    monthName={monthName} year={selectedYear}
                    onStudentClick={handleStudentClick}
                  />
                </div>
                {/* Artefak kertas untuk cetak (fallback bila template tak ada) */}
                <PrintPage matrix={g.rows}
                  columns={visibleColumns} effectiveDays={effectiveDays}
                  monthName={monthName} year={selectedYear} academicYear={academicYearLabel}
                  className={g.cls ? formatClassName(g.cls) : classNameBulanan}
                  onStudentClick={handleStudentClick}
                  principalName={principalName} principalNIP={principalNIP}
                  waliKelas={getWaliKelas(g.cls || "")}
                  holidayReasons={holidayReasons}
                  belowThreshold={g.rows.filter((s) => isBelowThreshold(s, effectiveDays)).length}
                />
              </Fragment>
            ))
          )}
        </div>

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
            <DataTable
              data={data}
              getRowId={(d) => d.academicYear}
              columns={[
                {
                  key: "academicYear",
                  header: "Tahun Ajaran",
                  card: "title",
                  render: (d) => (
                    <span className="font-medium text-center">{d.academicYear}</span>
                  ),
                },
                {
                  key: "hadir",
                  header: "Hadir",
                  card: "field",
                  render: (d) => (
                    <span className="text-green-700 font-medium text-center block">{d.hadir}</span>
                  ),
                },
                {
                  key: "sakit",
                  header: "Sakit",
                  card: "field",
                  render: (d) => (
                    <span className="text-yellow-700 text-center block">{d.sakit}</span>
                  ),
                },
                {
                  key: "izin",
                  header: "Izin",
                  card: "field",
                  render: (d) => (
                    <span className="text-blue-700 text-center block">{d.izin}</span>
                  ),
                },
                {
                  key: "alpha",
                  header: "Alpha",
                  card: "field",
                  render: (d) => (
                    <span className="text-red-700 text-center block">{d.alpha}</span>
                  ),
                },
                {
                  key: "totalDays",
                  header: "Total Hari",
                  card: "field",
                  render: (d) => <span className="text-center block">{d.totalDays}</span>,
                },
                {
                  key: "pct",
                  header: "% Kehadiran",
                  card: "field",
                  render: (d) => {
                    const pct = d.totalDays > 0 ? Math.round((d.hadir / d.totalDays) * 1000) / 10 : 0;
                    return <span className="font-semibold text-purple-700 text-center block">{pct}%</span>;
                  },
                },
              ]}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* Tampilan layar mobile-first untuk daftar hadir bulanan.
   Terpisah dari artefak kertas (.print-page): di layar dipakai tabel .attm-*
   yang nyaman di HP (font 13px, kolom identitas menempel, tanggal bisa digeser,
   baris jumlah menempel di bawah), sementara format cetak tetap di PrintPage. */
function ScreenMatrix({
  matrix, columns, effectiveDays, className, monthName, year, onStudentClick,
}: {
  matrix: StudentMatrix[]; columns: DayColumn[]; effectiveDays: number;
  className: string; monthName: string; year: number;
  onStudentClick?: (student: { id: string; name: string; nis: string; className: string }) => void;
}) {
  const colCount = columns.length;
  const totalSiswa = matrix.length;
  const pctKelas = classPct(matrix, effectiveDays);
  const dailyHadir = columns.map((c) =>
    c.effective ? matrix.reduce((n, s) => n + (s.dailyStatus[c.day] === "H" ? 1 : 0), 0) : null
  );
  return (
    <div className="no-print overflow-hidden rounded-lg border bg-white">
      {/* Identitas blok: kelas + periode + rekap singkat */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b bg-slate-50 px-3 py-2">
        <div>
          <p className="text-sm font-semibold leading-tight text-slate-800">
            Daftar Hadir — {className}
          </p>
          <p className="text-xs leading-tight text-slate-500">
            {monthName} {year} • {totalSiswa} siswa • Hari efektif {effectiveDays} hari
          </p>
        </div>
        <span className={`text-sm font-bold ${pctKelas !== null && pctKelas < 75 ? "text-red-600" : "text-green-700"}`}>
          {pctKelas === null ? "–" : `${pctKelas}%`}
        </span>
      </div>

      <div className="attm-wrap">
        <table className="attm-table">
          <thead>
            <tr>
              <th className="c-no" rowSpan={2}>No</th>
              <th className="c-nis" rowSpan={2}>NIS</th>
              <th className="c-name" rowSpan={2}>Nama Siswa</th>
              <th className="c-tgl" colSpan={Math.max(colCount, 1)}>Tanggal</th>
              <th className="c-sum" rowSpan={2}>H</th>
              <th className="c-sum" rowSpan={2}>S</th>
              <th className="c-sum" rowSpan={2}>I</th>
              <th className="c-sum" rowSpan={2}>A</th>
              <th className="c-pct" rowSpan={2}>%</th>
            </tr>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.day}
                  className={`c-day${c.effective ? "" : " day-off"}`}
                  title={c.effective ? DOW_NAMES_ID[c.dow] : "Hari libur / akhir pekan"}
                >
                  {c.day}
                  <span className="dow">{dowLetter(c.dow)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {totalSiswa === 0 ? (
              <tr>
                <td colSpan={colCount + 7} className="py-6 text-center text-slate-400">
                  Belum ada data presensi untuk periode ini
                </td>
              </tr>
            ) : matrix.map((s, i) => {
              const pct = studentPct(s, effectiveDays);
              const warn = isBelowThreshold(s, effectiveDays);
              return (
                <tr key={s.studentId}>
                  <td className="c-no">{i + 1}</td>
                  <td className="c-nis">{s.nis || s.nisn || ""}</td>
                  <td
                    className="c-name"
                    style={{ cursor: onStudentClick ? "pointer" : "default" }}
                    title={`${s.studentName} — ketuk untuk detail`}
                    onClick={() => onStudentClick?.({ id: s.studentId, name: s.studentName, nis: s.nis, className: s.className || className })}
                  >
                    {s.studentName}
                    {/* NIS sekunder di layar kecil (kolom NIS sendiri tampil di md+) */}
                    <span className="attm-nis">{s.nis || s.nisn || ""}</span>
                  </td>
                  {columns.map((c) => {
                    if (!c.effective) return <td key={c.day} className="c-day day-off" title="Hari libur / akhir pekan" />;
                    const status = s.dailyStatus[c.day];
                    const cls = status === "H" ? "status-h" : status === "S" ? "status-s" : status === "I" ? "status-i" : status === "A" ? "status-a" : "status-none";
                    return <td key={c.day} className={`c-day ${cls}`}>{status || "–"}</td>;
                  })}
                  <td className="c-sum status-h">{s.totalHadir}</td>
                  <td className="c-sum status-s">{s.totalSakit}</td>
                  <td className="c-sum status-i">{s.totalIzin}</td>
                  <td className="c-sum status-a">{s.totalAlpha}</td>
                  <td className={`c-pct${warn ? " pct-warn" : ""}`}>{pct === null ? "–" : `${pct}%`}</td>
                </tr>
              );
            })}
          </tbody>
          {totalSiswa > 0 && (
            <tfoot>
              <tr>
                <td className="c-no" />
                <td className="c-nis" />
                <td className="c-name">Jumlah ({totalSiswa} siswa)</td>
                {columns.map((c, idx) => (
                  <td key={c.day} className={`c-day${c.effective ? "" : " day-off"}`}>
                    {dailyHadir[idx] === null ? "" : dailyHadir[idx]}
                  </td>
                ))}
                <td className="c-sum">{matrix.reduce((n, s) => n + s.totalHadir, 0)}</td>
                <td className="c-sum">{matrix.reduce((n, s) => n + s.totalSakit, 0)}</td>
                <td className="c-sum">{matrix.reduce((n, s) => n + s.totalIzin, 0)}</td>
                <td className="c-sum">{matrix.reduce((n, s) => n + s.totalAlpha, 0)}</td>
                <td className="c-pct">{pctKelas === null ? "–" : `${pctKelas}%`}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="px-3 py-1.5 text-[11px] leading-snug text-slate-500 md:hidden">
        Ketuk nama siswa untuk detail kehadiran
      </p>
    </div>
  );
}

/**
 * Tampilan mobile (<md): satu kartu per siswa — nama/NIS, badge %,
 * grid chip tanggal (hari libur DIBLOK MERAH, status berwarna H/S/I/A),
 * rekap mini H/S/I/A. Menggantikan tabel 31 kolom yang sulit dibaca di
 * layar portrait kecil.
 */
function StudentCards({
  matrix, columns, effectiveDays, className, monthName, year, onStudentClick,
}: {
  matrix: StudentMatrix[]; columns: DayColumn[]; effectiveDays: number;
  className: string; monthName: string; year: number;
  onStudentClick?: (student: { id: string; name: string; nis: string; className: string }) => void;
}) {
  const pctKelas = classPct(matrix, effectiveDays);
  return (
    <div className="md:hidden space-y-2">
      {/* Identitas blok + % kelas (setara header ScreenMatrix) */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border bg-slate-50 px-3 py-2">
        <div>
          <p className="text-sm font-semibold leading-tight text-slate-800">Daftar Hadir — {className}</p>
          <p className="text-xs leading-tight text-slate-500">
            {monthName} {year} • {matrix.length} siswa • Hari efektif {effectiveDays} hari
          </p>
        </div>
        <span className={`text-sm font-bold ${pctKelas !== null && pctKelas < 75 ? "text-red-600" : "text-green-700"}`}>
          {pctKelas === null ? "–" : `${pctKelas}%`}
        </span>
      </div>

      {matrix.map((s) => {
        const pct = studentPct(s, effectiveDays);
        const warn = isBelowThreshold(s, effectiveDays);
        return (
          <div key={s.studentId} className="rounded-lg border bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-semibold leading-tight text-slate-800"
                  style={{ cursor: onStudentClick ? "pointer" : "default" }}
                  onClick={() => onStudentClick?.({ id: s.studentId, name: s.studentName, nis: s.nis, className: s.className || className })}
                >
                  {s.studentName}
                </p>
                <p className="text-[11px] leading-tight text-slate-500">{s.nis || s.nisn || ""}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                  warn ? "bg-red-50 text-red-600 ring-1 ring-red-200" : "bg-green-50 text-green-700 ring-1 ring-green-200"
                }`}
              >
                {pct === null ? "–" : `${pct}%`}
              </span>
            </div>

            {/* Chip tanggal: hari libur diblok merah, status H/S/I/A berwarna */}
            <div className="mt-2 grid grid-cols-8 gap-1 sm:grid-cols-10">
              {columns.map((c) => {
                const status = s.dailyStatus[c.day];
                if (!c.effective) {
                  return (
                    <div
                      key={c.day}
                      title={`Libur — ${c.reason || "hari libur/akhir pekan"}`}
                      className="rounded border border-red-300 bg-red-100 text-center leading-tight"
                    >
                      <div className="text-[9px] font-medium text-red-700">{c.day}</div>
                      <div className="text-[10px] font-bold text-red-700">✕</div>
                    </div>
                  );
                }
                const tone =
                  status === "H" ? "border-green-300 bg-green-50 text-green-700"
                  : status === "S" ? "border-amber-300 bg-amber-50 text-amber-700"
                  : status === "I" ? "border-blue-300 bg-blue-50 text-blue-700"
                  : status === "A" ? "border-red-300 bg-red-50 text-red-700"
                  : "border-slate-200 bg-slate-50 text-slate-400";
                return (
                  <div key={c.day} title={`${c.day} ${monthName} — ${STATUS_LABELS_ID[status || ""] || "Belum tercatat"}`} className={`rounded border text-center leading-tight ${tone}`}>
                    <div className="text-[9px] opacity-70">{c.day}</div>
                    <div className="text-[10px] font-bold">{status || "–"}</div>
                  </div>
                );
              })}
            </div>

            {/* Rekap mini */}
            <div className="mt-2 flex items-center justify-between border-t pt-2 text-[11px]">
              <span className="text-slate-500">Rekap</span>
              <span className="flex gap-2.5 tabular-nums">
                <span><b className="text-green-700">H</b> {s.totalHadir}</span>
                <span><b className="text-amber-700">S</b> {s.totalSakit}</span>
                <span><b className="text-blue-700">I</b> {s.totalIzin}</span>
                <span><b className="text-red-700">A</b> {s.totalAlpha}</span>
              </span>
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-center text-[11px] text-slate-500">
        Ketuk nama siswa untuk detail kehadiran • {matrix.length} siswa
      </p>
    </div>
  );
}

function PrintPage({
  matrix, columns, effectiveDays, monthName, year, academicYear, className,
  onStudentClick, principalName, principalNIP, waliKelas, waliNIP,
  holidayReasons = [], belowThreshold = 0, preview = false,
}: {
  matrix: StudentMatrix[]; columns: DayColumn[]; effectiveDays: number;
  monthName: string; year: number; academicYear: string; className: string;
  onStudentClick?: (student: { id: string; name: string; nis: string; className: string }) => void;
  principalName?: string; principalNIP?: string; waliKelas?: string; waliNIP?: string;
  holidayReasons?: [string, string][]; belowThreshold?: number;
  /** Tampilkan artefak kertas di layar (pratinjau eksplisit dari toolbar) */
  preview?: boolean;
}) {
  const totalSiswa = matrix?.length || 0;
  const colCount = columns.length;
  const persentaseKelas = classPct(matrix, effectiveDays);
  // Jumlah hadir per tanggal (untuk baris "Jumlah" di kaki tabel)
  const dailyHadir = columns.map((c) =>
    c.effective ? matrix.reduce((n, s) => n + (s.dailyStatus[c.day] === "H" ? 1 : 0), 0) : null
  );
  // Nama kelas tanpa awalan "Kelas" ganda (label sudah berawalan "Kelas …")
  const classLabel = (className || "").replace(/^Kelas\s+/i, "").trim();
  const classTitle = /^semua kelas$/i.test(classLabel) ? className : `Kelas ${classLabel}`;
  const waliTitle = /^semua kelas$/i.test(classLabel) ? null : `Wali Kelas ${classLabel}`;
  // Tempat & tanggal tanda tangan: "Kab. …" diambil dari alamat sekolah
  const signPlace = (
    siteConfig.school.address.match(/Kab\.\s*([^,]+)/)?.[1] ||
    siteConfig.school.address.match(/Kota\s+([^,]+)/)?.[1] ||
    ""
  ).trim();
  const signDate = format(new Date(), "d MMMM yyyy", { locale: localeId });

  // Ukuran font adaptif agar 1 kelas selalu muat 1 lembar F4 landscape:
  // tinggi layak ≈ 756px; kop+judul+meta+legenda+tanda tangan ≈ 260px;
  // baris tabel ≈ font*1.15 + padding 3px. Kelas sedikit → font besar (maks 10),
  // kelas besar → font ciut otomatis (min 5.5) tanpa pecah halaman.
  const rowCount = Math.max(totalSiswa, 1) + 3;
  const rowBudget = Math.max((756 - 260) / rowCount, 7);
  const baseFont = Math.min(10, Math.max(5.5, (rowBudget - 3) / 1.15));

  return (
    <div className={`print-page${preview ? " show-print-preview" : ""}`} style={{ [ "--pf" as any]: `${baseFont}px`, background: "white" }}>
      <style>{`
        @media print {
          @page { size: 8.27in 13in landscape; margin: 5mm; }
          body { font-size: ${baseFont}px; }
        }
        .print-page {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        @media screen {
          .print-page { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.04); }
          .pt-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #e2e8f0; border-radius: 6px; }
          .print-table { min-width: 720px; }
          .print-table th, .print-table td { padding: 4px 5px; }
          .print-table .sticky-no { position: sticky; left: 0; z-index: 3; background: #fff; width: 40px; min-width: 40px; }
          .print-table .sticky-nis { position: sticky; left: 40px; z-index: 3; background: #fff; width: 76px; min-width: 76px; }
          .print-table .sticky-name { position: sticky; left: 116px; z-index: 3; background: #fff; width: 150px; min-width: 150px; box-shadow: 2px 0 0 #cbd5e1; }
          .print-table thead .sticky-no, .print-table thead .sticky-nis, .print-table thead .sticky-name { background: #f0f0f0; z-index: 4; }
        }
        @media print {
          .print-page { padding: 0; border: none; box-shadow: none; }
          .print-table .sticky-no, .print-table .sticky-nis, .print-table .sticky-name { position: static; box-shadow: none; }
          .day-off { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .print-page + .print-page {
          break-before: page;
          page-break-before: always;
        }
        .kop-surat { text-align: center; border-bottom: 3px double #000; padding-bottom: 4px; margin-bottom: 6px; }
        .print-table {
          width: 100%; border-collapse: collapse; font-size: var(--pf);
        }
        .print-table th, .print-table td {
          border: 0.5px solid #000; padding: 1.4px 2px; text-align: center; white-space: nowrap;
        }
        .print-table th { background: #f0f0f0; font-weight: 600; }
        .print-table .col-no { width: 3%; }
        .print-table .col-nis { width: 6%; }
        .print-table .col-name { text-align: left; }
        .print-table .col-day { font-size: calc(var(--pf) * 0.9); min-width: 10px; width: ${(56 / Math.max(colCount, 1)).toFixed(3)}%; max-width: ${(56 / Math.max(colCount, 1)).toFixed(3)}%; }
        .print-table .col-day .dow { display: block; font-size: calc(var(--pf) * 0.8); color: #64748b; line-height: 1.15; }
        .print-table .col-sum { }
        .print-table .col-pct { font-weight: 600; }
        .print-table .col-hadir { color: #15803d; font-weight: 600; }
        .print-table .status-h { color: #15803d; }
        .print-table .status-s { color: #b45309; }
        .print-table .status-i { color: #1d4ed8; }
        .print-table .status-a { color: #dc2626; }
        .print-table .status-none { color: #64748b; }
        .print-table .day-off { background: #fee2e2; color: #dc2626; }
        .print-table .pct-warn { color: #dc2626; font-weight: 700; }
        .print-table tfoot td { background: #f8fafc; font-weight: 600; }
        .print-table td.col-name { text-decoration: none !important; }
        .report-note { font-size: calc(var(--pf) * 1.1); color: #334155; margin: 5px 0 0; line-height: 1.4; }
        .report-legend { font-size: calc(var(--pf) * 1.05); color: #334155; margin: 6px 0 0; line-height: 1.4; }
        .signature-block { break-inside: avoid; page-break-inside: avoid; }
      `}</style>

      {/* Kop surat sekolah */}
      <div className="kop-surat">
        <p style={{ margin: 0, fontSize: "calc(var(--pf) * 1.6)", fontWeight: 700, textTransform: "uppercase" }}>
          {siteConfig.school.name}
        </p>
        <p style={{ margin: "1px 0", fontSize: "calc(var(--pf) * 1.15)" }}>
          NPSN {siteConfig.school.npsn}
        </p>
        <p style={{ margin: 0, fontSize: "calc(var(--pf) * 1.1)" }}>{siteConfig.school.address}</p>
        {(siteConfig.school.email || siteConfig.school.website) && (
          <p style={{ margin: 0, fontSize: "calc(var(--pf) * 1.1)" }}>
            {[siteConfig.school.email, siteConfig.school.website].filter(Boolean).join(" • ")}
          </p>
        )}
      </div>

      <div style={{ textAlign: "center", marginBottom: "0.3rem" }}>
        <h2 style={{ margin: 0, fontSize: "calc(var(--pf) * 1.8)", fontWeight: 700 }}>DAFTAR HADIR SISWA</h2>
        <p style={{ margin: "1px 0", fontSize: "calc(var(--pf) * 1.3)", fontWeight: 600 }}>
          {classTitle} — {monthName} {year}
        </p>
        <p style={{ margin: 0, fontSize: "calc(var(--pf) * 1.2)" }}>Tahun Pelajaran {academicYear}</p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem", fontSize: "calc(var(--pf) * 1.2)" }}>
        <span><strong>Jumlah Siswa:</strong> {totalSiswa}</span>
        <span><strong>Hari Efektif:</strong> {effectiveDays} hari</span>
        <span><strong>Kehadiran Kelas:</strong> {persentaseKelas === null ? "–" : `${persentaseKelas}%`}</span>
      </div>

      <div className="pt-wrap">
        <table className="print-table">
          {/* Lebar kolom eksplisit: saat cetak globals.css memaksa table-layout:fixed,
              yang diandalkan adalah baris pertama / elemen <col>, bukan lebar konten. */}
          <colgroup>
            <col style={{ width: "3%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "13%" }} />
            {columns.map((c) => (
              <col key={c.day} style={{ width: `${(56 / Math.max(colCount, 1)).toFixed(3)}%` }} />
            ))}
            <col style={{ width: "4.5%" }} />
            <col style={{ width: "4.5%" }} />
            <col style={{ width: "4.5%" }} />
            <col style={{ width: "4.5%" }} />
            <col style={{ width: "4%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="col-no sticky-no" rowSpan={2}>No</th>
              <th className="col-nis sticky-nis" rowSpan={2}>NIS</th>
              <th className="col-name sticky-name" rowSpan={2}>Nama Siswa</th>
              <th colSpan={colCount} className="col-day">Tanggal</th>
              <th className="col-sum col-hadir" rowSpan={2}>H</th>
              <th className="col-sum" rowSpan={2}>S</th>
              <th className="col-sum" rowSpan={2}>I</th>
              <th className="col-sum" rowSpan={2}>A</th>
              <th className="col-pct" rowSpan={2}>%</th>
            </tr>
            <tr>
              {columns.map((c) => (
                <th key={c.day} className={`col-day${c.effective ? "" : " day-off"}`} title={c.effective ? DOW_NAMES_ID[c.dow] : "Hari libur / akhir pekan"}>
                  {c.day}
                  <span className="dow">{dowLetter(c.dow)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.length === 0 ? (
              <tr>
                <td colSpan={colCount + 7} style={{ textAlign: "center", padding: "8px" }}>
                  Belum ada data presensi untuk periode ini
                </td>
              </tr>
            ) : matrix.map((s, i) => {
              const pct = studentPct(s, effectiveDays);
              const warn = isBelowThreshold(s, effectiveDays);
              return (
                <tr key={s.studentId}>
                  <td className="col-no sticky-no">{i + 1}</td>
                  <td className="col-nis sticky-nis">{s.nis || s.nisn || ""}</td>
                  <td className="col-name sticky-name" style={{ cursor: onStudentClick ? "pointer" : "default" }} onClick={() => onStudentClick?.({ id: s.studentId, name: s.studentName, nis: s.nis, className: s.className || className })}>
                    {s.studentName}
                  </td>
                  {columns.map((c) => {
                    if (!c.effective) return <td key={c.day} className="col-day day-off" title="Hari libur / akhir pekan" />;
                    const status = s.dailyStatus[c.day];
                    const cls = status === "H" ? "status-h" : status === "S" ? "status-s" : status === "I" ? "status-i" : status === "A" ? "status-a" : "status-none";
                    return <td key={c.day} className={`col-day ${cls}`}>{status || "–"}</td>;
                  })}
                  <td className="col-sum col-hadir">{s.totalHadir}</td>
                  <td className="col-sum">{s.totalSakit}</td>
                  <td className="col-sum">{s.totalIzin}</td>
                  <td className="col-sum">{s.totalAlpha}</td>
                  <td className={`col-pct${warn ? " pct-warn" : ""}`}>{pct === null ? "–" : `${pct}%`}</td>
                </tr>
              );
            })}
          </tbody>
          {matrix.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} style={{ textAlign: "left" }}>Jumlah ({totalSiswa} siswa)</td>
                {columns.map((c, idx) => (
                  <td key={c.day} className={`col-day${c.effective ? "" : " day-off"}`}>
                    {dailyHadir[idx] === null ? "" : dailyHadir[idx]}
                  </td>
                ))}
                <td className="col-sum col-hadir">
                  {matrix.reduce((n, s) => n + s.totalHadir, 0)}
                </td>
                <td className="col-sum">{matrix.reduce((n, s) => n + s.totalSakit, 0)}</td>
                <td className="col-sum">{matrix.reduce((n, s) => n + s.totalIzin, 0)}</td>
                <td className="col-sum">{matrix.reduce((n, s) => n + s.totalAlpha, 0)}</td>
                <td className="col-pct">{persentaseKelas === null ? "–" : `${persentaseKelas}%`}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {matrix.length > 0 && (
        <div>
          <p className="report-legend">
            <strong>Keterangan:</strong> H = Hadir, S = Sakit, I = Izin, A = Alpha, – = Belum tercatat,
            kolom berwarna = hari libur / akhir pekan (tidak dihitung).
          </p>
          <p className="report-note">
            Hari efektif {effectiveDays} hari dari {colCount} tanggal • Persentase = Hadir ÷ Hari Efektif × 100
            {holidayReasons.length > 0 && (
              <> • Libur: {holidayReasons.map(([d, r]) => `${parseInt(d.split("-")[2], 10)} ${monthName} (${r})`).join(", ")}</>
            )}
          </p>
          {belowThreshold > 0 && (
            <p className="report-note" style={{ color: "#b45309" }}>
              Perhatian: {belowThreshold} siswa dengan kehadiran di bawah 75%.
            </p>
          )}
        </div>
      )}

      <div className="signature-block" style={{ display: "flex", justifyContent: "space-between", marginTop: "0.8rem", fontSize: "calc(var(--pf) * 1.2)" }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <p style={{ margin: 0 }}>Mengetahui,</p>
          <p style={{ margin: "1px 0" }}>Kepala Sekolah</p>
          <p style={{ marginTop: "1.6rem" }}>{principalName ? principalName : "________________________"}</p>
          <p style={{ margin: "1px 0" }}>{principalNIP ? `NIP. ${principalNIP}` : "NIP. ……………………………"}</p>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <p style={{ margin: 0 }}>{signPlace ? `${signPlace}, ` : ""}{signDate}</p>
          <p style={{ margin: "1px 0" }}>{waliTitle || "Wali Kelas"}</p>
          <p style={{ marginTop: "1.6rem" }}>{waliKelas ? waliKelas : "________________________"}</p>
          <p style={{ margin: "1px 0" }}>{waliNIP ? `NIP. ${waliNIP}` : "NIP. ……………………………"}</p>
        </div>
      </div>
    </div>
  );
}