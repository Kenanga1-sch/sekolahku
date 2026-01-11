"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
  Calendar,
  ArrowRight,
  FileText,
  Info,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { pb } from "@/lib/pocketbase";
import type { SPMBRegistrant, SPMBPeriod } from "@/types";

// Lazy load heavy chart components
const RegistrationTrendChart = dynamic(
  () => import("@/components/dashboard/charts").then(mod => ({ default: mod.RegistrationTrendChart })),
  {
    loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[250px] w-full" /></CardContent></Card>,
    ssr: false
  }
);

const StatusDistributionChart = dynamic(
  () => import("@/components/dashboard/charts").then(mod => ({ default: mod.StatusDistributionChart })),
  {
    loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[250px] w-full" /></CardContent></Card>,
    ssr: false
  }
);

interface DashboardStats {
  total: number;
  pending: number;
  verified: number;
  accepted: number;
  rejected: number;
}

interface RecentRegistrant {
  id: string;
  student_name: string;
  registration_number: string;
  status: string;
  created: string;
}

function getStatusBadge(status: string) {
  const styles = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    verified: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  };

  const labels = {
    pending: "Pending",
    verified: "Terverifikasi",
    accepted: "Diterima",
    rejected: "Ditolak"
  };

  return (
    <Badge variant="outline" className={styles[status as keyof typeof styles] || styles.pending}>
      {labels[status as keyof typeof labels] || status}
    </Badge>
  );
}

