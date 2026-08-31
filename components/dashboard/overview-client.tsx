"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Database,
  HardDrive,
  Info,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { SPMBStatusBadge } from "@/components/spmb/status-badge";

const RegistrationTrendChart = dynamic(
  () => import("@/components/dashboard/charts").then((mod) => ({ default: mod.RegistrationTrendChart })),
  { ssr: false }
);

const StatusDistributionChart = dynamic(
  () => import("@/components/dashboard/charts").then((mod) => ({ default: mod.StatusDistributionChart })),
  { ssr: false }
);

interface OverviewStats {
  pending: number;
  verified: number;
  accepted: number;
  rejected: number;
  total: number;
}

interface ModuleStats {
  perpustakaan: {
    totalBooks: number;
    activeLoans: number;
    overdueLoans: number;
  };
  inventaris: {
    totalAssets: number;
    totalRooms: number;
    needsMaintenance: number;
  };
  tabungan: {
    totalSaldo: number;
    totalStudents: number;
    todayTransactions: number;
    pendingSetoran?: number;
  };
}

interface RegistrationTrendPoint {
  date: string;
  count: number;
}

interface Registrant {
  id: string;
  fullName: string;
  registrationNumber: string;
  created?: string;
  createdAt?: number | string;
  status: string;
}

interface ActivePeriod {
  name: string;
  quota: number;
  registered?: number;
}

interface ServerHealth {
  database?: {
    status: string;
    formatted_size: string;
  };
  system?: {
    uptime_seconds: number;
    memory_usage_mb: number;
  };
  backup?: {
    last_backup: string | number | null;
  };
}

interface OverviewClientProps {
  stats: OverviewStats;
  moduleStats: ModuleStats;
  totalActiveStudents?: number;
  presensiHariIni?: number;
  registrationTrend?: RegistrationTrendPoint[];
  recentRegistrants: Registrant[];
  activePeriod: ActivePeriod | null;
  serverHealth: ServerHealth;
  userName?: string;
}

const accentClasses: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300",
};

function formatTrendDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function formatDateValue(value?: string | number) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID");
}

function buildFallbackTrend() {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return { date: date.toISOString().split("T")[0], count: 0 };
  });
}

