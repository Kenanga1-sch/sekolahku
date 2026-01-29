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
  Plus,
  CalendarDays,
  TrendingUp,
  ClipboardList,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface Stats {
  date: string;
  totalStudents: number;
  sessions: number;
  openSessions: number;
  stats: {
    hadir: number;
    sakit: number;
    izin: number;
    alpha: number;
    belumAbsen: number;
    recorded: number;
    persenKehadiran: number;
  };
}

interface Session {
  id: string;
  date: string;
  className: string;
  teacherName: string | null;
  status: "open" | "closed";
  openedAt: string;
  recordCount: number;
}

export default function PresensiDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, sessionsRes] = await Promise.all([
          fetch("/api/attendance/stats"),
          fetch("/api/attendance/sessions?date=" + new Date().toISOString().split("T")[0]),
        ]);

        const statsData = await statsRes.json();
        const sessionsData = await sessionsRes.json();

        setStats(statsData);
        setSessions(sessionsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const today = new Date();

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Presensi Siswa
          </h1>
          <p className="text-muted-foreground">
            {format(today, "EEEE, d MMMM yyyy", { locale: localeId })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/presensi/scan">
            <Button>
              <QrCode className="h-4 w-4 mr-2" />
              Scan QR
            </Button>
          </Link>
        </div>
      </div>

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

      {/* Active Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Sesi Presensi Hari Ini</CardTitle>
              <CardDescription>
                {stats?.openSessions || 0} sesi aktif
              </CardDescription>
            </div>
            <Link href="/presensi/sesi/baru">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Buat Sesi
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Belum ada sesi presensi hari ini</p>
                <Link href="/presensi/sesi/baru">
                  <Button className="mt-4" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Buat Sesi Baru
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/presensi/sesi/${session.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Kelas {session.className}</p>
                          <p className="text-sm text-muted-foreground">
                            {session.teacherName || "Guru wali kelas"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          className={
                            session.status === "open"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }
                        >
                          {session.status === "open" ? "Aktif" : "Tutup"}
                        </Badge>
                        <p className="text-sm text-muted-foreground mt-1">
                          {session.recordCount} siswa
                        </p>
                      </div>
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
            <Link href="/presensi/scan">
              <Button variant="outline" className="w-full h-20 flex-col gap-1">
                <QrCode className="h-6 w-6" />
                <span>Scan QR</span>
              </Button>
            </Link>
            <Link href="/presensi/sesi/baru">
              <Button variant="outline" className="w-full h-20 flex-col gap-1">
                <Plus className="h-6 w-6" />
                <span>Sesi Baru</span>
              </Button>
            </Link>
            <Link href="/presensi/laporan">
              <Button variant="outline" className="w-full h-20 flex-col gap-1">
                <TrendingUp className="h-6 w-6" />
                <span>Laporan</span>
              </Button>
            </Link>
            <Link href="/presensi/sesi">
              <Button variant="outline" className="w-full h-20 flex-col gap-1">
                <CalendarDays className="h-6 w-6" />
                <span>Riwayat</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