export default function OverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRegistrants, setRecentRegistrants] = useState<RecentRegistrant[]>([]);
  const [activePeriod, setActivePeriod] = useState<SPMBPeriod | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Chart data states
  const [trendData, setTrendData] = useState<{ date: string; count: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [zoneData, setZoneData] = useState<{ name: string; inZone: number; outZone: number }[]>([]);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const [totalRes, pendingRes, verifiedRes, acceptedRes, rejectedRes] = await Promise.all([
        pb.collection("spmb_registrants").getList(1, 1),
        pb.collection("spmb_registrants").getList(1, 1, { filter: 'status = "pending"' }),
        pb.collection("spmb_registrants").getList(1, 1, { filter: 'status = "verified"' }),
        pb.collection("spmb_registrants").getList(1, 1, { filter: 'status = "accepted"' }),
        pb.collection("spmb_registrants").getList(1, 1, { filter: 'status = "rejected"' }),
      ]);

      const statsData = {
        total: totalRes.totalItems,
        pending: pendingRes.totalItems,
        verified: verifiedRes.totalItems,
        accepted: acceptedRes.totalItems,
        rejected: rejectedRes.totalItems,
      };
      setStats(statsData);

      // Generate status distribution data for pie chart
      setStatusData([
        { name: "Pending", value: statsData.pending, color: "#f59e0b" },
        { name: "Terverifikasi", value: statsData.verified, color: "#3b82f6" },
        { name: "Diterima", value: statsData.accepted, color: "#22c55e" },
        { name: "Ditolak", value: statsData.rejected, color: "#ef4444" },
      ].filter(item => item.value > 0));

      // Fetch all registrants for trend data
      const allRegistrants = await pb.collection("spmb_registrants").getFullList<SPMBRegistrant>({
        sort: "-created",
      });

      // Generate trend data (last 7 days)
      const today = new Date();
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split("T")[0];
      });

      const trendCounts = last7Days.map(dateStr => {
        const count = allRegistrants.filter(r => r.created.startsWith(dateStr)).length;
        const date = new Date(dateStr);
        return {
          date: date.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
          count
        };
      });
      setTrendData(trendCounts);

      // Generate zone distribution data (last 4 weeks)
      const weeks = ["Minggu 1", "Minggu 2", "Minggu 3", "Minggu 4"];
      const zoneStats = weeks.map((name, i) => {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - ((3 - i) * 7) - 7);
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() - ((3 - i) * 7));

        const weekRegistrants = allRegistrants.filter(r => {
          const created = new Date(r.created);
          return created >= weekStart && created < weekEnd;
        });

        return {
          name,
          inZone: weekRegistrants.filter(r => r.is_in_zone || r.is_within_zone).length,
          outZone: weekRegistrants.filter(r => !r.is_in_zone && !r.is_within_zone).length,
        };
      });
      setZoneData(zoneStats);

      // Fetch recent registrants
      setRecentRegistrants(allRegistrants.slice(0, 5).map((item) => ({
        id: item.id,
        student_name: item.student_name || item.full_name || "N/A",
        registration_number: item.registration_number || "N/A",
        status: item.status || "pending",
        created: item.created,
      })));

      // Fetch active period
      try {
        const period = await pb.collection("spmb_periods").getFirstListItem<SPMBPeriod>(
          "is_active = true"
        );
        setActivePeriod(period);
      } catch {
        setActivePeriod(null);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Selamat Pagi," : hour < 18 ? "Selamat Siang," : "Selamat Malam,";

  const statsCards = stats ? [
    {
      title: "Total Pendaftar",
      value: stats.total.toString(),
      change: "Total keseluruhan",
      icon: Users,
      bg: "bg-blue-500/10",
      text: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Menunggu Verifikasi",
      value: stats.pending.toString(),
      change: "Perlu ditinjau",
      icon: Clock,
      bg: "bg-amber-500/10",
      text: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Terverifikasi",
      value: stats.verified.toString(),
      change: stats.total > 0 ? `${((stats.verified / stats.total) * 100).toFixed(1)}% dari total` : "0%",
      icon: UserCheck,
      bg: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Ditolak",
      value: stats.rejected.toString(),
      change: stats.total > 0 ? `${((stats.rejected / stats.total) * 100).toFixed(1)}% dari total` : "0%",
      icon: UserX,
      bg: "bg-red-500/10",
      text: "text-red-600 dark:text-red-400",
    },
  ] : [];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-blue-600 p-8 md:p-10 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 rounded-full bg-black/10 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {greeting} Admin! <span className="text-white/80">✨</span>
            </h1>
            <p className="text-blue-50 max-w-lg text-lg">
              Berikut adalah ringkasan aktivitas pendaftaran siswa baru.
              {stats && stats.pending > 0 && (
                <> Ada <span className="font-bold underline">{stats.pending} pendaftar</span> yang perlu verifikasi.</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">
                {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border bg-card/50">
              <CardContent className="p-6">
                <Skeleton className="h-12 w-12 rounded-2xl mb-4" />
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          statsCards.map((stat) => (
            <Card key={stat.title} className="border bg-card/50 backdrop-blur hover:bg-card hover:shadow-md transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.text}`} />
                  </div>
                  <Badge variant="outline" className="text-xs font-normal">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {stat.change}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <h3 className="text-3xl font-bold tracking-tight">{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-[250px] w-full" />
              </CardContent>
            </Card>
          ) : (
            <RegistrationTrendChart data={trendData} />
          )}
        </div>
        <div>
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-[250px] w-full" />
              </CardContent>
            </Card>
          ) : (
            <StatusDistributionChart data={statusData} />
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Table Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Pendaftar Terbaru</h2>
            <Link href="/spmb-admin">
              <Button variant="ghost" className="text-primary hover:text-primary/80">
                Lihat Semua <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>

          <Card className="border-none shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-medium">
                  <tr>
                    <th className="px-6 py-4">Nama Siswa</th>
                    <th className="px-6 py-4">Nomor</th>
                    <th className="px-6 py-4">Tanggal</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-28" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-6 w-20" /></td>
                      </tr>
                    ))
                  ) : recentRegistrants.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                        Belum ada pendaftar
                      </td>
                    </tr>
                  ) : (
                    recentRegistrants.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-medium">{item.student_name}</td>
                        <td className="px-6 py-4 font-mono text-muted-foreground">{item.registration_number}</td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(item.created).toLocaleDateString("id-ID")}
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold">Aksi Cepat</h2>
          <Card className="border-none shadow-md bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
            <CardContent className="p-6 space-y-3">
              <Link href="/spmb-admin">
                <Button variant="outline" className="w-full justify-start h-12 text-base font-normal hover:border-primary hover:text-primary transition-all">
                  <div className="p-1.5 bg-blue-100 text-blue-600 rounded mr-3">
                    <Clock className="h-4 w-4" />
                  </div>
                  Verifikasi Pending
                </Button>
              </Link>
              <Link href="/spmb-admin/periods">
                <Button variant="outline" className="w-full justify-start h-12 text-base font-normal hover:border-primary hover:text-primary transition-all">
                  <div className="p-1.5 bg-purple-100 text-purple-600 rounded mr-3">
                    <Calendar className="h-4 w-4" />
                  </div>
                  Kelola Periode
                </Button>
              </Link>
              <Link href="/announcements">
                <Button variant="outline" className="w-full justify-start h-12 text-base font-normal hover:border-primary hover:text-primary transition-all">
                  <div className="p-1.5 bg-orange-100 text-orange-600 rounded mr-3">
                    <FileText className="h-4 w-4" />
                  </div>
                  Pengumuman
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Info Periode
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-full bg-white/20" />
                  <Skeleton className="h-4 w-32 bg-white/20" />
                </>
              ) : activePeriod ? (
                <>
                  <div className="flex justify-between items-center border-b border-white/20 pb-2">
                    <span className="text-white/80">{activePeriod.name}</span>
                    <Badge className="bg-white text-primary hover:bg-white/90">Aktif</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Kuota Terisi</span>
                      <span className="font-bold">
                        {stats?.accepted || 0}/{activePeriod.quota || 100}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white transition-all"
                        style={{
                          width: `${Math.min(((stats?.accepted || 0) / (activePeriod.quota || 100)) * 100, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-white/80 text-sm">Tidak ada periode aktif</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
