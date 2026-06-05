"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookMarked,
  BookOpen,
  Boxes,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Info,
  Package,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/utils";
import { SPMBStatusBadge } from "@/components/spmb/status-badge";

const RegistrationTrendChart = dynamic(
  () => import("@/components/dashboard/charts").then((mod) => ({ default: mod.RegistrationTrendChart })),
  {
    loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[250px] w-full" /></CardContent></Card>,
    ssr: false,
  }
);

const StatusDistributionChart = dynamic(
  () => import("@/components/dashboard/charts").then((mod) => ({ default: mod.StatusDistributionChart })),
  {
    loading: () => <Card><CardContent className="p-6"><Skeleton className="h-[250px] w-full" /></CardContent></Card>,
    ssr: false,
  }
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
  registrationTrend?: RegistrationTrendPoint[];
  recentRegistrants: Registrant[];
  activePeriod: ActivePeriod | null;
  serverHealth: ServerHealth;
}

const emptyStats: OverviewStats = {
  pending: 0,
  verified: 0,
  accepted: 0,
  rejected: 0,
  total: 0,
};

const emptyModuleStats: ModuleStats = {
  perpustakaan: { totalBooks: 0, activeLoans: 0, overdueLoans: 0 },
  inventaris: { totalAssets: 0, totalRooms: 0, needsMaintenance: 0 },
  tabungan: { totalSaldo: 0, totalStudents: 0, todayTransactions: 0 },
};

const accentClasses: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
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

