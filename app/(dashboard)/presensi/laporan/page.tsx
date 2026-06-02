"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format, subDays } from "date-fns";
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
import { ArrowLeft, Download, FileText, Filter, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { goGet } from "@/lib/api-client";

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const STATUS_LABELS = {
  hadir: "Hadir",
  sakit: "Sakit",
  izin: "Izin",
  alpha: "Alpha",
};

const STATUS_BADGES = {
  hadir: "bg-green-100 text-green-700",
  sakit: "bg-yellow-100 text-yellow-700",
  izin: "bg-blue-100 text-blue-700",
  alpha: "bg-red-100 text-red-700",
};

export default function LaporanPresensiPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  
  // Filters
  const [startDate, setStartDate] = useState(
    format(subDays(new Date(), 7), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [className, setClassName] = useState("all");
  const [classes, setClasses] = useState<{name: string}[]>([]);

  useEffect(() => {
    // Fetch classes
    goGet("/api/classes")
      .then((response: any) => setClasses(response?.data || response))
      .catch((err) => console.error(err));
  }, []);

  const fetchReport = async () => {
    if (!startDate || !endDate) {
      toast.error("Tanggal mulai dan selesai harus diisi");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        class: className,
      });
      const response: any = await goGet(`/api/attendance/report?${params.toString()}`);
      setData(response?.data || response);
    } catch (error: any) {
      toast.error(error.message || "Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams({
      startDate,
      endDate,
      class: className,
    });
    
    window.location.href = `${API_BASE}/api/attendance/export?${params.toString()}`;
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/presensi">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Laporan Presensi
          </h1>
          <p className="text-muted-foreground">
            Rekapitulasi kehadiran siswa
          </p>
        </div>
      </div>

      {/* Filter Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter Laporan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label>Tanggal Mulai</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Selesai</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Kelas</Label>
              <Select value={className} onValueChange={setClassName}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.name} value={cls.name}>
                      Kelas {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchReport} variant="outline" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Filter className="h-4 w-4 mr-2" />
              )}
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-2xl font-bold">{data.summary.total}</p>
              <p className="text-xs text-muted-foreground">Total Catatan</p>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-green-700">{data.summary.hadir}</p>
              <p className="text-xs text-green-600">Hadir</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200">
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-yellow-700">{data.summary.sakit}</p>
              <p className="text-xs text-yellow-600">Sakit</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200">
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-blue-700">{data.summary.izin}</p>
              <p className="text-xs text-blue-600">Izin</p>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-red-700">{data.summary.alpha}</p>
              <p className="text-xs text-red-600">Alpha</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4 flex items-start gap-3 text-sm text-blue-700">
          <CalendarIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Tentang Laporan</p>
            <p className="mt-1 opacity-90">
              Laporan yang diunduh mencakup detail kehadiran siswa, waktu check-in, 
              metode presensi (QR/Manual), dan status kehadiran. Gunakan filter tanggal 
              dan kelas untuk membatasi data yang ingin dianalisis.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview Laporan</CardTitle>
          <CardDescription>
            {data
              ? `${data.records.length} catatan pada rentang ${format(new Date(startDate), "d MMM yyyy", { locale: localeId })} - ${format(new Date(endDate), "d MMM yyyy", { locale: localeId })}`
              : "Pilih filter lalu tampilkan laporan"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin" />
              Memuat laporan...
            </div>
          ) : !data || data.records.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border rounded-lg bg-muted/20 border-dashed">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p>Belum ada data presensi pada filter ini</p>
              <p className="text-xs">Sesi yang sudah ditutup akan otomatis menyertakan siswa alpha</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Siswa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Metode</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.records.slice(0, 100).map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.date}</TableCell>
                      <TableCell>Kelas {record.className}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.studentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {record.nis || record.nisn || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGES[record.status]}>
                          {STATUS_LABELS[record.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.checkInTime || "-"}</TableCell>
                      <TableCell>
                        {record.recordMethod === "qr_scan" ? "QR" : "Manual"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.records.length > 100 && (
                <div className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                  Menampilkan 100 catatan pertama. Unduh CSV untuk data lengkap.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

