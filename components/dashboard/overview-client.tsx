"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { formatClassName } from "@/lib/class-utils";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
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
  activeMale?: number;
  activeFemale?: number;
  studentsByClass?: Array<{ className?: string; count: number }>;
  presensiHariIni?: number;
  registrationTrend?: RegistrationTrendPoint[];
  recentRegistrants: Registrant[];
  activePeriod: ActivePeriod | null;
  serverHealth: ServerHealth;
  userName?: string;
}

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
  activeMale = 0,
  activeFemale = 0,
  studentsByClass = [],
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
  const quotaPercent = Math.min(Math.round((filledQuota / Math.max(quota, 1)) * 100), 100);
  const firstName = userName.split(" ")[0] || userName;

  const trendData = (registrationTrend.length > 0 ? registrationTrend : buildFallbackTrend()).map((item) => ({
    date: formatTrendDate(item.date),
    count: item.count || 0,
  }));

  const statusData = [
    { name: "Pending", value: safeStats.pending || 0, color: "#B45309" },
    { name: "Terverifikasi", value: safeStats.verified || 0, color: "#1D4ED8" },
    { name: "Diterima", value: safeStats.accepted || 0, color: "#166534" },
    { name: "Ditolak", value: safeStats.rejected || 0, color: "#B91C1C" },
  ].filter((item) => item.value > 0);

  const kpiTiles = [
    {
      title: "Siswa Aktif",
      value: totalActiveStudents.toLocaleString("id-ID"),
      hint: `${presensiHariIni} hadir hari ini`,
      icon: Users,
      link: "/admin/siswa",
    },
    {
      title: "Pendaftar SPMB",
      value: safeStats.total.toLocaleString("id-ID"),
      hint: (safeStats.pending || 0) > 0 ? `${safeStats.pending} menunggu verifikasi` : "Tidak ada pending",
      icon: ClipboardCheck,
      link: "/admin/siswa?tab=spmb",
    },
    {
      title: "Buku Dipinjam",
      value: perpus.activeLoans.toLocaleString("id-ID"),
      hint: (perpus.overdueLoans || 0) > 0 ? `${perpus.overdueLoans} terlambat` : `${perpus.totalBooks} eksemplar tersedia`,
      icon: BookOpen,
      link: "/perpustakaan/peminjaman",
    },
    {
      title: "Saldo Tabungan",
      value: formatCurrency(tabungan.totalSaldo || 0),
      hint: `${tabungan.totalStudents} penabung aktif`,
      icon: Wallet,
      link: "/tabungan",
    },
  ];

  const actionItems = [
    (safeStats.pending || 0) > 0 && {
      id: "spmb",
      label: "Verifikasi SPMB",
      detail: `${safeStats.pending} pendaftar menunggu verifikasi`,
      icon: ClipboardCheck,
      href: "/admin/siswa?tab=spmb",
    },
    (perpus.overdueLoans || 0) > 0 && {
      id: "overdue",
      label: "Buku Terlambat",
      detail: `${perpus.overdueLoans} peminjaman melewati jatuh tempo`,
      icon: Clock,
      href: "/perpustakaan/peminjaman?filter=overdue",
    },
    (tabungan.pendingSetoran || 0) > 0 && {
      id: "setoran",
      label: "Verifikasi Setoran",
      detail: `${tabungan.pendingSetoran} setoran menunggu persetujuan`,
      icon: Wallet,
      href: "/tabungan/setoran",
    },
    (inventaris.needsMaintenance || 0) > 0 && {
      id: "maintenance",
      label: "Aset Perlu Perbaikan",
      detail: `${inventaris.needsMaintenance} aset butuh perawatan`,
      icon: AlertTriangle,
      href: "/inventaris",
    },
  ].filter(Boolean) as Array<{
    id: string;
    label: string;
    detail: string;
    icon: typeof Activity;
    href: string;
  }>;

  const genderTotal = Math.max(activeMale + activeFemale, 1);
  const malePercent = Math.round((activeMale / genderTotal) * 100);
  const femalePercent = 100 - malePercent;
  const topClasses = [...studentsByClass]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader
        eyebrow={now.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        title={`${getGreeting(now)}, ${firstName}`}
        description="Ringkasan operasional sekolah hari ini. Pantau antrean, siswa, dan layanan dalam satu tampilan."
        actions={
          activePeriod ? (
            <Badge variant="outline" className="h-8 gap-1.5 px-3 text-xs">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {activePeriod.name}
            </Badge>
          ) : undefined
        }
      />

      {/* ── KPI strip: satu permukaan, bukan empat kartu terpisah ── */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-line/60 lg:grid-cols-4">
          {kpiTiles.map((tile) => (
            <Link
              key={tile.title}
              href={tile.link}
              className="group flex min-h-[132px] flex-col justify-between bg-card p-4 transition-colors hover:bg-surface-muted/60 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-soft">
                    {tile.title}
                  </p>
                  <p className="mt-2 truncate text-xl font-bold tabular-nums text-foreground sm:text-2xl lg:text-[1.7rem]">
                    {tile.value}
                  </p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <tile.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="truncate text-xs text-muted-foreground">{tile.hint}</p>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-12">
        {/* ── Antrean tindakan ── */}
        <Card className="flex flex-col xl:col-span-7">
          <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-line/60 pb-4">
            <div>
              <CardTitle className="text-base font-semibold">Perlu tindakan</CardTitle>
              <CardDescription className="mt-1">
                Pekerjaan yang menunggu perhatian hari ini.
              </CardDescription>
            </div>
            {actionItems.length > 0 && (
              <Badge variant="secondary" className="shrink-0">
                {actionItems.length} item
              </Badge>
            )}
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">
            {actionItems.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-foreground">Semua beres hari ini.</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Tidak ada antrean verifikasi atau perawatan yang tertunda.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line/60">
                {actionItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-muted/50 sm:px-5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-primary">
                        <item.icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Demografi siswa ── */}
        <Card className="xl:col-span-5">
          <CardHeader className="border-b border-line/60 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">Siswa aktif</CardTitle>
                <CardDescription className="mt-1">Komposisi dan sebaran per kelas.</CardDescription>
              </div>
              <span className="text-right">
                <span className="block text-2xl font-bold tabular-nums text-foreground">
                  {totalActiveStudents.toLocaleString("id-ID")}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-text-soft">total</span>
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div>
              <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full bg-primary transition-[width] duration-500"
                  style={{ width: `${malePercent}%` }}
                  title={`Laki-laki ${activeMale}`}
                />
                <div
                  className="h-full bg-accent transition-[width] duration-500"
                  style={{ width: `${femalePercent}%` }}
                  title={`Perempuan ${activeFemale}`}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-muted-foreground">Laki-laki</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {activeMale} <span className="font-normal text-text-soft">({malePercent}%)</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-muted-foreground">Perempuan</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {activeFemale} <span className="font-normal text-text-soft">({femalePercent}%)</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {topClasses.length > 0 && (
              <div className="border-t border-line/60 pt-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-soft">
                  Sebaran kelas
                </p>
                <ul className="space-y-2">
                  {topClasses.map((cls) => {
                    const width = Math.max((cls.count / Math.max(topClasses[0].count, 1)) * 100, 8);
                    return (
                      <li key={cls.className || "tanpa-kelas"} className="flex items-center gap-3 text-xs">
                        <span className="w-20 shrink-0 truncate font-medium text-foreground">
                          {formatClassName(cls.className || "")}
                        </span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                          <span className="block h-full rounded-full bg-primary/70" style={{ width: `${width}%` }} />
                        </span>
                        <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
                          {cls.count}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Statistik SPMB ── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-line/60 pb-4">
          <div>
            <CardTitle className="text-base font-semibold">Penerimaan siswa baru</CardTitle>
            <CardDescription className="mt-1">
              Tren pendaftaran tujuh hari terakhir dan distribusi status.
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">
            {activePeriod ? "Periode aktif" : "Belum ada periode"}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-6 pt-5 lg:grid-cols-[1.55fr_1fr]">
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-soft">
              Pendaftar per hari
            </p>
            <RegistrationTrendChart data={trendData} />
          </div>
          <div className="min-w-0 border-t border-line/60 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-soft">
              Distribusi status
            </p>
            <StatusDistributionChart data={statusData} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-12">
        {/* ── Pendaftar terbaru ── */}
        <Card className="xl:col-span-8">
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-line/60 pb-4">
            <div>
              <CardTitle className="text-base font-semibold">Pendaftar terbaru</CardTitle>
              <CardDescription className="mt-1">Pendaftaran SPMB yang terakhir masuk.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link href="/admin/siswa?tab=spmb">
                Lihat semua <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentRegistrants.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">Belum ada pendaftar</p>
                <p className="text-xs text-muted-foreground">Pendaftar baru akan muncul di sini.</p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-line/60 md:hidden">
                  {recentRegistrants.map((item) => (
                    <li key={item.id || item.registrationNumber} className="space-y-2 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.fullName}</p>
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {item.registrationNumber}
                          </p>
                        </div>
                        <SPMBStatusBadge status={item.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateValue(item.createdAt ?? item.created)}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-muted/60 text-[11px] uppercase tracking-wider text-text-soft">
                      <tr>
                        <th scope="col" className="px-5 py-3 font-semibold">Nama siswa</th>
                        <th scope="col" className="px-5 py-3 font-semibold">Nomor</th>
                        <th scope="col" className="px-5 py-3 font-semibold">Tanggal</th>
                        <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {recentRegistrants.map((item) => (
                        <tr key={item.id || item.registrationNumber} className="transition-colors hover:bg-surface-muted/30">
                          <td className="px-5 py-3 font-medium">{item.fullName}</td>
                          <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{item.registrationNumber}</td>
                          <td className="px-5 py-3 text-muted-foreground">{formatDateValue(item.createdAt ?? item.created)}</td>
                          <td className="px-5 py-3"><SPMBStatusBadge status={item.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Kuota SPMB ── */}
        <Card className="border-primary/20 bg-primary text-primary-foreground xl:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-[18px] w-[18px]" aria-hidden="true" />
              Kuota SPMB
            </CardTitle>
            <CardDescription className="text-primary-foreground/70">
              {activePeriod ? activePeriod.name : "Tidak ada periode aktif"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {activePeriod ? (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-3xl font-bold tabular-nums">{filledQuota}</p>
                    <p className="text-xs text-primary-foreground/70">dari {quota} kuota terisi</p>
                  </div>
                  <Badge className="border-0 bg-white/15 text-white hover:bg-white/20">
                    {quotaPercent}%
                  </Badge>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/20">
                  <div
                    className="h-full rounded-full bg-secondary transition-[width] duration-500"
                    style={{ width: `${quotaPercent}%` }}
                  />
                </div>
                <Button asChild variant="secondary" size="sm" className="w-full">
                  <Link href="/admin/siswa?tab=spmb">
                    Kelola pendaftaran <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-primary-foreground/75">
                Aktifkan periode SPMB untuk mulai menerima pendaftaran dan memantau kuota.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <SystemHealthStrip health={serverHealth} />
    </div>
  );
}

function SystemHealthStrip({ health }: { health: ServerHealth }) {
  if (!health) return null;

  const isHealthy = health.database?.status === "Online";
  const lastBackup = health.backup?.last_backup ? formatDateValue(health.backup.last_backup) : "—";

  return (
    <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-line/60 bg-surface/70 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center">
      <span className="flex items-center gap-2">
        <span className={isHealthy ? "h-2 w-2 rounded-full bg-success" : "h-2 w-2 rounded-full bg-warning"} aria-hidden="true" />
        Sistem {isHealthy ? "sehat" : "perlu dicek"} &middot; Uptime{" "}
        {health.system?.uptime_seconds ? (health.system.uptime_seconds / 3600).toFixed(1) : "0"} jam
      </span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5" aria-hidden="true" />
          DB {health.database?.formatted_size || "N/A"}
        </span>
        <span className="flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
          RAM {(health.system?.memory_usage_mb || 0).toFixed(1)} MB
        </span>
        <span>Backup: {lastBackup}</span>
      </span>
    </div>
  );
}