function getGreeting(date: Date) {
  const h = date.getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

export function OverviewClient({
  stats,
  moduleStats,
  totalActiveStudents = 0,
  presensiHariIni = 0,
  registrationTrend = [],
  recentRegistrants = [],
  activePeriod = null,
  serverHealth,
  userName = "Administrator",
}: OverviewClientProps) {
  const safeStats = stats || { pending: 0, verified: 0, accepted: 0, rejected: 0, total: 0 };
  const perpus = moduleStats?.perpustakaan || { totalBooks: 0, activeLoans: 0, overdueLoans: 0 };
  const inventaris = moduleStats?.inventaris || { totalAssets: 0, totalRooms: 0, needsMaintenance: 0 };
  const tabungan = moduleStats?.tabungan || { totalSaldo: 0, totalStudents: 0, todayTransactions: 0, pendingSetoran: 0 };

  const now = new Date();
  const quota = activePeriod?.quota || 100;
  const filledQuota = safeStats.accepted || 0;

  const trendData = (registrationTrend.length > 0 ? registrationTrend : buildFallbackTrend()).map((item) => ({
    date: formatTrendDate(item.date),
    count: item.count || 0,
  }));

  const statusData = [
    { name: "Pending", value: safeStats.pending || 0, color: "#f59e0b" },
    { name: "Terverifikasi", value: safeStats.verified || 0, color: "#3b82f6" },
    { name: "Diterima", value: safeStats.accepted || 0, color: "#22c55e" },
    { name: "Ditolak", value: safeStats.rejected || 0, color: "#ef4444" },
  ].filter((item) => item.value > 0);

  // ── KPI: satu pola tile untuk semua stat inti ──
  const kpiTiles = [
    {
      title: "Siswa Aktif",
      value: totalActiveStudents,
      hint: `${presensiHariIni} hadir hari ini`,
      icon: Users,
      accent: "blue",
      link: "/admin/siswa",
    },
    {
      title: "Pendaftar SPMB",
      value: safeStats.total,
      hint: (safeStats.pending || 0) > 0 ? `${safeStats.pending} menunggu verifikasi` : "Tidak ada pending",
      icon: ClipboardCheck,
      accent: "purple",
      link: "/admin/siswa?tab=spmb",
    },
    {
      title: "Buku Dipinjam",
      value: perpus.activeLoans,
      hint: (perpus.overdueLoans || 0) > 0 ? `${perpus.overdueLoans} terlambat` : `${perpus.totalBooks} eksemplar tersedia`,
      icon: BookOpen,
      accent: "amber",
      link: "/perpustakaan/peminjaman",
    },
    {
      title: "Saldo Tabungan",
      value: formatCurrency(tabungan.totalSaldo || 0),
      hint: `${tabungan.totalStudents} penabung aktif`,
      icon: Wallet,
      accent: "emerald",
      link: "/tabungan",
    },
  ];

  // ── Panel "Perlu Tindakan": item nyata, hanya yang > 0 ──
  const actionItems = [
    (safeStats.pending || 0) > 0 && {
      id: "spmb",
      label: "Verifikasi SPMB",
      detail: `${safeStats.pending} pendaftar menunggu verifikasi`,
      icon: ClipboardCheck,
      color: "text-purple-500",
      href: "/admin/siswa?tab=spmb",
    },
    (perpus.overdueLoans || 0) > 0 && {
      id: "overdue",
      label: "Buku Terlambat",
      detail: `${perpus.overdueLoans} peminjaman melewati jatuh tempo`,
      icon: Clock,
      color: "text-amber-500",
      href: "/perpustakaan/peminjaman?filter=overdue",
    },
    (tabungan.pendingSetoran || 0) > 0 && {
      id: "setoran",
      label: "Verifikasi Setoran",
      detail: `${tabungan.pendingSetoran} setoran uang menunggu persetujuan bendahara`,
      icon: Wallet,
      color: "text-emerald-500",
      href: "/tabungan/setoran",
    },
    (inventaris.needsMaintenance || 0) > 0 && {
      id: "maintenance",
      label: "Aset Perlu Perbaikan",
      detail: `${inventaris.needsMaintenance} aset butuh perawatan`,
      icon: AlertTriangle,
      color: "text-amber-500",
      href: "/inventaris",
    },
  ].filter(Boolean) as Array<{
    id: string;
    label: string;
    detail: string;
    icon: typeof Activity;
    color: string;
    href: string;
  }>;

  return (
    <div className="w-full min-w-0 space-y-5 sm:space-y-6 lg:space-y-8">
      {/* ── Header: salam, tanggal, periode SPMB ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {getGreeting(now)}, {userName}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}{" "}
            &middot; Ringkasan operasional sekolah hari ini.
          </p>
        </div>
        {activePeriod && (
          <Badge variant="secondary" className="w-fit shrink-0">
            <Calendar className="mr-1 h-3.5 w-3.5" />
            {activePeriod.name}
          </Badge>
        )}
      </div>

      {/* ── KPI: 4 tile seragam ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
        {kpiTiles.map((tile) => (
          <Link key={tile.title} href={tile.link} className="block">
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/20">
              <CardContent className="flex h-full flex-col gap-3 p-4 sm:p-5">
                <div className={`w-fit rounded-md p-2 ${accentClasses[tile.accent] || accentClasses.blue}`}>
                  <tile.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-2xl font-bold sm:text-3xl">{tile.value}</p>
                  <p className="mt-0.5 text-sm font-medium">{tile.title}</p>
                </div>
                <p className="mt-auto truncate text-xs text-muted-foreground">{tile.hint}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Panel Perlu Tindakan ── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold sm:mb-4 sm:text-xl">
          <Activity className="h-5 w-5 text-primary" />
          Perlu Tindakan
        </h2>
        <Card>
          <CardContent className="p-4 sm:p-5">
            {actionItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-sm font-medium">Tidak ada tugas tertunda. Semua beres hari ini.</p>
              </div>
            ) : (
              <div className="divide-y">
                {actionItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center gap-4 py-3 transition-colors first:pt-0 last:pb-0 hover:bg-muted/30 sm:px-2 sm:py-3.5"
                  >
                    <div className={`rounded-md bg-muted p-2 ${item.color}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <Badge variant="destructive" className="shrink-0">
                      Tindakan
                    </Badge>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Grafik SPMB ── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold sm:mb-4 sm:text-xl">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Statistik SPMB
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="lg:col-span-2">
            <RegistrationTrendChart data={trendData} />
          </div>
          <StatusDistributionChart data={statusData} />
        </div>
      </section>

      {/* ── Dua kolom: pendaftar terbaru + periode/aksi ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold sm:text-xl">Pendaftar Terbaru</h2>
            <Button asChild variant="ghost" className="w-fit text-primary hover:text-primary/80">
              <Link href="/admin/siswa?tab=spmb">
                Lihat Semua <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Nama Siswa</th>
                    <th className="px-4 py-3">Nomor</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentRegistrants.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        Belum ada pendaftar
                      </td>
                    </tr>
                  ) : (
                    recentRegistrants.map((item) => (
                      <tr key={item.id || item.registrationNumber} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{item.fullName}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{item.registrationNumber}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDateValue(item.createdAt ?? item.created)}</td>
                        <td className="px-4 py-3"><SPMBStatusBadge status={item.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Periode SPMB & kuota — dari bawah naik ke sini */}
          <Card className="border-primary/20 bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-5 w-5" />
                Periode SPMB
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activePeriod ? (
                <>
                  <div className="flex items-center justify-between border-b border-white/20 pb-2">
                    <span className="text-sm text-white/80">{activePeriod.name}</span>
                    <Badge className="bg-white text-primary hover:bg-white/90">Aktif</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Kuota Terisi</span>
                      <span className="font-bold">
                        {filledQuota}/{quota}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-black/20">
                      <div
                        className="h-full bg-white transition-all"
                        style={{ width: `${Math.min((filledQuota / quota) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-white/80">Tidak ada periode aktif</p>
              )}
            </CardContent>
          </Card>

          {/* Aksi Cepat */}
          <section>
            <h2 className="mb-3 text-lg font-bold sm:mb-4 sm:text-xl">Aksi Cepat</h2>
            <Card>
              <CardContent className="grid grid-cols-2 gap-2 p-3 sm:p-4">
                {[
                  { label: "Verifikasi SPMB", icon: Clock, href: "/admin/siswa?tab=spmb", color: "bg-purple-100 text-purple-600", badge: safeStats.pending || 0 },
                  { label: "Kelola Periode", icon: Calendar, href: "/admin/siswa?tab=spmb&sub=periods", color: "bg-blue-100 text-blue-600" },
                  { label: "Peminjaman Buku", icon: BookOpen, href: "/perpustakaan/peminjaman", color: "bg-amber-100 text-amber-600" },
                  { label: "Transaksi Tabungan", icon: Wallet, href: "/kiosk-kelas", color: "bg-emerald-100 text-emerald-600" },
                ].map((action) => (
                  <Button
                    key={action.label}
                    asChild
                    variant="outline"
                    className="relative h-auto min-h-24 flex-col gap-2 whitespace-normal px-2 py-3 text-center text-xs font-normal"
                  >
                    <Link href={action.href}>
                      <span className={`rounded-md p-2 ${action.color}`}>
                        <action.icon className="h-4 w-4" />
                      </span>
                      {action.label}
                      {action.badge !== undefined && action.badge > 0 && (
                        <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center p-0 text-[10px]">
                          {action.badge}
                        </Badge>
                      )}
                    </Link>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      {/* ── Status sistem: satu strip tenang di bawah ── */}
      <SystemHealthStrip health={serverHealth} />
    </div>
  );
}

function SystemHealthStrip({ health }: { health: ServerHealth }) {
  if (!health) return null;

  const isHealthy = health.database?.status === "Online";
  const lastBackup = health.backup?.last_backup ? formatDateValue(health.backup.last_backup) : "—";

  return (
    <div className="flex flex-col items-start justify-between gap-2 rounded-lg border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center">
      <span className="flex items-center gap-1.5">
        <Activity className={`h-3.5 w-3.5 ${isHealthy ? "text-emerald-500" : "text-amber-500"}`} />
        Sistem {isHealthy ? "sehat" : "perlu dicek"} &middot; Uptime{" "}
        {health.system?.uptime_seconds ? (health.system.uptime_seconds / 3600).toFixed(1) : "0"} jam
      </span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5" />
          DB {health.database?.formatted_size || "N/A"}
        </span>
        <span className="flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5" />
          RAM {(health.system?.memory_usage_mb || 0).toFixed(1)} MB
        </span>
        <span>Backup: {lastBackup}</span>
      </span>
    </div>
  );
}