export function OverviewClient({
  stats,
  moduleStats,
  registrationTrend = [],
  recentRegistrants = [],
  activePeriod = null,
  serverHealth,
}: OverviewClientProps) {
  const safeStats = stats || emptyStats;
  const safeModuleStats = moduleStats || emptyModuleStats;
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

  const moduleCards = [
    {
      title: "Perpustakaan",
      icon: BookOpen,
      accent: "blue",
      link: "/perpustakaan",
      items: [
        { label: "Total Buku", value: safeModuleStats.perpustakaan?.totalBooks || 0 },
        { label: "Dipinjam", value: safeModuleStats.perpustakaan?.activeLoans || 0 },
        { label: "Terlambat", value: safeModuleStats.perpustakaan?.overdueLoans || 0, alert: (safeModuleStats.perpustakaan?.overdueLoans || 0) > 0 },
      ],
    },
    {
      title: "Inventaris",
      icon: Package,
      accent: "amber",
      link: "/inventaris",
      items: [
        { label: "Total Aset", value: safeModuleStats.inventaris?.totalAssets || 0 },
        { label: "Ruangan", value: safeModuleStats.inventaris?.totalRooms || 0 },
        { label: "Perlu Perbaikan", value: safeModuleStats.inventaris?.needsMaintenance || 0, alert: (safeModuleStats.inventaris?.needsMaintenance || 0) > 0 },
      ],
    },
    {
      title: "Tabungan",
      icon: Wallet,
      accent: "emerald",
      link: "/tabungan",
      items: [
        { label: "Total Saldo", value: formatCurrency(safeModuleStats.tabungan?.totalSaldo || 0) },
        { label: "Siswa", value: safeModuleStats.tabungan?.totalStudents || 0 },
        { label: "Transaksi Hari Ini", value: safeModuleStats.tabungan?.todayTransactions || 0 },
      ],
    },
  ];

  const spmbCards = [
    { title: "Total Pendaftar", value: safeStats.total || 0, description: "Total keseluruhan pendaftar", icon: Users, accent: "blue" },
    { title: "Menunggu Verifikasi", value: safeStats.pending || 0, description: "Memerlukan tindakan segera", icon: Clock, accent: "amber" },
    { title: "Verifikasi & Diterima", value: (safeStats.verified || 0) + (safeStats.accepted || 0), description: "Proses lanjut atau diterima", icon: UserCheck, accent: "emerald" },
  ];

  const quickActions = [
    { label: "Verifikasi SPMB", icon: Clock, href: "/spmb-admin", color: "bg-blue-100 text-blue-600", badge: safeStats.pending || 0 },
    { label: "Kelola Periode", icon: Calendar, href: "/spmb-admin/periods", color: "bg-purple-100 text-purple-600" },
    { label: "Peminjaman Buku", icon: BookMarked, href: "/perpustakaan/peminjaman", color: "bg-indigo-100 text-indigo-600" },
    { label: "Stock Opname", icon: Boxes, href: "/inventaris/opname", color: "bg-amber-100 text-amber-600" },
    { label: "Transaksi Tabungan", icon: DollarSign, href: "/tabungan/scan", color: "bg-emerald-100 text-emerald-600" },
    { label: "Pengumuman", icon: Bell, href: "/announcements", color: "bg-red-100 text-red-600" },
  ];

  const recentActivities = [
    safeModuleStats.perpustakaan?.activeLoans > 0 && {
      id: "library",
      title: "Peminjaman Buku Aktif",
      description: `${safeModuleStats.perpustakaan.activeLoans} buku sedang dipinjam`,
      time: "Hari ini",
      icon: BookOpen,
      color: "text-blue-500",
    },
    safeModuleStats.inventaris?.needsMaintenance > 0 && {
      id: "inventory",
      title: "Aset Perlu Perbaikan",
      description: `${safeModuleStats.inventaris.needsMaintenance} aset butuh perhatian`,
      time: "Perlu tindakan",
      icon: AlertTriangle,
      color: "text-amber-500",
    },
    safeModuleStats.tabungan?.todayTransactions > 0 && {
      id: "savings",
      title: "Transaksi Hari Ini",
      description: `${safeModuleStats.tabungan.todayTransactions} transaksi tabungan`,
      time: "Hari ini",
      icon: Wallet,
      color: "text-emerald-500",
    },
    safeStats.pending > 0 && {
      id: "spmb",
      title: "Pendaftar Baru",
      description: `${safeStats.pending} menunggu verifikasi`,
      time: "Perlu tindakan",
      icon: Users,
      color: "text-purple-500",
    },
  ].filter(Boolean) as Array<{
    id: string;
    title: string;
    description: string;
    time: string;
    icon: typeof Activity;
    color: string;
  }>;

  return (
    <div className="w-full min-w-0 space-y-5 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Beranda</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Ringkasan operasional sekolah, layanan administrasi, dan kondisi sistem hari ini.
          </p>
        </div>
        {activePeriod && (
          <Badge variant="secondary" className="w-fit">
            Periode aktif: {activePeriod.name}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {moduleCards.map((card) => (
          <Link key={card.title} href={card.link} className="block">
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/20">
              <CardHeader className="space-y-2 pb-3">
                <CardTitle className="flex items-center gap-3 text-base sm:text-lg">
                  <span className={`rounded-md p-2 ${accentClasses[card.accent] || accentClasses.blue}`}>
                    <card.icon className="h-5 w-5" />
                  </span>
                  {card.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">Ringkasan data {card.title.toLowerCase()} terkini</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {card.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className={`text-sm font-semibold ${"alert" in item && item.alert ? "text-destructive" : ""}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1 text-xs font-medium text-primary">
                  Buka Menu <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold sm:mb-4 sm:text-xl">
          <Users className="h-5 w-5 text-primary" />
          Statistik SPMB
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {spmbCards.map((card) => (
            <Card key={card.title}>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-md p-2 ${accentClasses[card.accent] || accentClasses.blue}`}>
                    <card.icon className="h-5 w-5" />
                  </span>
                  <span className="text-3xl font-bold">{card.value}</span>
                </div>
                <div>
                  <h3 className="font-semibold">{card.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2">
          <RegistrationTrendChart data={trendData} />
        </div>
        <StatusDistributionChart data={statusData} />
      </div>

      <ServerHealthDisplay health={serverHealth} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold sm:text-xl">Pendaftar Terbaru</h2>
            <Button asChild variant="ghost" className="w-fit text-primary hover:text-primary/80">
              <Link href="/spmb-admin">
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
          <section>
            <h2 className="mb-3 text-lg font-bold sm:mb-4 sm:text-xl">Aksi Cepat</h2>
            <Card>
              <CardContent className="grid grid-cols-2 gap-2 p-3 sm:p-4">
                {quickActions.map((action) => (
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

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold sm:mb-4 sm:text-xl">
              <Activity className="h-5 w-5" />
              Aktivitas Terkini
            </h2>
            <Card>
              <CardContent className="p-4">
                <ScrollArea className="h-[200px]">
                  {recentActivities.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                      <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
                      <p className="text-sm">Semua berjalan lancar.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentActivities.map((activity) => (
                        <div key={activity.id} className="flex gap-3 rounded-md p-2 transition-colors hover:bg-muted/50">
                          <div className={`rounded-md bg-muted p-2 ${activity.color}`}>
                            <activity.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{activity.title}</p>
                            <p className="text-xs text-muted-foreground">{activity.description}</p>
                          </div>
                          <span className="whitespace-nowrap text-xs text-muted-foreground">{activity.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </section>

          <Card className="border-primary/20 bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-5 w-5" />
                Info Periode SPMB
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
                      <span className="font-bold">{filledQuota}/{quota}</span>
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
        </div>
      </div>
    </div>
  );
}

function ServerHealthDisplay({ health }: { health: ServerHealth }) {
  if (!health) return null;

  const isHealthy = health.database?.status === "Online";
  const lastBackup = health.backup?.last_backup ? formatDateValue(health.backup.last_backup) : "Belum ada";

  return (
    <Card className="border-zinc-800 bg-zinc-900 text-white">
      <CardContent className="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className={`rounded-full p-2.5 ${isHealthy ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
            <Activity className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold sm:text-lg">Status Sistem: {isHealthy ? "Sehat" : "Perlu Cek"}</h3>
            <p className="text-sm text-zinc-400">
              Uptime: {health.system?.uptime_seconds ? (health.system.uptime_seconds / 3600).toFixed(1) : "0"} jam
            </p>
          </div>
        </div>

        <div className="grid w-full grid-cols-3 gap-3 text-xs sm:text-sm md:w-auto md:gap-8">
          <div>
            <p className="text-zinc-400">Database</p>
            <p className="font-mono font-bold">{health.database?.formatted_size || "N/A"}</p>
          </div>
          <div>
            <p className="text-zinc-400">RAM</p>
            <p className="font-mono font-bold">{(health.system?.memory_usage_mb || 0).toFixed(1)} MB</p>
          </div>
          <div>
            <p className="text-zinc-400">Backup</p>
            <p className="font-mono font-bold">{lastBackup}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
