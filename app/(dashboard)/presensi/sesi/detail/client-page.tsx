"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  QrCode,
  Loader2,
  AlertCircle,
  CalendarDays,
} from "lucide-react";
import { goGet, goPost } from "@/lib/api-client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface Student {
  id: string;
  fullName: string;
  nisn: string | null;
  nis: string | null;
  className: string;
  photo: string | null;
}

interface Record {
  id: string;
  status: "hadir" | "sakit" | "izin" | "alpha";
  checkInTime: string;
  recordMethod: "qr_scan" | "manual";
  notes: string | null;
  student: Student;
}

interface DailyDetail {
  date: string;
  className: string;
  isHoliday: boolean;
  holidayReason?: string;
  students: Student[];
  records: Record[];
}

const STATUS_CONFIG = {
  hadir: { label: "Hadir", color: "bg-green-100 text-green-700", icon: CheckCircle },
  sakit: { label: "Sakit", color: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
  izin: { label: "Izin", color: "bg-blue-100 text-blue-700", icon: Clock },
  alpha: { label: "Alpha", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function SesiDetailPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<DailyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const className = searchParams.get("class") || "";
  const date = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");

  const fetchData = useCallback(async () => {
    if (!className) {
      setError("Kelas tidak ditemukan. Pilih kelas dari menu presensi.");
      setLoading(false);
      return;
    }
    try {
      const response: any = await goGet(`/api/attendance/daily?class=${encodeURIComponent(className)}&date=${date}`);
      setData(response?.data || response);
    } catch (err) {
      setError("Gagal memuat data presensi");
    } finally {
      setLoading(false);
    }
  }, [className, date]);

  useEffect(() => {
    if (className) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [className, date, fetchData]);

  const handleManualStatus = async (studentId: string, status: string) => {
    setError(null);
    try {
      await goPost("/api/attendance/manual", {
        date,
        className,
        studentId,
        status,
      });
      await fetchData();
    } catch (err: any) {
      console.error("Error recording attendance:", err);
      setError(err.message || "Gagal mencatat presensi");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!className) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Silakan pilih kelas dari halaman presensi</p>
        <Link href="/presensi">
          <Button className="mt-4">Kembali</Button>
        </Link>
      </div>
    );
  }

  if (data?.isHoliday) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/presensi">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" />
              Kelas {className}
            </h1>
            <p className="text-muted-foreground">
              {format(new Date(date), "EEEE, d MMMM yyyy", { locale: localeId })}
            </p>
          </div>
        </div>
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="py-8 text-center">
            <CalendarDays className="h-12 w-12 mx-auto mb-3 text-yellow-600 opacity-60" />
            <p className="text-lg font-semibold text-yellow-800">Hari Ini Libur</p>
            <p className="text-sm text-yellow-700">
              {data.holidayReason || "Tanggal merah / hari libur nasional"}
            </p>
            <p className="text-xs text-yellow-600 mt-2">Presensi tidak tersedia pada hari libur.</p>
            <Link href="/presensi">
              <Button variant="outline" className="mt-6">Kembali ke Presensi</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recordedIds = (data?.records || []).map((r) => r.student.id);
  const allStudents = data?.students || [];
  const records = data?.records || [];
  const recorded = records;
  const notRecorded = allStudents.filter((s) => !recordedIds.includes(s.id));

  const countBy = (status: string) =>
    recorded.filter((r) => r.status === status).length;

  const stats = {
    total: allStudents.length,
    hadir: countBy("hadir"),
    sakit: countBy("sakit"),
    izin: countBy("izin"),
    alpha: countBy("alpha"),
    belumAbsen: notRecorded.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/presensi">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Kelas {className}
            </h1>
            <p className="text-muted-foreground">
              {format(new Date(date), "EEEE, d MMMM yyyy", { locale: localeId })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/kiosk-kelas">
            <Button variant="outline" size="sm">
              <QrCode className="h-4 w-4 mr-1" />
              Scan QR
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="bg-gray-50">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-green-700">{stats.hadir}</p>
            <p className="text-xs text-green-600">Hadir</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-yellow-700">{stats.sakit}</p>
            <p className="text-xs text-yellow-600">Sakit</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{stats.izin}</p>
            <p className="text-xs text-blue-600">Izin</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-red-700">{stats.alpha}</p>
            <p className="text-xs text-red-600">Alpha</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-orange-700">{stats.belumAbsen}</p>
            <p className="text-xs text-orange-600">Belum</p>
          </CardContent>
        </Card>
      </div>

      {/* Recorded Students */}
      <Card>
        <CardHeader>
          <CardTitle>Siswa Sudah Diabsen ({recorded.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {recorded.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              Belum ada siswa yang diabsen
            </p>
          ) : (
            <div className="space-y-2">
              {recorded.map((record) => {
                const config = STATUS_CONFIG[record.status];
                const StatusIcon = config.icon;
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={record.student?.photo || undefined} />
                        <AvatarFallback>
                          {record.student?.fullName?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{record.student?.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          {record.student?.nis || record.student?.nisn || "-"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={config.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                      <Select
                        value={record.status}
                        onValueChange={(value) => handleManualStatus(record.student.id, value)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hadir">Hadir</SelectItem>
                          <SelectItem value="sakit">Sakit</SelectItem>
                          <SelectItem value="izin">Izin</SelectItem>
                          <SelectItem value="alpha">Alpha</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Not Recorded Students */}
      {notRecorded.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-700">
              Belum Diabsen ({notRecorded.length})
            </CardTitle>
            <CardDescription>
              Pilih status untuk mencatat presensi manual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {notRecorded.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={student.photo || undefined} />
                      <AvatarFallback>
                        {student.fullName?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{student.fullName}</p>
                      <p className="text-sm text-muted-foreground">
                        {student.nis || student.nisn || "-"}
                      </p>
                    </div>
                  </div>
                  <Select
                    onValueChange={(value) => handleManualStatus(student.id, value)}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hadir">Hadir</SelectItem>
                      <SelectItem value="sakit">Sakit</SelectItem>
                      <SelectItem value="izin">Izin</SelectItem>
                      <SelectItem value="alpha">Alpha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
