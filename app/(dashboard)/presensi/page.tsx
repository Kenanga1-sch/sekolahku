"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  QrCode,
  Users,
  CheckCircle,
  Clock,
  CalendarDays,
  TrendingUp,
  ClipboardList,
  AlertCircle,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { goGet } from "@/lib/api-client";

interface Stats {
  totalStudents: number;
  stats: {
    hadir: number;
    sakit: number;
    izin: number;
    alpha: number;
    belumAbsen: number;
    persenKehadiran: number;
  };
}

interface ClassItem {
  id: string;
  name: string;
  teacherName?: string | null;
}

export default function PresensiDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayReason, setHolidayReason] = useState("");

  const todayStr = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, classesData, holidayData]: [any, any, any] = await Promise.all([
          goGet("/api/attendance/stats"),
          goGet("/api/classes"),
          goGet(`/api/attendance/holiday?date=${todayStr}`),
        ]);

        setStats(statsData?.data ?? statsData);
        setClasses(classesData?.data ?? classesData ?? []);
        setIsHoliday(holidayData?.isHoliday || false);
        setHolidayReason(holidayData?.reason || "");
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [todayStr]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Presensi Siswa Harian
          </h1>
          <p className="text-muted-foreground text-sm">
            {format(new Date(), "EEEE, d MMMM yyyy", { locale: localeId })}
          </p>
        </div>
      </div>

      {isHoliday && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="py-4 flex items-center gap-3 text-yellow-800">
            <AlertCircle className="h-6 w-6 flex-shrink-0" />
            <div>
              <p className="font-semibold">Hari Ini Libur</p>
              <p className="text-sm">{holidayReason}. Presensi otomatis dinonaktifkan untuk hari ini.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Siswa
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalStudents || 0}</div>
            <p className="text-xs text-muted-foreground">siswa aktif</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700">
              Hadir
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {stats?.stats.hadir || 0}
            </div>
            <p className="text-xs text-green-600">
              {stats?.stats.persenKehadiran || 0}% kehadiran
            </p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700">
              Sakit/Izin
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">
              {(stats?.stats.sakit || 0) + (stats?.stats.izin || 0)}
            </div>
            <p className="text-xs text-yellow-600">
              {stats?.stats.sakit || 0} sakit, {stats?.stats.izin || 0} izin
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-700">
              Belum Presensi
            </CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {stats?.stats.belumAbsen || 0}
            </div>
            <p className="text-xs text-red-600">siswa belum dipresensi</p>
          </CardContent>
        </Card>
      </div>

      {/* Class List for Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pilih Kelas Hari Ini</CardTitle>
            <CardDescription>
              Klik kelas untuk membuka lembar absensi harian
            </CardDescription>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Belum ada data rombel kelas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {classes.map((cls) => (
                  <Link
                    key={cls.name || cls.id}
                    href={`/presensi/sesi/detail?class=${encodeURIComponent(cls.name)}&date=${todayStr}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Kelas {cls.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {cls.teacherName || "Wali Kelas"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Aksi Cepat</CardTitle>
            <CardDescription>Menu navigasi presensi</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Link href="/kiosk-kelas">
              <Button variant="outline" className="w-full h-20 flex-col gap-1">
                <QrCode className="h-6 w-6" />
                <span>Scan QR</span>
              </Button>
            </Link>
            <Link href="/presensi/laporan">
              <Button variant="outline" className="w-full h-20 flex-col gap-1">
                <TrendingUp className="h-6 w-6" />
                <span>Laporan Bulanan</span>
              </Button>
            </Link>
            <Link href="/presensi/holidays">
              <Button variant="outline" className="w-full h-20 flex-col gap-1">
                <Calendar className="h-6 w-6" />
                <span>Kelola Libur</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
